/**
 * Key for the `Idempotency-Key` header. Keep the same key while retrying one submission (so a
 * network retry can't create a second request) and make a new one only after success or an edit.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
