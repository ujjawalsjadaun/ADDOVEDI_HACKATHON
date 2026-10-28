import type { Response } from 'express';
import type { ApiMeta, ApiSuccess } from '@golden-hour/shared';

/** Sends the standard success envelope `{ data, meta }`. */
export function sendData<T>(res: Response, data: T, options: { status?: number; meta?: Omit<ApiMeta, 'requestId'> } = {}) {
  const body: ApiSuccess<T> = { data, meta: { requestId: res.locals.requestId as string, ...options.meta } };
  res.status(options.status ?? 200).json(body);
}
