import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Must run before any schema is defined. Validation files import this first.
extendZodWithOpenApi(z);

/** Trims before length checks, so "   " cannot slip past min(1). */
export const trimmedString = (max: number, min = 1) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(min, `Must be at least ${min} character(s)`)
      .max(max, `Must be at most ${max} characters`),
  );
