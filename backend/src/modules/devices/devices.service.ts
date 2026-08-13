import { prisma } from '../../lib/prisma';
import type { RegisterDeviceInput } from './devices.validation';

/**
 * Upsert on the raw token: the same physical device can move between
 * accounts (logout → login as someone else), so ownership is re-assigned.
 */
export async function registerDevice(userId: string, input: RegisterDeviceInput) {
  return prisma.deviceToken.upsert({
    where: { token: input.token },
    create: { userId, token: input.token, platform: input.platform },
    update: { userId, platform: input.platform, lastSeenAt: new Date() },
    select: { id: true, token: true, platform: true },
  });
}

/** Idempotent — deleting an unknown/already-removed token still succeeds. */
export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
}
