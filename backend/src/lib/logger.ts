import { pino, type TransportSingleOptions } from 'pino';
import { env } from '../config/env';

function resolveTransport(): TransportSingleOptions | undefined {
  if (env.isProd || env.isTest) return undefined;
  try {
    require.resolve('pino-pretty');
  } catch {
    return undefined;
  }
  return {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:mm:ss', ignore: 'pid,hostname' },
  };
}

export const logger = pino({
  level: env.isTest ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  transport: resolveTransport(),
  // Safety net: never persist credentials even if a serializer misses them.
  redact: {
    paths: ['req.headers.authorization', 'authorization', '*.token', '*.password', '*.refreshToken'],
    censor: '[REDACTED]',
  },
});
