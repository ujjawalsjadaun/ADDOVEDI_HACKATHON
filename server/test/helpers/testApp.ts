import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { loadConfig, type Config } from '../../src/config/env';
import { createLogger } from '../../src/lib/logger';
import { createApp } from '../../src/app';
import { connectDb, disconnectDb } from '../../src/lib/db';

export const TEST_ENV = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
  SESSION_SECRET: 'test-session-secret-0123456789abcdef',
  PATIENT_REF_SECRET: 'test-patient-ref-secret-0123456789ab',
  LOG_LEVEL: 'silent',
} as const;

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ ...TEST_ENV, ...overrides });
}

export function buildApp(overrides: Record<string, string> = {}) {
  const config = testConfig(overrides);
  return createApp({ config, logger: createLogger('silent') });
}

/** Single-node replica set so transactions behave as on Atlas. */
export async function startDb(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri('golden-hour-test');
  await connectDb(uri);
  return {
    uri,
    stop: async () => {
      await disconnectDb();
      await replSet.stop();
    },
  };
}
