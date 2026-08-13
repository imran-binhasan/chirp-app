import type { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../errors/app-error';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates (and replaces) request parts with the zod-parsed output, so
 * controllers always work with clean, typed, transformed data.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as ParamsDictionary;
      if (schemas.query) {
        // Express 5 declares req.query as a getter — shadow it with an own property.
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError(
            'Request validation failed',
            error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(error);
    }
  };
