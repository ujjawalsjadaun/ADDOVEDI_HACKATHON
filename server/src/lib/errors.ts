import type { ErrorCode } from '@golden-hour/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  ACTIVE_REQUEST_EXISTS: 409,
  SLOTS_FILLED: 409,
  DONOR_BUSY: 409,
  DUPLICATE_REVIEW_PENDING: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  SELF_VERIFICATION_NOT_ALLOWED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

export interface AppErrorOptions {
  fields?: Record<string, string>;
  current?: Record<string, unknown>;
  cause?: unknown;
}

/** An error that is safe to show to the client, mapped to the API error envelope. */
export class AppError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly current?: Record<string, unknown>;

  constructor(
    readonly code: ErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
    this.fields = options.fields;
    this.current = options.current;
  }
}
