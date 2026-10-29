import { z } from 'zod';
import { BLOOD_GROUPS } from '../enums';
import { emailSchema, passwordSchema } from './auth';
import { paginationQuerySchema, phoneSchema, reasonSchema } from './common';

export const DONOR_AVAILABILITY = ['available', 'unavailable'] as const;
export type DonorAvailability = (typeof DONOR_AVAILABILITY)[number];

export const DONOR_VERIFICATION_STATUSES = ['unverified', 'verified'] as const;
export type DonorVerificationStatus = (typeof DONOR_VERIFICATION_STATUSES)[number];

export const DONOR_REVIEW_STATUSES = ['ok', 'under_review'] as const;
export type DonorReviewStatus = (typeof DONOR_REVIEW_STATUSES)[number];

/** Bump when the consent wording changes, so we know what each donor agreed to. */
export const DONOR_CONSENT_VERSION = '2026-10-v1';

const isoDate = z.iso.date({ message: 'enter a valid date' });

export const donorAnchorSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Village / locality shown to hospitals instead of coordinates. */
  label: z.string().trim().min(2).max(80),
});

export const registerDonorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  bloodGroup: z.enum(BLOOD_GROUPS),
  consent: z.object({
    contact: z.literal(true, { message: 'you must agree to be contacted to register as a donor' }),
    location: z.boolean(),
    relay: z.boolean().optional(),
  }),
});
export type RegisterDonorInput = z.infer<typeof registerDonorSchema>;

export const updateDonorProfileSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  /** `null` = never donated. "I don't know" is a separate, deliberate action (POST /donors/me/last-donation-unknown). */
  lastDonationOn: isoDate.nullable(),
  anchor: donorAnchorSchema.nullable(),
  consent: z.object({ contact: z.boolean(), location: z.boolean(), relay: z.boolean().optional() }),
});
export type UpdateDonorProfileInput = z.infer<typeof updateDonorProfileSchema>;

export const donorAvailabilitySchema = z.object({ availability: z.enum(DONOR_AVAILABILITY) });

export const respondAlertSchema = z.object({ decision: z.enum(['accept', 'decline']) });
export type RespondAlertInput = z.infer<typeof respondAlertSchema>;

export const donorAssignmentStatusSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    status: z.enum(['en_route', 'arrived', 'withdrawn']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status !== 'withdrawn' || (v.reason?.length ?? 0) >= 3, {
    path: ['reason'],
    message: 'please tell the hospital why you are withdrawing',
  });
export type DonorAssignmentStatusInput = z.infer<typeof donorAssignmentStatusSchema>;

export const versionOnlySchema = z.object({ expectedVersion: z.number().int().min(0) });

export const noShowSchema = z.object({
  expectedVersion: z.number().int().min(0),
  reason: reasonSchema,
  /** Yes → next donors are alerted. No → hospital is prompted to fulfil or cancel. */
  needStillExists: z.boolean(),
});
export type NoShowInput = z.infer<typeof noShowSchema>;

export const nextBatchSchema = z.object({ expectedVersion: z.number().int().min(0), reason: reasonSchema });

export const donorVerificationSchema = z.object({ decision: z.enum(DONOR_VERIFICATION_STATUSES), reason: reasonSchema });
export const donorReviewSchema = z.object({ decision: z.enum(DONOR_REVIEW_STATUSES), reason: reasonSchema });

export const listDonorsQuerySchema = paginationQuerySchema.extend({
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  verificationStatus: z.enum(DONOR_VERIFICATION_STATUSES).optional(),
  reviewStatus: z.enum(DONOR_REVIEW_STATUSES).optional(),
});
