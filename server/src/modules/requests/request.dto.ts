import type {
  AlertSummary,
  AssignmentForHospital,
  DuplicateCandidate,
  PublicRequestStatus,
  RequestAction,
  RequestDetail,
  RequestSummary,
  TimelineEvent,
} from '@golden-hour/shared';
import { toFacilitySummary } from '../auth/auth.dto';
import type { HospitalDocument } from '../hospitals/hospital.model';
import type { BloodRequestDocument } from './request.model';

// Allow-listed serializers. `patientRefHash` is never serialised anywhere.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toRequestSummary(doc: BloodRequestDocument, facilityName: string | null = null): RequestSummary {
  return {
    id: doc._id.toString(),
    publicCode: doc.publicCode,
    facilityId: doc.facilityId.toString(),
    facilityName,
    bloodGroup: doc.bloodGroup,
    acceptCompatibleGroups: doc.acceptCompatibleGroups,
    unitsRequested: doc.unitsRequested,
    slotsFilled: doc.slotsFilled,
    urgency: doc.urgencyConfirmed ?? doc.urgencySuggested,
    urgencyConfirmed: doc.urgencyConfirmed !== null && doc.urgencyConfirmed !== undefined,
    deadlineAt: doc.deadlineAt.toISOString(),
    patientLabel: doc.patientLabel ?? null,
    verificationStatus: doc.verificationStatus,
    requestStatus: doc.requestStatus,
    duplicateReviewStatus: doc.duplicateReview.status,
    closureReason: doc.closure?.reason ?? null,
    createdAt: (doc.get('createdAt') as Date).toISOString(),
    version: doc.version,
  };
}

export function toDuplicateCandidate(doc: BloodRequestDocument): DuplicateCandidate {
  return {
    id: doc._id.toString(),
    publicCode: doc.publicCode,
    patientLabel: doc.patientLabel ?? null,
    bloodGroup: doc.bloodGroup,
    requestStatus: doc.requestStatus,
    createdAt: (doc.get('createdAt') as Date).toISOString(),
  };
}

export function toRequestDetail(
  doc: BloodRequestDocument,
  extra: {
    facility: HospitalDocument;
    names: Map<string, string>;
    candidates: BloodRequestDocument[];
    timeline: TimelineEvent[];
    allowedActions: RequestAction[];
    assignments: AssignmentForHospital[];
    alertSummary: AlertSummary;
  },
): RequestDetail {
  const name = (id: unknown) => (id ? (extra.names.get(String(id)) ?? null) : null);
  return {
    ...toRequestSummary(doc, extra.facility.name),
    facility: toFacilitySummary(extra.facility),
    clinicalNote: doc.clinicalNote ?? null,
    urgencySuggested: doc.urgencySuggested,
    createdBy: { id: doc.createdBy.toString(), name: name(doc.createdBy) },
    verification: doc.verification
      ? { by: name(doc.verification.by), at: doc.verification.at.toISOString(), reason: doc.verification.reason ?? null }
      : null,
    duplicateReview: {
      status: doc.duplicateReview.status,
      candidates: extra.candidates.map(toDuplicateCandidate),
      decidedBy: name(doc.duplicateReview.by),
      decidedAt: iso(doc.duplicateReview.at),
      reason: doc.duplicateReview.reason ?? null,
    },
    duplicateOfRequestId: doc.duplicateOfRequestId?.toString() ?? null,
    closure: doc.closure
      ? {
          reason: doc.closure.reason,
          at: doc.closure.at.toISOString(),
          by: name(doc.closure.by),
          note: doc.closure.note ?? null,
          unitsReceived: doc.closure.unitsReceived ?? null,
        }
      : null,
    verifiedAt: iso(doc.verifiedAt),
    timeline: extra.timeline,
    allowedActions: extra.allowedActions,
    assignments: extra.assignments,
    alertSummary: extra.alertSummary,
  };
}

/** Public checker view: status, facility, district, blood group, deadline, last update — nothing else. */
export function toPublicStatus(doc: BloodRequestDocument, facility: HospitalDocument): PublicRequestStatus {
  let status: Exclude<PublicRequestStatus['status'], 'not_found'>;
  if (doc.requestStatus === 'closed') {
    status = {
      fulfilled: 'closed_fulfilled',
      cancelled: 'closed_cancelled',
      duplicate: 'closed_cancelled',
      expired: 'closed_expired',
      rejected: 'rejected',
    }[doc.closure?.reason ?? 'cancelled'] as typeof status;
  } else if (doc.verificationStatus === 'verified') {
    status = 'verified_active';
  } else {
    status = 'pending_verification';
  }
  return {
    status,
    code: doc.publicCode,
    facilityName: facility.name,
    district: facility.district,
    bloodGroup: doc.bloodGroup,
    deadlineAt: status === 'verified_active' || status === 'pending_verification' ? doc.deadlineAt.toISOString() : null,
    updatedAt: (doc.get('updatedAt') as Date).toISOString(),
  };
}
