import type { AlertResponse, DonorAlertView, EtaSnapshot } from '@golden-hour/shared';
import type { HospitalDocument } from '../hospitals/hospital.model';
import type { BloodRequestDocument } from '../requests/request.model';
import type { RequestAlertDocument } from './alert.model';

/** A pending alert past its response window is expired, whether or not a worker has marked it yet. */
export function effectiveResponse(alert: Pick<RequestAlertDocument, 'response' | 'expiresAt'>, now = Date.now()): AlertResponse {
  return alert.response === 'pending' && alert.expiresAt.getTime() <= now ? 'expired' : alert.response;
}

export function toEtaView(eta: RequestAlertDocument['eta']): EtaSnapshot | null {
  if (!eta) return null;
  return {
    minutes: eta.minutes ?? null,
    distanceKm: eta.distanceKm ?? null,
    quality: eta.quality,
    source: eta.source,
    calculatedAt: eta.calculatedAt.toISOString(),
    weatherAdjustment: eta.weatherAdjustment ?? 'unavailable',
    warnings: eta.warnings ?? [],
  };
}

/** Donor's view of an alert: no patient label, note or reference — only what a donor needs. */
export function toDonorAlertView(alert: RequestAlertDocument, request: BloodRequestDocument, facility: HospitalDocument): DonorAlertView {
  return {
    id: alert._id.toString(),
    requestId: request._id.toString(),
    publicCode: request.publicCode,
    facility: { name: facility.name, district: facility.district, address: facility.address },
    bloodGroup: request.bloodGroup,
    deadlineAt: request.deadlineAt.toISOString(),
    eta: toEtaView(alert.eta),
    response: effectiveResponse(alert),
    expiresAt: alert.expiresAt.toISOString(),
    createdAt: (alert.get('createdAt') as Date).toISOString(),
  };
}
