import type { AuthUser } from '../modules/auth/auth.types';

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      /** Set by the authenticate middleware when a valid session cookie is present. */
      user?: AuthUser;
    }
  }
}

export {};
