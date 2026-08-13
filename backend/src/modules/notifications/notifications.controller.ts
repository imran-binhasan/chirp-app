import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as notificationsService from './notifications.service';
import type { NotificationsQuery } from './notifications.validation';

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

export const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationsService.markAllRead(req.user!.id);
  sendSuccess(res, { updated });
});
