import { Router } from 'express';
import {
  createStockTransferSchema,
  listStockTransfersQuerySchema,
  stockTransferActionSchema,
  type StockTransferView,
} from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { requireIdempotencyKey, runIdempotent } from '../idempotency/idempotency.service';
import { StockTransferModel } from './stockTransfer.model';
import { actOnStockTransfer, createStockTransfer, listStockTransfers, viewStockTransfer } from './stockTransfer.service';

/** /api/stock-transfers — facility-to-facility blood stock requests. Hospital staff only. */
export function stockTransferRoutes(): Router {
  const router = Router();
  router.use(requireRole('hospital_staff'));

  router.get('/', async (req, res) => {
    const { direction } = parse(listStockTransfersQuerySchema, req.query);
    sendData(res, await listStockTransfers(currentUser(res), direction));
  });

  router.post('/', async (req, res) => {
    const key = requireIdempotencyKey(req);
    const input = parse(createStockTransferSchema, req.body);
    const ctx = actionContext(res);
    const outcome = await runIdempotent(
      { scope: 'stock-transfers.create', actorKey: ctx.user.id, key, body: req.body },
      async () => ({ status: 201, resourceId: (await createStockTransfer(input, ctx))._id }),
    );
    const transfer = await StockTransferModel.findById(outcome.resourceId);
    sendData<StockTransferView>(res, await viewStockTransfer(transfer!, ctx.user), { status: outcome.status });
  });

  router.post('/:id/status', async (req, res) => {
    const input = parse(stockTransferActionSchema, req.body);
    sendData(res, await actOnStockTransfer(parseId(req.params.id), input, actionContext(res)));
  });

  return router;
}
