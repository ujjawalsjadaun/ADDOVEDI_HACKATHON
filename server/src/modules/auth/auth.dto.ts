import type { FacilitySummary, SafeUser } from '@golden-hour/shared';
import type { HospitalDocument } from '../hospitals/hospital.model';
import type { UserDocument } from '../users/user.model';
import type { AuthUser } from './auth.types';

export function toAuthUser(doc: UserDocument): AuthUser {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    facilityId: doc.facilityId ? doc.facilityId.toString() : null,
    canVerifyRequests: doc.canVerifyRequests,
    tokenVersion: doc.tokenVersion,
  };
}

export function toSafeUser(user: AuthUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    facilityId: user.facilityId,
    canVerifyRequests: user.canVerifyRequests,
  };
}

export function toFacilitySummary(doc: HospitalDocument): FacilitySummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    district: doc.district,
    verificationStatus: doc.verificationStatus,
  };
}
