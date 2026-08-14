import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as controller from './notifications.controller';
import { notificationIdParamsSchema, notificationsQuerySchema } from './notifications.validation';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  validate({ query: notificationsQuerySchema }),
  controller.listNotifications,
);
notificationsRouter.get('/unread-count', controller.getUnreadCount);
// Registered before '/:id/read' so the literal path always wins the match.
notificationsRouter.post('/read', controller.markAllRead);
notificationsRouter.post(
  '/:id/read',
  validate({ params: notificationIdParamsSchema }),
  controller.markOneRead,
);
