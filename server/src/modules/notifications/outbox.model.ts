import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from '@golden-hour/shared';

// docs/data-model.md — notificationOutbox. Written in the same transaction as the business change;
// a worker sends it. Phone numbers are resolved at send time, never copied here.

const outboxSchema = new Schema(
  {
    /** Idempotency key, e.g. `alert:<alertId>:sms`. Enqueuing the same event twice is a no-op. */
    eventId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    channel: { type: String, enum: ['sms'], required: true },
    /** Exactly one of these identifies the recipient. Family leads have no account; their number is read from the lead at send time. */
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    recipientLeadId: { type: Schema.Types.ObjectId, ref: 'FamilyLead', default: null },
    /** A facility's registered number (read at send time). */
    recipientHospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    /** Template variables only — public code, facility, blood group, deadline. No patient data. */
    vars: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

outboxSchema.index({ eventId: 1 }, { unique: true });
outboxSchema.index({ status: 1, nextAttemptAt: 1 });
outboxSchema.index({ requestId: 1 });
outboxSchema.index({ providerMessageId: 1 }, { sparse: true });

export type OutboxMessage = InferSchemaType<typeof outboxSchema>;
export type OutboxDocument = HydratedDocument<OutboxMessage>;
export const OutboxModel = model('NotificationOutbox', outboxSchema, 'notificationOutbox');
