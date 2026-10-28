import { createHmac } from 'node:crypto';

/** Keyed hash for values that must be comparable but never stored or logged in clear (emails in audit, patient refs). */
export function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}
