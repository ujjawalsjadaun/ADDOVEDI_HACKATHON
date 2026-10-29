import type { AdminDonorView, DonorProfileView } from '@golden-hour/shared';
import { fromGeoPoint } from '../../lib/geo';
import { maskPhone } from '../../lib/mask';
import type { UserDocument } from '../users/user.model';
import type { DonorProfileDocument } from './donor.model';

const DAY_MS = 24 * 60 * 60 * 1000;
export const STRIKE_WINDOW_DAYS = 180;
export const STRIKE_THRESHOLD = 3;
export const AVAILABILITY_STALE_DAYS = 30;

export function recentStrikes(p: DonorProfileDocument, now = Date.now()): number {
  return p.strikes.filter((s) => s.at.getTime() >= now - STRIKE_WINDOW_DAYS * DAY_MS).length;
}

const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Every reason this donor would not get automatic alerts right now — shown to the donor so they can fix it. */
export function notAlertableReasons(p: DonorProfileDocument, user: UserDocument, restDays: number, now = Date.now()): string[] {
  const reasons: string[] = [];
  if (user.status !== 'active') reasons.push('Your account is not active.');
  if (p.verificationStatus !== 'verified') reasons.push('Your profile is waiting for verification by an administrator.');
  if (p.reviewStatus !== 'ok') reasons.push('Your profile is under review after missed donations.');
  if (!p.consent.contact) reasons.push('You have not agreed to be contacted.');
  if (!p.consent.location) reasons.push('You have not agreed to share your approximate location for travel-time estimates.');
  if (!p.anchorLocation) reasons.push('Set your approximate location (village or locality).');
  if (p.availability !== 'available') reasons.push('You are marked unavailable.');
  else if (p.availabilityUpdatedAt.getTime() < now - AVAILABILITY_STALE_DAYS * DAY_MS) {
    reasons.push(`Please confirm your availability — it was last updated over ${AVAILABILITY_STALE_DAYS} days ago.`);
  }
  if (!p.lastDonationKnown) reasons.push('Add your last donation date (or "never donated") so we can respect the rest period.');
  else if (p.lastDonationAt && p.lastDonationAt.getTime() > now - restDays * DAY_MS) {
    reasons.push(`Rest period: you can be alerted again from ${dateOnly(new Date(p.lastDonationAt.getTime() + restDays * DAY_MS))}.`);
  }
  return reasons;
}

export function toDonorProfileView(p: DonorProfileDocument, user: UserDocument, restDays: number): DonorProfileView {
  const now = Date.now();
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    bloodGroup: p.bloodGroup,
    availability: p.availability,
    availabilityUpdatedAt: p.availabilityUpdatedAt.toISOString(),
    availabilityStale: p.availabilityUpdatedAt.getTime() < now - AVAILABILITY_STALE_DAYS * DAY_MS,
    lastDonationOn: dateOnly(p.lastDonationAt),
    lastDonationKnown: p.lastDonationKnown,
    nextEligibleOn: p.lastDonationAt ? dateOnly(new Date(p.lastDonationAt.getTime() + restDays * DAY_MS)) : null,
    anchorLabel: p.anchorLabel ?? null,
    hasAnchor: !!p.anchorLocation,
    anchor: p.anchorLocation ? { ...fromGeoPoint(p.anchorLocation), label: p.anchorLabel ?? '' } : null,
    consent: { contact: p.consent.contact, location: p.consent.location, relay: p.consent.relay ?? false, at: p.consent.at.toISOString(), version: p.consent.version },
    verificationStatus: p.verificationStatus,
    reviewStatus: p.reviewStatus,
    strikesLast180Days: recentStrikes(p, now),
    notAlertableReasons: notAlertableReasons(p, user, restDays, now),
  };
}

export function toAdminDonorView(p: DonorProfileDocument, user: UserDocument): AdminDonorView {
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    phoneMasked: maskPhone(user.phone),
    bloodGroup: p.bloodGroup,
    availability: p.availability,
    verificationStatus: p.verificationStatus,
    reviewStatus: p.reviewStatus,
    anchorLabel: p.anchorLabel ?? null,
    lastDonationOn: p.lastDonationKnown ? (dateOnly(p.lastDonationAt) ?? 'never') : null,
    strikesLast180Days: recentStrikes(p),
    consent: { contact: p.consent.contact, location: p.consent.location },
    accountStatus: user.status,
    createdAt: (p.get('createdAt') as Date).toISOString(),
  };
}
