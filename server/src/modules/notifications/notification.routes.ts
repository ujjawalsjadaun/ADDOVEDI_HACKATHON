import { Router } from 'express';
import { listNotificationsQuerySchema, retryNotificationSchema } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext } from '../../middleware/authorize';
import { listNotifications, queueHealth, retryNotification } from './outbox.service';

/** /api/admin/notifications — outbox visibility. Mounted behind requireRole('admin'). */
export function adminNotificationRoutes(config: Config): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(listNotificationsQuerySchema, req.query);
    const { items, total } = await listNotifications(query);
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.get('/health', async (_req, res) => {
    sendData(res, await queueHealth(config));
  });

  router.post('/:id/retry', async (req, res) => {
    const { reason } = parse(retryNotificationSchema, req.body);
    await retryNotification(parseId(req.params.id), reason, actionContext(res));
    sendData(res, { queued: true });
  });

  return router;
}
