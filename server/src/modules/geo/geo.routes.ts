import { Router } from 'express';
import type { Config } from '../../config/env';
import { nearestRoadSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { createRateLimiter } from '../../middleware/rateLimit';
import { findNearestRoad } from '../../providers/routing/snap';
import { currentUser, requireRole } from '../../middleware/authorize';
import { getMapData } from './geo.service';

/** /api/geo — map layers for hospital staff, coordinators and admins. */
export function geoRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('hospital_staff', 'coordinator', 'admin'));

  router.get('/map', async (_req, res) => {
    sendData(res, await getMapData(currentUser(res), config));
  });

  // Calls third-party map services, so it is limited per user.
  router.post('/nearest-road', createRateLimiter({ windowMs: 10 * 60_000, limit: 30, keyBy: 'user' }), async (req, res) => {
    sendData(res, await findNearestRoad(parse(nearestRoadSchema, req.body).location, config));
  });

  return router;
}
