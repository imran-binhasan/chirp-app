import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as controller from './notifications.controller';
import { notificationsQuerySchema } from './notifications.validation';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  validate({ query: notificationsQuerySchema }),
  controller.listNotifications,
);
notificationsRouter.get('/unread-count', controller.getUnreadCount);
notificationsRouter.post('/read', controller.markAllRead);
