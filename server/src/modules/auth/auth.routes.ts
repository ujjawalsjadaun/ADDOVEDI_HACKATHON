import { Router } from 'express';
import { loginSchema, type MeResponse } from '@golden-hour/shared';
import type { Logger } from 'pino';
import type { Config } from '../../config/env';
import { hmacHex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { currentUser, requireAuth } from '../../middleware/authorize';
import { createRateLimiter } from '../../middleware/rateLimit';
import { recordAudit, SYSTEM_ACTOR, userActor } from '../audit/audit.service';
import { toSafeUser } from './auth.dto';
import { checkCredentials, getFacilitySummary, recordLogin, revokeSessions } from './auth.service';
import { clearSessionCookieOptions, SESSION_COOKIE, sessionCookieOptions, signSession } from './session';

export function authRoutes(config: Config, logger: Logger): Router {
  const router = Router();
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, limit: 10, keyBy: 'ip+email' });

  router.post('/login', loginLimiter, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const result = await checkCredentials(input.email, input.password);

    if (!result.ok) {
      // Best effort: a failed audit write must not change what the caller learns.
      await recordAudit({
        actor: SYSTEM_ACTOR,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: result.userId,
        result: 'denied',
        detail: { reason: result.reason, emailHash: hmacHex(config.SESSION_SECRET, input.email) },
        requestId: res.locals.requestId,
      }).catch((err: unknown) => logger.error({ err }, 'audit write failed for auth.login_failed'));
      throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect.');
    }

    const { user } = result;
    await recordLogin(user.id);
    await recordAudit({
      actor: userActor(user),
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      facilityId: user.facilityId,
      requestId: res.locals.requestId,
    });
    res.cookie(SESSION_COOKIE, signSession(user, config), sessionCookieOptions(config));
    sendData<MeResponse>(res, { user: toSafeUser(user), facility: await getFacilitySummary(user.facilityId) });
  });

  // Idempotent: always clears the cookie; revokes every session of the user when signed in.
  router.post('/logout', async (_req, res) => {
    const user = res.locals.user;
    if (user) {
      await revokeSessions(user.id);
      await recordAudit({
        actor: userActor(user),
        action: 'auth.logout',
        resourceType: 'user',
        resourceId: user.id,
        requestId: res.locals.requestId,
      });
    }
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(config));
    sendData(res, { loggedOut: true });
  });

  router.get('/me', requireAuth, async (_req, res) => {
    const user = currentUser(res);
    sendData<MeResponse>(res, { user: toSafeUser(user), facility: await getFacilitySummary(user.facilityId) });
  });

  return router;
}
