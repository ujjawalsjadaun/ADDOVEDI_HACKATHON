import type { AssignmentStatus, BloodGroup, RequestStatus, Urgency } from '../enums';
import type { SuspiciousReportCategory } from '../schemas/requests';
import type { FacilitySummary } from './auth';
import type { EtaSnapshot } from './donor';
import type { RequestSummary } from './request';

// Read models for role dashboards. Every dashboard carries `generatedAt` so the UI can show its age.

export interface HospitalDashboard {
  generatedAt: string;
  facility: FacilitySummary;
  counts: {
    active: number;
    awaitingVerification: number;
    duplicateReviews: number;
    awaitingDonors: number;
    donorsOnTheWay: number;
    dueWithin2h: number;
    fulfilledToday: number;
  };
  /** Active requests needing a human decision or close to their deadline, most urgent first. */
  needsAction: (RequestSummary & { reasons: string[] })[];
  /** Donors currently committed to this facility's requests. */
  donorsInProgress: {
    assignmentId: string;
    requestId: string;
    publicCode: string;
    bloodGroup: BloodGroup;
    donorName: string;
    status: AssignmentStatus;
    eta: EtaSnapshot | null;
    acceptedAt: string;
  }[];
}

export interface AdminOverview {
  generatedAt: string;
  counts: {
    pendingFacilities: number;
    unverifiedDonors: number;
    donorsUnderReview: number;
    overdueVerifications: number;
    activeRequests: number;
    requestsWithoutResponders: number;
    /** Open requests at escalation step 2 or higher (admins should act). */
    escalatedRequests: number;
    /** Requests an administrator has flagged "under review". */
    requestsUnderReview: number;
    openSuspiciousReports: number;
    failedLogins24h: number;
    notificationsPending: number;
    notificationsFailed: number;
  };
  overdueVerifications: { id: string; publicCode: string; facilityName: string; bloodGroup: BloodGroup; createdAt: string; deadlineAt: string }[];
  /** Verified, still awaiting donors, with no pending or accepted alert — someone must act. */
  requestsWithoutResponders: { id: string; publicCode: string; facilityName: string; bloodGroup: BloodGroup; deadlineAt: string; alertsSent: number }[];
  verificationDeadlineMinutes: number;
}

export interface AuditEntryView {
  id: string;
  at: string;
  action: string;
  result: 'success' | 'denied' | 'failed';
  actor: { type: 'user' | 'system'; name: string | null; role: string | null };
  resourceType: string;
  resourceId: string | null;
  facilityName: string | null;
  reason: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  detail: Record<string, unknown> | null;
}

export interface SuspiciousReportView {
  id: string;
  publicCode: string;
  category: SuspiciousReportCategory;
  note: string | null;
  status: 'open' | 'reviewed';
  createdAt: string;
  /** Same IP reported this many times in the last 24 h (from a keyed hash, not the IP). */
  sameReporterCount24h: number;
  request: { id: string; facilityName: string; bloodGroup: BloodGroup; requestStatus: RequestStatus; verificationStatus: string } | null;
  reviewedBy: string | null;
}

/** Coordinator view: logistics only — no patient label, note or donor identity. */
export interface CoordinatorRequestView {
  id: string;
  publicCode: string;
  facility: { id: string; name: string; district: string; address: string; location: { lat: number; lng: number } };
  bloodGroup: BloodGroup;
  urgency: Urgency;
  unitsRequested: number;
  slotsFilled: number;
  donorsOnTheWay: number;
  requestStatus: RequestStatus;
  deadlineAt: string;
  verifiedAt: string | null;
}
