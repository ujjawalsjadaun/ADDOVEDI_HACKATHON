import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Router } from 'express';
import type { Logger } from 'pino';

/**
 * Serves the built web app (single-host deployment). Hashed files under /assets are cached for a year;
 * index.html is never cached so a new release is picked up. Any other GET that is not an API or socket
 * call falls back to index.html so deep links like /hospital/requests/… work after a refresh.
 * Returns null (and logs why) when the folder or its index.html is missing.
 */
export function serveClient(distDir: string, logger: Logger): Router | null {
  const root = path.resolve(distDir);
  const indexFile = path.join(root, 'index.html');
  if (!existsSync(indexFile)) {
    logger.warn({ root }, 'CLIENT_DIST_DIR has no index.html — web app NOT served (run `npm run build` first)');
    return null;
  }

  const router = express.Router();
  router.use(
    express.static(root, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  router.use((req, res, next) => {
    const isAppRoute = (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io');
    if (!isAppRoute || path.extname(req.path)) return next(); // missing files stay 404
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
  logger.info({ root }, 'serving web app');
  return router;
}
