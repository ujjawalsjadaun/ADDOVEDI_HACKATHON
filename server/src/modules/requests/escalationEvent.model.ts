import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ESCALATION_OUTCOMES } from '@golden-hour/shared';

// docs/data-model.md — escalationEvents. Unique (requestId, step) guarantees idempotent execution.

const escalationEventSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    step: { type: Number, required: true },
    outcome: { type: String, enum: ESCALATION_OUTCOMES, required: true },
    detail: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

escalationEventSchema.index({ requestId: 1, step: 1 }, { unique: true });
escalationEventSchema.index({ step: 1, at: -1 });

export type EscalationEvent = InferSchemaType<typeof escalationEventSchema>;
export type EscalationEventDocument = HydratedDocument<EscalationEvent>;
export const EscalationEventModel = model('EscalationEvent', escalationEventSchema, 'escalationEvents');
