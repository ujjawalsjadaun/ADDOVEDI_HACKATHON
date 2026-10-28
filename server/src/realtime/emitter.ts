import type { RealtimeEvent, RealtimeTopic } from '@golden-hour/shared';
import type { Types } from 'mongoose';
import type { Server } from 'socket.io';

// Realtime is an acceleration channel only (docs/architecture.md §7): events say *what* changed,
// never the data. Clients refetch over REST, which re-checks every permission.

let io: Server | undefined;

export function setRealtimeServer(server: Server | undefined): void {
  io = server;
}

type Id = string | Types.ObjectId | null | undefined;

export const rooms = {
  user: (id: Id) => (id ? `user:${String(id)}` : null),
  facility: (id: Id) => (id ? `facility:${String(id)}` : null),
  role: (role: 'admin' | 'coordinator' | 'hospital_staff' | 'donor') => `role:${role}`,
};

/**
 * Publishes a change to the given rooms. Call it AFTER the transaction commits, so a client never
 * refetches before the change is visible. A no-op when realtime is not running (tests, scripts).
 */
export function publish(topic: RealtimeTopic, targets: (string | null)[], id?: Id): void {
  if (!io) return;
  const list = [...new Set(targets.filter((r): r is string => !!r))];
  if (list.length === 0) return;
  const event: RealtimeEvent = { topic, id: id ? String(id) : undefined, at: new Date().toISOString() };
  io.to(list).emit('change', event);
}
