import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { BLOOD_GROUPS, FAMILY_LEAD_STATUSES } from '@golden-hour/shared';

// docs/data-model.md — familyLeads. A lead never alerts donors; only a hospital-confirmed request can.

const familyLeadSchema = new Schema(
  {
    reference: { type: String, required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    contactName: { type: String, required: true, trim: true },
    /** Needed for the hospital to call back; staff of the chosen facility only. */
    contactPhone: { type: String, required: true },
    phoneVerified: { type: Boolean, default: false },
    /** Keyed hash of the 6-digit confirmation code; never the code itself. */
    phoneCodeHash: { type: String, default: null },
    phoneCodeAttempts: { type: Number, default: 0 },
    bloodGroup: { type: String, enum: [...BLOOD_GROUPS, null], default: null },
    note: { type: String, default: null },
    status: { type: String, enum: FAMILY_LEAD_STATUSES, default: 'pending' },
    linkedRequestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

familyLeadSchema.index({ reference: 1 }, { unique: true });
familyLeadSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
familyLeadSchema.index({ contactPhone: 1, createdAt: -1 });

export type FamilyLead = InferSchemaType<typeof familyLeadSchema>;
export type FamilyLeadDocument = HydratedDocument<FamilyLead>;
export const FamilyLeadModel = model('FamilyLead', familyLeadSchema, 'familyLeads');
