import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Logger } from 'pino';
import type { Config } from '../config/env';
import { loadSessionUser } from '../modules/auth/auth.service';
import { readSession, SESSION_COOKIE } from '../modules/auth/session';
import { rooms, setRealtimeServer } from './emitter';

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/**
 * Socket.IO with the same session cookie as REST. Anonymous connections are refused. Rooms are
 * decided by the server from the user's role and facility — clients cannot join rooms themselves.
 */
export function startRealtime(httpServer: HttpServer, config: Config, logger: Logger): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: config.CLIENT_ORIGIN, credentials: true },
    serveClient: false,
  });

  io.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.handshake.headers.cookie, SESSION_COOKIE);
      const claims = token ? readSession(token, config) : null;
      const user = claims ? await loadSessionUser(claims.userId, claims.tokenVersion) : null;
      if (!user) return next(new Error('unauthenticated'));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      socket.data.facilityId = user.facilityId;
      next();
    } catch {
      next(new Error('unavailable'));
    }
  });

  io.on('connection', (socket) => {
    const joined = [rooms.user(socket.data.userId as string), rooms.role(socket.data.role), rooms.facility(socket.data.facilityId as string | null)];
    void socket.join(joined.filter((r): r is string => !!r));
  });

  setRealtimeServer(io);
  logger.info('realtime (Socket.IO) ready');
  return io;
}
