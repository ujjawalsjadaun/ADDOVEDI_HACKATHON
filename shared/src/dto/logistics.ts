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
}

/** Hospital view of a lead for its own facility. */
export interface FamilyLeadView {
  id: string;
  reference: string;
  contactName: string;
  contactPhone: string;
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
  pickup: { label: string; location: LatLng | null };
  dropoff: { label: string; location: LatLng | null };
  /** Donor details for a pickup — only for the assignee and the facility's staff. */
  donor: { name: string; phone: string | null } | null;
  assignee: { id: string; name: string } | null;
  note: string | null;
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
