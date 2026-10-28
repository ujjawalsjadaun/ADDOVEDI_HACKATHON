import type { RequestAction, RequestStatus } from '@golden-hour/shared';
import type { ClientSession, UpdateQuery } from 'mongoose';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import type { AuthUser } from '../auth/auth.types';
import type { HospitalDocument } from '../hospitals/hospital.model';
import { BloodRequestModel, type BloodRequest, type BloodRequestDocument } from './request.model';

// Legal request transitions (docs/state-machines.md §2). Anything not allowed here is refused.

export const ACTION_FROM: Record<RequestAction, readonly RequestStatus[]> = {
  verify: ['open'],
  reject: ['open'],
  review_duplicate: ['open'],
  cancel: ['open', 'awaiting_donor', 'donors_assigned'],
  fulfill: ['awaiting_donor', 'donors_assigned'],
};

const ALL_ACTIONS = Object.keys(ACTION_FROM) as RequestAction[];

export interface ActionSubject {
  request: BloodRequestDocument;
  facility: HospitalDocument;
  user: AuthUser;
  config: Config;
}

function sameFacility({ request, user }: ActionSubject): boolean {
  return user.role === 'hospital_staff' && user.facilityId === request.facilityId.toString();
}

function isVerifier(s: ActionSubject): boolean {
  return sameFacility(s) && s.user.canVerifyRequests;
}

function current(request: BloodRequestDocument) {
  return {
    requestStatus: request.requestStatus,
    verificationStatus: request.verificationStatus,
    duplicateReviewStatus: request.duplicateReview.status,
    version: request.version,
  };
}

/**
 * Throws the precise reason `action` is not allowed for this user and request right now.
 * Used both to guard every mutation and to compute `allowedActions` for the UI.
 */
export function assertCanAct(action: RequestAction, s: ActionSubject): void {
  const { request, facility, user, config } = s;
  const isAdmin = user.role === 'admin';
  const forbidden = (msg: string) => new AppError('FORBIDDEN', msg);
  const invalid = (msg: string) => new AppError('INVALID_TRANSITION', msg, { current: current(request) });

  if (!ACTION_FROM[action].includes(request.requestStatus)) {
    throw invalid(
      request.requestStatus === 'closed'
        ? 'This request is closed. If blood is still needed, raise a new request.'
        : `This action is not possible while the request is ${request.requestStatus.replace(/_/g, ' ')}.`,
    );
  }

  switch (action) {
    case 'verify': {
      if (!isVerifier(s)) throw forbidden('Only a verifier at this facility can verify its requests.');
      if (facility.verificationStatus !== 'verified') throw forbidden('Your facility is not verified, so it cannot verify requests.');
      if (request.verificationStatus !== 'pending') throw invalid('This request has already been decided.');
      if (request.duplicateReview.status === 'pending') {
        throw new AppError('DUPLICATE_REVIEW_PENDING', 'Resolve the possible-duplicate review before verifying.', {
          current: current(request),
        });
      }
      if (config.REQUIRE_SEPARATE_VERIFIER && request.createdBy.toString() === user.id) {
        throw new AppError('SELF_VERIFICATION_NOT_ALLOWED', 'A different verifier must confirm a request you raised.');
      }
      if (request.deadlineAt.getTime() <= Date.now()) {
        throw invalid('The deadline has passed. Cancel this request and raise a new one if blood is still needed.');
      }
      return;
    }
    case 'reject':
      if (!isAdmin && !isVerifier(s)) throw forbidden('Only a verifier at this facility or an administrator can reject a request.');
      if (request.verificationStatus !== 'pending') throw invalid('This request has already been decided.');
      return;
    case 'review_duplicate':
      if (!isAdmin && !isVerifier(s)) throw forbidden('Only a verifier at this facility or an administrator can resolve a duplicate review.');
      if (request.duplicateReview.status !== 'pending') throw invalid('There is no pending duplicate review on this request.');
      return;
    case 'cancel':
      if (!isAdmin && !sameFacility(s)) throw forbidden('Only staff of this facility or an administrator can cancel this request.');
      return;
    case 'fulfill':
      // Fulfilment is a hospital fact; administrators cannot confirm it (docs/security.md §1).
      if (!sameFacility(s)) throw forbidden('Only staff of this facility can confirm fulfilment.');
      return;
  }
}

export function allowedActions(s: ActionSubject): RequestAction[] {
  return ALL_ACTIONS.filter((action) => {
    try {
      assertCanAct(action, s);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Atomic, version-checked transition: matches only if the request is still in an allowed state at
 * the version the caller saw. A lost race becomes 409 CONFLICT carrying the current state.
 */
export async function applyTransition(
  session: ClientSession,
  args: { id: string; expectedVersion: number; action: RequestAction; update: UpdateQuery<BloodRequest> },
): Promise<BloodRequestDocument> {
  const { $inc, ...rest } = args.update;
  const doc = await BloodRequestModel.findOneAndUpdate(
    { _id: args.id, version: args.expectedVersion, requestStatus: { $in: ACTION_FROM[args.action] } },
    { ...rest, $inc: { ...($inc ?? {}), version: 1 } },
    { new: true, session },
  );
  if (doc) return doc;

  const latest = await BloodRequestModel.findById(args.id).session(session);
  if (!latest) throw new AppError('NOT_FOUND', 'Not found.');
  if (latest.version !== args.expectedVersion) {
    throw new AppError('CONFLICT', 'This request has changed since you loaded it. Refresh and try again.', {
      current: current(latest),
    });
  }
  throw new AppError('INVALID_TRANSITION', 'This action is no longer possible for this request.', { current: current(latest) });
}
