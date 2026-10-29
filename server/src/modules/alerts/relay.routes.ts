import { Router } from 'express';
import { sendData } from '../../lib/http';
import { parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { listRelayAlerts, markAlertRelayed } from './relay.service';

/** /api/relay — village coordinators pass open alerts on to donors who have no data. Coordinators only. */
export function relayRoutes(): Router {
  const router = Router();
  router.use(requireRole('coordinator'));

  router.get('/alerts', async (_req, res) => {
    sendData(res, await listRelayAlerts(currentUser(res)));
  });

  router.post('/alerts/:id/relayed', async (req, res) => {
    await markAlertRelayed(parseId(req.params.id), actionContext(res));
    sendData(res, { relayed: true });
  });

  return router;
}
