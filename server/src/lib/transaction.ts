import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from './errors';
import { isDbConnected } from './db';

/**
 * Runs `fn` in a MongoDB transaction (retried on transient errors by the driver).
 * Business change + audit record + outbox rows are written together or not at all
 * (docs/architecture.md §4). Fails closed when the database is unavailable.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!isDbConnected()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'The database is unavailable. Nothing was saved — please try again.');
  }
  return mongoose.connection.transaction(fn);
}

export function isDuplicateKeyError(err: unknown): err is { code: 11000; keyPattern?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
