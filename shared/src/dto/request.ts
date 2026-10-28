import type {
  BloodGroup,
  ClosureReason,
  DuplicateReviewStatus,
  PublicRequestStatusValue,
  RequestStatus,
  RequestVerificationStatus,
  Urgency,
} from '../enums';
import type { FacilitySummary } from './auth';
import type { AlertSummary, AssignmentForHospital } from './donor';

/** Actions the current user may take right now; computed by the server, re-checked on every call. */
export type RequestAction = 'verify' | 'reject' | 'review_duplicate' | 'cancel' | 'fulfill' | 'alert_next_batch';

export interface RequestSummary {
  id: string;
  publicCode: string;
  facilityId: string;
  /** Filled in list views (admins see several facilities). */
  facilityName: string | null;
  bloodGroup: BloodGroup;
  acceptCompatibleGroups: boolean;
  unitsRequested: number;
  slotsFilled: number;
  urgency: Urgency;
  urgencyConfirmed: boolean;
  deadlineAt: string;
  patientLabel: string | null;
  verificationStatus: RequestVerificationStatus;
  requestStatus: RequestStatus;
  duplicateReviewStatus: DuplicateReviewStatus;
  closureReason: ClosureReason | null;
  createdAt: string;
  version: number;
}

export interface TimelineEvent {
  at: string;
  action: string;
  label: string;
  actor: { name: string | null; role: string | null } | null;
  reason: string | null;
}

export interface DuplicateCandidate {
  id: string;
  publicCode: string;
  patientLabel: string | null;
  bloodGroup: BloodGroup;
  requestStatus: RequestStatus;
  createdAt: string;
}

export interface RequestDetail extends RequestSummary {
  facility: FacilitySummary;
  clinicalNote: string | null;
  urgencySuggested: Urgency;
  createdBy: { id: string; name: string | null };
  verification: { by: string | null; at: string; reason: string | null } | null;
  duplicateReview: {
    status: DuplicateReviewStatus;
    candidates: DuplicateCandidate[];
    decidedBy: string | null;
    decidedAt: string | null;
    reason: string | null;
  };
  duplicateOfRequestId: string | null;
  closure: { reason: ClosureReason; at: string; by: string | null; note: string | null; unitsReceived: number | null } | null;
  verifiedAt: string | null;
  timeline: TimelineEvent[];
  allowedActions: RequestAction[];
  assignments: AssignmentForHospital[];
  alertSummary: AlertSummary;
}

export interface CreateRequestResult {
  request: RequestDetail;
  possibleDuplicate: boolean;
}

/** GET /api/public/requests/:code — nothing that identifies a patient, donor or staff member. */
export type PublicRequestStatus =
  | { status: 'not_found' }
  | {
      status: Exclude<PublicRequestStatusValue, 'not_found'>;
      code: string;
      facilityName: string;
      district: string;
      bloodGroup: BloodGroup;
      deadlineAt: string | null;
      updatedAt: string;
    };
