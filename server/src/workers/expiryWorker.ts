import type { Logger } from 'pino';
import type { Config } from '../config/env';
import { withTransaction } from '../lib/transaction';
import { SYSTEM_ACTOR, recordAudit } from '../modules/audit/audit.service';
import { RequestAlertModel } from '../modules/alerts/alert.model';
import { endForClosedRequest } from '../modules/assignments/assignment.service';
import { FamilyLeadModel } from '../modules/leads/familyLead.model';
import { BloodRequestModel } from '../modules/requests/request.model';
import { publish, rooms } from '../realtime/emitter';

/**
 * Executes a single tick of the expiry worker (docs/architecture.md §8, docs/state-machines.md §2, §4, §7):
 * 1. Closes requests past their deadline (reason: 'expired'), ending alerts and assignments atomically.
 * 2. Marks pending donor alerts past ALERT_RESPONSE_WINDOW_MIN as 'expired'.
 * 3. Marks pending family leads past their 24h expiresAt as 'expired'.
 * 4. Data retention: purges personal fields on decided family leads older than 30 days.
 */
export async function processExpiry(config: Config, logger: Logger): Promise<{
  expiredRequests: number;
  expiredAlerts: number;
  expiredLeads: number;
  purgedLeads: number;
}> {
  const now = new Date();

  // 1. Overdue requests past deadline
  const overdueRequests = await BloodRequestModel.find({
    requestStatus: { $ne: 'closed' },
    deadlineAt: { $lte: now },
  });

  let expiredRequests = 0;
  for (const req of overdueRequests) {
    try {
      let notifiedDonors: string[] = [];
      const updated = await withTransaction(async (session) => {
        const doc = await BloodRequestModel.findOneAndUpdate(
          { _id: req._id, requestStatus: { $ne: 'closed' } },
          {
            $set: {
              requestStatus: 'closed',
              isActive: false,
              closure: {
                reason: 'expired',
                by: null,
                at: now,
                note: 'Request deadline passed',
                unitsReceived: null,
              },
            },
            $inc: { version: 1 },
          },
          { session, new: true },
        );
        if (!doc) return null;

        // Cancel pending alerts and release active assignments
        notifiedDonors = await endForClosedRequest(session, doc, 'expired', 'Request deadline passed');

        await recordAudit(
          {
            actor: SYSTEM_ACTOR,
            action: 'request.expired',
            resourceType: 'bloodRequest',
            resourceId: doc._id,
            facilityId: doc.facilityId,
            reason: 'Request deadline passed',
            changes: { requestStatus: [req.requestStatus, 'closed'] },
          },
          session,
        );
        return doc;
      });

      if (updated) {
        expiredRequests++;
        publish('request', [rooms.facility(req.facilityId), rooms.role('admin')], req._id);
        for (const donorId of notifiedDonors) {
          publish('alert', [rooms.user(donorId)], req._id);
        }
        logger.info({ requestId: req._id, publicCode: req.publicCode }, 'blood request expired past deadline');
      }
    } catch (err) {
      logger.error({ err: (err as Error).message, requestId: req._id }, 'failed to expire blood request');
    }
  }

  // 2. Unanswered alerts past expiresAt (ALERT_RESPONSE_WINDOW_MIN)
  const alertResult = await RequestAlertModel.updateMany(
    { response: 'pending', expiresAt: { $lte: now } },
    { $set: { response: 'expired', respondedAt: now } },
  );
  const expiredAlerts = alertResult.modifiedCount;

  // 3. Stale family leads past expiresAt (24h)
  const leadResult = await FamilyLeadModel.updateMany(
    { status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } },
  );
  const expiredLeads = leadResult.modifiedCount;

  // 4. Privacy & data retention: purge contact details on decided family leads older than 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const purgeResult = await FamilyLeadModel.updateMany(
    {
      status: { $in: ['confirmed', 'rejected', 'expired'] },
      updatedAt: { $lte: thirtyDaysAgo },
      contactName: { $ne: '[REDACTED]' },
    },
    {
      $set: {
        contactName: '[REDACTED]',
        contactPhone: '[REDACTED]',
        note: null,
      },
    },
  );
  const purgedLeads = purgeResult.modifiedCount;

  return { expiredRequests, expiredAlerts, expiredLeads, purgedLeads };
}

const EXPIRY_POLL_MS = 60_000;

/**
 * In-process expiry worker (docs/architecture.md §8): polls every 60s, never overlaps itself.
 * Returns a stop function for graceful shutdown.
 */
export function startExpiryWorker(config: Config, logger: Logger): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processExpiry(config, logger)
      .catch((err: unknown) => logger.error({ err }, 'expiry worker tick failed'))
      .finally(() => {
        running = false;
      });
  }, EXPIRY_POLL_MS);
  timer.unref();
  logger.info({ everyMs: EXPIRY_POLL_MS }, 'expiry worker started');
  return () => clearInterval(timer);
}
