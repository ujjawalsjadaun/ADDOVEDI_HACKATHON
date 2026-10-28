import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { ConfigError, loadConfig, type Config } from './config/env';
import { createLogger } from './lib/logger';
import { connectDb, disconnectDb } from './lib/db';
import { ensureIndexes } from './lib/indexes';
import { checkTransactionsSupported } from './lib/transaction';
import { createApp } from './app';
import { startRealtime } from './realtime/socket';
import { startOutboxWorker } from './workers/outboxWorker';
import { startEscalationWorker } from './workers/escalationWorker';
import { startExpiryWorker } from './workers/expiryWorker';

if (existsSync('.env')) process.loadEnvFile('.env');

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      console.error('See server/.env.example and docs/architecture.md §9.');
      process.exit(1);
    }
    throw err;
  }
}

const config = loadConfigOrExit();

const logger = createLogger(config.LOG_LEVEL);

if (config.NODE_ENV === 'production') {
  // Cannot be detected reliably, so say it loudly instead of failing: behind a proxy every visitor shares one IP.
  if (!config.TRUST_PROXY) logger.warn('NODE_ENV=production with TRUST_PROXY=false — behind a reverse proxy set TRUST_PROXY=true or rate limits treat all visitors as one');
  if (!config.CLIENT_DIST_DIR) logger.info('CLIENT_DIST_DIR not set — the web app must be hosted separately on the same site as the API');
  if (config.SMS_PROVIDER === 'simulated') logger.warn('SMS is simulated: no message will reach any phone');
}

// Mongoose reconnects by itself after a connection is lost, but not when the *first* connect fails.
// Start serving anyway so /api/health/ready can report the outage (mutations fail closed), and keep retrying.
const DB_RETRY_MS = 15_000;
let dbRetryTimer: NodeJS.Timeout | undefined;
async function connectWithRetry(): Promise<void> {
  try {
    await connectDb(config.MONGODB_URI);
    logger.info('database connected');
    const txSupported = await checkTransactionsSupported();
    if (txSupported) {
      logger.info('database transactions active (replica set / mongos)');
    } else {
      logger.warn('database running on standalone mongod — transactions disabled (safe fallback for local development)');
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, `database connection failed — degraded mode, retrying in ${DB_RETRY_MS / 1000}s`);
    dbRetryTimer = setTimeout(() => void connectWithRetry(), DB_RETRY_MS);
    return;
  }
  try {
    // Additive and idempotent; guarantees unique constraints (e.g. one account per email) exist.
    await ensureIndexes();
    logger.info('database indexes ensured');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'index creation failed — run `npm run db:indexes -w server` after fixing');
  }
}
await connectWithRetry();

const app = createApp({ config, logger });
const httpServer = createServer(app);
const io = startRealtime(httpServer, config, logger);
const stopOutbox = startOutboxWorker(config, logger);
const stopEscalation = startEscalationWorker(config, logger);
const stopExpiry = startExpiryWorker(config, logger);

httpServer.listen(config.PORT, () => {
  logger.info(`API listening on http://localhost:${config.PORT} (env=${config.NODE_ENV}, demoMode=${config.DEMO_MODE})`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  clearTimeout(dbRetryTimer);
  stopOutbox();
  stopEscalation();
  stopExpiry();
  await io.close();
  httpServer.close();
  await disconnectDb().catch(() => undefined);
  process.exit(0);
}
// A stray rejected promise must be visible in the logs, not silently ignored or crash the demo mid-request.
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — shutting down');
  void shutdown('uncaughtException');
});
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
