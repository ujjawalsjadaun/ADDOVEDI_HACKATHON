import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import { AppError } from '../../lib/errors';
import { isDuplicateKeyError } from '../../lib/transaction';
import { IdempotencyKeyModel } from './idempotency.model';

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export interface IdempotentOutcome<M = Record<string, unknown>> {
  status: number;
  resourceId: Types.ObjectId | string;
  meta?: M;
}

export interface IdempotentResult<M> extends IdempotentOutcome<M> {
  replayed: boolean;
}

/** Reads and validates the required `Idempotency-Key` header. */
export function requireIdempotencyKey(req: Request): string {
  const key = req.get('idempotency-key');
  if (!key || !KEY_PATTERN.test(key)) {
    throw new AppError('BAD_REQUEST', 'An Idempotency-Key header (16–64 letters, digits, - or _) is required.');
  }
  return key;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/**
 * Runs `handler` at most once per (scope, actor, key). A retry with the same key and body returns
 * the original outcome; the same key with a different body is rejected (docs/api-contracts.md §1).
 * If the handler fails, the key is released so the client can correct the input and retry.
 */
export async function runIdempotent<M>(
  opts: { scope: string; actorKey: string; key: string; body: unknown },
  handler: () => Promise<IdempotentOutcome<M>>,
): Promise<IdempotentResult<M>> {
  const requestHash = createHash('sha256').update(stableStringify(opts.body)).digest('hex');
  const identity = { scope: opts.scope, actorKey: opts.actorKey, key: opts.key };

  try {
    await IdempotencyKeyModel.create({ ...identity, requestHash, status: 'in_progress', expiresAt: new Date(Date.now() + TTL_MS) });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await IdempotencyKeyModel.findOne(identity);
    if (!existing) throw new AppError('CONFLICT', 'Please retry the request.');
    if (existing.requestHash !== requestHash) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different request.');
    }
    if (existing.status !== 'done' || !existing.resourceId) {
      throw new AppError('CONFLICT', 'This request is still being processed. Wait a moment and refresh.');
    }
    return {
      status: existing.responseStatus ?? 200,
      resourceId: existing.resourceId,
      meta: (existing.responseMeta ?? undefined) as M | undefined,
      replayed: true,
    };
  }

  let outcome: IdempotentOutcome<M>;
  try {
    outcome = await handler();
  } catch (err) {
    await IdempotencyKeyModel.deleteOne(identity).catch(() => undefined);
    throw err;
  }
  await IdempotencyKeyModel.updateOne(identity, {
    $set: { status: 'done', responseStatus: outcome.status, resourceId: outcome.resourceId, responseMeta: outcome.meta ?? null },
  });
  return { ...outcome, replayed: false };
}
