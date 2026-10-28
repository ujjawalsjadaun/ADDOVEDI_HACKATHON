import type { AlertResponse, AssignmentStatus } from '@golden-hour/shared';
import type { BadgeTone } from '../components/ui/StatusBadge';

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
