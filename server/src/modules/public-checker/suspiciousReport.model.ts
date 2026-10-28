import { Schema, model } from 'mongoose';
import { SUSPICIOUS_REPORT_CATEGORIES } from '@golden-hour/shared';

// docs/data-model.md — suspiciousReports. The reporter is anonymous; only a keyed hash of the IP is kept.

const suspiciousReportSchema = new Schema(
  {
    publicCode: { type: String, required: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
    category: { type: String, enum: SUSPICIOUS_REPORT_CATEGORIES, required: true },
    note: { type: String, default: null },
    reporterIpHash: { type: String, required: true },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

suspiciousReportSchema.index({ status: 1, createdAt: -1 });
suspiciousReportSchema.index({ publicCode: 1 });

export const SuspiciousReportModel = model('SuspiciousReport', suspiciousReportSchema, 'suspiciousReports');
