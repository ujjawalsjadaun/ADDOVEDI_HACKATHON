import { Router } from 'express';
import type { HealthLive, HealthReady } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { pingDb } from '../../lib/db';
import { sendData } from '../../lib/http';

export function healthRoutes(config: Config): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    sendData<HealthLive>(res, { status: 'ok' });
  });

  router.get('/ready', async (_req, res) => {
    const dbUp = await pingDb();
    // Real provider health checks arrive with the adapters (Phase 7/9); simulated ones are always available.
    const providers: HealthReady['providers'] = {
      routing: config.ROUTING_PROVIDER === 'simulated' ? 'simulated' : 'unchecked',
      weather: config.WEATHER_PROVIDER === 'simulated' ? 'simulated' : 'unchecked',
      sms: config.SMS_PROVIDER === 'simulated' ? 'simulated' : 'unchecked',
    };
    sendData<HealthReady>(
      res,
      { status: dbUp ? 'ready' : 'degraded', db: dbUp ? 'up' : 'down', demoMode: config.DEMO_MODE, providers },
      { status: dbUp ? 200 : 503 },
    );
  });

  return router;
}
