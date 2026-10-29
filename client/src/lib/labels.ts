import type { AlertResponse, AssignmentStatus, ClosureReason, RequestStatus, RequestSummary, Urgency } from '@golden-hour/shared';
import type { BadgeTone } from '../components/ui/StatusBadge';

// Human labels for status values, shared by every area so the same state reads the same everywhere.

export const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  standard: 'Planned',
};

export const URGENCY_TONE: Record<Urgency, BadgeTone> = {
  critical: 'red',
  urgent: 'amber',
  standard: 'slate',
};

const CLOSURE_LABEL: Record<ClosureReason, string> = {
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
  duplicate: 'Closed as duplicate',
};

const REQUEST_STATUS_LABEL: Record<Exclude<RequestStatus, 'closed'>, string> = {
  open: 'Awaiting verification',
  awaiting_donor: 'Verified · finding donors',
  donors_assigned: 'Donors assigned',
};

/** One human label + tone for a request's combined state. */
export function requestState(
  r: Pick<RequestSummary, 'requestStatus' | 'closureReason' | 'duplicateReviewStatus'> & Partial<Pick<RequestSummary, 'underReview' | 'escalationStep'>>,
): {
  label: string;
  tone: BadgeTone;
} {
  if (r.requestStatus === 'closed') {
    const reason = r.closureReason ?? 'cancelled';
    return { label: CLOSURE_LABEL[reason], tone: reason === 'fulfilled' ? 'green' : 'slate' };
  }
  if (r.underReview) return { label: 'Under admin review', tone: 'red' };
  if (r.requestStatus === 'awaiting_donor' && (r.escalationStep ?? -1) >= 2) return { label: 'Escalated · finding donors', tone: 'red' };
  if (r.requestStatus === 'open' && r.duplicateReviewStatus === 'pending') return { label: 'Possible duplicate · review', tone: 'red' };
  return { label: REQUEST_STATUS_LABEL[r.requestStatus], tone: r.requestStatus === 'open' ? 'amber' : 'blue' };
}

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: BadgeTone }> = {
  accepted: { label: 'Accepted', tone: 'blue' },
  en_route: { label: 'On the way', tone: 'blue' },
  arrived: { label: 'Arrived', tone: 'blue' },
  donated: { label: 'Donated', tone: 'green' },
  withdrawn: { label: 'Withdrew', tone: 'slate' },
  no_show: { label: 'Did not arrive', tone: 'red' },
  cancelled: { label: 'No longer needed', tone: 'slate' },
};

export const ALERT_RESPONSE: Record<AlertResponse, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting for your answer', tone: 'amber' },
  accepted: { label: 'You accepted', tone: 'green' },
  declined: { label: 'You declined', tone: 'slate' },
  expired: { label: 'Expired', tone: 'slate' },
  cancelled: { label: 'No longer needed', tone: 'slate' },
};
