import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BLOOD_GROUPS, STOCK_TRANSFER_STATUSES } from '@golden-hour/shared';

// docs/data-model.md — stockTransfers. Independent of blood-request closure; no live inventory integration.

const historySchema = new Schema(
  {
    status: { type: String, enum: STOCK_TRANSFER_STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, required: true },
    note: { type: String, default: null },
  },
  { _id: false },
);

const stockTransferSchema = new Schema(
  {
    requestingFacilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    respondingFacilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, required: true, min: 1 },
    offeredUnits: { type: Number, default: null },
    status: { type: String, enum: STOCK_TRANSFER_STATUSES, default: 'requested' },
    note: { type: String, default: null },
    history: { type: [historySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

stockTransferSchema.index({ requestingFacilityId: 1, status: 1, createdAt: -1 });
stockTransferSchema.index({ respondingFacilityId: 1, status: 1, createdAt: -1 });

export type StockTransfer = InferSchemaType<typeof stockTransferSchema>;
export type StockTransferDocument = HydratedDocument<StockTransfer>;
export const StockTransferModel = model('StockTransfer', stockTransferSchema, 'stockTransfers');
