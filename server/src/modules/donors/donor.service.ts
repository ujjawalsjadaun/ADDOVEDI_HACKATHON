import type { z } from 'zod';
import {
  DONOR_CONSENT_VERSION,
  type AdminDonorView,
  type DonorAvailability,
  type DonorProfileView,
  type DonorReviewStatus,
  type DonorVerificationStatus,
  type listDonorsQuerySchema,
  type RegisterDonorInput,
  type UpdateDonorProfileInput,
} from '@golden-hour/shared';
import type { ClientSession, Types } from 'mongoose';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { coarsen, toGeoPoint } from '../../lib/geo';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, SYSTEM_ACTOR, userActor } from '../audit/audit.service';
import { toAuthUser } from '../auth/auth.dto';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { hashPassword } from '../auth/password';
import { UserModel, type UserDocument } from '../users/user.model';
import { recentStrikes, STRIKE_THRESHOLD, toAdminDonorView, toDonorProfileView } from './donor.dto';
import { DonorProfileModel, type DonorProfileDocument } from './donor.model';

const MAX_STRIKES_KEPT = 10;

async function loadOwn(userId: string): Promise<{ user: UserDocument; profile: DonorProfileDocument }> {
  const [user, profile] = await Promise.all([UserModel.findById(userId), DonorProfileModel.findOne({ userId })]);
  if (!user || !profile) throw new AppError('NOT_FOUND', 'Donor profile not found.');
  return { user, profile };
}

// ── self-service ─────────────────────────────────────────────────────────────

/** Public donor sign-up. The profile starts unverified and is not alerted until an admin verifies it. */
export async function registerDonor(input: RegisterDonorInput, httpRequestId: string): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await withTransaction(async (session) => {
      const [created] = await UserModel.create(
        [{ name: input.name, email: input.email, passwordHash, phone: input.phone, role: 'donor' }],
        { session },
      );
      await DonorProfileModel.create(
        [
          {
            userId: created!._id,
            bloodGroup: input.bloodGroup,
            consent: { contact: input.consent.contact, location: input.consent.location, relay: input.consent.relay ?? false, at: new Date(), version: DONOR_CONSENT_VERSION },
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: { type: 'user', userId: created!._id.toString(), role: 'donor' },
          action: 'donor.registered',
          resourceType: 'user',
          resourceId: created!._id,
          detail: { consentVersion: DONOR_CONSENT_VERSION, locationConsent: input.consent.location },
          requestId: httpRequestId,
        },
        session,
      );
      return created!;
    });
    return toAuthUser(user);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('CONFLICT', 'An account with this email already exists. Sign in instead.', { fields: { email: 'already registered' } });
    }
    throw err;
  }
}

export async function getOwnProfile(userId: string, config: Config): Promise<DonorProfileView> {
  const { user, profile } = await loadOwn(userId);
  return toDonorProfileView(profile, user, config.DONATION_REST_DAYS);
}

export async function updateOwnProfile(input: UpdateDonorProfileInput, ctx: ActionContext, config: Config): Promise<DonorProfileView> {
  const { user, profile } = await loadOwn(ctx.user.id);

  let lastDonationAt: Date | null = null;
  if (input.lastDonationOn) {
    lastDonationAt = new Date(`${input.lastDonationOn}T00:00:00Z`);
    if (lastDonationAt.getTime() > Date.now()) {
      throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { lastDonationOn: 'cannot be in the future' } });
    }
  }
  // Without location consent no location is kept at all.
  const anchor = input.consent.location && input.anchor ? input.anchor : null;
  const groupChanged = input.bloodGroup !== profile.bloodGroup;
  const relay = input.consent.relay ?? profile.consent.relay ?? false;
  const consentChanged = input.consent.contact !== profile.consent.contact || input.consent.location !== profile.consent.location || relay !== (profile.consent.relay ?? false);

  const updated = await withTransaction(async (session) => {
    const doc = await DonorProfileModel.findOneAndUpdate(
      { _id: profile._id },
      {
        $set: {
          bloodGroup: input.bloodGroup,
          lastDonationAt,
          lastDonationKnown: true,
          anchorLocation: anchor ? toGeoPoint(coarsen(anchor)) : null,
          anchorLabel: anchor ? anchor.label : null,
          // A changed blood group must be re-verified before any alert.
          ...(groupChanged && { verificationStatus: 'unverified' }),
          ...(consentChanged && { consent: { contact: input.consent.contact, location: input.consent.location, relay, at: new Date(), version: DONOR_CONSENT_VERSION } }),
        },
      },
      { new: true, session },
    );
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'donor.profile_updated',
        resourceType: 'user',
        resourceId: user._id,
        changes: {
          ...(groupChanged && { bloodGroup: [profile.bloodGroup, input.bloodGroup] as [unknown, unknown] }),
          ...(consentChanged && { consent: [profile.consent.contact && profile.consent.location, input.consent.contact && input.consent.location] as [unknown, unknown] }),
        },
        requestId: ctx.requestId,
      },
      session,
    );
    return doc!;
  });
  return toDonorProfileView(updated, user, config.DONATION_REST_DAYS);
}

/**
 * Records "I don't know my last donation date". Kept separate from the profile form so it is a
 * deliberate choice; such donors are listed for manual review and never auto-alerted (D-09).
 */
export async function markLastDonationUnknown(ctx: ActionContext, config: Config): Promise<DonorProfileView> {
  const { user, profile } = await loadOwn(ctx.user.id);
  const doc = await DonorProfileModel.findOneAndUpdate({ _id: profile._id }, { $set: { lastDonationAt: null, lastDonationKnown: false } }, { new: true });
  return toDonorProfileView(doc!, user, config.DONATION_REST_DAYS);
}

export async function setAvailability(availability: DonorAvailability, ctx: ActionContext, config: Config): Promise<DonorProfileView> {
  const { user } = await loadOwn(ctx.user.id);
  const doc = await DonorProfileModel.findOneAndUpdate(
    { userId: ctx.user.id },
    { $set: { availability, availabilityUpdatedAt: new Date() } },
    { new: true },
  );
  return toDonorProfileView(doc!, user, config.DONATION_REST_DAYS);
}

// ── strikes (docs/security.md §6, decision D-17) ─────────────────────────────

/** Adds a no-show strike inside the caller's transaction; at the threshold, places the donor under admin review. */
export async function recordStrike(
  session: ClientSession,
  args: { donorUserId: Types.ObjectId; requestId: Types.ObjectId; reason: string; ctx?: ActionContext },
): Promise<void> {
  const profile = await DonorProfileModel.findOneAndUpdate(
    { userId: args.donorUserId },
    { $push: { strikes: { $each: [{ at: new Date(), requestId: args.requestId, reason: args.reason }], $slice: -MAX_STRIKES_KEPT } } },
    { new: true, session },
  );
  if (!profile || profile.reviewStatus !== 'ok' || recentStrikes(profile) < STRIKE_THRESHOLD) return;
  await DonorProfileModel.updateOne({ _id: profile._id }, { $set: { reviewStatus: 'under_review' } }, { session });
  await recordAudit(
    {
      actor: args.ctx ? userActor(args.ctx.user) : SYSTEM_ACTOR,
      action: 'donor.placed_under_review',
      resourceType: 'user',
      resourceId: args.donorUserId,
      reason: `${STRIKE_THRESHOLD} missed donations within 180 days`,
      changes: { reviewStatus: ['ok', 'under_review'] },
      requestId: args.ctx?.requestId,
    },
    session,
  );
}

// ── admin ────────────────────────────────────────────────────────────────────

export async function listDonors(query: z.output<typeof listDonorsQuerySchema>): Promise<{ items: AdminDonorView[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
  if (query.reviewStatus) filter.reviewStatus = query.reviewStatus;
  const [profiles, total] = await Promise.all([
    DonorProfileModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    DonorProfileModel.countDocuments(filter),
  ]);
  const users = await UserModel.find({ _id: { $in: profiles.map((p) => p.userId) } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return { items: profiles.flatMap((p) => (byId.has(p.userId.toString()) ? [toAdminDonorView(p, byId.get(p.userId.toString())!)] : [])), total };
}

async function adminUpdate(
  userId: string,
  field: 'verificationStatus' | 'reviewStatus',
  value: DonorVerificationStatus | DonorReviewStatus,
  reason: string,
  ctx: ActionContext,
): Promise<AdminDonorView> {
  const { user, profile } = await loadOwn(userId);
  const from = profile[field];
  if (from === value) throw new AppError('INVALID_TRANSITION', `This donor is already ${String(value).replace('_', ' ')}.`);
  const doc = await withTransaction(async (session) => {
    const updated = await DonorProfileModel.findOneAndUpdate({ _id: profile._id, [field]: from }, { $set: { [field]: value } }, { new: true, session });
    if (!updated) throw new AppError('CONFLICT', 'This donor was just changed. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: field === 'verificationStatus' ? `donor.${value}` : `donor.review_${value}`,
        resourceType: 'user',
        resourceId: user._id,
        reason,
        changes: { [field]: [from, value] },
        requestId: ctx.requestId,
      },
      session,
    );
    return updated;
  });
  return toAdminDonorView(doc, user);
}

export function setDonorVerification(userId: string, decision: DonorVerificationStatus, reason: string, ctx: ActionContext) {
  return adminUpdate(userId, 'verificationStatus', decision, reason, ctx);
}

export function setDonorReview(userId: string, decision: DonorReviewStatus, reason: string, ctx: ActionContext) {
  return adminUpdate(userId, 'reviewStatus', decision, reason, ctx);
}
