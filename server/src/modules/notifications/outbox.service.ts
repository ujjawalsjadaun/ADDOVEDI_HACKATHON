import type { NotificationQueueHealth, NotificationStatus, NotificationType, NotificationView } from '@golden-hour/shared';
import type { ClientSession, Types } from 'mongoose';
import type { Logger } from 'pino';
import type { Config } from '../../config/env';
import { isDbConnected } from '../../lib/db';
import { AppError } from '../../lib/errors';
import { maskPhone } from '../../lib/mask';
import { withTransaction } from '../../lib/transaction';
import { getSmsProvider } from '../../providers/sms/sms.provider';
import { publish, rooms } from '../../realtime/emitter';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext } from '../auth/auth.types';
import { DonorProfileModel } from '../donors/donor.model';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { OutboxModel, type OutboxDocument } from './outbox.model';
import { renderSms, type TemplateVars } from './templates';

const LEASE_MS = 30_000;
const BATCH_PER_TICK = 20;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

// ── enqueue (inside the business transaction) ────────────────────────────────

/**
 * Records a notification intent in the caller's transaction. Upsert on the unique `eventId`, so
 * the same event can never be queued twice (retries, double clicks, worker restarts).
 */
export async function enqueueNotification(
  session: ClientSession,
  n: { eventId: string; type: NotificationType; recipientUserId: Types.ObjectId | string; requestId?: Types.ObjectId | null; vars: TemplateVars },
): Promise<void> {
  await OutboxModel.updateOne(
    { eventId: n.eventId },
    {
      $setOnInsert: {
        eventId: n.eventId,
        type: n.type,
        channel: 'sms',
        recipientUserId: n.recipientUserId,
        requestId: n.requestId ?? null,
        vars: n.vars,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    },
    { upsert: true, session },
  );
}

// ── worker tick ──────────────────────────────────────────────────────────────

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(exp * (0.75 + Math.random() * 0.5)); // ±25 % jitter
}

/** Claims one due message with a lease. An expired lease (crash mid-send) is reclaimed; the provider dedupes on eventId. */
function claimNext(): Promise<OutboxDocument | null> {
  const now = new Date();
  return OutboxModel.findOneAndUpdate(
    {
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'sending', lockedUntil: { $lte: now } },
      ],
    },
    { $set: { status: 'sending', lockedUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { new: true, sort: { nextAttemptAt: 1 } },
  );
}

async function finish(msg: OutboxDocument, update: Record<string, unknown>): Promise<void> {
  await OutboxModel.updateOne({ _id: msg._id, status: 'sending' }, { $set: { lockedUntil: null, ...update } });
  publish('notification', [rooms.role('admin')], msg._id);
  if (msg.requestId) {
    const request = await BloodRequestModel.findById(msg.requestId).select('facilityId').lean();
    publish('request', [rooms.facility(request?.facilityId)], msg.requestId);
  }
}

async function sendOne(msg: OutboxDocument, config: Config): Promise<void> {
  const [user, profile] = await Promise.all([
    UserModel.findById(msg.recipientUserId).select('phone status').lean(),
    DonorProfileModel.findOne({ userId: msg.recipientUserId }).select('consent').lean(),
  ]);
  // Consent and number are re-checked at send time: a revoked consent stops queued messages.
  if (!user?.phone) return finish(msg, { status: 'failed', lastError: 'NO_PHONE_NUMBER' });
  if (user.status !== 'active') return finish(msg, { status: 'failed', lastError: 'ACCOUNT_NOT_ACTIVE' });
  if (msg.type === 'donor_alert' && !profile?.consent?.contact) return finish(msg, { status: 'failed', lastError: 'NO_CONTACT_CONSENT' });

  const body = renderSms(msg.type, msg.vars as TemplateVars);
  const result = await getSmsProvider(config)
    .send({ to: user.phone, body, idempotencyKey: msg.eventId })
    .catch((err: unknown) => ({ status: 'failed' as const, errorCode: err instanceof Error ? err.message.slice(0, 120) : 'SEND_ERROR', permanent: false }));

  if (result.status === 'accepted') {
    return finish(msg, { status: 'sent', providerMessageId: result.providerMessageId, sentAt: new Date(), lastError: null });
  }
  if (result.permanent || msg.attempts >= config.OUTBOX_MAX_ATTEMPTS) {
    return finish(msg, { status: 'failed', lastError: result.errorCode });
  }
  return finish(msg, { status: 'pending', lastError: result.errorCode, nextAttemptAt: new Date(Date.now() + backoffMs(msg.attempts)) });
}

/** One worker pass: sends up to a small batch of due messages. Safe to run concurrently. */
export async function processOutbox(config: Config, logger: Logger): Promise<number> {
  if (!isDbConnected()) return 0;
  let handled = 0;
  for (; handled < BATCH_PER_TICK; handled++) {
    const msg = await claimNext();
    if (!msg) break;
    try {
      await sendOne(msg, config);
    } catch (err) {
      logger.error({ err, eventId: msg.eventId }, 'outbox send failed unexpectedly');
      await OutboxModel.updateOne(
        { _id: msg._id, status: 'sending' },
        { $set: { status: 'pending', lockedUntil: null, lastError: 'WORKER_ERROR', nextAttemptAt: new Date(Date.now() + backoffMs(msg.attempts)) } },
      ).catch(() => undefined);
    }
  }
  return handled;
}

// ── admin views ──────────────────────────────────────────────────────────────

export async function listNotifications(query: { status?: NotificationStatus; page: number; limit: number }): Promise<{ items: NotificationView[]; total: number }> {
  const filter = query.status ? { status: query.status } : {};
  const [rows, total] = await Promise.all([
    OutboxModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    OutboxModel.countDocuments(filter),
  ]);
  const [users, requests] = await Promise.all([
    UserModel.find({ _id: { $in: rows.map((r) => r.recipientUserId) } }).select('name phone').lean(),
    BloodRequestModel.find({ _id: { $in: rows.map((r) => r.requestId).filter(Boolean) } }).select('publicCode').lean(),
  ]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const codeById = new Map(requests.map((r) => [r._id.toString(), r.publicCode]));
  return {
    items: rows.map((r) => {
      const u = userById.get(r.recipientUserId.toString());
      return {
        id: r._id.toString(),
        eventId: r.eventId,
        type: r.type,
        channel: 'sms',
        recipient: { name: u?.name ?? null, phoneMasked: maskPhone(u?.phone) },
        status: r.status,
        attempts: r.attempts,
        lastError: r.lastError ?? null,
        providerMessageId: r.providerMessageId ?? null,
        body: renderSms(r.type, r.vars as TemplateVars),
        request: r.requestId ? { id: r.requestId.toString(), publicCode: codeById.get(r.requestId.toString()) ?? '' } : null,
        createdAt: (r.get('createdAt') as Date).toISOString(),
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        nextAttemptAt: r.status === 'pending' ? r.nextAttemptAt.toISOString() : null,
        canRetry: r.status === 'failed',
      };
    }),
    total,
  };
}

/** Admin re-queues a failed message (e.g. after fixing a phone number). Audited. */
export async function retryNotification(id: string, reason: string, ctx: ActionContext): Promise<void> {
  await withTransaction(async (session) => {
    const msg = await OutboxModel.findOneAndUpdate(
      { _id: id, status: 'failed' },
      { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null } },
      { new: true, session },
    );
    if (!msg) throw new AppError('INVALID_TRANSITION', 'Only failed messages can be retried.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'notification.retried',
        resourceType: 'notification',
        resourceId: msg._id,
        reason,
        detail: { eventId: msg.eventId },
        requestId: ctx.requestId,
      },
      session,
    );
  });
  publish('notification', [rooms.role('admin')], id);
}

export async function queueHealth(config: Config): Promise<NotificationQueueHealth> {
  const [rows, oldest] = await Promise.all([
    OutboxModel.aggregate<{ _id: NotificationStatus; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    OutboxModel.findOne({ status: 'pending' }).sort({ createdAt: 1 }).select('createdAt').lean(),
  ]);
  const provider = getSmsProvider(config);
  return {
    provider: { name: provider.name, simulated: provider.simulated },
    counts: Object.fromEntries(rows.map((r) => [r._id, r.n])),
    oldestPendingAt: oldest ? (oldest as unknown as { createdAt: Date }).createdAt.toISOString() : null,
  };
}

/** SMS outbox status counts for one request's notifications. */
export async function smsCountsForRequest(requestId: Types.ObjectId): Promise<Partial<Record<NotificationStatus, number>>> {
  const rows = await OutboxModel.aggregate<{ _id: NotificationStatus; n: number }>([
    { $match: { requestId, type: 'donor_alert' } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}
