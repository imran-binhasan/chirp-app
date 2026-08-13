import type { Response } from 'express';
import type { PaginationMeta } from './pagination';

/**
 * Uniform response envelope — EVERY endpoint in the API responds through
 * these two helpers, so clients always see the exact same shape:
 *
 *   success: { success: true,  data, error: null, meta }
 *   failure: { success: false, data: null, error, meta }
 */

export type { PaginationMeta };

const baseMeta = (res: Response) => ({
  requestId: res.locals.requestId,
  timestamp: new Date().toISOString(),
});

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: PaginationMeta,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    error: null,
    meta: { ...baseMeta(res), ...(pagination ? { pagination } : {}) },
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(statusCode).json({
    success: false,
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta: baseMeta(res),
  });
}
