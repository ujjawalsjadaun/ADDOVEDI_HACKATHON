import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROAD_CONDITIONS, ROAD_REPORT_CONFIDENCE, ROAD_REPORT_VERIFICATION } from '@golden-hour/shared';
import { geoPointSchema } from '../../lib/geo';

// docs/data-model.md — roadReports. Stale reports are kept for history (no TTL) but never affect ETAs.

const roadReportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reporterRole: { type: String, required: true },
    location: { type: geoPointSchema, required: true },
    label: { type: String, required: true, trim: true },
    condition: { type: String, enum: ROAD_CONDITIONS, required: true },
    note: { type: String, default: null },
    confidence: { type: String, enum: ROAD_REPORT_CONFIDENCE, required: true },
    verificationStatus: { type: String, enum: ROAD_REPORT_VERIFICATION, default: 'unverified' },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reportedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

roadReportSchema.index({ location: '2dsphere' });
roadReportSchema.index({ expiresAt: 1 });
roadReportSchema.index({ verificationStatus: 1, expiresAt: 1 });

export type RoadReport = InferSchemaType<typeof roadReportSchema>;
export type RoadReportDocument = HydratedDocument<RoadReport>;
export const RoadReportModel = model('RoadReport', roadReportSchema, 'roadReports');
