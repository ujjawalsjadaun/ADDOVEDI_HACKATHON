import type { HospitalVerificationStatus, UserRole, UserStatus } from '../enums';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  facilityId: string | null;
  canVerifyRequests: boolean;
}

export interface FacilitySummary {
  id: string;
  name: string;
  district: string;
  verificationStatus: HospitalVerificationStatus;
}

export interface MeResponse {
  user: SafeUser;
  facility: FacilitySummary | null;
}
