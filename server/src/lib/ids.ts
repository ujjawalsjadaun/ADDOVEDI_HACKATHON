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
