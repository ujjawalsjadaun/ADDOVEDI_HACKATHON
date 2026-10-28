import type {
  BloodGroup,
  ClosureReason,
  DuplicateReviewStatus,
  EscalationOutcome,
  PublicRequestStatusValue,
  RequestStatus,
  RequestVerificationStatus,
  Urgency,
} from '../enums';
import type { FacilitySummary } from './auth';
import type { AlertSummary, AssignmentForHospital } from './donor';

/** Actions the current user may take right now; computed by the server, re-checked on every call. */
export type RequestAction =
  | 'verify'
  | 'reject'
  | 'review_duplicate'
  | 'cancel'
  | 'fulfill'
  | 'alert_next_batch'
  /** Admin only: mark a suspicious request "under review" (public checker shows it; alerts pause). */
  | 'flag_review'
  | 'clear_review';

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
  /** Last escalation-ladder step executed (-1 = none yet). */
  escalationStep: number;
  /** Flagged by an administrator for review; verification and new alerts are paused. */
  underReview: boolean;
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
  review: { reason: string; by: string | null; at: string } | null;
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

export interface EscalationEventView {
  step: number;
  outcome: EscalationOutcome;
  at: string;
  detail?: Record<string, unknown> | null;
}

export interface AdminEscalationItem {
  id: string;
  requestId: string;
  publicCode: string;
  facilityId: string;
  facilityName: string | null;
  facilityDistrict: string | null;
  bloodGroup: BloodGroup;
  unitsRequested: number;
  slotsFilled: number;
  urgency: Urgency;
  requestStatus: RequestStatus;
  escalationStep: number;
  verifiedAt: string;
  deadlineAt: string;
  elapsedMinutes: number;
  alertBatches: number;
  events: EscalationEventView[];
}

