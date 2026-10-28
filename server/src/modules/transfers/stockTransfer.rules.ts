import type { StockTransferAction, StockTransferStatus } from '@golden-hour/shared';
import type { AuthUser } from '../auth/auth.types';
import type { StockTransferDocument } from './stockTransfer.model';

// Stock transfer state machine (docs/state-machines.md §10).

export const TRANSFER_TRANSITIONS: Record<StockTransferAction, { from: readonly StockTransferStatus[]; to: StockTransferStatus; side: 'requesting' | 'responding' }> = {
  offer: { from: ['requested'], to: 'offered', side: 'responding' },
  decline: { from: ['requested'], to: 'declined', side: 'responding' },
  dispatch: { from: ['offered'], to: 'dispatched', side: 'responding' },
  receive: { from: ['dispatched'], to: 'received', side: 'requesting' },
  cancel: { from: ['requested', 'offered'], to: 'cancelled', side: 'requesting' },
};

export function transferAllowedActions(t: StockTransferDocument, user: AuthUser): StockTransferAction[] {
  if (user.role !== 'hospital_staff' || !user.facilityId) return [];
  const side = user.facilityId === t.requestingFacilityId.toString() ? 'requesting' : user.facilityId === t.respondingFacilityId.toString() ? 'responding' : null;
  if (!side) return [];
  return (Object.keys(TRANSFER_TRANSITIONS) as StockTransferAction[]).filter(
    (a) => TRANSFER_TRANSITIONS[a].side === side && TRANSFER_TRANSITIONS[a].from.includes(t.status),
  );
}
