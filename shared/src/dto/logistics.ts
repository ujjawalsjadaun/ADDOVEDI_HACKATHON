import type { BloodGroup, RequestStatus } from '../enums';
import type { LatLng } from '../schemas/common';
import type {
  FamilyLeadStatus,
  StockTransferAction,
  StockTransferStatus,
  TransportAction,
  TransportKind,
  TransportStatus,
} from '../schemas/logistics';

/** Returned to the public submitter: no hospital-internal details. */
export interface FamilyLeadReceipt {
  reference: string;
  status: 'pending';
  facilityName: string;
  /** A code was texted to the number given; entering it confirms the number belongs to the family. */
  phoneVerificationRequired: true;
}

/** Hospital view of a lead for its own facility. */
export interface FamilyLeadView {
  id: string;
  reference: string;
  contactName: string;
  contactPhone: string;
  /** True once the family typed the code texted to this number. */
  phoneVerified: boolean;
  /** A local coordinator who vouches that the request is genuine. A signal for staff, never a replacement for their confirmation. */
  vouch: { by: string | null; at: string; note: string } | null;
  bloodGroup: BloodGroup | null;
  note: string | null;
  status: FamilyLeadStatus;
  createdAt: string;
  expiresAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
  linkedRequest: { id: string; publicCode: string } | null;
}

export interface TransportTaskView {
  id: string;
  kind: TransportKind;
  status: TransportStatus;
  request: { id: string; publicCode: string; bloodGroup: BloodGroup; requestStatus: RequestStatus; deadlineAt: string };
  facility: { id: string; name: string; district: string };
  /** Nearest point an ambulance can reach for this facility, if marked (a reported estimate, not a survey). */
  ambulancePoint: { note: string | null; location: LatLng } | null;
  pickup: { label: string; location: LatLng | null };
  dropoff: { label: string; location: LatLng | null };
  /** Donor details for a pickup — only for the assignee and the facility's staff. */
  donor: { name: string; phone: string | null } | null;
  assignee: { id: string; name: string } | null;
  note: string | null;
  /** Set when this task is one leg of a two-coordinator relay. */
  relay: { leg: 1 | 2; handoverPoint: string; otherLegStatus: TransportStatus | null } | null;
  history: { status: TransportStatus; by: string | null; at: string; note: string | null }[];
  createdAt: string;
  version: number;
  allowedActions: TransportAction[];
}

export interface StockTransferView {
  id: string;
  status: StockTransferStatus;
  requesting: { id: string; name: string; district: string };
  responding: { id: string; name: string; district: string };
  bloodGroup: BloodGroup;
  units: number;
  offeredUnits: number | null;
  relatedRequest: { id: string; publicCode: string } | null;
  note: string | null;
  history: { status: StockTransferStatus; by: string | null; at: string; note: string | null }[];
  createdAt: string;
  version: number;
  allowedActions: StockTransferAction[];
}

/** Spare units a verified facility is willing to share. Visible to other verified facilities' staff only. */
export interface SurplusOfferView {
  id: string;
  facility: { id: string; name: string; district: string };
  bloodGroup: BloodGroup;
  units: number;
  note: string | null;
  availableUntil: string;
  /** True for the viewer's own facility (they can withdraw it). */
  own: boolean;
  createdAt: string;
}

/**
 * An open donor alert in a coordinator's village, for relaying it to a donor who has no data.
 * Only donors who chose this village and opted in to village relay appear; only while the alert is still open.
 */
export interface RelayAlertView {
  alertId: string;
  donor: { name: string; phone: string | null };
  bloodGroup: BloodGroup;
  facility: { name: string; district: string };
  publicCode: string;
  deadlineAt: string;
  expiresAt: string;
  /** The code the donor can SMS back, e.g. "YES K7P2". */
  shortCode: string | null;
  relayedAt: string | null;
  relayedBy: string | null;
}
