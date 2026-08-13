import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { asyncHandler } from './common/async-handler';
import { errorHandler } from './common/middleware/error-handler';
import { notFound } from './common/middleware/not-found';
import { globalLimiter } from './common/middleware/rate-limit';
import { requestId } from './common/middleware/request-id';
import { sendSuccess } from './common/response';
import { env } from './config/env';
import { buildOpenApiDocument } from './docs/openapi';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { v1Router } from './routes';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs for the rate limiter behind a proxy
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => (res as express.Response).locals.requestId,
      autoLogging: !env.isTest,
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins }));
  app.use(express.json({ limit: '16kb' }));
  app.use(globalLimiter);

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      let database: 'up' | 'down' = 'up';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'down';
      }
      sendSuccess(res, { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()) });
    }),
  );

  const openApiDocument = buildOpenApiDocument();
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'Mini Social Feed API' }),
  );

  app.use('/api/v1', v1Router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
