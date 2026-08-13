import { z } from 'zod';
import { paginationQueryFields } from '../../common/pagination';
import { trimmedString } from '../../common/validation-utils';

export const createPostSchema = z.object({
  content: trimmedString(2000),
});

export const feedQuerySchema = z.object({
  ...paginationQueryFields,
  username: trimmedString(30).optional(),
});

export const postIdParamsSchema = z.object({
  id: z.uuid('Invalid post id'),
});

export const createCommentSchema = z.object({
  content: trimmedString(1000),
});

export const commentsQuerySchema = z.object({
  ...paginationQueryFields,
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type PostIdParams = z.infer<typeof postIdParamsSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CommentsQuery = z.infer<typeof commentsQuerySchema>;
