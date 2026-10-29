import type { HospitalAdmin, HospitalPublic } from '@golden-hour/shared';
import { fromGeoPoint } from '../../lib/geo';
import type { HospitalDocument } from './hospital.model';

export function toHospitalPublic(doc: HospitalDocument): HospitalPublic {
  return {
    id: doc._id.toString(),
    name: doc.name,
    facilityType: doc.facilityType,
    district: doc.district,
    address: doc.address,
    location: fromGeoPoint(doc.location),
  };
}

export function toHospitalAdmin(doc: HospitalDocument, staffCount: number): HospitalAdmin {
  return {
    ...toHospitalPublic(doc),
    registeredPhone: doc.registeredPhone,
    verificationStatus: doc.verificationStatus,
    verification: doc.verification
      ? { by: doc.verification.by.toString(), at: doc.verification.at.toISOString(), reason: doc.verification.reason }
      : null,
    staffCount,
    strikes: doc.falseRequestStrikes ?? 0,
    createdAt: (doc.get('createdAt') as Date).toISOString(),
  };
}
