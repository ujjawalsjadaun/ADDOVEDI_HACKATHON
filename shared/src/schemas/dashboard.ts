import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema, reasonSchema } from './common';

export const auditQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(60).optional(),
  resourceType: z.enum(['user', 'hospital', 'bloodRequest', 'roadReport', 'familyLead', 'stockTransfer']).optional(),
  resourceId: objectIdSchema.optional(),
  facilityId: objectIdSchema.optional(),
  result: z.enum(['success', 'denied', 'failed']).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export const listReportsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'reviewed']).optional(),
});

export const reviewReportSchema = z.object({ reason: reasonSchema });
