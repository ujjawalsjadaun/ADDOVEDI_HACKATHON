import { Router } from 'express';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { currentUser, requireRole } from '../../middleware/authorize';
import { getAdminOverview, getHospitalDashboard, listCoordinatorRequests } from './dashboard.service';

/** /api/dashboard — role read models. */
export function dashboardRoutes(): Router {
  const router = Router();

  router.get('/hospital', requireRole('hospital_staff'), async (_req, res) => {
    sendData(res, await getHospitalDashboard(currentUser(res)));
  });

  router.get('/coordinator', requireRole('coordinator', 'admin'), async (_req, res) => {
    sendData(res, await listCoordinatorRequests());
  });

  return router;
}

/** /api/admin/overview — mounted behind requireRole('admin'). */
export function adminOverviewRoutes(config: Config): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    sendData(res, await getAdminOverview(config));
  });
  return router;
}
