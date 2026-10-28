import { Router } from 'express';
import {
  accessPointSchema,
  createHospitalSchema,
  hospitalDecisionSchema,
  listHospitalsQuerySchema,
  publicHospitalsQuerySchema,
} from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, requireRole } from '../../middleware/authorize';
import {
  createHospital,
  decideHospitalVerification,
  getHospital,
  listHospitals,
  listVerifiedHospitals,
  setAccessPoint,
} from './hospital.service';

/** /api/hospitals — public list of verified facilities, plus the staff-only access-point update. */
export function publicHospitalRoutes(): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const query = parse(publicHospitalsQuerySchema, req.query);
    sendData(res, await listVerifiedHospitals(query.district));
  });

  router.post('/:id/access-point', requireRole('hospital_staff', 'coordinator', 'admin'), async (req, res) => {
    const input = parse(accessPointSchema, req.body);
    await setAccessPoint(parseId(req.params.id), input, actionContext(res));
    sendData(res, { updated: true });
  });
  return router;
}

/** /api/admin/hospitals — mounted behind requireRole('admin'). */
export function adminHospitalRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(listHospitalsQuerySchema, req.query);
    const { items, total } = await listHospitals(query);
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.post('/', async (req, res) => {
    const input = parse(createHospitalSchema, req.body);
    sendData(res, await createHospital(input, actionContext(res)), { status: 201 });
  });

  router.get('/:id', async (req, res) => {
    sendData(res, await getHospital(parseId(req.params.id)));
  });

  router.post('/:id/verification', async (req, res) => {
    const id = parseId(req.params.id);
    const input = parse(hospitalDecisionSchema, req.body);
    sendData(res, await decideHospitalVerification(id, input, actionContext(res)));
  });

  return router;
}
