import type { AssignmentForHospital, DonorAssignmentView } from '@golden-hour/shared';
import { fromGeoPoint } from '../../lib/geo';
import type { AuthUser } from '../auth/auth.types';
import { toEtaView } from '../alerts/alert.dto';
import type { DonorProfileDocument } from '../donors/donor.model';
import type { HospitalDocument } from '../hospitals/hospital.model';
import type { BloodRequestDocument } from '../requests/request.model';
import type { UserDocument } from '../users/user.model';
import type { AssignmentDocument } from './assignment.model';
import { donorAllowedActions, hospitalAllowedActions } from './assignment.transitions';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Hospital view. The donor's phone is shared because they accepted this request (docs/security.md §5). */
export function toAssignmentForHospital(
  a: AssignmentDocument,
  donor: { user: UserDocument | undefined; profile: DonorProfileDocument | undefined },
  viewer: AuthUser,
): AssignmentForHospital {
  return {
    id: a._id.toString(),
    slot: a.slot,
    status: a.status,
    donor: {
      userId: a.donorUserId.toString(),
      name: donor.user?.name ?? 'Donor',
      phone: donor.user?.phone ?? null,
      anchorLabel: donor.profile?.anchorLabel ?? null,
      bloodGroup: donor.profile?.bloodGroup ?? 'O+',
    },
    eta: toEtaView(a.eta),
    acceptedAt: a.acceptedAt.toISOString(),
    enRouteAt: iso(a.enRouteAt),
    arrivedAt: iso(a.arrivedAt),
    arrivedBy: a.arrivedBy ?? null,
    donatedAt: iso(a.donatedAt),
    endedAt: iso(a.endedAt),
    endReason: a.endReason ?? null,
    version: a.version,
    allowedActions: hospitalAllowedActions(a, viewer),
  };
}

/** Donor view. Facility contact and location are revealed only once the donor has accepted. */
export function toDonorAssignmentView(
  a: AssignmentDocument,
  request: BloodRequestDocument,
  facility: HospitalDocument,
  viewer: AuthUser,
): DonorAssignmentView {
  return {
    id: a._id.toString(),
    requestId: request._id.toString(),
    publicCode: request.publicCode,
    facility: {
      name: facility.name,
      district: facility.district,
      address: facility.address,
      phone: facility.registeredPhone,
      location: fromGeoPoint(facility.location),
    },
    bloodGroup: request.bloodGroup,
    deadlineAt: request.deadlineAt.toISOString(),
    status: a.status,
    eta: toEtaView(a.eta),
    acceptedAt: a.acceptedAt.toISOString(),
    updatedAt: (a.get('updatedAt') as Date).toISOString(),
    version: a.version,
    allowedActions: donorAllowedActions(a, viewer),
  };
}
