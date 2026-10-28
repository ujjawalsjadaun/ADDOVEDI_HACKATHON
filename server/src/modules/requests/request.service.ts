import type { z } from 'zod';
import {
  MAX_DEADLINE_HOURS,
  suggestUrgency,
  type CreateRequestInput,
  type DuplicateReviewInput,
  type FulfillRequestInput,
  type listRequestsQuerySchema,
  type ReasonedTransitionInput,
  type RequestAction,
  type RequestDetail,
  type RequestSummary,
  type ReviewFlagInput,
  type CandidatePreview,
  type VerifyRequestInput,
} from '@golden-hour/shared';
import { Types, type ClientSession } from 'mongoose';
import type { Config } from '../../config/env';
import { hmacHex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { generatePublicCode } from '../../lib/ids';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import { alertNextBatch, insertAlertBatch, matchFirstBatch, summariseAlerts } from '../alerts/alert.service';
import { endForClosedRequest, listForHospital } from '../assignments/assignment.service';
import { matchDonors, toCandidatePreview } from '../matching/matching.service';
import { publish, rooms } from '../../realtime/emitter';
import { assertFacilityScope } from '../auth/auth.policy';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { HospitalModel, type HospitalDocument } from '../hospitals/hospital.model';
import { UserModel } from '../users/user.model';
import { toRequestDetail, toRequestSummary } from './request.dto';
import { BloodRequestModel, type BloodRequestDocument } from './request.model';
import { buildTimeline } from './request.timeline';
import { EscalationEventModel } from './escalationEvent.model';
import { allowedActions, applyTransition, assertCanAct } from './request.transitions';

const SIMILARITY_WINDOW_MS = 6 * 60 * 60 * 1000;
const MIN_LEAD_MS = 5 * 60 * 1000;

// ── helpers ──────────────────────────────────────────────────────────────────

function patientRefHash(config: Config, facilityId: string, patientRef: string): string {
  const normalised = patientRef.trim().toUpperCase().replace(/\s+/g, ' ');
  return hmacHex(config.PATIENT_REF_SECRET, `${facilityId}:${normalised}`);
}

async function loadFacility(id: Types.ObjectId | string): Promise<HospitalDocument> {
  const facility = await HospitalModel.findById(id);
  if (!facility) throw new AppError('NOT_FOUND', 'Not found.');
  return facility;
}

/** Loads a request the user may see: own facility for staff, any for admin; 404 otherwise. */
async function loadScoped(id: string, user: AuthUser): Promise<{ request: BloodRequestDocument; facility: HospitalDocument }> {
  const request = await BloodRequestModel.findById(id);
  if (!request) throw new AppError('NOT_FOUND', 'Not found.');
  assertFacilityScope(user, request.facilityId);
  return { request, facility: await loadFacility(request.facilityId) };
}

/**
 * Soft duplicate signal (docs/security.md §6): same facility and blood group, still active,
 * raised within 6 h, deadline within ±6 h, but a different patient reference. Flags for human
 * review — never rejects on its own.
 */
async function findSimilar(args: {
  facilityId: Types.ObjectId | string;
  bloodGroup: string;
  patientRefHash: string;
  deadlineAt: Date;
  excludeId?: Types.ObjectId;
}): Promise<BloodRequestDocument[]> {
  const now = Date.now();
  return BloodRequestModel.find({
    facilityId: args.facilityId,
    isActive: true,
    bloodGroup: args.bloodGroup,
    patientRefHash: { $ne: args.patientRefHash },
    createdAt: { $gte: new Date(now - SIMILARITY_WINDOW_MS) },
    deadlineAt: {
      $gte: new Date(args.deadlineAt.getTime() - SIMILARITY_WINDOW_MS),
      $lte: new Date(args.deadlineAt.getTime() + SIMILARITY_WINDOW_MS),
    },
    ...(args.excludeId && { _id: { $ne: args.excludeId } }),
  })
    .sort({ createdAt: -1 })
    .limit(10);
}

async function userNames(ids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique } }).select('name').lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

export async function buildDetail(
  request: BloodRequestDocument,
  facility: HospitalDocument,
  user: AuthUser,
  config: Config,
): Promise<RequestDetail> {
  const [candidates, timeline, names, assignments, alertSummary] = await Promise.all([
    request.duplicateReview.candidates.length
      ? BloodRequestModel.find({ _id: { $in: request.duplicateReview.candidates } })
      : Promise.resolve([] as BloodRequestDocument[]),
    buildTimeline(request._id),
    userNames([request.createdBy, request.verification?.by, request.duplicateReview.by, request.closure?.by, request.review?.by]),
    listForHospital(request._id, user),
    summariseAlerts(request._id),
  ]);
  return toRequestDetail(request, {
    facility,
    names,
    candidates,
    timeline,
    allowedActions: allowedActions({ request, facility, user, config }),
    assignments,
    alertSummary,
  });
}

function audit(ctx: ActionContext, request: BloodRequestDocument, action: string, extra: Partial<Parameters<typeof recordAudit>[0]> = {}) {
  return {
    actor: userActor(ctx.user),
    action,
    resourceType: 'bloodRequest',
    resourceId: request._id,
    facilityId: request.facilityId,
    requestId: ctx.requestId,
    ...extra,
  };
}

/** Realtime nudge after a committed change: facility, admins, coordinators; plus affected donors. */
function announce(request: { _id: Types.ObjectId; facilityId: Types.ObjectId }, donorUserIds: string[] = []): void {
  publish('request', [rooms.facility(request.facilityId), rooms.role('admin'), rooms.role('coordinator')], request._id);
  if (donorUserIds.length > 0) publish('alert', donorUserIds.map((id) => rooms.user(id)), request._id);
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createRequest(
  input: CreateRequestInput,
  ctx: ActionContext,
  config: Config,
  /** Runs inside the creation transaction (e.g. linking a family lead); throwing aborts everything. */
  onCreated?: (session: ClientSession, request: BloodRequestDocument) => Promise<void>,
): Promise<{ request: BloodRequestDocument; possibleDuplicate: boolean }> {
  const { user } = ctx;
  if (user.role !== 'hospital_staff' || !user.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff can raise requests.');
  const facility = await loadFacility(user.facilityId);
  if (facility.verificationStatus !== 'verified') {
    throw new AppError('FORBIDDEN', 'Your facility is not verified, so it cannot raise official requests yet.');
  }

  const deadlineAt = new Date(input.deadlineAt);
  const lead = deadlineAt.getTime() - Date.now();
  if (lead < MIN_LEAD_MS || lead > MAX_DEADLINE_HOURS * 3_600_000) {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', {
      fields: { deadlineAt: `must be between 5 minutes and ${MAX_DEADLINE_HOURS} hours from now` },
    });
  }

  const refHash = patientRefHash(config, user.facilityId, input.patientRef);
  const similar = await findSimilar({ facilityId: user.facilityId, bloodGroup: input.bloodGroup, patientRefHash: refHash, deadlineAt });
  const possibleDuplicate = similar.length > 0;

  // A fresh public code per attempt; a collision on the 40-bit code is astronomically rare but handled.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const request = await withTransaction(async (session) => {
        const [created] = await BloodRequestModel.create(
          [
            {
              publicCode: generatePublicCode(),
              facilityId: user.facilityId,
              createdBy: user.id,
              bloodGroup: input.bloodGroup,
              acceptCompatibleGroups: input.acceptCompatibleGroups,
              unitsRequested: input.unitsRequested,
              urgencySuggested: suggestUrgency(deadlineAt),
              deadlineAt,
              patientRefHash: refHash,
              patientLabel: input.patientLabel || null,
              clinicalNote: input.clinicalNote || null,
              duplicateReview: possibleDuplicate
                ? { status: 'pending', candidates: similar.map((r) => r._id) }
                : { status: 'none', candidates: [] },
            },
          ],
          { session },
        );
        const request = created!;
        await recordAudit(audit(ctx, request, 'request.created', { detail: { publicCode: request.publicCode } }), session);
        if (possibleDuplicate) {
          await recordAudit(
            audit(ctx, request, 'request.duplicate_flagged', { detail: { candidates: similar.map((r) => r.publicCode) } }),
            session,
          );
        }
        if (onCreated) await onCreated(session, request);
        return request;
      });
      announce(request);
      return { request, possibleDuplicate };
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      if (err.keyPattern && 'publicCode' in err.keyPattern) continue;
      // One active request per patient per facility (unique partial index) — race-safe.
      const existing = await BloodRequestModel.findOne({ facilityId: user.facilityId, patientRefHash: refHash, isActive: true }).select('_id publicCode');
      throw new AppError('ACTIVE_REQUEST_EXISTS', 'This patient already has an active request at your facility. Update or close it instead.', {
        fields: existing ? { existingRequestId: existing._id.toString(), existingPublicCode: existing.publicCode } : undefined,
      });
    }
  }
  throw new AppError('INTERNAL', 'Could not allocate a request code. Please try again.');
}

// ── read ─────────────────────────────────────────────────────────────────────

export async function listRequests(
  query: z.output<typeof listRequestsQuerySchema>,
  user: AuthUser,
): Promise<{ items: RequestSummary[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (user.role === 'admin') {
    if (query.facilityId) filter.facilityId = query.facilityId;
  } else {
    filter.facilityId = user.facilityId; // staff always see only their own facility
  }
  if (query.requestStatus) filter.requestStatus = query.requestStatus;
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
  if (query.active) filter.isActive = query.active === 'true';

  const [docs, total] = await Promise.all([
    BloodRequestModel.find(filter)
      .sort({ isActive: -1, deadlineAt: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    BloodRequestModel.countDocuments(filter),
  ]);
  const facilities = await HospitalModel.find({ _id: { $in: [...new Set(docs.map((d) => d.facilityId.toString()))] } }).select('name');
  const names = new Map(facilities.map((f) => [f._id.toString(), f.name]));
  return { items: docs.map((d) => toRequestSummary(d, names.get(d.facilityId.toString()) ?? null)), total };
}

export async function getRequestDetail(id: string, user: AuthUser, config: Config): Promise<RequestDetail> {
  const { request, facility } = await loadScoped(id, user);
  return buildDetail(request, facility, user, config);
}

// ── transitions ──────────────────────────────────────────────────────────────

async function prepare(id: string, action: RequestAction, ctx: ActionContext, config: Config) {
  const loaded = await loadScoped(id, ctx.user);
  assertCanAct(action, { ...loaded, user: ctx.user, config });
  return loaded;
}

export async function verifyRequest(id: string, input: VerifyRequestInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const { request, facility } = await prepare(id, 'verify', ctx, config);

  // Re-run the duplicate check at verification: another request may have arrived since creation.
  const known = new Set(request.duplicateReview.candidates.map(String));
  const fresh = (
    await findSimilar({
      facilityId: request.facilityId,
      bloodGroup: request.bloodGroup,
      patientRefHash: request.patientRefHash,
      deadlineAt: request.deadlineAt,
      excludeId: request._id,
    })
  ).filter((r) => !known.has(r._id.toString()));
  if (fresh.length > 0) {
    await withTransaction(async (session) => {
      const flagged = await applyTransition(session, {
        id,
        expectedVersion: input.expectedVersion,
        action: 'verify',
        update: {
          $set: { 'duplicateReview.status': 'pending', 'duplicateReview.by': null, 'duplicateReview.at': null, 'duplicateReview.reason': null },
          $addToSet: { 'duplicateReview.candidates': { $each: fresh.map((r) => r._id) } },
        },
      });
      await recordAudit(audit(ctx, flagged, 'request.duplicate_flagged', { detail: { candidates: fresh.map((r) => r.publicCode) } }), session);
    });
    throw new AppError('DUPLICATE_REVIEW_PENDING', 'A similar request arrived since this one was raised. Review it before verifying.');
  }

  // Rank donors before the transaction (routing calls are slow); the batch is inserted inside it.
  const firstBatch = await matchFirstBatch(request, facility, config);

  let alerted: string[] = [];
  const updated = await withTransaction(async (session) => {
    const now = new Date();
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action: 'verify',
      update: {
        $set: {
          verificationStatus: 'verified',
          verification: { by: new Types.ObjectId(ctx.user.id), at: now, reason: null },
          verifiedAt: now,
          urgencyConfirmed: input.urgencyConfirmed,
          requestStatus: 'awaiting_donor',
          alertBatches: 1,
          escalationStep: 0,
        },
      },
    });
    await recordAudit(
      audit(ctx, doc, 'request.verified', {
        changes: { verificationStatus: ['pending', 'verified'], requestStatus: ['open', 'awaiting_donor'] },
        detail: { urgencyConfirmed: input.urgencyConfirmed, urgencySuggested: doc.urgencySuggested },
      }),
      session,
    );
    // No donor is contacted before this point (docs/state-machines.md §2).
    alerted = await insertAlertBatch(session, { request: doc, candidates: firstBatch.ranked, batch: 0, actor: userActor(ctx.user), requestId: ctx.requestId, config });
    // Escalation ladder step 0 (docs/state-machines.md §5) is this first batch; the worker runs steps 1+.
    await EscalationEventModel.create(
      [{ requestId: doc._id, step: 0, outcome: alerted.length > 0 ? 'executed' : 'skipped_condition_not_met', detail: { alerted: alerted.length }, at: now }],
      { session },
    );
    return doc;
  });
  announce(updated, alerted);
  return buildDetail(updated, facility, ctx.user, config);
}

function closeUpdate(reason: 'rejected' | 'cancelled' | 'duplicate' | 'fulfilled', ctx: ActionContext, extra: { note?: string | null; unitsReceived?: number | null } = {}) {
  return {
    requestStatus: 'closed' as const,
    isActive: false,
    closure: {
      reason,
      by: new Types.ObjectId(ctx.user.id),
      at: new Date(),
      note: extra.note ?? null,
      unitsReceived: extra.unitsReceived ?? null,
    },
  };
}

export async function rejectRequest(id: string, input: ReasonedTransitionInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const { request, facility } = await prepare(id, 'reject', ctx, config);
  const updated = await withTransaction(async (session) => {
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action: 'reject',
      update: {
        $set: {
          ...closeUpdate('rejected', ctx, { note: input.reason }),
          verificationStatus: 'rejected',
          verification: { by: new Types.ObjectId(ctx.user.id), at: new Date(), reason: input.reason },
        },
      },
    });
    await recordAudit(
      audit(ctx, doc, 'request.rejected', { reason: input.reason, changes: { requestStatus: [request.requestStatus, 'closed'] } }),
      session,
    );
    return doc;
  });
  announce(updated);
  return buildDetail(updated, facility, ctx.user, config);
}

export async function reviewDuplicate(id: string, input: DuplicateReviewInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const { request, facility } = await prepare(id, 'review_duplicate', ctx, config);

  if (input.decision === 'duplicate') {
    const original = await BloodRequestModel.findById(input.duplicateOfRequestId);
    if (!original || original.facilityId.toString() !== request.facilityId.toString() || original._id.equals(request._id)) {
      throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { duplicateOfRequestId: 'choose another request from this facility' },
      });
    }
  }

  const updated = await withTransaction(async (session) => {
    const decided = { 'duplicateReview.by': new Types.ObjectId(ctx.user.id), 'duplicateReview.at': new Date(), 'duplicateReview.reason': input.reason };
    if (input.decision === 'distinct') {
      const doc = await applyTransition(session, {
        id,
        expectedVersion: input.expectedVersion,
        action: 'review_duplicate',
        update: { $set: { 'duplicateReview.status': 'distinct', ...decided } },
      });
      await recordAudit(audit(ctx, doc, 'request.duplicate_cleared', { reason: input.reason }), session);
      return doc;
    }
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action: 'review_duplicate',
      update: {
        $set: {
          'duplicateReview.status': 'duplicate',
          ...decided,
          duplicateOfRequestId: new Types.ObjectId(input.duplicateOfRequestId),
          ...closeUpdate('duplicate', ctx, { note: input.reason }),
        },
      },
    });
    await recordAudit(
      audit(ctx, doc, 'request.closed_duplicate', { reason: input.reason, detail: { duplicateOfRequestId: input.duplicateOfRequestId } }),
      session,
    );
    return doc;
  });
  announce(updated);
  return buildDetail(updated, facility, ctx.user, config);
}

export async function cancelRequest(id: string, input: ReasonedTransitionInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const { request, facility } = await prepare(id, 'cancel', ctx, config);
  let notified: string[] = [];
  const updated = await withTransaction(async (session) => {
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action: 'cancel',
      update: { $set: closeUpdate('cancelled', ctx, { note: input.reason }) },
    });
    notified = await endForClosedRequest(session, doc, 'cancelled', 'request cancelled by the hospital');
    await recordAudit(
      audit(ctx, doc, 'request.cancelled', { reason: input.reason, changes: { requestStatus: [request.requestStatus, 'closed'] } }),
      session,
    );
    return doc;
  });
  announce(updated, notified);
  return buildDetail(updated, facility, ctx.user, config);
}

export async function fulfillRequest(id: string, input: FulfillRequestInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const { request, facility } = await prepare(id, 'fulfill', ctx, config);
  if (input.unitsReceived > request.unitsRequested) {
    throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', {
      fields: { unitsReceived: `cannot exceed the ${request.unitsRequested} unit(s) requested` },
    });
  }
  let notified: string[] = [];
  const updated = await withTransaction(async (session) => {
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action: 'fulfill',
      update: { $set: closeUpdate('fulfilled', ctx, { note: input.note, unitsReceived: input.unitsReceived }) },
    });
    // Donors still on their way are released; donations already made stay recorded.
    notified = await endForClosedRequest(session, doc, 'fulfilled', 'request fulfilled — no longer needed');
    await recordAudit(
      audit(ctx, doc, 'request.fulfilled', {
        changes: { requestStatus: [request.requestStatus, 'closed'] },
        detail: { unitsReceived: input.unitsReceived, unitsRequested: request.unitsRequested },
      }),
      session,
    );
    return doc;
  });
  announce(updated, notified);
  return buildDetail(updated, facility, ctx.user, config);
}

// ── matching preview ─────────────────────────────────────────────────────────

/** Ranked donors the next batch would alert, plus the manual-review list. Read-only. */
export async function getCandidatePreview(id: string, user: AuthUser, config: Config): Promise<CandidatePreview> {
  const { request, facility } = await loadScoped(id, user);
  if (request.requestStatus === 'closed') throw new AppError('INVALID_TRANSITION', 'This request is closed.');
  return toCandidatePreview(await matchDonors(request, facility, config, { escalationStep: request.alertBatches }));
}

/** Hospital "alert more donors": next batch with the contact cooldown relaxed, reason audited. */
export async function alertMoreDonors(
  id: string,
  input: { expectedVersion: number; reason: string },
  ctx: ActionContext,
  config: Config,
): Promise<RequestDetail> {
  await prepare(id, 'alert_next_batch', ctx, config);
  const { request, alertedDonorIds } = await alertNextBatch(id, {
    actor: userActor(ctx.user),
    config,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
    httpRequestId: ctx.requestId,
  });
  announce(request, alertedDonorIds);
  return buildDetail(request, await loadFacility(request.facilityId), ctx.user, config);
}

// ── administrator review flag ────────────────────────────────────────────────

/**
 * Places a request under review (or clears it). While flagged, the public checker shows "under
 * review", verification and new donor alerts are refused, and escalation skips the request.
 * Cancelling, rejecting and fulfilling stay possible.
 */
export async function setReviewFlag(id: string, input: ReviewFlagInput, ctx: ActionContext, config: Config): Promise<RequestDetail> {
  const action = input.flagged ? 'flag_review' : 'clear_review';
  const { facility } = await prepare(id, action, ctx, config);
  const updated = await withTransaction(async (session) => {
    const doc = await applyTransition(session, {
      id,
      expectedVersion: input.expectedVersion,
      action,
      update: {
        $set: { review: input.flagged ? { by: new Types.ObjectId(ctx.user.id), at: new Date(), reason: input.reason } : null },
      },
    });
    await recordAudit(audit(ctx, doc, input.flagged ? 'request.flagged_under_review' : 'request.review_cleared', { reason: input.reason }), session);
    return doc;
  });
  announce(updated);
  return buildDetail(updated, facility, ctx.user, config);
}
