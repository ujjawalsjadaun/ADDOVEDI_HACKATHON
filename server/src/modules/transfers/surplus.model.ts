import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BLOOD_GROUPS } from '@golden-hour/shared';

// A facility's spare units, shown to other facilities so surplus is used instead of wasted.
// An offer is information only: moving units still goes through a stock transfer.

const surplusSchema = new Schema(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, required: true, min: 1 },
    note: { type: String, default: null },
    availableUntil: { type: Date, required: true },
    withdrawnAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

surplusSchema.index({ availableUntil: 1, withdrawnAt: 1 });
surplusSchema.index({ facilityId: 1, withdrawnAt: 1 });

export type SurplusOffer = InferSchemaType<typeof surplusSchema>;
export type SurplusOfferDocument = HydratedDocument<SurplusOffer>;
export const SurplusOfferModel = model('SurplusOffer', surplusSchema, 'surplusOffers');
