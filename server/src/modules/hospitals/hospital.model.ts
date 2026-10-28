import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { FACILITY_TYPES, HOSPITAL_VERIFICATION_STATUSES } from '@golden-hour/shared';
import { geoPointSchema } from '../../lib/geo';

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    facilityType: { type: String, enum: FACILITY_TYPES, required: true },
    district: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: { type: geoPointSchema, required: true },
    /** Staff/admin only; never in public DTOs. */
    registeredPhone: { type: String, required: true },
    /** Nearest point a vehicle/ambulance can reach — a reported estimate, not a survey. */
    ambulanceAccessPoint: {
      type: new Schema(
        {
          location: { type: geoPointSchema, required: true },
          note: { type: String, default: null },
          reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          reportedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    verificationStatus: { type: String, enum: HOSPITAL_VERIFICATION_STATUSES, default: 'pending' },
    verification: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, required: true },
          reason: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

hospitalSchema.index({ verificationStatus: 1 });
hospitalSchema.index({ location: '2dsphere' });

export type Hospital = InferSchemaType<typeof hospitalSchema>;
export type HospitalDocument = HydratedDocument<Hospital>;
export const HospitalModel = model('Hospital', hospitalSchema, 'hospitals');
