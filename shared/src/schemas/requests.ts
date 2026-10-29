import { z } from 'zod';
import { BLOOD_GROUPS, REQUEST_STATUSES, REQUEST_VERIFICATION_STATUSES, URGENCY_LEVELS, type Urgency } from '../enums';
import { objectIdSchema, paginationQuerySchema, reasonSchema } from './common';

export const MAX_UNITS_PER_REQUEST = 6;
/** A request deadline further out than this is not an emergency request. */
export const MAX_DEADLINE_HOURS = 72;

const expectedVersion = z.number().int().min(0);

/** Why the blood is needed. Trauma and delivery are emergencies by nature; a planned transfusion is not. */
export const REQUEST_CATEGORIES = ['trauma', 'delivery', 'surgery', 'planned_transfusion', 'other'] as const;
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const createRequestSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  acceptCompatibleGroups: z.boolean().default(false),
  unitsRequested: z.number().int().min(1).max(MAX_UNITS_PER_REQUEST),
  deadlineAt: z.iso.datetime({ offset: true, message: 'enter a valid date and time' }),
  /** Hospital's internal patient reference (e.g. MRN). Hashed on receipt; never stored or returned. */
  patientRef: z.string().trim().min(1, 'This field is required.').max(64),
  category: z.enum(REQUEST_CATEGORIES).optional(),
  patientLabel: z.string().trim().max(60).optional(),
  clinicalNote: z.string().trim().max(280).optional(),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const verifyRequestSchema = z.object({
  expectedVersion,
  urgencyConfirmed: z.enum(URGENCY_LEVELS),
});
export type VerifyRequestInput = z.infer<typeof verifyRequestSchema>;

export const reasonedTransitionSchema = z.object({ expectedVersion, reason: reasonSchema });
export type ReasonedTransitionInput = z.infer<typeof reasonedTransitionSchema>;

export const duplicateReviewSchema = z
  .object({
    expectedVersion,
    decision: z.enum(['distinct', 'duplicate']),
    duplicateOfRequestId: objectIdSchema.optional(),
    reason: reasonSchema,
  })
  .refine((v) => v.decision !== 'duplicate' || !!v.duplicateOfRequestId, {
    path: ['duplicateOfRequestId'],
    message: 'choose the request this duplicates',
  });
export type DuplicateReviewInput = z.infer<typeof duplicateReviewSchema>;

export const fulfillRequestSchema = z.object({
  expectedVersion,
  unitsReceived: z.number().int().min(1).max(MAX_UNITS_PER_REQUEST),
  note: z.string().trim().max(280).optional(),
});
export type FulfillRequestInput = z.infer<typeof fulfillRequestSchema>;

export const listRequestsQuerySchema = paginationQuerySchema.extend({
  requestStatus: z.enum(REQUEST_STATUSES).optional(),
  verificationStatus: z.enum(REQUEST_VERIFICATION_STATUSES).optional(),
  active: z.enum(['true', 'false']).optional(),
  facilityId: objectIdSchema.optional(),
});

// ── Public checker ───────────────────────────────────────────────────────────

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Normalises what people type or paste ("gh 7k2m-q9zt", "GH7K2MQ9ZT") to "GH-7K2M-Q9ZT", or null. */
export function normalizePublicCode(raw: string): string | null {
  const compact = raw
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^GH/, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (!CROCKFORD.test(compact)) return null;
  return `GH-${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export const SUSPICIOUS_REPORT_CATEGORIES = ['fake_request', 'wrong_details', 'harassment', 'other'] as const;
export type SuspiciousReportCategory = (typeof SUSPICIOUS_REPORT_CATEGORIES)[number];

export const suspiciousReportSchema = z.object({
  publicCode: z.string().trim().min(1).max(20),
  category: z.enum(SUSPICIOUS_REPORT_CATEGORIES),
  note: z.string().trim().max(280).optional(),
});
export type SuspiciousReportInput = z.infer<typeof suspiciousReportSchema>;

/** A donor reports the request behind one of their own alerts; the code comes from the alert, not the donor. */
export const donorAlertReportSchema = suspiciousReportSchema.omit({ publicCode: true });
export type DonorAlertReportInput = z.infer<typeof donorAlertReportSchema>;

// ── Urgency suggestion (rule-based, never applied without hospital confirmation) ──

/** docs/security.md §9: critical < 2 h to deadline, urgent < 6 h, otherwise standard. */
export function suggestUrgency(deadlineAt: Date, now: Date = new Date(), category?: RequestCategory): Urgency {
  // Trauma and delivery (postpartum haemorrhage) are critical whatever the deadline says.
  if (category === 'trauma' || category === 'delivery') return 'critical';
  const byDeadline = suggestByDeadline(deadlineAt, now);
  // A planned transfusion is never suggested above "urgent": the hospital can still confirm higher.
  return category === 'planned_transfusion' && byDeadline === 'critical' ? 'urgent' : byDeadline;
}

function suggestByDeadline(deadlineAt: Date, now: Date): Urgency {
  const hours = (deadlineAt.getTime() - now.getTime()) / 3_600_000;
  if (hours < 2) return 'critical';
  if (hours < 6) return 'urgent';
  return 'standard';
}
