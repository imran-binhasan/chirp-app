import type { Prisma } from '@prisma/client';

/** Public author summary embedded in posts/comments — safe to expose anywhere. */
export const authorSelect = {
  id: true,
  username: true,
} satisfies Prisma.UserSelect;

/** Fields returned for the authenticated user (signup/login/auth me). */
export const userSelfSelect = {
  ...authorSelect,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
