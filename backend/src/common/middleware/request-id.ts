import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Correlation id for every request, echoed in headers, logs and meta. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64
      ? incoming
      : randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
