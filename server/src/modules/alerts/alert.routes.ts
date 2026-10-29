import { Router } from 'express';
import { donorAlertReportSchema, respondAlertSchema, type RespondAlertResult } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { currentUser, requireRole } from '../../middleware/authorize';
import { acceptAlert } from '../assignments/assignment.service';
import type { Config } from '../../config/env';
import { createRateLimiter } from '../../middleware/rateLimit';
import { declineAlert, reportAlertSuspicious } from './alert.service';

/** /api/alerts — donors answer their own alerts. Repeating the same answer returns the same result. */
export function alertRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('donor'));

  router.post('/:id/respond', async (req, res) => {
    const id = parseId(req.params.id);
    const { decision } = parse(respondAlertSchema, req.body);
    const user = currentUser(res);
    const result: RespondAlertResult =
      decision === 'accept' ? await acceptAlert(id, user, res.locals.requestId) : { alert: await declineAlert(id, user), assignment: null };
    sendData(res, result);
  });

  router.post('/:id/report', createRateLimiter({ windowMs: 10 * 60_000, limit: 10, keyBy: 'user' }), async (req, res) => {
    const input = parse(donorAlertReportSchema, req.body);
    await reportAlertSuspicious(parseId(req.params.id), input, currentUser(res), config);
    sendData(res, { reported: true });
  });

  return router;
}
