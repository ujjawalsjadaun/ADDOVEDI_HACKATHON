// Response envelopes and error codes from docs/api-contracts.md §1.

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_TRANSITION',
  'ACTIVE_REQUEST_EXISTS',
  'SLOTS_FILLED',
  'DONOR_BUSY',
  'DUPLICATE_REVIEW_PENDING',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_FAILED',
  'IDEMPOTENCY_KEY_REUSED',
  'SELF_VERIFICATION_NOT_ALLOWED',
  'RATE_LIMITED',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiMeta {
  requestId: string;
  page?: number;
  limit?: number;
  total?: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    fields?: Record<string, string>;
    current?: Record<string, unknown>;
  };
}

// 'unchecked' = a real provider is configured but its health probe is not implemented yet.
export type ProviderHealth = 'simulated' | 'up' | 'down' | 'unchecked';

export interface HealthLive {
  status: 'ok';
}

export interface HealthReady {
  status: 'ready' | 'degraded';
  db: 'up' | 'down';
  demoMode: boolean;
  providers: {
    routing: ProviderHealth;
    weather: ProviderHealth;
    sms: ProviderHealth;
  };
}
