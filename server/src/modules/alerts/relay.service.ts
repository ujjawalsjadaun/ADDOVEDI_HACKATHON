import type { RelayAlertView } from '@golden-hour/shared';
import { AppError } from '../../lib/errors';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { DonorProfileModel } from '../donors/donor.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { RequestAlertModel } from './alert.model';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Donors in the coordinator's village who may be contacted: same village label (case-insensitive), contact consent, not under review. */
async function villageDonorIds(user: AuthUser): Promise<string[]> {
  const doc = await UserModel.findById(user.id).select('villageLabel');
  const village = doc?.villageLabel?.trim();
  if (!village) return [];
  const profiles = await DonorProfileModel.find({
    anchorLabel: new RegExp(`^${escapeRegex(village)}$`, 'i'),
    'consent.contact': true,
    reviewStatus: 'ok',
  }).select('userId');
  return profiles.map((p) => p.userId.toString());
}

export async function listRelayAlerts(user: AuthUser): Promise<RelayAlertView[]> {
  const donorIds = await villageDonorIds(user);
  if (donorIds.length === 0) return [];
  const alerts = await RequestAlertModel.find({ donorUserId: { $in: donorIds }, response: 'pending', expiresAt: { $gt: new Date() } }).sort({ expiresAt: 1 }).limit(50);
  const [donors, requests, relayers] = await Promise.all([
    UserModel.find({ _id: { $in: alerts.map((a) => a.donorUserId) } }).select('name phone').lean(),
    BloodRequestModel.find({ _id: { $in: alerts.map((a) => a.requestId) } }).select('publicCode bloodGroup deadlineAt facilityId'),
    UserModel.find({ _id: { $in: alerts.map((a) => a.relayedBy).filter(Boolean) } }).select('name').lean(),
  ]);
  const facilities = await HospitalModel.find({ _id: { $in: requests.map((r) => r.facilityId) } }).select('name district');
  const donorById = new Map(donors.map((d) => [d._id.toString(), d]));
  const reqById = new Map(requests.map((r) => [r._id.toString(), r]));
  const facById = new Map(facilities.map((f) => [f._id.toString(), f]));
  const relayerById = new Map(relayers.map((r) => [r._id.toString(), r.name]));
  return alerts.flatMap((a) => {
    const donor = donorById.get(a.donorUserId.toString());
    const request = reqById.get(a.requestId.toString());
    const facility = request ? facById.get(request.facilityId.toString()) : undefined;
    if (!donor || !request || !facility) return [];
    return [
      {
        alertId: a._id.toString(),
        donor: { name: donor.name, phone: donor.phone ?? null },
        bloodGroup: request.bloodGroup,
        facility: { name: facility.name, district: facility.district },
        publicCode: request.publicCode,
        deadlineAt: request.deadlineAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
        shortCode: a.shortCode ?? null,
        relayedAt: a.relayedAt ? a.relayedAt.toISOString() : null,
        relayedBy: a.relayedBy ? (relayerById.get(a.relayedBy.toString()) ?? null) : null,
      },
    ];
  });
}

/** Records that the coordinator passed the alert on. It does not answer for the donor. Audited. */
export async function markAlertRelayed(alertId: string, ctx: ActionContext): Promise<void> {
  const donorIds = await villageDonorIds(ctx.user);
  const alert = await RequestAlertModel.findOneAndUpdate(
    { _id: alertId, donorUserId: { $in: donorIds }, response: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { relayedAt: new Date(), relayedBy: ctx.user.id } },
  );
  if (!alert) throw new AppError('NOT_FOUND', 'Not found.');
  await recordAudit({
    actor: userActor(ctx.user),
    action: 'alert.relayed',
    resourceType: 'bloodRequest',
    resourceId: alert.requestId,
    facilityId: alert.facilityId,
    detail: { alertId: alert._id.toString() },
    requestId: ctx.requestId,
  });
}
