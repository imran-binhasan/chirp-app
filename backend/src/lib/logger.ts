import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.isTest ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  transport:
    env.isProd || env.isTest
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
  // Safety net: never persist credentials even if a serializer misses them.
  redact: {
    paths: ['req.headers.authorization', 'authorization', '*.token', '*.password', '*.refreshToken'],
    censor: '[REDACTED]',
  },
});
