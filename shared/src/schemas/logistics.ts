import { z } from 'zod';
import { BLOOD_GROUPS } from '../enums';
import { latLngSchema, objectIdSchema, phoneSchema, reasonSchema } from './common';
import { createRequestSchema, MAX_UNITS_PER_REQUEST } from './requests';

const expectedVersion = z.number().int().min(0);

// ── Family leads (docs/state-machines.md §7) ─────────────────────────────────

export const FAMILY_LEAD_STATUSES = ['pending', 'confirmed', 'rejected', 'expired'] as const;
export type FamilyLeadStatus = (typeof FAMILY_LEAD_STATUSES)[number];

export const createFamilyLeadSchema = z.object({
  hospitalId: objectIdSchema,
  contactName: z.string().trim().min(2).max(100),
  contactPhone: phoneSchema,
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  note: z.string().trim().max(280).optional(),
});
export type CreateFamilyLeadInput = z.infer<typeof createFamilyLeadSchema>;

/** Confirming a lead = the hospital raises an official request (which still needs verification). */
export const confirmFamilyLeadSchema = z.object({ request: createRequestSchema });
export type ConfirmFamilyLeadInput = z.infer<typeof confirmFamilyLeadSchema>;

/** The family types the 6-digit code that was texted to the number they gave, proving the number is theirs. */
export const verifyFamilyPhoneSchema = z.object({
  reference: z.string().trim().min(3).max(30),
  code: z.string().trim().regex(/^\d{6}$/, 'enter the 6-digit code'),
});
export type VerifyFamilyPhoneInput = z.infer<typeof verifyFamilyPhoneSchema>;

/**
 * A local coordinator vouches that a family's request is genuine. They enter the reference the family
 * gave them; they never see the family's name, number or the patient.
 */
export const vouchFamilyLeadSchema = z.object({
  reference: z.string().trim().min(3).max(30),
  note: z.string().trim().min(3, 'say how you know the family').max(200),
});
export type VouchFamilyLeadInput = z.infer<typeof vouchFamilyLeadSchema>;

export const rejectFamilyLeadSchema = z.object({ reason: reasonSchema });

// ── Transport tasks (docs/state-machines.md §9) ──────────────────────────────

export const TRANSPORT_KINDS = ['donor_pickup', 'unit_transfer'] as const;
export type TransportKind = (typeof TRANSPORT_KINDS)[number];

export const TRANSPORT_STATUSES = ['requested', 'assigned', 'picked_up', 'handed_over', 'completed', 'failed', 'cancelled'] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

export const TRANSPORT_ACTIONS = ['claim', 'picked_up', 'handed_over', 'complete', 'fail', 'cancel'] as const;
export type TransportAction = (typeof TRANSPORT_ACTIONS)[number];

const placeSchema = z.object({
  label: z.string().trim().min(2).max(120),
  location: latLngSchema.nullable().optional(),
});

export const createTransportTaskSchema = z.object({
  requestId: objectIdSchema,
  kind: z.enum(TRANSPORT_KINDS),
  /** For donor pickups: the donor's assignment on this request. */
  assignmentId: objectIdSchema.optional(),
  pickup: placeSchema,
  dropoff: placeSchema,
  /**
   * Donor pickups only: a handover point where the donor is passed to a second coordinator (relay across a
   * river or ridge). Creates two linked legs: pickup → handover point, then handover point → dropoff.
   */
  relayPoint: placeSchema.optional(),
  note: z.string().trim().max(280).optional(),
}).refine((v) => !v.relayPoint || v.kind === 'donor_pickup', { path: ['relayPoint'], message: 'a relay is only for donor pickups' });
export type CreateTransportTaskInput = z.infer<typeof createTransportTaskSchema>;

export const transportActionSchema = z
  .object({
    expectedVersion,
    action: z.enum(TRANSPORT_ACTIONS),
    note: z.string().trim().max(280).optional(),
  })
  .refine((v) => !['fail', 'cancel'].includes(v.action) || (v.note?.length ?? 0) >= 3, {
    path: ['note'],
    message: 'please give a reason',
  });
export type TransportActionInput = z.infer<typeof transportActionSchema>;

export const listTransportQuerySchema = z.object({
  scope: z.enum(['open', 'mine', 'facility', 'all']).default('mine'),
  requestId: objectIdSchema.optional(),
});

// ── Stock transfers (docs/state-machines.md §10) ─────────────────────────────

export const STOCK_TRANSFER_STATUSES = ['requested', 'offered', 'dispatched', 'received', 'declined', 'cancelled'] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export const STOCK_TRANSFER_ACTIONS = ['offer', 'decline', 'dispatch', 'receive', 'cancel'] as const;
export type StockTransferAction = (typeof STOCK_TRANSFER_ACTIONS)[number];

export const createStockTransferSchema = z.object({
  respondingFacilityId: objectIdSchema,
  bloodGroup: z.enum(BLOOD_GROUPS),
  units: z.number().int().min(1).max(MAX_UNITS_PER_REQUEST * 2),
  relatedRequestId: objectIdSchema.optional(),
  note: z.string().trim().max(280).optional(),
});
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;

export const stockTransferActionSchema = z
  .object({
    expectedVersion,
    action: z.enum(STOCK_TRANSFER_ACTIONS),
    offeredUnits: z.number().int().min(1).max(MAX_UNITS_PER_REQUEST * 2).optional(),
    note: z.string().trim().max(280).optional(),
  })
  .refine((v) => v.action !== 'offer' || v.offeredUnits !== undefined, { path: ['offeredUnits'], message: 'how many units can you send?' })
  .refine((v) => !['decline', 'cancel'].includes(v.action) || (v.note?.length ?? 0) >= 3, { path: ['note'], message: 'please give a reason' });
export type StockTransferActionInput = z.infer<typeof stockTransferActionSchema>;

export const listStockTransfersQuerySchema = z.object({
  direction: z.enum(['incoming', 'outgoing']).default('outgoing'),
});

// ── Surplus units shared with nearby facilities ──────────────────────────────

export const createSurplusSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  units: z.number().int().min(1).max(50),
  note: z.string().trim().max(160).optional(),
  /** How long the offer stays visible. Units near expiry should be offered with a short window. */
  validHours: z.number().int().min(6).max(168).default(48),
});
export type CreateSurplusInput = z.infer<typeof createSurplusSchema>;
