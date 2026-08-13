import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT} (docs: /api/docs)`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown requested — draining connections');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Hard-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
