import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a correlation id to every request (honouring an inbound
 * X-Request-Id from a proxy/client). Surfaced in response headers, the
 * response envelope's meta.requestId, and log lines.
 */
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
