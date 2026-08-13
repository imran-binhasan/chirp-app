import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Enables .openapi() metadata on schemas. Validation files import this
// module first, so the prototype patch is guaranteed to be applied before
// any schema is defined.
extendZodWithOpenApi(z);

/**
 * Trims whitespace BEFORE length checks run, so inputs like "   " cannot
 * sneak past min(1). (Chained .trim() ordering is version-dependent in zod;
 * preprocessing is explicit and deterministic.)
 */
export const trimmedString = (max: number, min = 1) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(min, `Must be at least ${min} character(s)`)
      .max(max, `Must be at most ${max} characters`),
  );
