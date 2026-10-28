import type { ClientSession, Types } from 'mongoose';
import type { AuthUser } from '../auth/auth.types';
import { AuditLog } from './audit.model';

export type AuditActor = { type: 'user'; userId: string; role: string } | { type: 'system' };

export interface AuditEntry {
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string | Types.ObjectId;
  facilityId?: string | Types.ObjectId | null;
  result?: 'success' | 'denied' | 'failed';
  reason?: string;
  changes?: Record<string, [unknown, unknown]>;
  detail?: Record<string, unknown>;
  requestId?: string;
}

export function userActor(user: AuthUser): AuditActor {
  return { type: 'user', userId: user.id, role: user.role };
}

export const SYSTEM_ACTOR: AuditActor = { type: 'system' };

/**
 * Writes an audit record. Pass the transaction session for business changes so the change
 * and its audit record commit together (docs/architecture.md §4).
 */
export async function recordAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await AuditLog.create(
    [
      {
        actor: entry.actor,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        facilityId: entry.facilityId ?? undefined,
        result: entry.result ?? 'success',
        reason: entry.reason,
        changes: entry.changes,
        detail: entry.detail,
        requestId: entry.requestId,
      },
    ],
    { session },
  );
}
