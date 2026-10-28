import { Router } from 'express';
import { listReportsQuerySchema, reviewReportSchema, suspiciousReportSchema, type PublicRequestStatus } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext } from '../../middleware/authorize';
import { createRateLimiter } from '../../middleware/rateLimit';
import { listSuspiciousReports, lookupPublicStatus, reportSuspicious, reviewSuspiciousReport } from './checker.service';

/** /api/public — anonymous, rate-limited. */
export function publicCheckerRoutes(config: Config): Router {
  const router = Router();
  const lookupLimiter = createRateLimiter({ windowMs: 60_000, limit: 30, keyBy: 'ip' });
  const reportLimiter = createRateLimiter({ windowMs: 60 * 60_000, limit: 10, keyBy: 'ip' });

  router.get('/requests/:code', lookupLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendData<PublicRequestStatus>(res, await lookupPublicStatus(String(req.params.code).slice(0, 32)));
  });

  router.post('/reports', reportLimiter, async (req, res) => {
    const input = parse(suspiciousReportSchema, req.body);
    await reportSuspicious(input, req.ip ?? 'unknown', config);
    sendData(res, { received: true }, { status: 202 });
  });

  return router;
}

/** /api/admin/suspicious-reports — mounted behind requireRole('admin'). */
export function adminReportRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(listReportsQuerySchema, req.query);
    const { items, total } = await listSuspiciousReports(query);
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.post('/:id/review', async (req, res) => {
    const { reason } = parse(reviewReportSchema, req.body);
    await reviewSuspiciousReport(parseId(req.params.id), reason, actionContext(res));
    sendData(res, { reviewed: true });
  });

  return router;
}
