import type { Types } from 'mongoose';
import { AppError } from '../../lib/errors';
import type { AuthUser } from './auth.types';

/**
 * Hospital staff may only touch resources of their own facility. Answers 404 rather than 403
 * so facility ids cannot be probed (docs/security.md §1). Admins pass.
 */
export function assertFacilityScope(user: AuthUser, facilityId: string | Types.ObjectId | null | undefined): void {
  if (user.role === 'admin') return;
  if (!facilityId || user.facilityId !== facilityId.toString()) {
    throw new AppError('NOT_FOUND', 'Not found.');
  }
}

/** Hospital verifier capability: hospital staff with `canVerifyRequests`. */
export function assertCanVerifyRequests(user: AuthUser): void {
  if (user.role !== 'hospital_staff' || !user.canVerifyRequests) {
    throw new AppError('FORBIDDEN', 'Only hospital verifiers can do this.');
  }
}
