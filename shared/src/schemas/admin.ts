import { z } from 'zod';
import { FACILITY_TYPES, HOSPITAL_VERIFICATION_STATUSES, USER_ROLES, USER_STATUSES, type UserRole } from '../enums';
import { emailSchema, passwordSchema } from './auth';
import { latLngSchema, objectIdSchema, paginationQuerySchema, phoneSchema, reasonSchema } from './common';

// ── Hospitals ────────────────────────────────────────────────────────────────

export const createHospitalSchema = z.object({
  name: z.string().trim().min(3).max(120),
  facilityType: z.enum(FACILITY_TYPES),
  district: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(300),
  location: latLngSchema,
  registeredPhone: phoneSchema,
});
export type CreateHospitalInput = z.infer<typeof createHospitalSchema>;

export const HOSPITAL_DECISIONS = ['verified', 'rejected', 'suspended'] as const;
export const hospitalDecisionSchema = z.object({
  decision: z.enum(HOSPITAL_DECISIONS),
  reason: reasonSchema,
});
export type HospitalDecisionInput = z.infer<typeof hospitalDecisionSchema>;

/** A strike for a false or abusive request raised by a facility. Reaching the limit suspends it automatically. */
export const hospitalStrikeSchema = z.object({
  reason: reasonSchema,
  requestId: objectIdSchema.optional(),
});
export type HospitalStrikeInput = z.infer<typeof hospitalStrikeSchema>;

export const listHospitalsQuerySchema = paginationQuerySchema.extend({
  verificationStatus: z.enum(HOSPITAL_VERIFICATION_STATUSES).optional(),
});

export const publicHospitalsQuerySchema = z.object({
  district: z.string().trim().max(80).optional(),
});

// ── Users ────────────────────────────────────────────────────────────────────

/** Roles an admin may provision. Donors self-register (Phase 5). */
export const PROVISIONABLE_ROLES = ['hospital_staff', 'coordinator', 'admin'] as const satisfies readonly UserRole[];

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(PROVISIONABLE_ROLES),
    phone: phoneSchema.optional(),
    facilityId: objectIdSchema.optional(),
    canVerifyRequests: z.boolean().default(false),
    /** Coordinators only: the village they serve. Donors who chose the same village label get their alerts relayed by this person. */
    villageLabel: z.string().trim().min(2).max(80).optional(),
  })
  .superRefine((u, ctx) => {
    if (u.role === 'hospital_staff' && !u.facilityId) {
      ctx.addIssue({ code: 'custom', path: ['facilityId'], message: 'hospital staff must belong to a facility' });
    }
    if (u.role !== 'hospital_staff' && u.facilityId) {
      ctx.addIssue({ code: 'custom', path: ['facilityId'], message: 'only hospital staff belong to a facility' });
    }
    if (u.role !== 'hospital_staff' && u.canVerifyRequests) {
      ctx.addIssue({ code: 'custom', path: ['canVerifyRequests'], message: 'only hospital staff can verify requests' });
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const userStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
  reason: reasonSchema,
});
export type UserStatusInput = z.infer<typeof userStatusSchema>;

/** A strike against a local coordinator (e.g. a false vouch or a false road report). At the limit the account is paused. */
export const userStrikeSchema = z.object({ reason: reasonSchema });
export type UserStrikeInput = z.infer<typeof userStrikeSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  facilityId: objectIdSchema.optional(),
});

/** Admin flags (or clears) a request as "under review" — e.g. after suspicious-request reports. */
export const reviewFlagSchema = z.object({
  expectedVersion: z.number().int().min(0),
  flagged: z.boolean(),
  reason: reasonSchema,
});
export type ReviewFlagInput = z.infer<typeof reviewFlagSchema>;

export const adminEscalationsQuerySchema = z.object({
  open: z.enum(['true', 'false']).optional().default('true'),
});
export type AdminEscalationsQuery = z.infer<typeof adminEscalationsQuerySchema>;

