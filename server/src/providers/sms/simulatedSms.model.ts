import { Schema, model } from 'mongoose';

// docs/data-model.md — simulatedSms. What the simulated provider "sent". Phone numbers are masked.

const simulatedSmsSchema = new Schema(
  {
    idempotencyKey: { type: String, required: true },
    providerMessageId: { type: String, required: true },
    toMasked: { type: String, required: true },
    body: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

simulatedSmsSchema.index({ idempotencyKey: 1 }, { unique: true });
simulatedSmsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SimulatedSmsModel = model('SimulatedSms', simulatedSmsSchema, 'simulatedSms');
