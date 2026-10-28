import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@golden-hour/shared';
import type { Logger } from 'pino';
import { AppError } from '../lib/errors';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Not found.'));
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  // body-parser errors carry a `type` and an HTTP status.
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return new AppError('BAD_REQUEST', 'Request body is not valid JSON.');
  if (e?.type === 'entity.too.large') return new AppError('BAD_REQUEST', 'Request body is too large.');
  return new AppError('INTERNAL', 'Something went wrong. Please try again.', { cause: err });
}

export function errorHandler(logger: Logger, exposeInternals: boolean): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const appErr = toAppError(err);
    const requestId = res.locals.requestId as string;
    if (appErr.status >= 500) {
      logger.error({ err: appErr.cause ?? appErr, requestId }, 'request failed');
    }
    const body: ApiErrorBody = {
      error: {
        code: appErr.code,
        message: appErr.message,
        requestId,
        ...(appErr.fields && { fields: appErr.fields }),
        ...(appErr.current && { current: appErr.current }),
      },
    };
    if (exposeInternals && appErr.code === 'INTERNAL' && appErr.cause instanceof Error) {
      (body.error as Record<string, unknown>).debug = appErr.cause.stack;
    }
    res.status(appErr.status).json(body);
  };
}
