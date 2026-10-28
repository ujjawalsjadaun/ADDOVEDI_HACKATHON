import { randomBytes } from 'node:crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Public request code `GH-XXXX-XXXX`: 40 random bits in Crockford base32 (no I, L, O, U).
 * Not sequential and unrelated to database ids (docs/security.md §7).
 */
export function generatePublicCode(): string {
  const bytes = randomBytes(5);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 7; i >= 0; i--) out += CROCKFORD_ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return `GH-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Short human reference such as `L-7K2M9Q` (30 random bits) — for receipts, not for authorisation. */
export function generateReference(prefix: string): string {
  const bytes = randomBytes(4);
  let n = bytes.readUInt32BE(0) >>> 2;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = CROCKFORD_ALPHABET[n & 31] + out;
    n >>>= 5;
  }
  return `${prefix}-${out}`;
}
