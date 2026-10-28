import type { AssignmentStatus, DonorAssignmentAction, HospitalAssignmentAction } from '@golden-hour/shared';
import type { AuthUser } from '../auth/auth.types';
import type { AssignmentDocument } from './assignment.model';

// Assignment state machine (docs/state-machines.md §6). Arrival and donation are distinct facts;
// donation is confirmed only by the hospital and never closes the request by itself.

export const DONOR_ACTION_FROM: Record<DonorAssignmentAction, readonly AssignmentStatus[]> = {
  en_route: ['accepted'],
  arrived: ['accepted', 'en_route'],
  withdraw: ['accepted', 'en_route'],
};

export const HOSPITAL_ACTION_FROM: Record<HospitalAssignmentAction, readonly AssignmentStatus[]> = {
  confirm_arrival: ['accepted', 'en_route', 'arrived'],
  mark_donated: ['arrived'],
  mark_no_show: ['accepted', 'en_route'],
};

export function donorAllowedActions(a: AssignmentDocument, user: AuthUser): DonorAssignmentAction[] {
  if (user.role !== 'donor' || a.donorUserId.toString() !== user.id) return [];
  return (Object.keys(DONOR_ACTION_FROM) as DonorAssignmentAction[]).filter((k) => DONOR_ACTION_FROM[k].includes(a.status));
}

export function hospitalAllowedActions(a: AssignmentDocument, user: AuthUser): HospitalAssignmentAction[] {
  if (user.role !== 'hospital_staff' || user.facilityId !== a.facilityId.toString()) return [];
  return (Object.keys(HOSPITAL_ACTION_FROM) as HospitalAssignmentAction[]).filter((k) => {
    if (!HOSPITAL_ACTION_FROM[k].includes(a.status)) return false;
    // Re-confirming an arrival the hospital already confirmed is pointless.
    return !(k === 'confirm_arrival' && a.status === 'arrived' && a.arrivedBy === 'hospital_confirmed');
  });
}
