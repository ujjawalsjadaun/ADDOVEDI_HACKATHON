import { Router } from 'express';
import {
  donorAvailabilitySchema,
  donorReviewSchema,
  donorVerificationSchema,
  listDonorsQuerySchema,
  updateDonorProfileSchema,
} from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { listDonorAlerts } from '../alerts/alert.service';
import { listForDonor } from '../assignments/assignment.service';
import {
  getOwnProfile,
  listDonors,
  markLastDonationUnknown,
  setAvailability,
  setDonorReview,
  setDonorVerification,
  updateOwnProfile,
} from './donor.service';

/** /api/donors/me — a donor's own profile, alerts and assignments. */
export function donorRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('donor'));

  router.get('/me', async (_req, res) => {
    sendData(res, await getOwnProfile(currentUser(res).id, config));
  });

  router.put('/me', async (req, res) => {
    const input = parse(updateDonorProfileSchema, req.body);
    sendData(res, await updateOwnProfile(input, actionContext(res), config));
  });

  router.post('/me/last-donation-unknown', async (_req, res) => {
    sendData(res, await markLastDonationUnknown(actionContext(res), config));
  });

  router.post('/me/availability', async (req, res) => {
    const { availability } = parse(donorAvailabilitySchema, req.body);
    sendData(res, await setAvailability(availability, actionContext(res), config));
  });

  router.get('/me/alerts', async (_req, res) => {
    sendData(res, await listDonorAlerts(currentUser(res).id));
  });

  router.get('/me/assignments', async (_req, res) => {
    sendData(res, await listForDonor(currentUser(res)));
  });

  return router;
}

/** /api/admin/donors — mounted behind requireRole('admin'). */
export function adminDonorRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(listDonorsQuerySchema, req.query);
    const { items, total } = await listDonors(query);
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.post('/:userId/verification', async (req, res) => {
    const { decision, reason } = parse(donorVerificationSchema, req.body);
    sendData(res, await setDonorVerification(parseId(req.params.userId), decision, reason, actionContext(res)));
  });

  router.post('/:userId/review', async (req, res) => {
    const { decision, reason } = parse(donorReviewSchema, req.body);
    sendData(res, await setDonorReview(parseId(req.params.userId), decision, reason, actionContext(res)));
  });

  return router;
}
