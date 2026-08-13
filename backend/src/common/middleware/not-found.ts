import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/app-error';

/** Catch-all for unmatched routes — responds with the standard 404 envelope. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
