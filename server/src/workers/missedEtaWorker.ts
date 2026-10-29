import type { Logger } from 'pino';
import type { Config } from '../config/env';
import { isDbConnected } from '../lib/db';
import { SYSTEM_ACTOR } from '../modules/audit/audit.service';
import { alertNextBatch } from '../modules/alerts/alert.service';
import { releaseMissedEtaAssignments } from '../modules/assignments/assignment.service';
import { publish, rooms } from '../realtime/emitter';

const MISSED_ETA_POLL_MS = 60_000;

/** One tick: free slots held by donors who missed their ETA, then alert the next donors (best effort). */
export async function processMissedEtas(config: Config, logger: Logger): Promise<number> {
  if (!isDbConnected()) return 0;
  const released = await releaseMissedEtaAssignments(config.NO_SHOW_GRACE_MIN);
  for (const a of released) {
    try {
      const { request, alertedDonorIds } = await alertNextBatch(a.requestId, { actor: SYSTEM_ACTOR, config });
      publish('request', [rooms.facility(request.facilityId), rooms.role('admin')], request._id);
      publish('alert', alertedDonorIds.map((id) => rooms.user(id)), request._id);
    } catch (err) {
      logger.warn({ err, requestId: a.requestId.toString() }, 'next alert batch after missed ETA failed');
    }
  }
  return released.length;
}

export function startMissedEtaWorker(config: Config, logger: Logger): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processMissedEtas(config, logger)
      .catch((err: unknown) => logger.error({ err }, 'missed-ETA worker tick failed'))
      .finally(() => {
        running = false;
      });
  }, MISSED_ETA_POLL_MS);
  timer.unref();
  logger.info({ everyMs: MISSED_ETA_POLL_MS }, 'missed-ETA worker started');
  return () => clearInterval(timer);
}
