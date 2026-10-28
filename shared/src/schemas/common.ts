import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'must be a valid id');

/** Free-text justification required for sensitive decisions (audited). */
export const reasonSchema = z.string().trim().min(3, 'please give a reason').max(500);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'use international format, e.g. +919000000001');

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
