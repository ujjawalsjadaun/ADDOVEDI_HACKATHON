import type { z } from 'zod';
import type { CreateUserInput, listUsersQuerySchema, UserAdmin, UserStatusInput } from '@golden-hour/shared';
import { AppError } from '../../lib/errors';
import { isDuplicateKeyError, withTransaction } from '../../lib/transaction';
import { recordAudit, userActor, type AuditActor } from '../audit/audit.service';
import type { ActionContext } from '../auth/auth.types';
import { hashPassword } from '../auth/password';
import { HospitalModel } from '../hospitals/hospital.model';
import { toUserAdmin } from './user.dto';
import { UserModel, type UserDocument } from './user.model';

async function facilityNames(docs: UserDocument[]): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => d.facilityId?.toString()).filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const hospitals = await HospitalModel.find({ _id: { $in: ids } }).select('name');
  return new Map(hospitals.map((h) => [h._id.toString(), h.name]));
}

export async function listUsers(
  query: z.output<typeof listUsersQuerySchema>,
): Promise<{ items: UserAdmin[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.facilityId) filter.facilityId = query.facilityId;
  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    UserModel.countDocuments(filter),
  ]);
  const names = await facilityNames(docs);
  return {
    items: docs.map((d) => toUserAdmin(d, d.facilityId ? (names.get(d.facilityId.toString()) ?? null) : null)),
    total,
  };
}

/**
 * Creates a staff/coordinator/admin account. Used by the admin API and by the create-admin
 * command (with a system actor), so the same validation, uniqueness and audit rules apply.
 */
export async function createUser(
  input: CreateUserInput,
  actor: AuditActor,
  requestId?: string,
): Promise<UserAdmin> {
  const passwordHash = await hashPassword(input.password);
  try {
    const { doc, facilityName } = await withTransaction(async (session) => {
      let facilityName: string | null = null;
      if (input.facilityId) {
        const facility = await HospitalModel.findById(input.facilityId).session(session);
        if (!facility) throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields: { facilityId: 'facility not found' } });
        facilityName = facility.name;
      }
      const [created] = await UserModel.create(
        [
          {
            name: input.name,
            email: input.email,
            passwordHash,
            phone: input.phone,
            role: input.role,
            facilityId: input.facilityId ?? null,
            canVerifyRequests: input.canVerifyRequests,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor,
          action: 'user.created',
          resourceType: 'user',
          resourceId: created!._id,
          facilityId: input.facilityId,
          changes: { role: [null, input.role], canVerifyRequests: [null, input.canVerifyRequests] },
          requestId,
        },
        session,
      );
      return { doc: created!, facilityName };
    });
    return toUserAdmin(doc, facilityName);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('CONFLICT', 'An account with this email already exists.', { fields: { email: 'already in use' } });
    }
    throw err;
  }
}

export async function setUserStatus(id: string, input: UserStatusInput, ctx: ActionContext): Promise<UserAdmin> {
  if (id === ctx.user.id) {
    throw new AppError('VALIDATION_FAILED', 'You cannot change the status of your own account.', {
      fields: { status: 'ask another administrator' },
    });
  }
  const doc = await withTransaction(async (session) => {
    const current = await UserModel.findById(id).session(session);
    if (!current) throw new AppError('NOT_FOUND', 'Not found.');
    const from = current.status;
    if (from === input.status) {
      throw new AppError('INVALID_TRANSITION', `This account is already ${from}.`, { current: { status: from } });
    }
    // Pausing or suspending revokes every session immediately (token version bump).
    const update = input.status === 'active' ? { $set: { status: input.status } } : { $set: { status: input.status }, $inc: { tokenVersion: 1 } };
    const updated = await UserModel.findOneAndUpdate({ _id: id, status: from }, update, { new: true, session });
    if (!updated) throw new AppError('CONFLICT', 'This account was just changed by someone else. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: `user.${input.status}`,
        resourceType: 'user',
        resourceId: updated._id,
        facilityId: updated.facilityId,
        reason: input.reason,
        changes: { status: [from, input.status] },
        requestId: ctx.requestId,
      },
      session,
    );
    return updated;
  });
  const names = await facilityNames([doc]);
  return toUserAdmin(doc, doc.facilityId ? (names.get(doc.facilityId.toString()) ?? null) : null);
}
