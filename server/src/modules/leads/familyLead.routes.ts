import { Router } from 'express';
import { z } from 'zod';
import {
  confirmFamilyLeadSchema,
  createFamilyLeadSchema,
  FAMILY_LEAD_STATUSES,
  rejectFamilyLeadSchema,
  type FamilyLeadReceipt,
} from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { hmacHex } from '../../lib/crypto';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { createRateLimiter } from '../../middleware/rateLimit';
import { requireIdempotencyKey, runIdempotent } from '../idempotency/idempotency.service';
import { FamilyLeadModel } from './familyLead.model';
import { confirmFamilyLead, listFamilyLeads, rejectFamilyLead, submitFamilyLead } from './familyLead.service';

const listQuery = z.object({ status: z.enum(FAMILY_LEAD_STATUSES).optional() });

/** /api/family-leads — public submission (rate-limited, idempotent); hospital staff review their own facility's leads. */
export function familyLeadRoutes(config: Config): Router {
  const router = Router();
  const submitLimiter = createRateLimiter({ windowMs: 60 * 60_000, limit: 5, keyBy: 'ip' });

  router.post('/', submitLimiter, async (req, res) => {
    const key = requireIdempotencyKey(req);
    const input = parse(createFamilyLeadSchema, req.body);
    const outcome = await runIdempotent<FamilyLeadReceipt>(
      // Anonymous: scope the key to a keyed hash of the IP, never the IP itself.
      { scope: 'family-leads.create', actorKey: hmacHex(config.SESSION_SECRET, `ip:${req.ip ?? 'unknown'}`), key, body: req.body },
      async () => {
        const receipt = await submitFamilyLead(input, res.locals.requestId);
        const lead = await FamilyLeadModel.findOne({ reference: receipt.reference }).select('_id');
        return { status: 202, resourceId: lead!._id, meta: receipt };
      },
    );
    sendData<FamilyLeadReceipt>(res, outcome.meta!, { status: outcome.status });
  });

  router.get('/', requireRole('hospital_staff'), async (req, res) => {
    const { status } = parse(listQuery, req.query);
    sendData(res, await listFamilyLeads(currentUser(res), status));
  });

  router.post('/:id/confirm', requireRole('hospital_staff'), async (req, res) => {
    const input = parse(confirmFamilyLeadSchema, req.body);
    sendData(res, await confirmFamilyLead(parseId(req.params.id), input, actionContext(res), config), { status: 201 });
  });

  router.post('/:id/reject', requireRole('hospital_staff'), async (req, res) => {
    const { reason } = parse(rejectFamilyLeadSchema, req.body);
    sendData(res, await rejectFamilyLead(parseId(req.params.id), reason, actionContext(res)));
  });

  return router;
}
