import type {
  AssignmentForHospital,
  AssignmentStatus,
  DonorAssignmentStatusInput,
  DonorAssignmentView,
  NoShowInput,
  RespondAlertResult,
} from '@golden-hour/shared';
import type { ClientSession, Types, UpdateQuery } from 'mongoose';
import { AppError } from '../../lib/errors';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, SYSTEM_ACTOR, userActor, type AuditActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { effectiveResponse } from '../alerts/alert.dto';
import { RequestAlertModel } from '../alerts/alert.model';
import { cancelPendingAlerts, loadDonorAlertView } from '../alerts/alert.service';
import { DonorProfileModel } from '../donors/donor.model';
import { enqueueNotification } from '../notifications/outbox.service';
import { publish, rooms } from '../../realtime/emitter';
import { recordStrike } from '../donors/donor.service';
import { FamilyLeadModel } from '../leads/familyLead.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { toAssignmentForHospital, toDonorAssignmentView } from './assignment.dto';
import { AssignmentModel, type Assignment, type AssignmentDocument } from './assignment.model';
import { DONOR_ACTION_FROM, donorAllowedActions, HOSPITAL_ACTION_FROM, hospitalAllowedActions } from './assignment.transitions';

/** Realtime nudge after a committed assignment change: the facility, admins and the donor. */
function announceAssignment(a: Pick<AssignmentDocument, 'requestId' | 'facilityId' | 'donorUserId'>): void {
  publish('request', [rooms.facility(a.facilityId), rooms.role('admin'), rooms.role('coordinator')], a.requestId);
  publish('alert', [rooms.user(a.donorUserId)], a.requestId);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function auditOnRequest(actor: AuditActor, a: Pick<AssignmentDocument, 'requestId' | 'facilityId' | '_id' | 'slot'>, action: string, extra: { reason?: string; requestId?: string } = {}) {
  return {
    actor,
    action,
    resourceType: 'bloodRequest',
    resourceId: a.requestId,
    facilityId: a.facilityId,
    reason: extra.reason,
    detail: { assignmentId: a._id.toString(), slot: a.slot },
    requestId: extra.requestId,
  };
}

/** Version-checked assignment transition; a lost race is 409 with the current state. */
async function transitionAssignment(
  session: ClientSession,
  args: { id: string; expectedVersion: number; from: readonly AssignmentStatus[]; update: UpdateQuery<Assignment> },
): Promise<AssignmentDocument> {
  const { $inc, ...rest } = args.update;
  const doc = await AssignmentModel.findOneAndUpdate(
    { _id: args.id, version: args.expectedVersion, status: { $in: args.from } },
    { ...rest, $inc: { ...($inc ?? {}), version: 1 } },
    { new: true, session },
  );
  if (doc) return doc;
  const latest = await AssignmentModel.findById(args.id).session(session);
  if (!latest) throw new AppError('NOT_FOUND', 'Not found.');
  const current = { status: latest.status, version: latest.version };
  if (latest.version !== args.expectedVersion) throw new AppError('CONFLICT', 'This assignment has changed. Refresh and try again.', { current });
  throw new AppError('INVALID_TRANSITION', 'This step is not possible for this assignment now.', { current });
}

/** Frees the slot an assignment held: request goes back to waiting for donors. */
async function releaseSlot(session: ClientSession, requestId: Types.ObjectId): Promise<void> {
  await BloodRequestModel.updateOne(
    { _id: requestId, requestStatus: { $in: ['awaiting_donor', 'donors_assigned'] }, slotsFilled: { $gt: 0 } },
    { $inc: { slotsFilled: -1, version: 1 }, $set: { requestStatus: 'awaiting_donor' } },
    { session },
  );
}

async function loadForDonor(id: string, user: AuthUser): Promise<AssignmentDocument> {
  const a = await AssignmentModel.findById(id);
  if (!a || a.donorUserId.toString() !== user.id) throw new AppError('NOT_FOUND', 'Not found.');
  return a;
}

async function loadForHospital(id: string, user: AuthUser): Promise<AssignmentDocument> {
  const a = await AssignmentModel.findById(id);
  if (!a || user.role !== 'hospital_staff' || user.facilityId !== a.facilityId.toString()) throw new AppError('NOT_FOUND', 'Not found.');
  return a;
}

export async function donorAssignmentView(a: AssignmentDocument, user: AuthUser): Promise<DonorAssignmentView> {
  const request = await BloodRequestModel.findById(a.requestId);
  const facility = request ? await HospitalModel.findById(request.facilityId) : null;
  if (!request || !facility) throw new AppError('NOT_FOUND', 'Not found.');
  return toDonorAssignmentView(a, request, facility, user);
}

// ── accept (atomic slot claim) ───────────────────────────────────────────────

/**
 * Accepts an alert. In one transaction: the alert must still be pending and unexpired, the donor
 * must have no other active assignment, and the request must still have a free slot. The partial
 * unique indexes (one donor per slot, one active assignment per donor) are the backstop, so two
 * simultaneous accepts can never both win the same slot (docs/state-machines.md §4).
 */
export async function acceptAlert(alertId: string, user: AuthUser, httpRequestId?: string): Promise<RespondAlertResult> {
  const alert = await RequestAlertModel.findOne({ _id: alertId, donorUserId: user.id });
  if (!alert) throw new AppError('NOT_FOUND', 'Not found.');

  // Repeated "accept" (double tap, retry, duplicate SMS later) returns the original result.
  if (alert.response === 'accepted') {
    const existing = await AssignmentModel.findOne({ alertId: alert._id });
    return { alert: await loadDonorAlertView(alert._id), assignment: existing ? await donorAssignmentView(existing, user) : null };
  }
  const response = effectiveResponse(alert);
  if (response !== 'pending') {
    throw new AppError('INVALID_TRANSITION', response === 'expired' ? 'This alert has expired.' : `This alert is already ${response}.`, {
      current: { response },
    });
  }

  let assignment: AssignmentDocument;
  try {
    assignment = await withTransaction(async (session) => {
      const now = new Date();
      if (await AssignmentModel.exists({ donorUserId: user.id, isActive: true }).session(session)) {
        throw new AppError('DONOR_BUSY', 'You already have an active donation in progress. Finish or withdraw from it first.');
      }

      const claimed = await BloodRequestModel.findOneAndUpdate(
        { _id: alert.requestId, requestStatus: 'awaiting_donor', $expr: { $lt: ['$slotsFilled', '$unitsRequested'] } },
        { $inc: { slotsFilled: 1, version: 1 } },
        { new: true, session },
      );
      if (!claimed) {
        const request = await BloodRequestModel.findById(alert.requestId).session(session);
        if (!request || request.requestStatus === 'closed') throw new AppError('INVALID_TRANSITION', 'This request has been closed. Thank you — no donor is needed now.');
        throw new AppError('SLOTS_FILLED', 'Enough donors have already accepted this request. Thank you!');
      }

      const updatedAlert = await RequestAlertModel.findOneAndUpdate(
        { _id: alert._id, response: 'pending', expiresAt: { $gt: now } },
        { $set: { response: 'accepted', respondedAt: now } },
        { new: true, session },
      );
      if (!updatedAlert) throw new AppError('CONFLICT', 'This alert just changed. Refresh and try again.');

      const taken = new Set<number>(await AssignmentModel.find({ requestId: claimed._id, holdsSlot: true }).session(session).distinct('slot'));
      let slot = 0;
      while (taken.has(slot)) slot++;

      const [created] = await AssignmentModel.create(
        [
          {
            requestId: claimed._id,
            facilityId: claimed.facilityId,
            donorUserId: user.id,
            alertId: alert._id,
            slot,
            status: 'accepted',
            eta: alert.eta,
            acceptedAt: now,
          },
        ],
        { session },
      );

      if (claimed.slotsFilled >= claimed.unitsRequested) {
        await BloodRequestModel.updateOne({ _id: claimed._id }, { $set: { requestStatus: 'donors_assigned' } }, { session });
        await cancelPendingAlerts(session, claimed._id);
      }
      await recordAudit(auditOnRequest(userActor(user), created!, 'donor.accepted', { requestId: httpRequestId }), session);
      return created!;
    });
  } catch (err) {
    if (err instanceof AppError && (err.code === 'SLOTS_FILLED' || err.code === 'INVALID_TRANSITION')) {
      // Nothing left to accept: close the alert so the donor's list stops offering it.
      await RequestAlertModel.updateOne({ _id: alert._id, response: 'pending' }, { $set: { response: 'cancelled', respondedAt: new Date() } }).catch(() => undefined);
    }
    if (isDuplicateKeyError(err)) {
      const pattern = Object.keys(err.keyPattern ?? {});
      if (pattern.length === 1 && pattern[0] === 'donorUserId') {
        throw new AppError('DONOR_BUSY', 'You already have an active donation in progress. Finish or withdraw from it first.');
      }
      throw new AppError('CONFLICT', 'Someone accepted at the same moment. Refresh and try again.');
    }
    throw err;
  }
  announceAssignment(assignment);
  return { alert: await loadDonorAlertView(alert._id), assignment: await donorAssignmentView(assignment, user) };
}

// ── donor progress ───────────────────────────────────────────────────────────

/** Returns the updated view and whether the freed slot should trigger the next alert batch. */
export async function updateDonorAssignment(
  id: string,
  input: DonorAssignmentStatusInput,
  ctx: ActionContext,
): Promise<{ view: DonorAssignmentView; slotReleased: boolean; requestId: Types.ObjectId }> {
  const current = await loadForDonor(id, ctx.user);
  const action = input.status === 'withdrawn' ? 'withdraw' : input.status;
  if (!donorAllowedActions(current, ctx.user).includes(action)) {
    throw new AppError('INVALID_TRANSITION', 'This step is not possible now.', { current: { status: current.status, version: current.version } });
  }
  const now = new Date();

  const updated = await withTransaction(async (session) => {
    if (input.status === 'en_route') {
      const a = await transitionAssignment(session, { id, expectedVersion: input.expectedVersion, from: DONOR_ACTION_FROM.en_route, update: { $set: { status: 'en_route', enRouteAt: now } } });
      await recordAudit(auditOnRequest(userActor(ctx.user), a, 'donor.en_route', { requestId: ctx.requestId }), session);
      return a;
    }
    if (input.status === 'arrived') {
      const a = await transitionAssignment(session, {
        id,
        expectedVersion: input.expectedVersion,
        from: DONOR_ACTION_FROM.arrived,
        update: { $set: { status: 'arrived', arrivedAt: now, arrivedBy: 'donor_reported' } },
      });
      await recordAudit(auditOnRequest(userActor(ctx.user), a, 'donor.arrived', { requestId: ctx.requestId }), session);
      return a;
    }
    const a = await transitionAssignment(session, {
      id,
      expectedVersion: input.expectedVersion,
      from: DONOR_ACTION_FROM.withdraw,
      update: { $set: { status: 'withdrawn', isActive: false, holdsSlot: false, endedAt: now, endReason: input.reason ?? null } },
    });
    await releaseSlot(session, a.requestId);
    await recordAudit(auditOnRequest(userActor(ctx.user), a, 'donor.withdrawn', { reason: input.reason, requestId: ctx.requestId }), session);
    return a;
  });

  announceAssignment(updated);
  return { view: await donorAssignmentView(updated, ctx.user), slotReleased: input.status === 'withdrawn', requestId: updated.requestId };
}

// ── hospital confirmations ───────────────────────────────────────────────────

export async function confirmArrival(id: string, expectedVersion: number, ctx: ActionContext): Promise<AssignmentDocument> {
  const current = await loadForHospital(id, ctx.user);
  if (!hospitalAllowedActions(current, ctx.user).includes('confirm_arrival')) throw new AppError('INVALID_TRANSITION', 'Arrival cannot be confirmed now.');
  const done = await withTransaction(async (session) => {
    const a = await transitionAssignment(session, {
      id,
      expectedVersion,
      from: HOSPITAL_ACTION_FROM.confirm_arrival,
      update: { $set: { status: 'arrived', arrivedAt: current.arrivedAt ?? new Date(), arrivedBy: 'hospital_confirmed' } },
    });
    await recordAudit(auditOnRequest(userActor(ctx.user), a, 'assignment.arrival_confirmed', { requestId: ctx.requestId }), session);
    return a;
  });
  announceAssignment(done);
  return done;
}

/** Hospital confirms this donor donated. Updates the donor's rest period; does NOT fulfil the request. */
export async function markDonated(id: string, expectedVersion: number, ctx: ActionContext): Promise<AssignmentDocument> {
  const current = await loadForHospital(id, ctx.user);
  if (!hospitalAllowedActions(current, ctx.user).includes('mark_donated')) throw new AppError('INVALID_TRANSITION', 'Only an arrived donor can be marked as donated.');
  const done = await withTransaction(async (session) => {
    const now = new Date();
    const a = await transitionAssignment(session, {
      id,
      expectedVersion,
      from: HOSPITAL_ACTION_FROM.mark_donated,
      // Still holds its slot (the unit was given), but the donor is free again.
      update: { $set: { status: 'donated', donatedAt: now, isActive: false, endedAt: now } },
    });
    await DonorProfileModel.updateOne({ userId: a.donorUserId }, { $set: { lastDonationAt: now, lastDonationKnown: true } }, { session });
    await recordAudit(auditOnRequest(userActor(ctx.user), a, 'assignment.donated', { requestId: ctx.requestId }), session);
    return a;
  });
  announceAssignment(done);
  return done;
}

export async function markNoShow(id: string, input: NoShowInput, ctx: ActionContext): Promise<{ assignment: AssignmentDocument; slotReleased: boolean }> {
  const current = await loadForHospital(id, ctx.user);
  if (!hospitalAllowedActions(current, ctx.user).includes('mark_no_show')) throw new AppError('INVALID_TRANSITION', 'This donor cannot be marked as a no-show now.');
  const assignment = await withTransaction(async (session) => {
    const now = new Date();
    const a = await transitionAssignment(session, {
      id,
      expectedVersion: input.expectedVersion,
      from: HOSPITAL_ACTION_FROM.mark_no_show,
      update: { $set: { status: 'no_show', isActive: false, holdsSlot: false, endedAt: now, endReason: input.reason } },
    });
    await releaseSlot(session, a.requestId);
    await recordAudit(
      { ...auditOnRequest(userActor(ctx.user), a, 'assignment.no_show', { reason: input.reason, requestId: ctx.requestId }), changes: { needStillExists: [null, input.needStillExists] } },
      session,
    );
    await recordStrike(session, { donorUserId: a.donorUserId, requestId: a.requestId, reason: input.reason, ctx });
    return a;
  });
  announceAssignment(assignment);
  return { assignment, slotReleased: input.needStillExists };
}

// ── request closure ──────────────────────────────────────────────────────────

/** Called inside the request's cancel/fulfil/expire transaction: ends alerts and active assignments. */
export async function endForClosedRequest(
  session: ClientSession,
  request: { _id: Types.ObjectId; publicCode: string; facilityId: Types.ObjectId },
  outcome: 'fulfilled' | 'cancelled' | 'expired',
  reason: string,
): Promise<string[]> {
  await cancelPendingAlerts(session, request._id);
  const active = await AssignmentModel.find({ requestId: request._id, isActive: true }).session(session).select('donorUserId');
  await AssignmentModel.updateMany(
    { requestId: request._id, isActive: true },
    { $set: { status: 'cancelled', isActive: false, holdsSlot: false, endedAt: new Date(), endReason: reason }, $inc: { version: 1 } },
    { session },
  );
  // Donors who may already be travelling are told by SMS that they are no longer needed.
  const facility = await HospitalModel.findById(request.facilityId).session(session).select('name');
  for (const a of active) {
    await enqueueNotification(session, {
      eventId: `request:${request._id.toString()}:closed:${a._id.toString()}`,
      type: 'request_closed_for_donor',
      recipientUserId: a.donorUserId,
      requestId: request._id,
      vars: { publicCode: request.publicCode, facilityName: facility?.name ?? 'the hospital', outcome },
    });
  }
  // The family that asked for this blood is told, if they confirmed their number.
  const lead = await FamilyLeadModel.findOne({ linkedRequestId: request._id }).session(session).select('_id');
  if (lead) {
    await enqueueNotification(session, {
      eventId: `lead:${lead._id.toString()}:closed`,
      type: 'family_lead_update',
      recipientLeadId: lead._id,
      requestId: request._id,
      vars: { event: 'closed', facilityName: facility?.name ?? 'the hospital', publicCode: request.publicCode, outcome },
    });
  }
  // Pending alerts were cancelled too: those donors' lists change as well.
  const alerted = await RequestAlertModel.find({ requestId: request._id }).session(session).distinct('donorUserId');
  return [...new Set([...active.map((a) => a.donorUserId.toString()), ...alerted.map(String)])];
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listForHospital(requestId: Types.ObjectId, viewer: AuthUser): Promise<AssignmentForHospital[]> {
  const assignments = await AssignmentModel.find({ requestId }).sort({ isActive: -1, acceptedAt: 1 });
  const donorIds = assignments.map((a) => a.donorUserId);
  const [users, profiles] = await Promise.all([UserModel.find({ _id: { $in: donorIds } }), DonorProfileModel.find({ userId: { $in: donorIds } })]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const profileById = new Map(profiles.map((p) => [p.userId.toString(), p]));
  return assignments.map((a) =>
    toAssignmentForHospital(a, { user: userById.get(a.donorUserId.toString()), profile: profileById.get(a.donorUserId.toString()) }, viewer),
  );
}

export async function listForDonor(user: AuthUser): Promise<DonorAssignmentView[]> {
  const assignments = await AssignmentModel.find({ donorUserId: user.id }).sort({ isActive: -1, acceptedAt: -1 }).limit(20);
  const requests = await BloodRequestModel.find({ _id: { $in: assignments.map((a) => a.requestId) } });
  const facilities = await HospitalModel.find({ _id: { $in: requests.map((r) => r.facilityId) } });
  const reqById = new Map(requests.map((r) => [r._id.toString(), r]));
  const facById = new Map(facilities.map((f) => [f._id.toString(), f]));
  return assignments.flatMap((a) => {
    const r = reqById.get(a.requestId.toString());
    const f = r && facById.get(r.facilityId.toString());
    return r && f ? [toDonorAssignmentView(a, r, f, user)] : [];
  });
}

// ── automatic release of donors who missed their ETA ─────────────────────────

/**
 * Releases accepted/en-route donors whose own travel-time estimate (plus a grace period) has passed
 * without an arrival. Only assignments with a KNOWN ETA qualify — an unknown ETA is never guessed.
 * The donor is marked `no_show` and the slot freed, but NO strike is recorded: the donor may simply not
 * have updated the app in a low-signal area, and a strike needs a person's judgement (D-75).
 */
export async function releaseMissedEtaAssignments(graceMin: number, now = new Date()): Promise<AssignmentDocument[]> {
  const candidates = await AssignmentModel.find({ status: { $in: ['accepted', 'en_route'] }, isActive: true, 'eta.minutes': { $ne: null } });
  const released: AssignmentDocument[] = [];
  for (const c of candidates) {
    const dueAt = c.acceptedAt.getTime() + ((c.eta?.minutes ?? 0) + graceMin) * 60_000;
    if (dueAt > now.getTime()) continue;
    try {
      const a = await withTransaction(async (session) => {
        const doc = await transitionAssignment(session, {
          id: c._id.toString(),
          expectedVersion: c.version,
          from: ['accepted', 'en_route'],
          update: {
            $set: { status: 'no_show', isActive: false, holdsSlot: false, endedAt: now, endReason: `Automatic: did not arrive within the estimated ${c.eta?.minutes} min plus ${graceMin} min grace.` },
          },
        });
        await releaseSlot(session, doc.requestId);
        await recordAudit(auditOnRequest(SYSTEM_ACTOR, doc, 'assignment.missed_eta', { reason: doc.endReason ?? undefined }), session);
        return doc;
      });
      announceAssignment(a);
      released.push(a);
    } catch (err) {
      // A donor who updated their status in the meantime (409/invalid transition) is simply skipped.
      if (!(err instanceof AppError)) throw err;
    }
  }
  return released;
}
