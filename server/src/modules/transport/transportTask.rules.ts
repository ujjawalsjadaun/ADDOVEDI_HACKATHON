import type { TransportAction, TransportStatus } from '@golden-hour/shared';
import type { AuthUser } from '../auth/auth.types';
import type { TransportTaskDocument } from './transportTask.model';

// Transport state machine (docs/state-machines.md §9). `completed` needs the receiving facility.

export const TRANSPORT_TRANSITIONS: Record<TransportAction, { from: readonly TransportStatus[]; to: TransportStatus }> = {
  claim: { from: ['requested'], to: 'assigned' },
  picked_up: { from: ['assigned'], to: 'picked_up' },
  handed_over: { from: ['picked_up'], to: 'handed_over' },
  complete: { from: ['handed_over'], to: 'completed' },
  fail: { from: ['assigned', 'picked_up', 'handed_over'], to: 'failed' },
  cancel: { from: ['requested', 'assigned'], to: 'cancelled' },
};

export function transportAllowedActions(t: TransportTaskDocument, user: AuthUser): TransportAction[] {
  const isAssignee = !!t.assigneeUserId && t.assigneeUserId.toString() === user.id;
  const isFacilityStaff = user.role === 'hospital_staff' && user.facilityId === t.facilityId.toString();
  const isAdmin = user.role === 'admin';
  const who: Record<TransportAction, boolean> = {
    claim: user.role === 'coordinator',
    picked_up: isAssignee,
    handed_over: isAssignee,
    complete: isFacilityStaff,
    fail: isAssignee || isFacilityStaff || isAdmin,
    cancel: isFacilityStaff || isAdmin,
  };
  return (Object.keys(TRANSPORT_TRANSITIONS) as TransportAction[]).filter(
    (a) => who[a] && TRANSPORT_TRANSITIONS[a].from.includes(t.status),
  );
}
