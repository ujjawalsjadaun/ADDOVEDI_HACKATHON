import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { RealtimeEvent, RealtimeTopic } from '@golden-hour/shared';

// Realtime is an acceleration channel (docs/architecture.md §7): an event only says what changed,
// then the affected REST queries refetch with full permission checks. Polling stays as the fallback.

export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'reconnecting';

const RealtimeContext = createContext<RealtimeStatus>('off');

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}

const INVALIDATE: Record<RealtimeTopic, QueryKey[]> = {
  request: [['requests'], ['admin', 'overview'], ['coordinator'], ['transport']],
  alert: [['donor']],
  transport: [['transport'], ['coordinator']],
  transfer: [['hospital', 'transfers']],
  lead: [['hospital', 'leads']],
  map: [['geo'], ['requests', 'candidates']],
  notification: [['admin', 'notifications'], ['admin', 'overview']],
};

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? undefined;

/** Connects only while `enabled` (signed in). Reconnects automatically; after a reconnect, refetches everything. */
export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('off');

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    setStatus('connecting');
    const socket: Socket = io(SOCKET_URL ?? '', { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
    let wasConnected = false;

    socket.on('connect', () => {
      // Events may have been missed while disconnected: the server state is the truth.
      if (wasConnected) void queryClient.invalidateQueries();
      wasConnected = true;
      setStatus('live');
    });
    socket.on('disconnect', () => setStatus('reconnecting'));
    socket.on('connect_error', () => setStatus(wasConnected ? 'reconnecting' : 'connecting'));
    socket.on('change', (event: RealtimeEvent) => {
      for (const queryKey of INVALIDATE[event.topic] ?? []) void queryClient.invalidateQueries({ queryKey });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [enabled, queryClient]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}
