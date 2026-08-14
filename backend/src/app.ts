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

  // Opt-in: trusting X-Forwarded-For when nothing rewrites it lets a client
  // forge its own IP and bypass the per-IP rate limiter.
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => (res as express.Response).locals.requestId,
      autoLogging: !env.isTest,
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'silent';
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins }));
  app.use(express.json({ limit: '16kb' }));

  // Ahead of the limiter so health polling never spends the request budget.
  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      let database: 'up' | 'down' = 'up';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'down';
      }
      sendSuccess(
        res,
        { status: database === 'up' ? 'ok' : 'degraded', database, uptimeSeconds: Math.round(process.uptime()) },
        database === 'up' ? 200 : 503,
      );
    }),
  );

  app.use(globalLimiter);

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
