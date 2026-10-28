import type { RequestHandler } from 'express';
import type { Config } from '../config/env';
import { loadSessionUser } from '../modules/auth/auth.service';
import { clearSessionCookieOptions, readSession, SESSION_COOKIE } from '../modules/auth/session';

/**
 * Resolves the session cookie to an active user on every request (status and token version are
 * re-checked, so suspension and logout take effect immediately). Never rejects by itself —
 * route guards decide what needs a user. An invalid cookie is cleared.
 */
export function authenticate(config: Config): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token === '') return next();

    const claims = readSession(token, config);
    const user = claims ? await loadSessionUser(claims.userId, claims.tokenVersion) : null;
    if (!user) {
      res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(config));
      return next();
    }
    res.locals.user = user;
    next();
  };
}
