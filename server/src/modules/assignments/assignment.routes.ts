import { Router } from 'express';
import { donorAssignmentStatusSchema, noShowSchema, versionOnlySchema } from '@golden-hour/shared';
import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, requireRole } from '../../middleware/authorize';
import { SYSTEM_ACTOR } from '../audit/audit.service';
import { alertNextBatch } from '../alerts/alert.service';
import { getRequestDetail } from '../requests/request.service';
import { confirmArrival, markDonated, markNoShow, updateDonorAssignment } from './assignment.service';

/** /api/assignments — donors update their own; hospital staff confirm for their facility. */
export function assignmentRoutes(config: Config, logger: Logger): Router {
  const router = Router();

  /**
   * After a slot is freed and the need still exists, alert the next donors. Best effort: the
   * status change is already committed; if this fails the hospital can widen the search manually.
   */
  async function refillSlot(requestId: Types.ObjectId, httpRequestId: string) {
    try {
      await alertNextBatch(requestId, { actor: SYSTEM_ACTOR, config, httpRequestId });
    } catch (err) {
      logger.warn({ err, requestId: requestId.toString() }, 'next alert batch after released slot failed');
    }
  }

  router.post('/:id/status', requireRole('donor'), async (req, res) => {
    const input = parse(donorAssignmentStatusSchema, req.body);
    const ctx = actionContext(res);
    const { view, slotReleased, requestId } = await updateDonorAssignment(parseId(req.params.id), input, ctx);
    if (slotReleased) await refillSlot(requestId, ctx.requestId);
    sendData(res, view);
  });

  router.post('/:id/confirm-arrival', requireRole('hospital_staff'), async (req, res) => {
    const { expectedVersion } = parse(versionOnlySchema, req.body);
    const ctx = actionContext(res);
    const a = await confirmArrival(parseId(req.params.id), expectedVersion, ctx);
    sendData(res, await getRequestDetail(a.requestId.toString(), ctx.user, config));
  });

  router.post('/:id/donated', requireRole('hospital_staff'), async (req, res) => {
    const { expectedVersion } = parse(versionOnlySchema, req.body);
    const ctx = actionContext(res);
    const a = await markDonated(parseId(req.params.id), expectedVersion, ctx);
    sendData(res, await getRequestDetail(a.requestId.toString(), ctx.user, config));
  });

  router.post('/:id/no-show', requireRole('hospital_staff'), async (req, res) => {
    const input = parse(noShowSchema, req.body);
    const ctx = actionContext(res);
    const { assignment, slotReleased } = await markNoShow(parseId(req.params.id), input, ctx);
    if (slotReleased) await refillSlot(assignment.requestId, ctx.requestId);
    sendData(res, await getRequestDetail(assignment.requestId.toString(), ctx.user, config));
  });

  return router;
}
