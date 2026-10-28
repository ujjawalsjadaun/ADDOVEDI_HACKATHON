import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Config } from './config/env';
import { requestId } from './middleware/requestId';
import { requireJson } from './middleware/requireJson';
import { errorHandler, notFound } from './middleware/errorHandler';
import { healthRoutes } from './modules/health/health.routes';

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
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
    }),
  );

  const api = express.Router();
  api.use(requireJson);
  api.use(express.json({ limit: '50kb' }));
  api.use('/health', healthRoutes(config));
  api.use(notFound);

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler(logger, config.NODE_ENV === 'development'));

  return app;
}
