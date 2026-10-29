import type { CreateSurplusInput, SurplusOfferView } from '@golden-hour/shared';
import { AppError } from '../../lib/errors';
import { withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { HospitalModel } from '../hospitals/hospital.model';
import { SurplusOfferModel, type SurplusOfferDocument } from './surplus.model';

const MAX_OPEN_OFFERS_PER_FACILITY = 8;

function requireStaff(user: AuthUser): string {
  if (user.role !== 'hospital_staff' || !user.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff manage surplus units.');
  return user.facilityId;
}

async function toViews(offers: SurplusOfferDocument[], viewer: AuthUser): Promise<SurplusOfferView[]> {
  const facilities = await HospitalModel.find({ _id: { $in: offers.map((o) => o.facilityId) } }).select('name district');
  const byId = new Map(facilities.map((f) => [f._id.toString(), f]));
  return offers.flatMap((o) => {
    const f = byId.get(o.facilityId.toString());
    if (!f) return [];
    return [
      {
        id: o._id.toString(),
        facility: { id: f._id.toString(), name: f.name, district: f.district },
        bloodGroup: o.bloodGroup,
        units: o.units,
        note: o.note ?? null,
        availableUntil: o.availableUntil.toISOString(),
        own: o.facilityId.toString() === viewer.facilityId,
        createdAt: (o.get('createdAt') as Date).toISOString(),
      },
    ];
  });
}

/** Open, unexpired offers from verified facilities. Staff of any facility can see them; no one else can. */
export async function listSurplus(viewer: AuthUser): Promise<SurplusOfferView[]> {
  requireStaff(viewer);
  const verified = await HospitalModel.find({ verificationStatus: 'verified' }).distinct('_id');
  const offers = await SurplusOfferModel.find({ facilityId: { $in: verified }, withdrawnAt: null, availableUntil: { $gt: new Date() } })
    .sort({ availableUntil: 1 })
    .limit(100);
  return toViews(offers, viewer);
}

export async function createSurplus(input: CreateSurplusInput, ctx: ActionContext): Promise<SurplusOfferView> {
  const facilityId = requireStaff(ctx.user);
  const facility = await HospitalModel.findById(facilityId);
  if (facility?.verificationStatus !== 'verified') throw new AppError('FORBIDDEN', 'Your facility must be verified to share surplus units.');
  const open = await SurplusOfferModel.countDocuments({ facilityId, withdrawnAt: null, availableUntil: { $gt: new Date() } });
  if (open >= MAX_OPEN_OFFERS_PER_FACILITY) throw new AppError('CONFLICT', 'Withdraw an existing offer before adding another.');

  const offer = await withTransaction(async (session) => {
    const [created] = await SurplusOfferModel.create(
      [
        {
          facilityId,
          bloodGroup: input.bloodGroup,
          units: input.units,
          note: input.note || null,
          availableUntil: new Date(Date.now() + input.validHours * 3_600_000),
          createdBy: ctx.user.id,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'surplus.offered',
        resourceType: 'hospital',
        resourceId: facilityId,
        facilityId,
        detail: { bloodGroup: input.bloodGroup, units: input.units, validHours: input.validHours },
        requestId: ctx.requestId,
      },
      session,
    );
    return created!;
  });
  return (await toViews([offer], ctx.user))[0]!;
}

export async function withdrawSurplus(id: string, ctx: ActionContext): Promise<void> {
  const facilityId = requireStaff(ctx.user);
  await withTransaction(async (session) => {
    const offer = await SurplusOfferModel.findOneAndUpdate({ _id: id, facilityId, withdrawnAt: null }, { $set: { withdrawnAt: new Date() } }, { new: true, session });
    if (!offer) throw new AppError('NOT_FOUND', 'Not found.');
    await recordAudit(
      { actor: userActor(ctx.user), action: 'surplus.withdrawn', resourceType: 'hospital', resourceId: facilityId, facilityId, requestId: ctx.requestId },
      session,
    );
  });
}
