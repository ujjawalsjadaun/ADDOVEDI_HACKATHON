import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BLOOD_GROUPS, DONOR_AVAILABILITY, DONOR_REVIEW_STATUSES, DONOR_VERIFICATION_STATUSES } from '@golden-hour/shared';
import { geoPointSchema } from '../../lib/geo';

// docs/data-model.md — donorProfiles. Blood group + profile are NOT medical eligibility.

const strikeSchema = new Schema(
  {
    at: { type: Date, required: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const donorProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    consent: {
      type: new Schema(
        {
          contact: { type: Boolean, required: true },
          location: { type: Boolean, required: true },
          at: { type: Date, required: true },
          version: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    availability: { type: String, enum: DONOR_AVAILABILITY, default: 'available' },
    availabilityUpdatedAt: { type: Date, default: () => new Date() },
    /** null + lastDonationKnown=false means "unknown" → manual review only, never auto-alerted. */
    lastDonationAt: { type: Date, default: null },
    lastDonationKnown: { type: Boolean, default: false },
    /** Routing origin, rounded to ~1 km at write time. Never returned by any API. */
    anchorLocation: { type: geoPointSchema, default: null },
    anchorLabel: { type: String, default: null },
    verificationStatus: { type: String, enum: DONOR_VERIFICATION_STATUSES, default: 'unverified' },
    lastAlertedAt: { type: Date, default: null },
    strikes: { type: [strikeSchema], default: [] },
    reviewStatus: { type: String, enum: DONOR_REVIEW_STATUSES, default: 'ok' },
  },
  { timestamps: true },
);

donorProfileSchema.index({ userId: 1 }, { unique: true });
donorProfileSchema.index({ bloodGroup: 1, availability: 1, verificationStatus: 1, reviewStatus: 1 });
donorProfileSchema.index({ anchorLocation: '2dsphere' }, { sparse: true });

export type DonorProfile = InferSchemaType<typeof donorProfileSchema>;
export type DonorProfileDocument = HydratedDocument<DonorProfile>;
export const DonorProfileModel = model('DonorProfile', donorProfileSchema, 'donorProfiles');
