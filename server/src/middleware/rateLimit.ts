import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { AppError } from '../lib/errors';

// In-memory store: correct for the single-process MVP; documented limitation (docs/security.md §4).

type KeyBy = 'ip' | 'ip+email' | 'user';

function clientKey(req: Request, res: Response, keyBy: KeyBy): string {
  const ip = ipKeyGenerator(req.ip ?? 'unknown');
  if (keyBy === 'user') return res.locals.user?.id ?? `ip:${ip}`;
  if (keyBy === 'ip+email') {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ip}|${email}`;
  }
  return ip;
}

export function createRateLimiter(options: { windowMs: number; limit: number; keyBy: KeyBy }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req, res) => clientKey(req, res, options.keyBy),
    handler: (req, res, next) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const resetMs = resetTime ? resetTime.getTime() - Date.now() : options.windowMs;
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(resetMs / 1000))));
      next(new AppError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.'));
    },
  });
}
