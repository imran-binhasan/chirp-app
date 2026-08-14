import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../errors/app-error';
import { sendError } from '../response';

interface ParsedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const isBodyParseError = (err: unknown): err is SyntaxError =>
  err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400;

function normalizeError(err: unknown): ParsedError {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  // Safety net — validate() should have caught these already.
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return { statusCode: 409, code: 'CONFLICT', message: 'Resource already exists' };
    }
    if (err.code === 'P2025') {
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    }
  }

  if (isBodyParseError(err)) {
    return { statusCode: 400, code: 'BAD_JSON', message: 'Request body is not valid JSON' };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong' };
}

/** The only place errors are serialized. Clients always get a sanitized body. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const { statusCode, code, message, details } = normalizeError(err);

  if (statusCode >= 500) {
    logger.error({ err, requestId: res.locals.requestId, path: req.path }, 'Unhandled error');
  }

  // Must precede sendError — headers cannot be set once the body is flushed.
  if (!env.isProd && statusCode >= 500 && err instanceof Error) {
    res.setHeader('x-debug-error', err.name);
  }

  sendError(res, statusCode, code, message, details);
}
