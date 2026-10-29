import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { missedCallSchema, smsReplySchema } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { createRateLimiter } from '../../middleware/rateLimit';
import { recordAudit, userActor } from '../audit/audit.service';
import { actionContext } from '../../middleware/authorize';
import { handleMissedCall, handleSmsReply } from './smsReply.service';

function secretMatches(given: unknown, expected: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/sms/inbound — webhook for an SMS provider. No session: the shared secret authenticates the
 * provider. With no INBOUND_SMS_SECRET configured it answers 404, so it cannot be abused when unused.
 */
export function inboundSmsRoutes(config: Config): Router {
  const router = Router();
  router.post('/inbound', createRateLimiter({ windowMs: 60_000, limit: 120, keyBy: 'ip' }), async (req, res) => {
    if (!config.INBOUND_SMS_SECRET || !secretMatches(req.get('x-sms-secret'), config.INBOUND_SMS_SECRET)) {
      throw new AppError('NOT_FOUND', 'Not found.');
    }
    sendData(res, await handleSmsReply(parse(smsReplySchema, req.body), config, res.locals.requestId));
  });
  router.post('/missed-call', createRateLimiter({ windowMs: 60_000, limit: 120, keyBy: 'ip' }), async (req, res) => {
    if (!config.INBOUND_SMS_SECRET || !secretMatches(req.get('x-sms-secret'), config.INBOUND_SMS_SECRET)) {
      throw new AppError('NOT_FOUND', 'Not found.');
    }
    sendData(res, await handleMissedCall(parse(missedCallSchema, req.body), res.locals.requestId));
  });
  return router;
}

/** POST /api/admin/sms/simulate-reply — lets an administrator type a donor's reply (demo without a real provider). Audited. */
export function adminSmsRoutes(config: Config): Router {
  const router = Router();
  router.post('/simulate-reply', async (req, res) => {
    const input = parse(smsReplySchema, req.body);
    const ctx = actionContext(res);
    const result = await handleSmsReply(input, config, ctx.requestId);
    await recordAudit({
      actor: userActor(ctx.user),
      action: 'admin.sms_reply_simulated',
      resourceType: 'user',
      resourceId: ctx.user.id,
      detail: { outcome: result.outcome },
      requestId: ctx.requestId,
    });
    sendData(res, result);
  });
  router.post('/simulate-missed-call', async (req, res) => {
    const input = parse(missedCallSchema, req.body);
    const ctx = actionContext(res);
    const result = await handleMissedCall(input, ctx.requestId);
    await recordAudit({
      actor: userActor(ctx.user),
      action: 'admin.missed_call_simulated',
      resourceType: 'user',
      resourceId: ctx.user.id,
      detail: { outcome: result.outcome },
      requestId: ctx.requestId,
    });
    sendData(res, result);
  });
  return router;
}
