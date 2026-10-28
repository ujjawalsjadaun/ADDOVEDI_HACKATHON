import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config/env';
import { requestId } from './middleware/requestId';
import { requireJson } from './middleware/requireJson';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { publicHospitalRoutes } from './modules/hospitals/hospital.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { requestRoutes } from './modules/requests/request.routes';
import { publicCheckerRoutes } from './modules/public-checker/checker.routes';
import { donorRoutes } from './modules/donors/donor.routes';
import { alertRoutes } from './modules/alerts/alert.routes';
import { assignmentRoutes } from './modules/assignments/assignment.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';

export interface AppDeps {
  config: Config;
  logger: Logger;
}

export function createApp({ config, logger }: AppDeps) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY ? 1 : false);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => res.getHeader('X-Request-Id') as string,
      // Keep request logs to method/url/status; bodies are never logged.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: config.NODE_ENV !== 'test',
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replayed'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );

  const api = express.Router();
  api.use(requireJson);
  api.use(express.json({ limit: '50kb' }));
  // Health stays outside authentication so it works even when the database is down.
  api.use('/health', healthRoutes(config));
  api.use(cookieParser());
  api.use(authenticate(config));
  api.use('/auth', authRoutes(config, logger));
  api.use('/hospitals', publicHospitalRoutes());
  api.use('/admin', adminRoutes(config));
  api.use('/requests', requestRoutes(config));
  api.use('/public', publicCheckerRoutes(config));
  api.use('/donors', donorRoutes(config));
  api.use('/alerts', alertRoutes());
  api.use('/assignments', assignmentRoutes(config, logger));
  api.use('/dashboard', dashboardRoutes());
  api.use(notFound);

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler(logger, config.NODE_ENV === 'development'));

  return app;
}
