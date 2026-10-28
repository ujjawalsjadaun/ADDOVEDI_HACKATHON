import type { FacilitySummary } from '@golden-hour/shared';
import { isValidObjectId } from 'mongoose';
import { HospitalModel } from '../hospitals/hospital.model';
import { UserModel } from '../users/user.model';
import { toAuthUser, toFacilitySummary } from './auth.dto';
import type { AuthUser } from './auth.types';
import { verifyPassword } from './password';

export type CredentialCheck =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'unknown_email' | 'bad_password' | 'inactive_account'; userId?: string };

export async function checkCredentials(email: string, password: string): Promise<CredentialCheck> {
  const doc = await UserModel.findOne({ email }).select('+passwordHash');
  const passwordOk = await verifyPassword(password, doc?.passwordHash);
  if (!doc) return { ok: false, reason: 'unknown_email' };
  if (!passwordOk) return { ok: false, reason: 'bad_password', userId: doc._id.toString() };
  if (doc.status !== 'active') return { ok: false, reason: 'inactive_account', userId: doc._id.toString() };
  return { ok: true, user: toAuthUser(doc) };
}

/** Loads the session's user; null unless the account is active and the token version still matches. */
export async function loadSessionUser(userId: string, tokenVersion: number): Promise<AuthUser | null> {
  if (!isValidObjectId(userId)) return null;
  const doc = await UserModel.findById(userId);
  if (!doc || doc.status !== 'active' || doc.tokenVersion !== tokenVersion) return null;
  return toAuthUser(doc);
}

export async function recordLogin(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
}

/** Invalidates every session of the user (logout everywhere). */
export async function revokeSessions(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

export async function getFacilitySummary(facilityId: string | null): Promise<FacilitySummary | null> {
  if (!facilityId) return null;
  const doc = await HospitalModel.findById(facilityId);
  return doc ? toFacilitySummary(doc) : null;
}
