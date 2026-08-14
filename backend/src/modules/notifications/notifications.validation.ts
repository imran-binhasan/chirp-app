import { z } from 'zod';
import { paginationQueryFields } from '../../common/pagination';

export const notificationsQuerySchema = z.object({
  ...paginationQueryFields,
});

export const notificationIdParamsSchema = z.object({
  id: z.uuid('Invalid notification id'),
});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
