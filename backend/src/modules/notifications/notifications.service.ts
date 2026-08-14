import type { NotificationType, Prisma } from '@prisma/client';
import { buildPagination, keysetWhere } from '../../common/pagination';
import { env } from '../../config/env';
import { getFirebaseMessaging } from '../../lib/firebase';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { authorSelect } from '../users/user.select';
import type { NotificationsQuery } from './notifications.validation';

export interface PostInteractionNotification {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  postId: string;
  commentPreview?: string;
}

const actorRelation = { actor: { select: authorSelect } } as const;

type NotificationWithActor = Prisma.NotificationGetPayload<{ include: typeof actorRelation }>;

function toNotificationResponse(notification: NotificationWithActor) {
  return {
    id: notification.id,
    type: notification.type,
    postId: notification.postId,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
    actor: notification.actor,
  };
}

const isDeadTokenError = (code: string | undefined): boolean =>
  code === 'messaging/registration-token-not-registered' ||
  code === 'messaging/invalid-registration-token';

const FCM_MULTICAST_LIMIT = 500;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

export async function listNotifications(userId: string, query: NotificationsQuery) {
  const { limit, cursor } = query;

  const notifications = await prisma.notification.findMany({
    where: { userId, ...keysetWhere(cursor) },
    include: actorRelation,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const { page, pagination } = buildPagination(notifications, limit);
  return { items: page.map(toNotificationResponse), pagination };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Scoped by userId so a guessed id cannot reach another account's inbox. */
export async function markOneRead(userId: string, notificationId: string): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, userId, read: false },
    data: { read: true },
  });
  return count > 0;
}

/** Explicit: reading the inbox must not mutate it, so GET stays safe. */
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}

/**
 * Writes the inbox row inside the caller's transaction, so it commits with the
 * like or comment that caused it. Returns whether a row was actually written.
 *
 * A like is a state, not an event: re-liking must not announce itself again,
 * or anyone can flood an inbox by tapping the heart. Every comment notifies.
 */
export async function recordPostInteractionNotification(
  tx: Prisma.TransactionClient,
  input: PostInteractionNotification,
): Promise<boolean> {
  if (input.type === 'POST_LIKED') {
    const alreadyAnnounced = await tx.notification.findFirst({
      where: {
        userId: input.recipientId,
        actorId: input.actorId,
        postId: input.postId,
        type: 'POST_LIKED',
      },
      select: { id: true },
    });
    if (alreadyAnnounced) return false;
  }

  await tx.notification.create({
    data: {
      userId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId: input.postId,
    },
  });
  return true;
}

/** Push is intentionally decoupled from the response path after persistence. */
export function schedulePostInteractionPush(input: PostInteractionNotification): void {
  void deliverPush(input);
}

/** NEVER throws: a push failure must not fail the request that triggered it. */
async function deliverPush(input: PostInteractionNotification): Promise<void> {
  try {
    if (!env.firebaseConfigured) return;

    const devices = await prisma.deviceToken.findMany({
      where: { userId: input.recipientId },
      select: { token: true },
    });
    if (devices.length === 0) return;

    const isLike = input.type === 'POST_LIKED';
    const deadTokens: string[] = [];
    for (const deviceBatch of chunks(devices, FCM_MULTICAST_LIMIT)) {
      // FCM rejects multicast requests larger than 500 tokens.
      const response = await getFirebaseMessaging().sendEachForMulticast({
        tokens: deviceBatch.map((device) => device.token),
        notification: {
          title: isLike ? 'New like' : 'New comment',
          body: isLike
            ? `${input.actorUsername} liked your post`
            : `${input.actorUsername} commented: ${input.commentPreview ?? ''}`,
        },
        data: {
          type: input.type,
          postId: input.postId,
          actorUsername: input.actorUsername,
        },
        android: { priority: 'high' },
      });

      deadTokens.push(
        ...deviceBatch
          .filter((_, index) => {
            const result = response.responses[index];
            return result !== undefined && !result.success && isDeadTokenError(result.error?.code);
          })
          .map((device) => device.token),
      );
    }

    if (deadTokens.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: deadTokens } } });
      logger.info({ pruned: deadTokens.length }, 'Pruned invalid FCM device tokens');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to deliver push notification');
  }
}
