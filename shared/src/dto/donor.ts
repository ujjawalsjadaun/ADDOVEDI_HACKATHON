import type { AlertDeliveryStatus, AlertResponse, AssignmentStatus, BloodGroup, EtaQuality } from '../enums';
import type { DonorAvailability, DonorReviewStatus, DonorVerificationStatus } from '../schemas/donors';

export type WeatherAdjustment = 'none' | 'moderate' | 'heavy' | 'unavailable';

/** Travel-time estimate with its provenance (docs/architecture.md §5–6). Never shown without its quality. */
export interface EtaSnapshot {
  minutes: number | null;
  distanceKm: number | null;
  quality: EtaQuality;
  source: string;
  calculatedAt: string;
  weatherAdjustment: WeatherAdjustment;
}

export interface DonorProfileView {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  bloodGroup: BloodGroup;
  availability: DonorAvailability;
  availabilityUpdatedAt: string;
  availabilityStale: boolean;
  lastDonationOn: string | null;
  lastDonationKnown: boolean;
  nextEligibleOn: string | null;
  anchorLabel: string | null;
  hasAnchor: boolean;
  /** The donor's own stored (rounded, ~1 km) location. Returned only to the donor themself. */
  anchor: { lat: number; lng: number; label: string } | null;
  consent: { contact: boolean; location: boolean; at: string; version: string };
  verificationStatus: DonorVerificationStatus;
  reviewStatus: DonorReviewStatus;
  strikesLast180Days: number;
  /** Why this donor would not receive automatic alerts right now (empty = alertable). */
  notAlertableReasons: string[];
}

export type DonorAssignmentAction = 'en_route' | 'arrived' | 'withdraw';
export type HospitalAssignmentAction = 'confirm_arrival' | 'mark_donated' | 'mark_no_show';

export interface DonorAlertView {
  id: string;
  requestId: string;
  publicCode: string;
  facility: { name: string; district: string; address: string };
  bloodGroup: BloodGroup;
  deadlineAt: string;
  eta: EtaSnapshot | null;
  response: AlertResponse;
  expiresAt: string;
  createdAt: string;
}

export interface DonorAssignmentView {
  id: string;
  requestId: string;
  publicCode: string;
  /** Contact details are revealed only after the donor accepted. */
  facility: { name: string; district: string; address: string; phone: string; location: { lat: number; lng: number } };
  bloodGroup: BloodGroup;
  deadlineAt: string;
  status: AssignmentStatus;
  eta: EtaSnapshot | null;
  acceptedAt: string;
  updatedAt: string;
  version: number;
  allowedActions: DonorAssignmentAction[];
}

export interface AssignmentForHospital {
  id: string;
  slot: number;
  status: AssignmentStatus;
  donor: { userId: string; name: string; phone: string | null; anchorLabel: string | null; bloodGroup: BloodGroup };
  eta: EtaSnapshot | null;
  acceptedAt: string;
  enRouteAt: string | null;
  arrivedAt: string | null;
  arrivedBy: 'donor_reported' | 'hospital_confirmed' | null;
  donatedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  version: number;
  allowedActions: HospitalAssignmentAction[];
}

export interface AlertSummary {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  cancelled: number;
  delivery: Partial<Record<AlertDeliveryStatus, number>>;
  lastBatchAt: string | null;
}

export interface Candidate {
  donorUserId: string;
  name: string;
  anchorLabel: string | null;
  bloodGroup: BloodGroup;
  eta: EtaSnapshot | null;
  beforeDeadline: boolean | null;
  manualReviewRequired: boolean;
  lastAlertedAt: string | null;
  rank: number;
}

export interface CandidatePreview {
  /** Would be alerted automatically, in order. */
  ranked: Candidate[];
  /** Otherwise eligible but last donation date unknown — hospital decides, never auto-alerted. */
  manualReview: Candidate[];
  alreadyAlerted: number;
  cooldownRelaxed: boolean;
}

export interface AdminDonorView {
  userId: string;
  name: string;
  email: string;
  phoneMasked: string | null;
  bloodGroup: BloodGroup;
  availability: DonorAvailability;
  verificationStatus: DonorVerificationStatus;
  reviewStatus: DonorReviewStatus;
  anchorLabel: string | null;
  lastDonationOn: string | null;
  strikesLast180Days: number;
  consent: { contact: boolean; location: boolean };
  accountStatus: string;
  createdAt: string;
}

export interface RespondAlertResult {
  alert: DonorAlertView;
  assignment: DonorAssignmentView | null;
}
