import type { NotificationType, Prisma } from '@prisma/client';
import { buildPagination, keysetWhere } from '../../common/pagination';
import { env } from '../../config/env';
import { getFirebaseMessaging } from '../../lib/firebase';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { authorSelect } from '../users/user.select';
import type { NotificationsQuery } from './notifications.validation';

interface PostInteractionNotification {
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

/** Explicit state change — reading the inbox must not mutate it (GET stays safe). */
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}

/**
 * Persists the in-app notification, then hands push delivery off without
 * awaiting it.
 *
 * The database write is awaited on purpose: it is a single local insert, and
 * the inbox must be consistent the moment the like/comment response returns.
 * Only the FCM round-trip — slow and failure-prone — is fire-and-forget.
 */
export async function notifyPostInteraction(input: PostInteractionNotification): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId: input.postId,
    },
  });

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
    const response = await getFirebaseMessaging().sendEachForMulticast({
      tokens: devices.map((device) => device.token),
      notification: {
        title: isLike ? 'New like' : 'New comment',
        body: isLike
          ? `${input.actorUsername} liked your post`
          : `${input.actorUsername} commented: ${input.commentPreview ?? ''}`,
      },
      // `data` drives deep-linking when the notification is tapped.
      data: {
        type: input.type,
        postId: input.postId,
        actorUsername: input.actorUsername,
      },
      android: { priority: 'high' },
    });

    const deadTokens = devices
      .filter((_, index) => {
        const result = response.responses[index];
        return result !== undefined && !result.success && isDeadTokenError(result.error?.code);
      })
      .map((device) => device.token);

    if (deadTokens.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: deadTokens } } });
      logger.info({ pruned: deadTokens.length }, 'Pruned invalid FCM device tokens');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to deliver push notification');
  }
}
