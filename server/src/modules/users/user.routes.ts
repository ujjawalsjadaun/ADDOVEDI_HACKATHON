import { Router } from 'express';
import { createUserSchema, listUsersQuerySchema, userStatusSchema } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext } from '../../middleware/authorize';
import { userActor } from '../audit/audit.service';
import { createUser, listUsers, setUserStatus } from './user.service';

/** /api/admin/users — mounted behind requireRole('admin'). */
export function adminUserRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(listUsersQuerySchema, req.query);
    const { items, total } = await listUsers(query);
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.post('/', async (req, res) => {
    const input = parse(createUserSchema, req.body);
    const ctx = actionContext(res);
    sendData(res, await createUser(input, userActor(ctx.user), ctx.requestId), { status: 201 });
  });

  router.post('/:id/status', async (req, res) => {
    const id = parseId(req.params.id);
    const input = parse(userStatusSchema, req.body);
    sendData(res, await setUserStatus(id, input, actionContext(res)));
  });

  return router;
}
