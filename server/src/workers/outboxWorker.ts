import type { Logger } from 'pino';
import type { Config } from '../config/env';
import { processOutbox } from '../modules/notifications/outbox.service';

/**
 * In-process outbox worker (decision D-16): polls every OUTBOX_POLL_MS, never overlaps itself.
 * Stops when the host sleeps; on wake it resumes and reclaims expired leases. Returns a stop function.
 */
export function startOutboxWorker(config: Config, logger: Logger): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processOutbox(config, logger)
      .catch((err: unknown) => logger.error({ err }, 'outbox worker tick failed'))
      .finally(() => {
        running = false;
      });
  }, config.OUTBOX_POLL_MS);
  timer.unref();
  logger.info({ everyMs: config.OUTBOX_POLL_MS }, 'outbox worker started');
  return () => clearInterval(timer);
}
