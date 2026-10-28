import type { ApiErrorBody, ApiSuccess, ErrorCode } from '@golden-hour/shared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Client-side failures that never reach the server get their own codes. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly fields?: Record<string, string>,
    readonly current?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Non-2xx statuses whose `{ data }` envelope should be returned instead of thrown (e.g. 503 from /health/ready). */
  acceptStatus?: number[];
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body;
}

function isSuccessBody<T>(body: unknown): body is ApiSuccess<T> {
  return typeof body === 'object' && body !== null && 'data' in body;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<ApiSuccess<T>> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
    });
  } catch (err) {
    if (timeout.signal.aborted) throw new ApiError('TIMEOUT', 'The server took too long to respond.', 0);
    if (options.signal?.aborted) throw err;
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (res.ok || options.acceptStatus?.includes(res.status)) {
    if (isSuccessBody<T>(body)) return body;
  }
  if (isErrorBody(body)) {
    const e = body.error;
    throw new ApiError(e.code, e.message, res.status, e.requestId, e.fields, e.current);
  }
  throw new ApiError('INTERNAL', `Unexpected response from server (HTTP ${res.status}).`, res.status);
}
