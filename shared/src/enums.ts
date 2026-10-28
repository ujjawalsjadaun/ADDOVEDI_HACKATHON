// Exact status strings from docs/state-machines.md and docs/data-model.md.
// Changing a value here is a contract change: update the docs and decision log.

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const USER_ROLES = ['admin', 'hospital_staff', 'donor', 'coordinator'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'paused', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const FACILITY_TYPES = ['hospital', 'blood_bank', 'hospital_with_blood_bank'] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const HOSPITAL_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type HospitalVerificationStatus = (typeof HOSPITAL_VERIFICATION_STATUSES)[number];

export const REQUEST_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'expired'] as const;
export type RequestVerificationStatus = (typeof REQUEST_VERIFICATION_STATUSES)[number];

export const REQUEST_STATUSES = ['open', 'awaiting_donor', 'donors_assigned', 'closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CLOSURE_REASONS = ['fulfilled', 'cancelled', 'rejected', 'expired', 'duplicate'] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export const URGENCY_LEVELS = ['critical', 'urgent', 'standard'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const DUPLICATE_REVIEW_STATUSES = ['none', 'pending', 'distinct', 'duplicate'] as const;
export type DuplicateReviewStatus = (typeof DUPLICATE_REVIEW_STATUSES)[number];

export const ALERT_DELIVERY_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'unknown'] as const;
export type AlertDeliveryStatus = (typeof ALERT_DELIVERY_STATUSES)[number];

export const ALERT_RESPONSES = ['pending', 'accepted', 'declined', 'expired', 'cancelled'] as const;
export type AlertResponse = (typeof ALERT_RESPONSES)[number];

export const ASSIGNMENT_STATUSES = [
  'accepted',
  'en_route',
  'arrived',
  'donated',
  'withdrawn',
  'no_show',
  'cancelled',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const ACTIVE_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ['accepted', 'en_route', 'arrived'];

export const ETA_QUALITIES = ['live', 'cached', 'simulated', 'rough_estimate', 'unavailable'] as const;
export type EtaQuality = (typeof ETA_QUALITIES)[number];

export const PUBLIC_REQUEST_STATUSES = [
  'not_found',
  'pending_verification',
  'verified_active',
  'under_review',
  'closed_fulfilled',
  'closed_cancelled',
  'closed_expired',
  'rejected',
] as const;
export type PublicRequestStatusValue = (typeof PUBLIC_REQUEST_STATUSES)[number];
