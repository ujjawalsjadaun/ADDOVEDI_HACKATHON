import type { FacilityType } from '../enums';
import type { LatLng } from '../schemas/common';
import type { RoadCondition, RoadReportConfidence, RoadReportVerification } from '../schemas/geo';

export type RoadReportAction = 'verify' | 'dismiss';

/** Road reports are attributed, timestamped claims — never presented as road truth. */
export interface RoadReportView {
  id: string;
  location: LatLng;
  label: string;
  condition: RoadCondition;
  note: string | null;
  confidence: RoadReportConfidence;
  reporter: { name: string | null; role: string | null };
  verificationStatus: RoadReportVerification;
  verifiedBy: string | null;
  reportedAt: string;
  expiresAt: string;
  isStale: boolean;
  /** Whether this report currently changes travel-time estimates. */
  affectsEta: boolean;
  allowedActions: RoadReportAction[];
}

export interface AccessPointView {
  location: LatLng;
  note: string | null;
  reportedBy: string | null;
  reportedAt: string;
}

export interface MapFacility {
  id: string;
  name: string;
  district: string;
  facilityType: FacilityType;
  location: LatLng;
  accessPoint: AccessPointView | null;
  activeRequests: number;
}

export interface MapData {
  generatedAt: string;
  facilities: MapFacility[];
  roadReports: RoadReportView[];
  providers: {
    routing: { name: string; simulated: boolean };
    weather: { name: string; simulated: boolean };
  };
  /** Reports of these conditions within this distance of a route make its ETA "unknown". */
  closureCorridorKm: number;
}
