import { prisma } from '../../lib/prisma';
import type { RegisterDeviceInput } from './devices.validation';

/**
 * Upserts on the token, because one physical device moves between accounts
 * when someone logs out and back in as somebody else.
 *
 * The token is never echoed back: it is a credential for a push target, and
 * would otherwise leak into mobile logs and analytics SDKs.
 */
export async function registerDevice(userId: string, input: RegisterDeviceInput) {
  return prisma.deviceToken.upsert({
    where: { token: input.token },
    create: { userId, token: input.token, platform: input.platform },
    update: { userId, platform: input.platform, lastSeenAt: new Date() },
    select: { id: true, platform: true },
  });
}

/** Idempotent: removing an unknown token still succeeds. */
export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
}
