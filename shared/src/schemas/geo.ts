import { z } from 'zod';
import { latLngSchema, reasonSchema } from './common';

export const ROAD_CONDITIONS = ['open', 'blocked', 'restricted', 'unknown'] as const;
export type RoadCondition = (typeof ROAD_CONDITIONS)[number];

export const ROAD_REPORT_CONFIDENCE = ['low', 'medium', 'high'] as const;
export type RoadReportConfidence = (typeof ROAD_REPORT_CONFIDENCE)[number];

export const ROAD_REPORT_VERIFICATION = ['unverified', 'verified', 'dismissed'] as const;
export type RoadReportVerification = (typeof ROAD_REPORT_VERIFICATION)[number];

export const MAX_ROAD_REPORT_HOURS = 72;

export const createRoadReportSchema = z.object({
  location: latLngSchema,
  label: z.string().trim().min(3).max(120),
  condition: z.enum(ROAD_CONDITIONS),
  note: z.string().trim().max(280).optional(),
  confidence: z.enum(ROAD_REPORT_CONFIDENCE),
  /** A report is shown as stale (and ignored for travel times) after this many hours. */
  expiresInHours: z.number().int().min(1).max(MAX_ROAD_REPORT_HOURS),
});
export type CreateRoadReportInput = z.infer<typeof createRoadReportSchema>;

export const roadReportDecisionSchema = z.object({
  decision: z.enum(['verified', 'dismissed']),
  reason: reasonSchema,
});
export type RoadReportDecisionInput = z.infer<typeof roadReportDecisionSchema>;

export const accessPointSchema = z.object({
  /** `null` clears the access point. */
  location: latLngSchema.nullable(),
  note: z.string().trim().max(200).optional(),
});
export type AccessPointInput = z.infer<typeof accessPointSchema>;

/** Where to look for the nearest drivable road (e.g. the village or patient location picked on the map). */
export const nearestRoadSchema = z.object({ location: latLngSchema });
export type NearestRoadInput = z.infer<typeof nearestRoadSchema>;
