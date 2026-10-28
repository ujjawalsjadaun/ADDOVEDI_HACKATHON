import { Router } from 'express';
import { suspiciousReportSchema, type PublicRequestStatus } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { createRateLimiter } from '../../middleware/rateLimit';
import { lookupPublicStatus, reportSuspicious } from './checker.service';

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
