import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ALERT_DELIVERY_STATUSES, ALERT_RESPONSES, ETA_QUALITIES } from '@golden-hour/shared';

// docs/data-model.md — requestAlerts. Delivery (did it reach the donor?) and response (what did
// they answer?) are separate facts.

export const etaSnapshotSchema = new Schema(
  {
    minutes: { type: Number, default: null },
    distanceKm: { type: Number, default: null },
    quality: { type: String, enum: ETA_QUALITIES, required: true },
    source: { type: String, required: true },
    calculatedAt: { type: Date, required: true },
    weatherAdjustment: { type: String, enum: ['none', 'moderate', 'heavy', 'unavailable'], default: 'unavailable' },
    warnings: { type: [String], default: [] },
  },
  { _id: false },
);

const requestAlertSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    donorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batch: { type: Number, required: true },
    rank: { type: Number, required: true },
    eta: { type: etaSnapshotSchema, default: null },
    channels: { type: [String], default: ['in_app'] },
    deliveryStatus: { type: String, enum: ALERT_DELIVERY_STATUSES, default: 'queued' },
    response: { type: String, enum: ALERT_RESPONSES, default: 'pending' },
    respondedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    /** Random correlation token for future SMS YES/NO replies. */
    responseToken: { type: String, required: true },
  },
  { timestamps: true },
);

requestAlertSchema.index({ requestId: 1, donorUserId: 1 }, { unique: true });
requestAlertSchema.index({ donorUserId: 1, response: 1, createdAt: -1 });
requestAlertSchema.index({ response: 1, expiresAt: 1 });

export type RequestAlert = InferSchemaType<typeof requestAlertSchema>;
export type RequestAlertDocument = HydratedDocument<RequestAlert>;
export const RequestAlertModel = model('RequestAlert', requestAlertSchema, 'requestAlerts');
