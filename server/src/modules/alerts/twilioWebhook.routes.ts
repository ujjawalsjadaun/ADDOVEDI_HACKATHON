import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { missedCallSchema, smsReplySchema } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { createRateLimiter } from '../../middleware/rateLimit';
import { handleMissedCall, handleSmsReply } from './smsReply.service';

// Twilio posts form-encoded fields and signs the request (X-Twilio-Signature = base64 HMAC-SHA1 of the full
// URL followed by every field name and value sorted by name, keyed with the account's auth token).
// https://www.twilio.com/docs/usage/webhooks/webhooks-security

function signatureMatches(req: Request, config: Config): boolean {
  const token = config.TWILIO_AUTH_TOKEN;
  const given = req.get('x-twilio-signature');
  if (!token || !given) return false;
  const url = `${config.TWILIO_WEBHOOK_BASE_URL ?? config.PUBLIC_APP_URL}${req.originalUrl}`;
  const params = req.body as Record<string, string>;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac('sha1', token).update(data, 'utf8').digest('base64');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * /api/twilio — webhooks for a Twilio number. Mounted BEFORE the JSON-only guard because Twilio sends forms;
 * the signature (not a cookie) is what authenticates the caller, and a bad signature looks like an unknown route.
 *  - POST /sms   : an incoming text → the same handler as every other inbound SMS; the answer goes back as TwiML.
 *  - POST /voice : an incoming call is rejected (free for the caller) and counts as a missed call = "available today".
 */
export function twilioWebhookRoutes(config: Config): Router {
  const router = Router();
  router.use(createRateLimiter({ windowMs: 60_000, limit: 120, keyBy: 'ip' }));
  router.use(express.urlencoded({ extended: false, limit: '10kb' }));
  router.use((req, _res, next) => {
    if (config.SMS_PROVIDER !== 'twilio' || !signatureMatches(req, config)) return next(new AppError('NOT_FOUND', 'Not found.'));
    next();
  });

  router.post('/sms', async (req, res) => {
    const input = smsReplySchema.safeParse({ from: req.body.From, body: req.body.Body });
    const result = input.success ? await handleSmsReply(input.data, config, res.locals.requestId) : null;
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response>${result ? `<Message>${xml(result.replyText)}</Message>` : ''}</Response>`);
  });

  router.post('/voice', async (req, res) => {
    const input = missedCallSchema.safeParse({ from: req.body.From });
    if (input.success) await handleMissedCall(input.data, res.locals.requestId);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>');
  });

  return router;
}
