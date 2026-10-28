import type { TimelineEvent } from '@golden-hour/shared';
import type { Types } from 'mongoose';
import { AuditLog } from '../audit/audit.model';
import { UserModel } from '../users/user.model';

// The request timeline is derived from audit events, not stored on the request (docs/state-machines.md §2).

const LABELS: Record<string, string> = {
  'request.created': 'Request raised',
  'request.duplicate_flagged': 'Flagged as a possible duplicate — needs review',
  'request.duplicate_cleared': 'Confirmed as a separate need',
  'request.closed_duplicate': 'Closed as a duplicate',
  'request.verified': 'Verified by the hospital',
  'request.rejected': 'Rejected',
  'request.cancelled': 'Cancelled',
  'request.fulfilled': 'Fulfilled — confirmed by the hospital',
  'request.expired': 'Expired',
  'request.alerted': 'Donors alerted',
  'request.no_candidates': 'No eligible donor found for this batch',
  'request.search_widened': 'Search widened — more donors alerted',
  'donor.accepted': 'A donor accepted',
  'donor.declined': 'A donor declined',
  'donor.en_route': 'Donor is on the way',
  'donor.arrived': 'Donor reported arrival',
  'donor.withdrawn': 'Donor withdrew',
  'assignment.arrival_confirmed': 'Arrival confirmed by the hospital',
  'assignment.donated': 'Donation confirmed by the hospital',
  'assignment.no_show': 'Donor did not arrive (no-show)',
};

export async function buildTimeline(requestId: Types.ObjectId): Promise<TimelineEvent[]> {
  const events = await AuditLog.find({ resourceType: 'bloodRequest', resourceId: requestId, result: 'success' })
    .sort({ at: 1 })
    .limit(200)
    .lean();
  const userIds = [...new Set(events.map((e) => e.actor?.userId?.toString()).filter((id): id is string => !!id))];
  const users = await UserModel.find({ _id: { $in: userIds } }).select('name role').lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return events.map((e) => {
    const user = e.actor?.userId ? byId.get(e.actor.userId.toString()) : undefined;
    return {
      at: e.at.toISOString(),
      action: e.action,
      label: labelFor(e.action, e.detail as Record<string, unknown> | undefined),
      actor: e.actor?.type === 'system' ? { name: 'System', role: null } : { name: user?.name ?? null, role: e.actor?.role ?? null },
      reason: e.reason ?? null,
    };
  });
}

function labelFor(action: string, detail: Record<string, unknown> | undefined): string {
  const base = LABELS[action] ?? action;
  if (action === 'request.alerted' && typeof detail?.donors === 'number') return `${base} (${detail.donors})`;
  return base;
}
