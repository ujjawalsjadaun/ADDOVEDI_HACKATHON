import { Router } from 'express';
import { createSurplusSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { publish, rooms } from '../../realtime/emitter';
import { createSurplus, listSurplus, withdrawSurplus } from './surplus.service';

/** /api/stock-surplus — spare units shared between verified facilities. Hospital staff only. */
export function surplusRoutes(): Router {
  const router = Router();
  router.use(requireRole('hospital_staff'));

  router.get('/', async (_req, res) => {
    sendData(res, await listSurplus(currentUser(res)));
  });

  router.post('/', async (req, res) => {
    const view = await createSurplus(parse(createSurplusSchema, req.body), actionContext(res));
    publish('transfer', [rooms.role('hospital_staff')], view.id);
    sendData(res, view, { status: 201 });
  });

  router.post('/:id/withdraw', async (req, res) => {
    const id = parseId(req.params.id);
    await withdrawSurplus(id, actionContext(res));
    publish('transfer', [rooms.role('hospital_staff')], id);
    sendData(res, { withdrawn: true });
  });

  return router;
}
