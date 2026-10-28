import { Router } from 'express';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { currentUser, requireRole } from '../../middleware/authorize';
import { getMapData } from './geo.service';

/** /api/geo — map layers for hospital staff, coordinators and admins. */
export function geoRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('hospital_staff', 'coordinator', 'admin'));

  router.get('/map', async (_req, res) => {
    sendData(res, await getMapData(currentUser(res), config));
  });

  return router;
}
