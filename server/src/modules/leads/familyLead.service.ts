import type {
  ConfirmFamilyLeadInput,
  CreateFamilyLeadInput,
  FamilyLeadReceipt,
  FamilyLeadStatus,
  FamilyLeadView,
  RequestDetail,
} from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { generateReference } from '../../lib/ids';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { createRequest, getRequestDetail } from '../requests/request.service';
import { UserModel } from '../users/user.model';
import { FamilyLeadModel, type FamilyLeadDocument } from './familyLead.model';

const LEAD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LEADS_PER_PHONE_PER_HOUR = 3;

/** A pending lead past its expiry is expired, whether or not anything has written that yet. */
function effectiveStatus(lead: FamilyLeadDocument, now = Date.now()): FamilyLeadStatus {
  return lead.status === 'pending' && lead.expiresAt.getTime() <= now ? 'expired' : lead.status;
}

function requireStaffOf(user: AuthUser, lead: FamilyLeadDocument) {
  if (user.role !== 'hospital_staff' || user.facilityId !== lead.hospitalId.toString()) throw new AppError('NOT_FOUND', 'Not found.');
}

// ── public submission ────────────────────────────────────────────────────────

/** Records a family's lead for a verified facility. Pending until that hospital confirms; never alerts donors. */
export async function submitFamilyLead(input: CreateFamilyLeadInput, httpRequestId: string): Promise<FamilyLeadReceipt> {
  const hospital = await HospitalModel.findOne({ _id: input.hospitalId, verificationStatus: 'verified' });
  if (!hospital) {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { hospitalId: 'choose a registered hospital' } });
  }
  const recent = await FamilyLeadModel.countDocuments({ contactPhone: input.contactPhone, createdAt: { $gte: new Date(Date.now() - 3_600_000) } });
  if (recent >= MAX_LEADS_PER_PHONE_PER_HOUR) {
    throw new AppError('RATE_LIMITED', 'Several requests were already sent from this number. Please call the hospital directly.');
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const lead = await withTransaction(async (session) => {
        const [created] = await FamilyLeadModel.create(
          [
            {
              reference: generateReference('L'),
              hospitalId: hospital._id,
              contactName: input.contactName,
              contactPhone: input.contactPhone,
              bloodGroup: input.bloodGroup ?? null,
              note: input.note || null,
              expiresAt: new Date(Date.now() + LEAD_TTL_MS),
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: { type: 'system' },
            action: 'lead.submitted',
            resourceType: 'familyLead',
            resourceId: created!._id,
            facilityId: hospital._id,
            detail: { reference: created!.reference },
            requestId: httpRequestId,
          },
          session,
        );
        return created!;
      });
      return { reference: lead.reference, status: 'pending', facilityName: hospital.name };
    } catch (err) {
      if (isDuplicateKeyError(err)) continue; // reference collision: try a new one
      throw err;
    }
  }
  throw new AppError('INTERNAL', 'Could not record the request. Please try again.');
}

// ── hospital review ──────────────────────────────────────────────────────────

async function toViews(leads: FamilyLeadDocument[]): Promise<FamilyLeadView[]> {
  const [deciders, requests] = await Promise.all([
    UserModel.find({ _id: { $in: leads.map((l) => l.decidedBy).filter(Boolean) } }).select('name').lean(),
    BloodRequestModel.find({ _id: { $in: leads.map((l) => l.linkedRequestId).filter(Boolean) } }).select('publicCode').lean(),
  ]);
  const name = new Map(deciders.map((u) => [u._id.toString(), u.name]));
  const code = new Map(requests.map((r) => [r._id.toString(), r.publicCode]));
  return leads.map((l) => ({
    id: l._id.toString(),
    reference: l.reference,
    contactName: l.contactName,
    contactPhone: l.contactPhone,
    bloodGroup: l.bloodGroup ?? null,
    note: l.note ?? null,
    status: effectiveStatus(l),
    createdAt: (l.get('createdAt') as Date).toISOString(),
    expiresAt: l.expiresAt.toISOString(),
    decidedBy: l.decidedBy ? (name.get(l.decidedBy.toString()) ?? null) : null,
    decidedAt: l.decidedAt ? l.decidedAt.toISOString() : null,
    reason: l.reason ?? null,
    linkedRequest: l.linkedRequestId ? { id: l.linkedRequestId.toString(), publicCode: code.get(l.linkedRequestId.toString()) ?? '' } : null,
  }));
}

export async function listFamilyLeads(user: AuthUser, status: FamilyLeadStatus | undefined): Promise<FamilyLeadView[]> {
  if (user.role !== 'hospital_staff' || !user.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff review family leads.');
  const now = new Date();
  const filter: Record<string, unknown> = { hospitalId: user.facilityId };
  if (status === 'pending') Object.assign(filter, { status: 'pending', expiresAt: { $gt: now } });
  else if (status === 'expired') Object.assign(filter, { $or: [{ status: 'expired' }, { status: 'pending', expiresAt: { $lte: now } }] });
  else if (status) filter.status = status;
  const leads = await FamilyLeadModel.find(filter).sort({ createdAt: -1 }).limit(100);
  return toViews(leads);
}

/**
 * Confirms a lead by raising an official request for the patient. The request is created and the
 * lead linked in ONE transaction; the request still needs verification before any donor is alerted.
 */
export async function confirmFamilyLead(id: string, input: ConfirmFamilyLeadInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const lead = await FamilyLeadModel.findById(id);
  if (!lead) throw new AppError('NOT_FOUND', 'Not found.');
  requireStaffOf(ctx.user, lead);
  const status = effectiveStatus(lead);
  if (status !== 'pending') throw new AppError('INVALID_TRANSITION', `This lead is already ${status}.`, { current: { status } });

  const { request } = await createRequest(input.request, ctx, config, async (session, created) => {
    const updated = await FamilyLeadModel.findOneAndUpdate(
      { _id: lead._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'confirmed', linkedRequestId: created._id, decidedBy: ctx.user.id, decidedAt: new Date() } },
      { new: true, session },
    );
    if (!updated) throw new AppError('CONFLICT', 'This lead was just decided or expired. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'lead.confirmed',
        resourceType: 'bloodRequest',
        resourceId: created._id,
        facilityId: lead.hospitalId,
        detail: { leadReference: lead.reference },
        requestId: ctx.requestId,
      },
      session,
    );
  });
  return getRequestDetail(request._id.toString(), ctx.user, config);
}

export async function rejectFamilyLead(id: string, reason: string, ctx: ActionContext): Promise<FamilyLeadView> {
  const lead = await FamilyLeadModel.findById(id);
  if (!lead) throw new AppError('NOT_FOUND', 'Not found.');
  requireStaffOf(ctx.user, lead);
  const status = effectiveStatus(lead);
  if (status !== 'pending') throw new AppError('INVALID_TRANSITION', `This lead is already ${status}.`, { current: { status } });

  const updated = await withTransaction(async (session) => {
    const doc = await FamilyLeadModel.findOneAndUpdate(
      { _id: lead._id, status: 'pending' },
      { $set: { status: 'rejected', decidedBy: ctx.user.id, decidedAt: new Date(), reason } },
      { new: true, session },
    );
    if (!doc) throw new AppError('CONFLICT', 'This lead was just decided. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'lead.rejected',
        resourceType: 'familyLead',
        resourceId: doc._id,
        facilityId: doc.hospitalId,
        reason,
        requestId: ctx.requestId,
      },
      session,
    );
    return doc;
  });
  return (await toViews([updated]))[0]!;
}
