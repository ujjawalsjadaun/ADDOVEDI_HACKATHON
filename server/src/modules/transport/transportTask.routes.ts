import { Router } from 'express';
import { createTransportTaskSchema, listTransportQuerySchema, transportActionSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { actOnTransportTask, createTransportTask, listTransportTasks } from './transportTask.service';
import { publish, rooms } from '../../realtime/emitter';
import type { TransportTaskView } from '@golden-hour/shared';

/** After a committed change: the facility, coordinators and admins refetch transport (and the request timeline). */
function announce(t: TransportTaskView): void {
  const targets = [rooms.facility(t.facility.id), rooms.role('coordinator'), rooms.role('admin')];
  publish('transport', targets, t.id);
  publish('request', [rooms.facility(t.facility.id)], t.request.id);
}

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
    const task = await createTransportTask(input, actionContext(res));
    announce(task);
    sendData(res, task, { status: 201 });
  });

  router.post('/:id/status', async (req, res) => {
    const input = parse(transportActionSchema, req.body);
    const task = await actOnTransportTask(parseId(req.params.id), input, actionContext(res));
    announce(task);
    sendData(res, task);
  });

  return router;
}
