import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// Append-only (docs/data-model.md — auditLogs). There is deliberately no update or delete code path.

const auditLogSchema = new Schema(
  {
    actor: {
      type: { type: String, enum: ['user', 'system'], required: true },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      role: String,
    },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital' },
    result: { type: String, enum: ['success', 'denied', 'failed'], required: true },
    reason: String,
    /** Minimal field diffs: { field: [from, to] }. Never secrets or contact details. */
    changes: { type: Schema.Types.Mixed },
    /** Non-identifying extra context (e.g. hashed email for failed logins). */
    detail: { type: Schema.Types.Mixed },
    requestId: String,
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

auditLogSchema.index({ resourceType: 1, resourceId: 1, at: 1 });
auditLogSchema.index({ facilityId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { _id: Types.ObjectId };
export const AuditLog = model('AuditLog', auditLogSchema, 'auditLogs');
