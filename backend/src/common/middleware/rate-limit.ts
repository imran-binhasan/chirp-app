import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { sendError } from '../response';

const createLimiter = (limit: number) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest, // never throttle the test suite
    handler: (_req, res) =>
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests, please try again later'),
  });

/** Applied globally to every request. */
export const globalLimiter = createLimiter(env.RATE_LIMIT_MAX);

/** Stricter bucket for credential endpoints (signup/login/refresh). */
export const authLimiter = createLimiter(env.AUTH_RATE_LIMIT_MAX);
