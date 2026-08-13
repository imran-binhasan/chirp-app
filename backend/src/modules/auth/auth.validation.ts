import { z } from 'zod';
import { trimmedString } from '../../common/validation-utils';

export const signupSchema = z.object({
  username: trimmedString(30, 3)
    .refine(
      (value) => /^[a-zA-Z0-9_]+$/.test(value),
      'Username may only contain letters, numbers, and underscores',
    )
    .openapi({ pattern: '^[a-zA-Z0-9_]+$', example: 'janedoe' }),
  email: trimmedString(255)
    .pipe(z.email('Invalid email address'))
    .openapi({ format: 'email', example: 'jane@example.com' }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  /** Email OR username. */
  identifier: trimmedString(255),
  password: z.string().min(1, 'Password is required').max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const logoutSchema = refreshSchema;

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
