import { Router } from 'express';
import { requireRole } from '../../middleware/authorize';
import { adminHospitalRoutes } from '../hospitals/hospital.routes';
import { adminUserRoutes } from '../users/user.routes';
import { adminDonorRoutes } from '../donors/donor.routes';

/** /api/admin — every route below requires the admin role (checked here, server-side). */
export function adminRoutes(): Router {
  const router = Router();
  router.use(requireRole('admin'));
  router.use('/hospitals', adminHospitalRoutes());
  router.use('/users', adminUserRoutes());
  router.use('/donors', adminDonorRoutes());
  return router;
}
