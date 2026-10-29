import { Router } from 'express';
import type { Config } from '../../config/env';
import { requireRole } from '../../middleware/authorize';
import { adminAuditRoutes } from '../audit/audit.routes';
import { adminOverviewRoutes } from '../dashboard/dashboard.routes';
import { adminDonorRoutes } from '../donors/donor.routes';
import { adminEscalationRoutes } from './admin.escalation.routes';
import { adminHospitalRoutes } from '../hospitals/hospital.routes';
import { adminReportRoutes } from '../public-checker/checker.routes';
import { adminNotificationRoutes } from '../notifications/notification.routes';
import { adminSmsRoutes } from '../alerts/smsReply.routes';
import { adminUserRoutes } from '../users/user.routes';

/** /api/admin — every route below requires the admin role (checked here, server-side). */
export function adminRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('admin'));
  router.use('/overview', adminOverviewRoutes(config));
  router.use('/hospitals', adminHospitalRoutes(config));
  router.use('/users', adminUserRoutes());
  router.use('/donors', adminDonorRoutes());
  router.use('/escalations', adminEscalationRoutes());
  router.use('/audit', adminAuditRoutes());
  router.use('/suspicious-reports', adminReportRoutes());
  router.use('/notifications', adminNotificationRoutes(config));
  router.use('/sms', adminSmsRoutes());
  return router;
}
