import type { FacilityType, HospitalVerificationStatus } from '../enums';
import type { LatLng } from '../schemas/common';

/** Safe for anyone: verified institutions only. */
export interface HospitalPublic {
  id: string;
  /** What a family types after BLOOD <group> when asking by SMS, e.g. "Siang-HDH". Derived from the name. */
  smsCode: string;
  name: string;
  facilityType: FacilityType;
  district: string;
  address: string;
  location: LatLng;
}

/** Admin view, includes the registered contact and verification history. */
export interface HospitalAdmin extends HospitalPublic {
  registeredPhone: string;
  verificationStatus: HospitalVerificationStatus;
  verification: { by: string; at: string; reason: string } | null;
  staffCount: number;
  /** False-request strikes recorded by administrators. */
  strikes: number;
  createdAt: string;
}
