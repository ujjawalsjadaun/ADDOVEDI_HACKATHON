import type { RoadReportAction } from '@golden-hour/shared';
import type { AuthUser } from '../auth/auth.types';
import type { RoadReport } from './roadReport.model';

type ReportLike = Pick<RoadReport, 'condition' | 'confidence' | 'verificationStatus' | 'expiresAt' | 'reporterId'>;

export function isStale(r: Pick<RoadReport, 'expiresAt'>, now = Date.now()): boolean {
  return r.expiresAt.getTime() <= now;
}

/**
 * A report changes travel-time estimates only when it says the road is BLOCKED, is current, not
 * dismissed, and is either verified or reported with high confidence (decision D-48). Everything
 * else is shown as a warning, never silently applied.
 */
export function affectsEta(r: ReportLike, now = Date.now()): boolean {
  return (
    r.condition === 'blocked' &&
    !isStale(r, now) &&
    r.verificationStatus !== 'dismissed' &&
    (r.verificationStatus === 'verified' || r.confidence === 'high')
  );
}

/** Coordinators and admins verify/dismiss; a coordinator cannot verify their own report. */
export function roadReportActions(r: ReportLike, user: AuthUser): RoadReportAction[] {
  if (user.role !== 'admin' && user.role !== 'coordinator') return [];
  const own = r.reporterId.toString() === user.id;
  const actions: RoadReportAction[] = [];
  if (r.verificationStatus === 'unverified' && (user.role === 'admin' || !own)) actions.push('verify');
  if (r.verificationStatus !== 'dismissed') actions.push('dismiss');
  return actions;
}
