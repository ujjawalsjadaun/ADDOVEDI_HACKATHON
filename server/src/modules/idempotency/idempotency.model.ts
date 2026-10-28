import { Schema, model } from 'mongoose';

// docs/data-model.md — idempotencyKeys. Expired keys are removed by the TTL index.

const idempotencyKeySchema = new Schema(
  {
    scope: { type: String, required: true },
    actorKey: { type: String, required: true },
    key: { type: String, required: true },
    /** SHA-256 of the request body: the same key with a different body is rejected. */
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'done'], required: true },
    responseStatus: { type: Number, default: null },
    /** Id of the resource the original call produced; replays re-serialise its current state. */
    resourceId: { type: Schema.Types.ObjectId, default: null },
    responseMeta: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

idempotencyKeySchema.index({ scope: 1, actorKey: 1, key: 1 }, { unique: true });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyKeyModel = model('IdempotencyKey', idempotencyKeySchema, 'idempotencyKeys');
