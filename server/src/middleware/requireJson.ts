import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * State-changing requests must be JSON. Browsers cannot send cross-site JSON without a
 * CORS preflight, so this is part of the CSRF defence (docs/security.md §2).
 * Webhook routes that need raw bodies are mounted before this middleware.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!MUTATING.has(req.method)) return next();
  const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined;
  if (!hasBody && req.method === 'DELETE') return next();
  // req.is() returns null when there is no body, so check the header for bodiless requests.
  const isJson = hasBody ? !!req.is('application/json') : /^application\/json\b/i.test(req.get('content-type') ?? '');
  if (!isJson) {
    return next(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Requests must use Content-Type: application/json.'));
  }
  next();
};
