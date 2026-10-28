import { Router } from 'express';
import {
  createRequestSchema,
  duplicateReviewSchema,
  fulfillRequestSchema,
  listRequestsQuerySchema,
  nextBatchSchema,
  reasonedTransitionSchema,
  verifyRequestSchema,
  type CreateRequestResult,
} from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { sendData } from '../../lib/http';
import { parse, parseId } from '../../lib/validation';
import { actionContext, currentUser, requireRole } from '../../middleware/authorize';
import { createRateLimiter } from '../../middleware/rateLimit';
import { requireIdempotencyKey, runIdempotent } from '../idempotency/idempotency.service';
import {
  alertMoreDonors,
  cancelRequest,
  createRequest,
  fulfillRequest,
  getCandidatePreview,
  getRequestDetail,
  listRequests,
  rejectRequest,
  reviewDuplicate,
  verifyRequest,
} from './request.service';

/** /api/requests — hospital staff (own facility) and administrators. */
export function requestRoutes(config: Config): Router {
  const router = Router();
  router.use(requireRole('hospital_staff', 'admin'));
  const createLimiter = createRateLimiter({ windowMs: 60 * 60_000, limit: 30, keyBy: 'user' });

  router.post('/', requireRole('hospital_staff'), createLimiter, async (req, res) => {
    const key = requireIdempotencyKey(req);
    const input = parse(createRequestSchema, req.body);
    const ctx = actionContext(res);
    const outcome = await runIdempotent<{ possibleDuplicate: boolean }>(
      { scope: 'requests.create', actorKey: ctx.user.id, key, body: req.body },
      async () => {
        const { request, possibleDuplicate } = await createRequest(input, ctx, config);
        return { status: 201, resourceId: request._id, meta: { possibleDuplicate } };
      },
    );
    res.setHeader('Idempotent-Replayed', String(outcome.replayed));
    const request = await getRequestDetail(outcome.resourceId.toString(), ctx.user, config);
    sendData<CreateRequestResult>(res, { request, possibleDuplicate: outcome.meta?.possibleDuplicate ?? false }, { status: outcome.status });
  });

  router.get('/', async (req, res) => {
    const query = parse(listRequestsQuerySchema, req.query);
    const { items, total } = await listRequests(query, currentUser(res));
    sendData(res, items, { meta: { page: query.page, limit: query.limit, total } });
  });

  router.get('/:id', async (req, res) => {
    sendData(res, await getRequestDetail(parseId(req.params.id), currentUser(res), config));
  });

  router.post('/:id/verify', async (req, res) => {
    const input = parse(verifyRequestSchema, req.body);
    sendData(res, await verifyRequest(parseId(req.params.id), input, actionContext(res), config));
  });

  router.post('/:id/reject', async (req, res) => {
    const input = parse(reasonedTransitionSchema, req.body);
    sendData(res, await rejectRequest(parseId(req.params.id), input, actionContext(res), config));
  });

  router.post('/:id/duplicate-review', async (req, res) => {
    const input = parse(duplicateReviewSchema, req.body);
    sendData(res, await reviewDuplicate(parseId(req.params.id), input, actionContext(res), config));
  });

  router.post('/:id/cancel', async (req, res) => {
    const input = parse(reasonedTransitionSchema, req.body);
    sendData(res, await cancelRequest(parseId(req.params.id), input, actionContext(res), config));
  });

  router.post('/:id/fulfill', async (req, res) => {
    const input = parse(fulfillRequestSchema, req.body);
    sendData(res, await fulfillRequest(parseId(req.params.id), input, actionContext(res), config));
  });

  router.get('/:id/candidates', async (req, res) => {
    sendData(res, await getCandidatePreview(parseId(req.params.id), currentUser(res), config));
  });

  router.post('/:id/alerts/next-batch', async (req, res) => {
    const input = parse(nextBatchSchema, req.body);
    sendData(res, await alertMoreDonors(parseId(req.params.id), input, actionContext(res), config));
  });

  return router;
}
