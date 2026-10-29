import { randomBytes } from 'node:crypto';
import type { AlertSummary, DonorAlertReportInput, DonorAlertView } from '@golden-hour/shared';
import type { ClientSession, Types } from 'mongoose';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { withTransaction } from '../../lib/transaction';
import { hmacHex } from '../../lib/crypto';
import { SuspiciousReportModel } from '../public-checker/suspiciousReport.model';
import { recordAudit, type AuditActor } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DonorProfileModel } from '../donors/donor.model';
import { HospitalModel, type HospitalDocument } from '../hospitals/hospital.model';
import { matchDonors, type MatchResult, type RankedCandidate } from '../matching/matching.service';
import { BloodRequestModel, type BloodRequestDocument } from '../requests/request.model';
import { applyTransition } from '../requests/request.transitions';
import { enqueueNotification, smsCountsForRequest } from '../notifications/outbox.service';
import { publish, rooms } from '../../realtime/emitter';
import { formatDeadline } from '../notifications/templates';
import { effectiveResponse, toDonorAlertView } from './alert.dto';
import { RequestAlertModel } from './alert.model';

/**
 * Inserts the next alert batch inside the caller's transaction and records it on the request
 * timeline. In-app alerts are `delivered` once written; an SMS copy is queued in the outbox in the same
 * transaction and its delivery is tracked separately. Returns the alerted donors' user ids.
 */
export async function insertAlertBatch(
  session: ClientSession,
  args: {
    request: BloodRequestDocument;
    candidates: RankedCandidate[];
    batch: number;
    actor: AuditActor;
    requestId?: string;
    config: Config;
  },
): Promise<string[]> {
  const { request, config } = args;
  const chosen = args.candidates.slice(0, config.ALERT_BATCH_SIZE);
  const now = new Date();

  if (chosen.length === 0) {
    await recordAudit(
      {
        actor: args.actor,
        action: 'request.no_candidates',
        resourceType: 'bloodRequest',
        resourceId: request._id,
        facilityId: request.facilityId,
        detail: { batch: args.batch },
        requestId: args.requestId,
      },
      session,
    );
    return [];
  }

  const facility = await HospitalModel.findById(request.facilityId).session(session);
  const created = await RequestAlertModel.insertMany(
    chosen.map((c) => ({
      requestId: request._id,
      facilityId: request.facilityId,
      donorUserId: c.donorUserId,
      batch: args.batch,
      rank: c.rank,
      eta: c.eta,
      channels: ['in_app', 'sms'],
      deliveryStatus: 'delivered',
      response: 'pending',
      expiresAt: new Date(now.getTime() + config.ALERT_RESPONSE_WINDOW_MIN * 60_000),
      responseToken: randomBytes(16).toString('base64url'),
      shortCode: newShortCode(),
    })),
    { session },
  );
  await DonorProfileModel.updateMany({ _id: { $in: chosen.map((c) => c.profileId) } }, { $set: { lastAlertedAt: now } }, { session });
  for (const alert of created) {
    await enqueueNotification(session, {
      eventId: `alert:${alert._id.toString()}:sms`,
      type: 'donor_alert',
      recipientUserId: alert.donorUserId,
      requestId: request._id,
      vars: {
        publicCode: request.publicCode,
        facilityName: facility?.name ?? 'A hospital',
        district: facility?.district ?? '',
        bloodGroup: request.bloodGroup,
        deadlineText: formatDeadline(request.deadlineAt),
        checkUrl: `${config.PUBLIC_APP_URL}/check/${request.publicCode}`,
        appUrl: config.PUBLIC_APP_URL,
        shortCode: alert.shortCode ?? undefined,
      },
    });
  }
  await recordAudit(
    {
      actor: args.actor,
      action: 'request.alerted',
      resourceType: 'bloodRequest',
      resourceId: request._id,
      facilityId: request.facilityId,
      detail: { batch: args.batch, donors: chosen.length },
      requestId: args.requestId,
    },
    session,
  );
  return chosen.map((c) => c.donorUserId);
}

/** 4 characters from an alphabet without look-alikes (no 0/O, 1/I). Only needs to be unique per donor's open alerts. */
function newShortCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Alerts the next batch for a request still awaiting donors — used by the hospital's "alert more
 * donors" action, after a withdrawal/no-show, and by the escalation worker (Phase 10).
 * From the second batch on, the contact cooldown is relaxed (never the other filters).
 */
export async function alertNextBatch(
  requestId: string | Types.ObjectId,
  opts: { actor: AuditActor; config: Config; expectedVersion?: number; reason?: string; httpRequestId?: string },
): Promise<{ alertedDonorIds: string[]; request: BloodRequestDocument }> {
  const request = await BloodRequestModel.findById(requestId);
  if (!request) throw new AppError('NOT_FOUND', 'Not found.');
  if (request.requestStatus !== 'awaiting_donor') {
    throw new AppError('INVALID_TRANSITION', 'More donors can only be alerted while the request is waiting for donors.');
  }
  // Every path (manual, escalation, slot refill after a withdrawal/no-show) honours an administrator's pause.
  if (request.review) {
    throw new AppError('INVALID_TRANSITION', 'This request is under administrator review; no more donors are alerted until it is cleared.');
  }
  const facility = await HospitalModel.findById(request.facilityId);
  if (!facility) throw new AppError('NOT_FOUND', 'Not found.');

  const batch = request.alertBatches;
  const match = await matchDonors(request, facility, opts.config, { escalationStep: Math.max(1, batch) });

  return withTransaction(async (session) => {
    const updated = await applyTransition(session, {
      id: request._id.toString(),
      expectedVersion: opts.expectedVersion ?? request.version,
      action: 'alert_next_batch',
      update: { $inc: { alertBatches: 1 } },
    });
    const alertedDonorIds = await insertAlertBatch(session, {
      request: updated,
      candidates: match.ranked,
      batch,
      actor: opts.actor,
      requestId: opts.httpRequestId,
      config: opts.config,
    });
    if (opts.reason) {
      await recordAudit(
        {
          actor: opts.actor,
          action: 'request.search_widened',
          resourceType: 'bloodRequest',
          resourceId: updated._id,
          facilityId: updated.facilityId,
          reason: opts.reason,
          requestId: opts.httpRequestId,
        },
        session,
      );
    }
    return { alertedDonorIds, request: updated };
  });
}

/** Pre-computes the first batch for verification; the caller inserts it in its transaction. */
export function matchFirstBatch(request: BloodRequestDocument, facility: HospitalDocument, config: Config): Promise<MatchResult> {
  return matchDonors(request, facility, config, { escalationStep: 0 });
}

/** Cancels every still-pending alert of a request (request closed or all slots filled). */
export async function cancelPendingAlerts(session: ClientSession, requestId: Types.ObjectId): Promise<void> {
  await RequestAlertModel.updateMany(
    { requestId, response: 'pending' },
    { $set: { response: 'cancelled', respondedAt: new Date() } },
    { session },
  );
}

export async function declineAlert(alertId: string, user: AuthUser): Promise<DonorAlertView> {
  const alert = await RequestAlertModel.findOne({ _id: alertId, donorUserId: user.id });
  if (!alert) throw new AppError('NOT_FOUND', 'Not found.');
  const response = effectiveResponse(alert);
  if (response === 'declined') return loadDonorAlertView(alert._id); // repeated answer → same result
  if (response !== 'pending') throw new AppError('INVALID_TRANSITION', `This alert is already ${response}.`, { current: { response } });

  await withTransaction(async (session) => {
    const updated = await RequestAlertModel.findOneAndUpdate(
      { _id: alert._id, response: 'pending' },
      { $set: { response: 'declined', respondedAt: new Date() } },
      { new: true, session },
    );
    if (!updated) throw new AppError('CONFLICT', 'This alert just changed. Refresh and try again.');
    await recordAudit(
      {
        actor: { type: 'user', userId: user.id, role: user.role },
        action: 'donor.declined',
        resourceType: 'bloodRequest',
        resourceId: updated.requestId,
        facilityId: updated.facilityId,
        detail: { alertId: updated._id.toString() },
      },
      session,
    );
  });
  publish('request', [rooms.facility(alert.facilityId), rooms.role('admin')], alert.requestId);
  return loadDonorAlertView(alert._id);
}

export async function loadDonorAlertView(alertId: Types.ObjectId | string): Promise<DonorAlertView> {
  const alert = await RequestAlertModel.findById(alertId);
  if (!alert) throw new AppError('NOT_FOUND', 'Not found.');
  const request = await BloodRequestModel.findById(alert.requestId);
  const facility = request ? await HospitalModel.findById(request.facilityId) : null;
  if (!request || !facility) throw new AppError('NOT_FOUND', 'Not found.');
  return toDonorAlertView(alert, request, facility);
}

export async function listDonorAlerts(userId: string): Promise<DonorAlertView[]> {
  const alerts = await RequestAlertModel.find({ donorUserId: userId }).sort({ createdAt: -1 }).limit(30);
  const requests = await BloodRequestModel.find({ _id: { $in: alerts.map((a) => a.requestId) } });
  const facilities = await HospitalModel.find({ _id: { $in: requests.map((r) => r.facilityId) } });
  const reqById = new Map(requests.map((r) => [r._id.toString(), r]));
  const facById = new Map(facilities.map((f) => [f._id.toString(), f]));
  return alerts.flatMap((a) => {
    const r = reqById.get(a.requestId.toString());
    const f = r && facById.get(r.facilityId.toString());
    return r && f ? [toDonorAlertView(a, r, f)] : [];
  });
}

export async function summariseAlerts(requestId: Types.ObjectId): Promise<AlertSummary> {
  const alerts = await RequestAlertModel.find({ requestId }).select('response expiresAt deliveryStatus createdAt').lean();
  const summary: AlertSummary = {
    total: alerts.length,
    pending: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    cancelled: 0,
    delivery: {},
    sms: await smsCountsForRequest(requestId),
    lastBatchAt: null,
  };
  for (const a of alerts) {
    summary[effectiveResponse(a)] += 1;
    summary.delivery[a.deliveryStatus] = (summary.delivery[a.deliveryStatus] ?? 0) + 1;
    const created = (a as { createdAt?: Date }).createdAt;
    if (created && (!summary.lastBatchAt || created.toISOString() > summary.lastBatchAt)) summary.lastBatchAt = created.toISOString();
  }
  return summary;
}

/**
 * A donor reports the request behind one of their alerts as suspicious. It lands in the same admin queue as
 * public reports. The reporter is stored only as a keyed hash of the user id (one report per donor per
 * request), so administrators see the report but not who filed it. Idempotent for repeats.
 */
export async function reportAlertSuspicious(alertId: string, input: DonorAlertReportInput, user: AuthUser, config: Config): Promise<void> {
  const alert = await RequestAlertModel.findOne({ _id: alertId, donorUserId: user.id });
  if (!alert) throw new AppError('NOT_FOUND', 'Not found.');
  const request = await BloodRequestModel.findById(alert.requestId).select('publicCode');
  if (!request) throw new AppError('NOT_FOUND', 'Not found.');
  const reporterIpHash = hmacHex(config.SESSION_SECRET, `donor:${user.id}`);
  if (await SuspiciousReportModel.exists({ requestId: request._id, reporterIpHash })) return;
  await SuspiciousReportModel.create({
    publicCode: request.publicCode,
    requestId: request._id,
    category: input.category,
    note: input.note || null,
    reporterIpHash,
  });
  publish('request', [rooms.role('admin')], request._id);
}
