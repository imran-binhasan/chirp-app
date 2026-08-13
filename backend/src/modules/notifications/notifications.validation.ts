import { z } from 'zod';
import { paginationQueryFields } from '../../common/pagination';

export const notificationsQuerySchema = z.object({
  ...paginationQueryFields,
});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
