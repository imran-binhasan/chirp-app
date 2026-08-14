import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as notificationsService from './notifications.service';
import type { NotificationIdParams, NotificationsQuery } from './notifications.validation';

// Express 5 types params loosely; validate() has already parsed them as uuids.
const notificationId = (req: Request): string =>
  (req.params as unknown as NotificationIdParams).id;

export const listNotifications = asyncHandler(async (req, res) => {
  const { items, pagination } = await notificationsService.listNotifications(
    req.user!.id,
    req.query as unknown as NotificationsQuery,
  );
  sendSuccess(res, items, 200, pagination);
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const unread = await notificationsService.getUnreadCount(req.user!.id);
  sendSuccess(res, { unread });
});

export const markOneRead = asyncHandler(async (req, res) => {
  const updated = await notificationsService.markOneRead(req.user!.id, notificationId(req));
  sendSuccess(res, { updated: updated ? 1 : 0 });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationsService.markAllRead(req.user!.id);
  sendSuccess(res, { updated });
});
