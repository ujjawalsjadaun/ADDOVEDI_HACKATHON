import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from './errors';
import { isDbConnected } from './db';

let supportsTransactions: boolean | null = null;

export function isStandaloneTransactionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const msg = (err as Error).message ?? '';
  const code = (err as { code?: unknown }).code;
  const codeName = (err as { codeName?: unknown }).codeName;
  return (
    code === 20 ||
    codeName === 'IllegalOperation' ||
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos')
  );
}

/**
 * Checks whether the connected MongoDB instance supports transactions (replica set member or mongos).
 * Caches the result for future withTransaction calls.
 */
export async function checkTransactionsSupported(): Promise<boolean> {
  if (supportsTransactions !== null) return supportsTransactions;
  if (!isDbConnected() || !mongoose.connection.db) return false;
  try {
    const res = await mongoose.connection.db.admin().command({ hello: 1 });
    supportsTransactions = Boolean(res?.setName || res?.msg === 'isdbgrid');
  } catch {
    supportsTransactions = false;
  }
  return supportsTransactions;
}

/**
 * Runs `fn` in a MongoDB transaction (retried on transient errors by the driver).
 * Business change + audit record + outbox rows are written together or not at all
 * (docs/architecture.md §4). Fails closed when the database is unavailable.
 *
 * Falls back gracefully to non-transactional execution on standalone local mongod instances
 * where replica sets are not configured (DATA-001).
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!isDbConnected()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'The database is unavailable. Nothing was saved — please try again.');
  }

  if (supportsTransactions === false) {
    return fn(undefined as unknown as ClientSession);
  }

  try {
    return await mongoose.connection.transaction(fn);
  } catch (err) {
    if (isStandaloneTransactionError(err)) {
      supportsTransactions = false;
      return fn(undefined as unknown as ClientSession);
    }
    throw err;
  }
}

export function isDuplicateKeyError(err: unknown): err is { code: 11000; keyPattern?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
