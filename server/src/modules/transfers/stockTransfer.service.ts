import type { CreateStockTransferInput, StockTransferActionInput, StockTransferView } from '@golden-hour/shared';
import { Types } from 'mongoose';
import { AppError } from '../../lib/errors';
import { withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { StockTransferModel, type StockTransferDocument } from './stockTransfer.model';
import { TRANSFER_TRANSITIONS, transferAllowedActions } from './stockTransfer.rules';

const HISTORY_KEPT = 20;

async function toViews(transfers: StockTransferDocument[], viewer: AuthUser): Promise<StockTransferView[]> {
  if (transfers.length === 0) return [];
  const [facilities, requests, users] = await Promise.all([
    HospitalModel.find({ _id: { $in: transfers.flatMap((t) => [t.requestingFacilityId, t.respondingFacilityId]) } }).select('name district'),
    BloodRequestModel.find({ _id: { $in: transfers.map((t) => t.relatedRequestId).filter(Boolean) } }).select('publicCode facilityId'),
    UserModel.find({ _id: { $in: transfers.flatMap((t) => t.history.map((h) => h.by)).filter(Boolean) } }).select('name').lean(),
  ]);
  const fac = new Map(facilities.map((f) => [f._id.toString(), { id: f._id.toString(), name: f.name, district: f.district }]));
  const req = new Map(requests.map((r) => [r._id.toString(), r]));
  const name = new Map(users.map((u) => [u._id.toString(), u.name]));
  const unknown = { id: '', name: '—', district: '' };

  return transfers.map((t) => {
    const related = t.relatedRequestId ? req.get(t.relatedRequestId.toString()) : undefined;
    // The related request's code is shown only to its own facility.
    const showRelated = related && viewer.facilityId === related.facilityId.toString();
    return {
      id: t._id.toString(),
      status: t.status,
      requesting: fac.get(t.requestingFacilityId.toString()) ?? unknown,
      responding: fac.get(t.respondingFacilityId.toString()) ?? unknown,
      bloodGroup: t.bloodGroup,
      units: t.units,
      offeredUnits: t.offeredUnits ?? null,
      relatedRequest: showRelated ? { id: related._id.toString(), publicCode: related.publicCode } : null,
      note: t.note ?? null,
      history: t.history.map((h) => ({ status: h.status, by: h.by ? (name.get(h.by.toString()) ?? null) : null, at: h.at.toISOString(), note: h.note ?? null })),
      createdAt: (t.get('createdAt') as Date).toISOString(),
      version: t.version,
      allowedActions: transferAllowedActions(t, viewer),
    };
  });
}

export async function listStockTransfers(viewer: AuthUser, direction: 'incoming' | 'outgoing'): Promise<StockTransferView[]> {
  if (viewer.role !== 'hospital_staff' || !viewer.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff manage stock transfers.');
  const filter = direction === 'incoming' ? { respondingFacilityId: viewer.facilityId } : { requestingFacilityId: viewer.facilityId };
  const transfers = await StockTransferModel.find(filter).sort({ createdAt: -1 }).limit(100);
  return toViews(transfers, viewer);
}

export async function createStockTransfer(input: CreateStockTransferInput, ctx: ActionContext): Promise<StockTransferDocument> {
  const { user } = ctx;
  if (user.role !== 'hospital_staff' || !user.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff can request stock.');
  if (input.respondingFacilityId === user.facilityId) {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { respondingFacilityId: 'choose another facility' } });
  }
  const [own, target] = await Promise.all([HospitalModel.findById(user.facilityId), HospitalModel.findById(input.respondingFacilityId)]);
  if (own?.verificationStatus !== 'verified') throw new AppError('FORBIDDEN', 'Your facility must be verified to request stock.');
  if (target?.verificationStatus !== 'verified') {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { respondingFacilityId: 'choose a verified facility' } });
  }
  if (input.relatedRequestId) {
    const related = await BloodRequestModel.findById(input.relatedRequestId);
    if (!related || related.facilityId.toString() !== user.facilityId) {
      throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { relatedRequestId: 'choose one of your facility’s requests' } });
    }
  }

  return withTransaction(async (session) => {
    const [created] = await StockTransferModel.create(
      [
        {
          requestingFacilityId: own._id,
          respondingFacilityId: target._id,
          relatedRequestId: input.relatedRequestId ?? null,
          bloodGroup: input.bloodGroup,
          units: input.units,
          note: input.note || null,
          history: [{ status: 'requested', by: new Types.ObjectId(user.id), at: new Date(), note: input.note || null }],
          createdBy: user.id,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: userActor(user),
        action: 'transfer.requested',
        resourceType: created!.relatedRequestId ? 'bloodRequest' : 'stockTransfer',
        resourceId: created!.relatedRequestId ?? created!._id,
        facilityId: own._id,
        detail: { transferId: created!._id.toString(), to: target.name, bloodGroup: input.bloodGroup, units: input.units },
        requestId: ctx.requestId,
      },
      session,
    );
    return created!;
  });
}

export async function viewStockTransfer(t: StockTransferDocument, viewer: AuthUser): Promise<StockTransferView> {
  return (await toViews([t], viewer))[0]!;
}

export async function actOnStockTransfer(id: string, input: StockTransferActionInput, ctx: ActionContext): Promise<StockTransferView> {
  const transfer = await StockTransferModel.findById(id);
  const involved =
    transfer && ctx.user.facilityId && [transfer.requestingFacilityId.toString(), transfer.respondingFacilityId.toString()].includes(ctx.user.facilityId);
  if (!transfer || !involved) throw new AppError('NOT_FOUND', 'Not found.');
  if (!transferAllowedActions(transfer, ctx.user).includes(input.action)) {
    throw new AppError('INVALID_TRANSITION', 'This step is not possible for your facility now.', { current: { status: transfer.status, version: transfer.version } });
  }
  if (input.action === 'offer' && (input.offeredUnits ?? 0) > transfer.units) {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { offeredUnits: `at most ${transfer.units} unit(s) were requested` } });
  }
  const { from, to } = TRANSFER_TRANSITIONS[input.action];

  const updated = await withTransaction(async (session) => {
    const doc = await StockTransferModel.findOneAndUpdate(
      { _id: id, version: input.expectedVersion, status: { $in: from } },
      {
        $set: { status: to, ...(input.action === 'offer' && { offeredUnits: input.offeredUnits }) },
        $push: { history: { $each: [{ status: to, by: new Types.ObjectId(ctx.user.id), at: new Date(), note: input.note || null }], $slice: -HISTORY_KEPT } },
        $inc: { version: 1 },
      },
      { new: true, session },
    );
    if (!doc) throw new AppError('CONFLICT', 'This transfer just changed. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: `transfer.${to}`,
        resourceType: doc.relatedRequestId ? 'bloodRequest' : 'stockTransfer',
        resourceId: doc.relatedRequestId ?? doc._id,
        facilityId: ctx.user.facilityId,
        reason: input.note,
        detail: { transferId: doc._id.toString(), ...(input.offeredUnits && { offeredUnits: input.offeredUnits }) },
        requestId: ctx.requestId,
      },
      session,
    );
    return doc;
  });
  return viewStockTransfer(updated, ctx.user);
}
