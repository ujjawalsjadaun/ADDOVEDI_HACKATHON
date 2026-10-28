import { Router } from 'express';
import { createTransportTaskSchema, listTransportQuerySchema, transportActionSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { actOnTransportTask, createTransportTask, listTransportTasks } from './transportTask.service';

/** /api/transport-tasks — hospital staff (own facility) and admins create; coordinators claim and run them. */
export function transportRoutes(): Router {
  const router = Router();
  router.use(requireRole('hospital_staff', 'coordinator', 'admin'));

  router.get('/', async (req, res) => {
    const query = parse(listTransportQuerySchema, req.query);
    sendData(res, await listTransportTasks(currentUser(res), query));
  });

  router.post('/', async (req, res) => {
    const input = parse(createTransportTaskSchema, req.body);
    sendData(res, await createTransportTask(input, actionContext(res)), { status: 201 });
  });

  router.post('/:id/status', async (req, res) => {
    const input = parse(transportActionSchema, req.body);
    sendData(res, await actOnTransportTask(parseId(req.params.id), input, actionContext(res)));
  });

  return router;
}
