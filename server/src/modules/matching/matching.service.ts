import { eligibleDonorGroups, type Candidate, type CandidatePreview, type EtaSnapshot } from '@golden-hour/shared';
import type { Types } from 'mongoose';
import type { Config } from '../../config/env';
import { fromGeoPoint, haversineKm } from '../../lib/geo';
import { RequestAlertModel } from '../alerts/alert.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { AVAILABILITY_STALE_DAYS } from '../donors/donor.dto';
import { DonorProfileModel, type DonorProfileDocument } from '../donors/donor.model';
import { createEtaContext } from '../geo/eta.service';
import type { HospitalDocument } from '../hospitals/hospital.model';
import type { BloodRequestDocument } from '../requests/request.model';
import { UserModel } from '../users/user.model';

// Donor matching (docs/api-contracts.md §3, blueprint D7). Operational triage only — never a
// statement about medical eligibility. Hard filters are never relaxed automatically, except the
// contact cooldown from escalation step 1 onward (documented).

/** How many nearest donors get a routing call; the rest are too far to matter for this batch. */
const ETA_POOL = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RankedCandidate extends Candidate {
  profileId: Types.ObjectId;
}

export interface MatchResult {
  ranked: RankedCandidate[];
  manualReview: RankedCandidate[];
  alreadyAlerted: number;
  cooldownRelaxed: boolean;
}

const QUALITY_ORDER: Record<string, number> = { live: 0, cached: 1, simulated: 2, rough_estimate: 3, unavailable: 4 };

/** Stable ranking: reachable before deadline → ETA quality → minutes → least recently alerted → id. */
function compareCandidates(a: Candidate, b: Candidate): number {
  const deadline = (c: Candidate) => (c.beforeDeadline === true ? 0 : c.beforeDeadline === null ? 1 : 2);
  return (
    deadline(a) - deadline(b) ||
    (QUALITY_ORDER[a.eta?.quality ?? 'unavailable'] ?? 4) - (QUALITY_ORDER[b.eta?.quality ?? 'unavailable'] ?? 4) ||
    (a.eta?.minutes ?? Number.MAX_SAFE_INTEGER) - (b.eta?.minutes ?? Number.MAX_SAFE_INTEGER) ||
    (a.lastAlertedAt ? Date.parse(a.lastAlertedAt) : 0) - (b.lastAlertedAt ? Date.parse(b.lastAlertedAt) : 0) ||
    a.donorUserId.localeCompare(b.donorUserId)
  );
}

/**
 * Finds and ranks donors for a request. `escalationStep >= 1` relaxes the contact cooldown only.
 */
export async function matchDonors(
  request: BloodRequestDocument,
  facility: HospitalDocument,
  config: Config,
  opts: { escalationStep: number },
): Promise<MatchResult> {
  const now = Date.now();
  const cooldownRelaxed = opts.escalationStep >= 1;

  const [alerted, busy] = await Promise.all([
    RequestAlertModel.find({ requestId: request._id }).distinct('donorUserId'),
    AssignmentModel.find({ isActive: true }).distinct('donorUserId'),
  ]);
  const excluded = [...alerted, ...busy];

  const profiles = await DonorProfileModel.find({
    userId: { $nin: excluded },
    bloodGroup: { $in: eligibleDonorGroups(request.bloodGroup, request.acceptCompatibleGroups) },
    verificationStatus: 'verified',
    reviewStatus: 'ok',
    availability: 'available',
    availabilityUpdatedAt: { $gte: new Date(now - AVAILABILITY_STALE_DAYS * DAY_MS) },
    'consent.contact': true,
    'consent.location': true,
    anchorLocation: { $ne: null },
    // Unknown date (→ manual-review list), never donated, or rest period over.
    $or: [{ lastDonationKnown: false }, { lastDonationAt: null }, { lastDonationAt: { $lte: new Date(now - config.DONATION_REST_DAYS * DAY_MS) } }],
    ...(!cooldownRelaxed &&
      config.CONTACT_COOLDOWN_HOURS > 0 && {
        $and: [{ $or: [{ lastAlertedAt: null }, { lastAlertedAt: { $lte: new Date(now - config.CONTACT_COOLDOWN_HOURS * 3_600_000) } }] }],
      }),
  }).limit(500);

  // Account must be active (a paused/suspended person is never alerted).
  const users = await UserModel.find({ _id: { $in: profiles.map((p) => p.userId) }, status: 'active', role: 'donor' }).select('name').lean();
  const names = new Map(users.map((u) => [u._id.toString(), u.name]));
  const eligible = profiles.filter((p) => names.has(p.userId.toString()));

  const hospitalAt = fromGeoPoint(facility.location);
  const byDistance = eligible
    .map((p) => ({ p, km: haversineKm(fromGeoPoint(p.anchorLocation!), hospitalAt) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, ETA_POOL);

  // Routing + road reports + weather, each labelled (modules/geo/eta.service.ts).
  const etaContext = await createEtaContext(config);
  const etas = await Promise.all(byDistance.map(({ p }) => etaContext.eta(fromGeoPoint(p.anchorLocation!), hospitalAt)));

  const toCandidate = (p: DonorProfileDocument, eta: EtaSnapshot): RankedCandidate => ({
    profileId: p._id,
    donorUserId: p.userId.toString(),
    name: names.get(p.userId.toString())!,
    anchorLabel: p.anchorLabel ?? null,
    bloodGroup: p.bloodGroup,
    eta,
    beforeDeadline: eta.minutes === null ? null : now + eta.minutes * 60_000 <= request.deadlineAt.getTime(),
    manualReviewRequired: !p.lastDonationKnown || eta.quality === 'unavailable',
    lastAlertedAt: p.lastAlertedAt ? p.lastAlertedAt.toISOString() : null,
    rank: 0,
  });

  const all = byDistance.map(({ p }, i) => toCandidate(p, etas[i]!));
  const withRank = (list: RankedCandidate[]) => list.sort(compareCandidates).map((c, i) => ({ ...c, rank: i + 1 }));
  const known = new Set(eligible.filter((p) => p.lastDonationKnown).map((p) => p.userId.toString()));

  return {
    // Unknown last-donation date is never auto-alerted (decision D-09).
    ranked: withRank(all.filter((c) => known.has(c.donorUserId))),
    manualReview: withRank(all.filter((c) => !known.has(c.donorUserId))),
    alreadyAlerted: alerted.length,
    cooldownRelaxed,
  };
}

export function toCandidatePreview(result: MatchResult): CandidatePreview {
  const strip = ({ profileId: _profileId, ...c }: RankedCandidate): Candidate => c;
  return {
    ranked: result.ranked.map(strip),
    manualReview: result.manualReview.map(strip),
    alreadyAlerted: result.alreadyAlerted,
    cooldownRelaxed: result.cooldownRelaxed,
  };
}
