import type { ClosureReason, RequestStatus, RequestSummary, Urgency } from '@golden-hour/shared';
import type { BadgeTone } from '../../components/ui/StatusBadge';

export const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  standard: 'Standard',
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

const STATUS_LABEL: Record<Exclude<RequestStatus, 'closed'>, string> = {
  open: 'Awaiting verification',
  awaiting_donor: 'Verified · finding donors',
  donors_assigned: 'Donors assigned',
};

/** One human label + tone for a request's combined state. */
export function requestState(r: Pick<RequestSummary, 'requestStatus' | 'closureReason' | 'duplicateReviewStatus'>): {
  label: string;
  tone: BadgeTone;
} {
  if (r.requestStatus === 'closed') {
    const reason = r.closureReason ?? 'cancelled';
    return { label: CLOSURE_LABEL[reason], tone: reason === 'fulfilled' ? 'green' : 'slate' };
  }
  if (r.requestStatus === 'open' && r.duplicateReviewStatus === 'pending') return { label: 'Possible duplicate · review', tone: 'red' };
  return { label: STATUS_LABEL[r.requestStatus], tone: r.requestStatus === 'open' ? 'amber' : 'blue' };
}
