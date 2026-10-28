import { Router } from 'express';
import { createRoadReportSchema, roadReportDecisionSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { createRateLimiter } from '../../middleware/rateLimit';
import { createRoadReport, decideRoadReport, listRoadReports } from './roadReport.service';
import { publish, rooms } from '../../realtime/emitter';

/** /api/road-reports — hospital staff, coordinators and admins report; coordinators/admins verify. */
export function roadReportRoutes(): Router {
  const router = Router();
  router.use(requireRole('hospital_staff', 'coordinator', 'admin'));
  const createLimiter = createRateLimiter({ windowMs: 60 * 60_000, limit: 30, keyBy: 'user' });

  router.get('/', async (_req, res) => {
    sendData(res, await listRoadReports(currentUser(res)));
  });

  router.post('/', createLimiter, async (req, res) => {
    const input = parse(createRoadReportSchema, req.body);
    const report = await createRoadReport(input, actionContext(res));
    publish('map', [rooms.role('coordinator'), rooms.role('admin'), rooms.role('hospital_staff')], report.id);
    sendData(res, report, { status: 201 });
  });

  router.post('/:id/verification', requireRole('coordinator', 'admin'), async (req, res) => {
    const input = parse(roadReportDecisionSchema, req.body);
    const report = await decideRoadReport(parseId(req.params.id), input, actionContext(res));
    publish('map', [rooms.role('coordinator'), rooms.role('admin'), rooms.role('hospital_staff')], report.id);
    sendData(res, report);
  });

  return router;
}
