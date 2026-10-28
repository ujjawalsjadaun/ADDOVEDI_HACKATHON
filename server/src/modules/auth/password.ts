import { compare, hash } from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(plain: string, passwordHash: string | undefined): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hash('golden-hour-timing-equaliser', COST);
    await compare(plain, await dummyHash);
    return false;
  }
  return compare(plain, passwordHash);
}
