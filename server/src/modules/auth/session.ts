import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import type { Config } from '../../config/env';

// Session design: docs/security.md §2 and decision D-15.

export const SESSION_COOKIE = 'gh_session';

interface SessionClaims {
  userId: string;
  tokenVersion: number;
}

export function signSession(user: { id: string; tokenVersion: number }, config: Config): string {
  return jwt.sign({ tv: user.tokenVersion }, config.SESSION_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: `${config.SESSION_TTL_HOURS}h`,
  });
}

/** Returns the claims of a valid, unexpired session token, or null. */
export function readSession(token: string, config: Config): SessionClaims | null {
  try {
    const payload = jwt.verify(token, config.SESSION_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || typeof payload.tv !== 'number') return null;
    return { userId: payload.sub, tokenVersion: payload.tv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(config: Config): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

export function clearSessionCookieOptions(config: Config): CookieOptions {
  const { maxAge: _maxAge, ...rest } = sessionCookieOptions(config);
  return rest;
}
