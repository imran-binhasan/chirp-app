import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../../lib/jwt';
import { UnauthorizedError } from '../errors/app-error';

/** Stateless JWT guard. The type claim stops refresh tokens being used here. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    if (payload.type !== 'access') throw new Error('Unexpected token type');
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
