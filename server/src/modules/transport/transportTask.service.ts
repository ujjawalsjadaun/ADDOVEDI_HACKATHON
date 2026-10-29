import type { CreateTransportTaskInput, TransportAction, TransportActionInput, TransportTaskView } from '@golden-hour/shared';
import { Types } from 'mongoose';
import { AppError } from '../../lib/errors';
import { fromGeoPoint, toGeoPoint } from '../../lib/geo';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { AssignmentModel } from '../assignments/assignment.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { TransportTaskModel, type TransportTaskDocument } from './transportTask.model';
import { TRANSPORT_TRANSITIONS, transportAllowedActions } from './transportTask.rules';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const HISTORY_KEPT = 20;

function canSeeDonor(t: TransportTaskDocument, viewer: AuthUser): boolean {
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'hospital_staff') return viewer.facilityId === t.facilityId.toString();
  // A coordinator sees who to pick up only after claiming the task.
  return !!t.assigneeUserId && t.assigneeUserId.toString() === viewer.id;
}

/**
 * Allowed actions, with relay rules layered on the base state machine:
 * - leg 2 can be claimed only once the donor has reached the handover point (leg 1 `handed_over`/`completed`);
 * - leg 1 is completed by the leg-2 coordinator who receives the donor (or facility staff, as for any task);
 * - if leg 1 failed or was cancelled, leg 2 can no longer be claimed.
 */
function allowedWithRelay(t: TransportTaskDocument, viewer: AuthUser, other: TransportTaskDocument | undefined): TransportAction[] {
  const base = transportAllowedActions(t, viewer);
  if (!t.relayLeg || !other) return base;
  if (t.relayLeg === 2) return base.filter((a) => a !== 'claim' || ['handed_over', 'completed'].includes(other.status));
  const receiver = !!other.assigneeUserId && other.assigneeUserId.toString() === viewer.id;
  const out: TransportAction[] = base.filter((a) => a !== 'complete');
  if (t.status === 'handed_over' && (receiver || base.includes('complete'))) out.push('complete');
  return out;
}

async function relaySiblings(tasks: TransportTaskDocument[]): Promise<Map<string, TransportTaskDocument>> {
  const groups = [...new Set(tasks.filter((t) => t.relayGroupId).map((t) => t.relayGroupId!.toString()))];
  if (groups.length === 0) return new Map();
  const all = await TransportTaskModel.find({ relayGroupId: { $in: groups } });
  const byGroupLeg = new Map(all.map((t) => [`${t.relayGroupId!.toString()}:${t.relayLeg}`, t]));
  // key: this task's id → the other leg
  return new Map(tasks.filter((t) => t.relayGroupId).flatMap((t) => {
    const other = byGroupLeg.get(`${t.relayGroupId!.toString()}:${t.relayLeg === 1 ? 2 : 1}`);
    return other ? [[t._id.toString(), other] as const] : [];
  }));
}

async function toViews(tasks: TransportTaskDocument[], viewer: AuthUser): Promise<TransportTaskView[]> {
  if (tasks.length === 0) return [];
  const siblings = await relaySiblings(tasks);
  const [requests, facilities, assignments] = await Promise.all([
    BloodRequestModel.find({ _id: { $in: tasks.map((t) => t.requestId) } }),
    HospitalModel.find({ _id: { $in: tasks.map((t) => t.facilityId) } }).select('name district ambulanceAccessPoint'),
    AssignmentModel.find({ _id: { $in: tasks.map((t) => t.assignmentId ?? t.relayAssignmentId).filter(Boolean) } }).select('donorUserId'),
  ]);
  const userIds = [
    ...tasks.flatMap((t) => [t.assigneeUserId, ...t.history.map((h) => h.by)]),
    ...assignments.map((a) => a.donorUserId),
  ].filter(Boolean);
  const users = await UserModel.find({ _id: { $in: userIds } }).select('name phone').lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const reqById = new Map(requests.map((r) => [r._id.toString(), r]));
  const facById = new Map(facilities.map((f) => [f._id.toString(), f]));
  const donorByAssignment = new Map(assignments.map((a) => [a._id.toString(), a.donorUserId.toString()]));

  return tasks.flatMap((t) => {
    const r = reqById.get(t.requestId.toString());
    const f = facById.get(t.facilityId.toString());
    if (!r || !f) return [];
    const assignmentRef = t.assignmentId ?? t.relayAssignmentId;
    const donorId = assignmentRef ? donorByAssignment.get(assignmentRef.toString()) : undefined;
    const other = siblings.get(t._id.toString());
    const donor = donorId && canSeeDonor(t, viewer) ? userById.get(donorId) : undefined;
    const assignee = t.assigneeUserId ? userById.get(t.assigneeUserId.toString()) : undefined;
    return [
      {
        id: t._id.toString(),
        kind: t.kind,
        status: t.status,
        request: { id: r._id.toString(), publicCode: r.publicCode, bloodGroup: r.bloodGroup, requestStatus: r.requestStatus, deadlineAt: r.deadlineAt.toISOString() },
        facility: { id: f._id.toString(), name: f.name, district: f.district },
        ambulancePoint: f.ambulanceAccessPoint ? { note: f.ambulanceAccessPoint.note ?? null, location: fromGeoPoint(f.ambulanceAccessPoint.location) } : null,
        pickup: { label: t.pickup.label, location: t.pickup.location ? fromGeoPoint(t.pickup.location) : null },
        dropoff: { label: t.dropoff.label, location: t.dropoff.location ? fromGeoPoint(t.dropoff.location) : null },
        donor: donor ? { name: donor.name, phone: donor.phone ?? null } : null,
        assignee: assignee && t.assigneeUserId ? { id: t.assigneeUserId.toString(), name: assignee.name } : null,
        note: t.note ?? null,
        relay: t.relayLeg
          ? { leg: t.relayLeg as 1 | 2, handoverPoint: t.relayLeg === 1 ? t.dropoff.label : t.pickup.label, otherLegStatus: other?.status ?? null }
          : null,
        history: t.history.map((h) => ({
          status: h.status,
          by: h.by ? (userById.get(h.by.toString())?.name ?? null) : null,
          at: h.at.toISOString(),
          note: h.note ?? null,
        })),
        createdAt: (t.get('createdAt') as Date).toISOString(),
        version: t.version,
        allowedActions: allowedWithRelay(t, viewer, other),
      },
    ];
  });
}

export async function listTransportTasks(
  viewer: AuthUser,
  query: { scope: 'open' | 'mine' | 'facility' | 'all'; requestId?: string },
): Promise<TransportTaskView[]> {
  const filter: Record<string, unknown> = {};
  if (query.requestId) filter.requestId = query.requestId;
  if (viewer.role === 'hospital_staff') {
    filter.facilityId = viewer.facilityId; // staff only ever see their own facility's tasks
  } else if (viewer.role === 'coordinator') {
    if (query.scope === 'open') filter.status = 'requested';
    else if (!query.requestId) filter.assigneeUserId = viewer.id;
    else filter.$or = [{ status: 'requested' }, { assigneeUserId: viewer.id }];
  } else if (query.scope === 'open') {
    filter.status = 'requested';
  }
  const tasks = await TransportTaskModel.find(filter).sort({ open: -1, createdAt: -1 }).limit(100);
  return toViews(tasks, viewer);
}

export async function createTransportTask(input: CreateTransportTaskInput, ctx: ActionContext): Promise<TransportTaskView> {
  const request = await BloodRequestModel.findById(input.requestId);
  if (!request) throw new AppError('NOT_FOUND', 'Not found.');
  if (ctx.user.role === 'hospital_staff' && ctx.user.facilityId !== request.facilityId.toString()) throw new AppError('NOT_FOUND', 'Not found.');
  if (request.requestStatus === 'closed') throw new AppError('INVALID_TRANSITION', 'This request is closed; no transport is needed.');
  if (request.verificationStatus !== 'verified') throw new AppError('INVALID_TRANSITION', 'Transport can only be arranged for a verified request.');

  if (input.kind === 'donor_pickup') {
    if (!input.assignmentId) throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { assignmentId: 'choose the donor to pick up' } });
    const a = await AssignmentModel.findById(input.assignmentId);
    if (!a || !a.requestId.equals(request._id) || !a.isActive) {
      throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { assignmentId: 'choose a donor who is currently assigned to this request' } });
    }
  }

  const now = new Date();
  try {
    const task = await withTransaction(async (session) => {
      if (input.relayPoint) {
        const groupId = new Types.ObjectId();
        const base = { requestId: request._id, facilityId: request.facilityId, createdBy: ctx.user.id, relayGroupId: groupId, note: input.note || null };
        const placeOf = (p: { label: string; location?: { lat: number; lng: number } | null }) => ({ label: p.label, location: p.location ? toGeoPoint(p.location) : null });
        const history = [{ status: 'requested' as const, by: new Types.ObjectId(ctx.user.id), at: now, note: input.note || null }];
        const [leg1] = await TransportTaskModel.create(
          [{ ...base, _id: groupId, kind: 'donor_pickup', assignmentId: input.assignmentId, relayLeg: 1, pickup: placeOf(input.pickup), dropoff: placeOf(input.relayPoint), history }],
          { session },
        );
        await TransportTaskModel.create(
          [{ ...base, kind: 'donor_pickup', assignmentId: null, relayAssignmentId: input.assignmentId, relayLeg: 2, pickup: placeOf(input.relayPoint), dropoff: placeOf(input.dropoff), history }],
          { session },
        );
        await recordAudit(
          {
            actor: userActor(ctx.user),
            action: 'transport.requested',
            resourceType: 'bloodRequest',
            resourceId: request._id,
            facilityId: request.facilityId,
            detail: { taskId: leg1!._id.toString(), kind: 'donor_pickup', relay: true, handoverPoint: input.relayPoint.label },
            requestId: ctx.requestId,
          },
          session,
        );
        return leg1!;
      }
      const [created] = await TransportTaskModel.create(
        [
          {
            requestId: request._id,
            facilityId: request.facilityId,
            assignmentId: input.kind === 'donor_pickup' ? input.assignmentId : null,
            kind: input.kind,
            pickup: { label: input.pickup.label, location: input.pickup.location ? toGeoPoint(input.pickup.location) : null },
            dropoff: { label: input.dropoff.label, location: input.dropoff.location ? toGeoPoint(input.dropoff.location) : null },
            note: input.note || null,
            history: [{ status: 'requested', by: new Types.ObjectId(ctx.user.id), at: now, note: input.note || null }],
            createdBy: ctx.user.id,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: userActor(ctx.user),
          action: 'transport.requested',
          resourceType: 'bloodRequest',
          resourceId: request._id,
          facilityId: request.facilityId,
          detail: { taskId: created!._id.toString(), kind: input.kind },
          requestId: ctx.requestId,
        },
        session,
      );
      return created!;
    });
    return (await toViews([task], ctx.user))[0]!;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError('CONFLICT', 'A pickup for this donor is already arranged.');
    throw err;
  }
}

export async function actOnTransportTask(id: string, input: TransportActionInput, ctx: ActionContext): Promise<TransportTaskView> {
  const task = await TransportTaskModel.findById(id);
  if (!task) throw new AppError('NOT_FOUND', 'Not found.');
  if (ctx.user.role === 'hospital_staff' && ctx.user.facilityId !== task.facilityId.toString()) throw new AppError('NOT_FOUND', 'Not found.');
  const other = task.relayGroupId ? (await relaySiblings([task])).get(task._id.toString()) : undefined;
  if (!allowedWithRelay(task, ctx.user, other).includes(input.action)) {
    throw new AppError('INVALID_TRANSITION', 'This step is not possible for you on this task now.', { current: { status: task.status, version: task.version } });
  }
  const { from, to } = TRANSPORT_TRANSITIONS[input.action];
  const now = new Date();

  const updated = await withTransaction(async (session) => {
    const doc = await TransportTaskModel.findOneAndUpdate(
      { _id: id, version: input.expectedVersion, status: { $in: from } },
      {
        $set: {
          status: to,
          open: !TERMINAL.has(to),
          ...(input.action === 'claim' && { assigneeUserId: new Types.ObjectId(ctx.user.id) }),
        },
        $push: { history: { $each: [{ status: to, by: new Types.ObjectId(ctx.user.id), at: now, note: input.note || null }], $slice: -HISTORY_KEPT } },
        $inc: { version: 1 },
      },
      { new: true, session },
    );
    if (!doc) throw new AppError('CONFLICT', 'This task just changed. Refresh and try again.');
    // If the first leg fails or is cancelled, the second has nothing to carry: close it too (not for completed work).
    if (doc.relayLeg === 1 && ['failed', 'cancelled'].includes(to)) {
      await TransportTaskModel.updateMany(
        { relayGroupId: doc.relayGroupId, relayLeg: 2, status: { $in: ['requested', 'assigned'] } },
        {
          $set: { status: 'cancelled', open: false },
          $push: { history: { status: 'cancelled', by: new Types.ObjectId(ctx.user.id), at: now, note: 'First leg ended; this leg is no longer needed.' } },
          $inc: { version: 1 },
        },
        { session },
      );
    }
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: `transport.${to}`,
        resourceType: 'bloodRequest',
        resourceId: doc.requestId,
        facilityId: doc.facilityId,
        reason: input.note,
        detail: { taskId: doc._id.toString(), kind: doc.kind },
        requestId: ctx.requestId,
      },
      session,
    );
    return doc;
  });
  return (await toViews([updated], ctx.user))[0]!;
}
