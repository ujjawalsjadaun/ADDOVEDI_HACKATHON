import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Accepts a well-formed incoming X-Request-Id or generates one; echoes it on the response. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
