import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  BLOOD_GROUPS,
  CLOSURE_REASONS,
  DUPLICATE_REVIEW_STATUSES,
  REQUEST_STATUSES,
  REQUEST_VERIFICATION_STATUSES,
  URGENCY_LEVELS,
} from '@golden-hour/shared';

// docs/data-model.md — bloodRequests. Verification and operational status are separate fields.

const decisionSchema = new Schema(
  {
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const duplicateReviewSchema = new Schema(
  {
    status: { type: String, enum: DUPLICATE_REVIEW_STATUSES, required: true, default: 'none' },
    candidates: { type: [{ type: Schema.Types.ObjectId, ref: 'BloodRequest' }], default: [] },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: null },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const bloodRequestSchema = new Schema(
  {
    publicCode: { type: String, required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    acceptCompatibleGroups: { type: Boolean, default: false },
    unitsRequested: { type: Number, required: true, min: 1 },
    slotsFilled: { type: Number, default: 0, min: 0 },
    urgencySuggested: { type: String, enum: URGENCY_LEVELS, required: true },
    urgencyConfirmed: { type: String, enum: URGENCY_LEVELS, default: null },
    deadlineAt: { type: Date, required: true },
    /** HMAC(PATIENT_REF_SECRET, facilityId:normalisedRef). The raw reference is never stored. */
    patientRefHash: { type: String, required: true },
    patientLabel: { type: String, default: null },
    clinicalNote: { type: String, default: null },
    verificationStatus: { type: String, enum: REQUEST_VERIFICATION_STATUSES, default: 'pending' },
    verification: { type: decisionSchema, default: null },
    verifiedAt: { type: Date, default: null },
    requestStatus: { type: String, enum: REQUEST_STATUSES, default: 'open' },
    /** True until closed; drives the one-active-request-per-patient unique index. */
    isActive: { type: Boolean, default: true },
    duplicateReview: { type: duplicateReviewSchema, required: true, default: () => ({}) },
    duplicateOfRequestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    closure: {
      type: new Schema(
        {
          reason: { type: String, enum: CLOSURE_REASONS, required: true },
          by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          at: { type: Date, required: true },
          note: { type: String, default: null },
          unitsReceived: { type: Number, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    /** Donor alert batches sent so far (verification sends batch 0). */
    alertBatches: { type: Number, default: 0 },
    /** Last escalation-ladder step executed (Phase 10). */
    escalationStep: { type: Number, default: -1 },
    /** Optimistic concurrency: every transition matches on and increments this. */
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

bloodRequestSchema.index({ publicCode: 1 }, { unique: true });
bloodRequestSchema.index(
  { facilityId: 1, patientRefHash: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_request_per_patient' },
);
bloodRequestSchema.index({ facilityId: 1, requestStatus: 1, createdAt: -1 });
bloodRequestSchema.index({ requestStatus: 1, deadlineAt: 1 });
bloodRequestSchema.index({ verificationStatus: 1, createdAt: 1 });

export type BloodRequest = InferSchemaType<typeof bloodRequestSchema>;
export type BloodRequestDocument = HydratedDocument<BloodRequest>;
export const BloodRequestModel = model('BloodRequest', bloodRequestSchema, 'bloodRequests');
