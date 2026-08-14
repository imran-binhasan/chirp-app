import type { Prisma } from '@prisma/client';

/** Safe to expose to anyone. */
export const authorSelect = {
  id: true,
  username: true,
} satisfies Prisma.UserSelect;

/** Only ever returned to the account it describes. */
export const userSelfSelect = {
  ...authorSelect,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
