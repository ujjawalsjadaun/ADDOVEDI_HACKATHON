import type { Logger } from 'pino';
import type { Config } from '../config/env';
import { isDbConnected } from '../lib/db';
import { isDuplicateKeyError } from '../lib/transaction';
import { SYSTEM_ACTOR, recordAudit } from '../modules/audit/audit.service';
import { alertNextBatch } from '../modules/alerts/alert.service';
import { BloodRequestModel } from '../modules/requests/request.model';
import { EscalationEventModel } from '../modules/requests/escalationEvent.model';
import { publish, rooms } from '../realtime/emitter';

/**
 * Executes a single tick of the escalation ladder (docs/architecture.md §8, docs/state-machines.md §5).
 * For verified, open requests awaiting donors, checks elapsed time against ESCALATION_STEPS_MIN.
 * Each step inserts a unique row into escalationEvents; re-running is guaranteed idempotent.
 */
export async function processEscalations(config: Config, logger: Logger): Promise<number> {
  if (!isDbConnected()) return 0; // database outage: skip quietly, resume on reconnect
  const now = new Date();
  const requests = await BloodRequestModel.find({
    requestStatus: 'awaiting_donor',
    verificationStatus: 'verified',
    verifiedAt: { $ne: null },
    // Requests under administrator review are paused, not escalated.
    review: null,
  });

  let processedCount = 0;

  for (const request of requests) {
    if (!request.verifiedAt) continue;
    const elapsedMs = now.getTime() - request.verifiedAt.getTime();
    const elapsedMin = elapsedMs / 60_000;

    // config.ESCALATION_STEPS_MIN default is [0, 5, 10, 15]
    for (let step = 1; step < config.ESCALATION_STEPS_MIN.length; step++) {
      const stepMinutes = config.ESCALATION_STEPS_MIN[step]!;
      if (elapsedMin < stepMinutes) {
        // Steps are strictly increasing, so later steps cannot be due yet
        break;
      }

      // Check if step already ran
      const existing = await EscalationEventModel.findOne({ requestId: request._id, step });
      if (existing) continue;

      try {
        if (step === 1) {
          // Step 1 (default 5 min): Widen search & relax contact cooldown
          try {
            await EscalationEventModel.create({
              requestId: request._id,
              step: 1,
              outcome: 'executed',
              detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin) },
              at: now,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) continue;
            throw err;
          }

          await BloodRequestModel.updateOne(
            { _id: request._id, escalationStep: { $lt: 1 } },
            { $set: { escalationStep: 1 } },
          );

          // Record what actually happened: an "executed" step that alerted nobody would mislead admins.
          try {
            const { alertedDonorIds } = await alertNextBatch(request._id, {
              actor: SYSTEM_ACTOR,
              config,
              reason: `Escalation step 1: ${stepMinutes}m elapsed with request still awaiting donors`,
            });
            await EscalationEventModel.updateOne(
              { requestId: request._id, step: 1 },
              { $set: { outcome: alertedDonorIds.length > 0 ? 'executed' : 'skipped_condition_not_met', 'detail.alerted': alertedDonorIds.length } },
            );
            publish('alert', alertedDonorIds.map((id) => rooms.user(id)), request._id);
          } catch (batchErr) {
            await EscalationEventModel.updateOne(
              { requestId: request._id, step: 1 },
              { $set: { outcome: 'failed', 'detail.error': (batchErr as Error).message.slice(0, 200) } },
            ).catch(() => undefined);
            logger.warn({ err: (batchErr as Error).message, requestId: request._id }, 'escalation step 1 alert widening skipped or failed');
          }

          publish('request', [rooms.facility(request.facilityId), rooms.role('admin')], request._id);
          processedCount++;
          logger.info({ requestId: request._id, publicCode: request.publicCode, step: 1 }, 'escalation step 1 executed');
        } else if (step === 2) {
          // Step 2 (default 10 min): Notify admins; advise hospital (banner + outbox) to check blood bank / stock transfer
          try {
            await EscalationEventModel.create({
              requestId: request._id,
              step: 2,
              outcome: 'executed',
              detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin), advice: 'Advise hospital to check blood bank / initiate stock transfer' },
              at: now,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) continue;
            throw err;
          }

          await BloodRequestModel.updateOne(
            { _id: request._id, escalationStep: { $lt: 2 } },
            { $set: { escalationStep: 2 } },
          );

          await recordAudit({
            actor: SYSTEM_ACTOR,
            action: 'request.escalated_level_2',
            resourceType: 'bloodRequest',
            resourceId: request._id,
            facilityId: request.facilityId,
            reason: `Escalation step 2: ${stepMinutes}m elapsed. Advise facility to check internal blood bank or request stock transfer.`,
            detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin) },
          });

          publish('request', [rooms.facility(request.facilityId), rooms.role('admin')], request._id);
          processedCount++;
          logger.info({ requestId: request._id, publicCode: request.publicCode, step: 2 }, 'escalation step 2 executed');
        } else if (step === 3) {
          // Step 3 (default 15 min): Admin task / stock transfer recommendation
          try {
            await EscalationEventModel.create({
              requestId: request._id,
              step: 3,
              outcome: 'executed',
              detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin), advice: 'Escalated to admin queue for direct intervention / nearby facility contact' },
              at: now,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) continue;
            throw err;
          }

          await BloodRequestModel.updateOne(
            { _id: request._id, escalationStep: { $lt: 3 } },
            { $set: { escalationStep: 3 } },
          );

          await recordAudit({
            actor: SYSTEM_ACTOR,
            action: 'request.escalated_level_3',
            resourceType: 'bloodRequest',
            resourceId: request._id,
            facilityId: request.facilityId,
            reason: `Escalation step 3: ${stepMinutes}m elapsed. Critical escalation to admin queue for inter-hospital transfer coordination.`,
            detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin) },
          });

          publish('request', [rooms.facility(request.facilityId), rooms.role('admin')], request._id);
          processedCount++;
          logger.info({ requestId: request._id, publicCode: request.publicCode, step: 3 }, 'escalation step 3 executed');
        } else {
          // Higher configurable steps
          try {
            await EscalationEventModel.create({
              requestId: request._id,
              step,
              outcome: 'executed',
              detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin) },
              at: now,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) continue;
            throw err;
          }

          await BloodRequestModel.updateOne(
            { _id: request._id, escalationStep: { $lt: step } },
            { $set: { escalationStep: step } },
          );

          await recordAudit({
            actor: SYSTEM_ACTOR,
            action: `request.escalated_level_${step}`,
            resourceType: 'bloodRequest',
            resourceId: request._id,
            facilityId: request.facilityId,
            reason: `Escalation step ${step}: ${stepMinutes}m elapsed.`,
            detail: { stepMinutes, elapsedMinutes: Math.round(elapsedMin) },
          });

          publish('request', [rooms.facility(request.facilityId), rooms.role('admin')], request._id);
          processedCount++;
        }
      } catch (err) {
        logger.error({ err: (err as Error).message, requestId: request._id, step }, 'escalation step execution failed');
      }
    }
  }

  return processedCount;
}

const ESCALATION_POLL_MS = 15_000;

/**
 * In-process escalation worker (docs/architecture.md §8): polls every 15s, never overlaps itself.
 * Returns a stop function for graceful shutdown.
 */
export function startEscalationWorker(config: Config, logger: Logger): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processEscalations(config, logger)
      .catch((err: unknown) => logger.error({ err }, 'escalation worker tick failed'))
      .finally(() => {
        running = false;
      });
  }, ESCALATION_POLL_MS);
  timer.unref();
  logger.info({ everyMs: ESCALATION_POLL_MS }, 'escalation worker started');
  return () => clearInterval(timer);
}
