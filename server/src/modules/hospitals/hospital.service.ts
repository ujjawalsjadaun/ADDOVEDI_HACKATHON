import type { z } from 'zod';
import type {
  AccessPointInput,
  CreateHospitalInput,
  HospitalAdmin,
  HospitalDecisionInput,
  HospitalPublic,
  HospitalVerificationStatus,
  listHospitalsQuerySchema,
} from '@golden-hour/shared';
import { Types } from 'mongoose';
import { AppError } from '../../lib/errors';
import { toGeoPoint } from '../../lib/geo';
import { withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import { assertFacilityScope } from '../auth/auth.policy';
import type { ActionContext } from '../auth/auth.types';
import { UserModel } from '../users/user.model';
import { toHospitalAdmin, toHospitalPublic } from './hospital.dto';
import { HospitalModel } from './hospital.model';

/** Legal facility verification transitions (docs/state-machines.md §1). */
const TRANSITIONS: Record<HospitalVerificationStatus, readonly HospitalVerificationStatus[]> = {
  pending: ['verified', 'rejected'],
  verified: ['suspended'],
  suspended: ['verified'],
  rejected: [],
};

async function staffCounts(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await UserModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { facilityId: { $in: ids } } },
    { $group: { _id: '$facilityId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.n]));
}

export async function listVerifiedHospitals(district?: string): Promise<HospitalPublic[]> {
  const filter: Record<string, unknown> = { verificationStatus: 'verified' };
  if (district) filter.district = district;
  const docs = await HospitalModel.find(filter).sort({ name: 1 }).limit(200);
  return docs.map(toHospitalPublic);
}

export async function listHospitals(
  query: z.output<typeof listHospitalsQuerySchema>,
): Promise<{ items: HospitalAdmin[]; total: number }> {
  const filter = query.verificationStatus ? { verificationStatus: query.verificationStatus } : {};
  const [docs, total] = await Promise.all([
    HospitalModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    HospitalModel.countDocuments(filter),
  ]);
  const counts = await staffCounts(docs.map((d) => d._id));
  return { items: docs.map((d) => toHospitalAdmin(d, counts.get(d._id.toString()) ?? 0)), total };
}

export async function getHospital(id: string): Promise<HospitalAdmin> {
  const doc = await HospitalModel.findById(id);
  if (!doc) throw new AppError('NOT_FOUND', 'Not found.');
  const counts = await staffCounts([doc._id]);
  return toHospitalAdmin(doc, counts.get(id) ?? 0);
}

export async function createHospital(input: CreateHospitalInput, ctx: ActionContext): Promise<HospitalAdmin> {
  const doc = await withTransaction(async (session) => {
    const [created] = await HospitalModel.create(
      [{ ...input, location: toGeoPoint(input.location), verificationStatus: 'pending' }],
      { session },
    );
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'hospital.created',
        resourceType: 'hospital',
        resourceId: created!._id,
        facilityId: created!._id,
        requestId: ctx.requestId,
      },
      session,
    );
    return created!;
  });
  return toHospitalAdmin(doc, 0);
}

export async function decideHospitalVerification(
  id: string,
  input: HospitalDecisionInput,
  ctx: ActionContext,
): Promise<HospitalAdmin> {
  const updated = await withTransaction(async (session) => {
    const current = await HospitalModel.findById(id).session(session);
    if (!current) throw new AppError('NOT_FOUND', 'Not found.');
    const from = current.verificationStatus;
    if (!TRANSITIONS[from].includes(input.decision)) {
      throw new AppError('INVALID_TRANSITION', `A ${from} facility cannot be marked ${input.decision}.`, {
        current: { verificationStatus: from },
      });
    }
    // Conditional on the status we read, so a concurrent decision cannot be overwritten.
    const doc = await HospitalModel.findOneAndUpdate(
      { _id: id, verificationStatus: from },
      {
        $set: {
          verificationStatus: input.decision,
          verification: { by: new Types.ObjectId(ctx.user.id), at: new Date(), reason: input.reason },
        },
      },
      { new: true, session },
    );
    if (!doc) throw new AppError('CONFLICT', 'This facility was just changed by someone else. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: `hospital.${input.decision}`,
        resourceType: 'hospital',
        resourceId: doc._id,
        facilityId: doc._id,
        reason: input.reason,
        changes: { verificationStatus: [from, input.decision] },
        requestId: ctx.requestId,
      },
      session,
    );
    return doc;
  });
  const counts = await staffCounts([updated._id]);
  return toHospitalAdmin(updated, counts.get(id) ?? 0);
}

/** Sets or clears the facility's ambulance-accessible point. Hospital staff (own facility), coordinators, admins. */
export async function setAccessPoint(id: string, input: AccessPointInput, ctx: ActionContext): Promise<void> {
  if (ctx.user.role === 'hospital_staff') assertFacilityScope(ctx.user, id);
  await withTransaction(async (session) => {
    const before = await HospitalModel.findById(id).session(session);
    if (!before) throw new AppError('NOT_FOUND', 'Not found.');
    await HospitalModel.updateOne(
      { _id: id },
      {
        $set: {
          ambulanceAccessPoint: input.location
            ? { location: toGeoPoint(input.location), note: input.note || null, reportedBy: new Types.ObjectId(ctx.user.id), reportedAt: new Date() }
            : null,
        },
      },
      { session },
    );
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: input.location ? 'hospital.access_point_set' : 'hospital.access_point_cleared',
        resourceType: 'hospital',
        resourceId: before._id,
        facilityId: before._id,
        detail: input.note ? { note: input.note } : undefined,
        requestId: ctx.requestId,
      },
      session,
    );
  });
}
