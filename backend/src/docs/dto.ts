import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

/**
 * Response DTOs. These mirror what the services return and give the generated
 * OpenAPI spec accurate response shapes and examples.
 *
 * Keep these in step with `modules/users/user.select.ts` — that select is what
 * actually determines the fields on the wire.
 */

export const authorSummaryDto = z
  .object({
    id: z.uuid(),
    username: z.string().openapi({ example: 'janedoe' }),
  })
  .openapi('AuthorSummary');

export const userSelfDto = z
  .object({
    ...authorSummaryDto.shape,
    email: z.email().openapi({ example: 'jane@example.com' }),
    createdAt: z.iso.datetime(),
  })
  .openapi('UserSelf');

export const tokensDto = z
  .object({
    accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
    refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
    accessTokenExpiresIn: z.number().int().openapi({ example: 900 }),
    refreshTokenExpiresIn: z.number().int().openapi({ example: 2592000 }),
  })
  .openapi('TokenPair');

export const authResponseDto = z
  .object({
    user: userSelfDto,
    tokens: tokensDto,
  })
  .openapi('AuthResponse');

export const refreshResponseDto = z
  .object({
    tokens: tokensDto,
  })
  .openapi('RefreshResponse');

export const messageDto = z
  .object({
    message: z.string().openapi({ example: 'Logged out successfully' }),
  })
  .openapi('Message');

export const postDto = z
  .object({
    id: z.uuid(),
    content: z.string().openapi({ example: 'Just shipped our new feature!' }),
    likeCount: z.number().int().openapi({ example: 3 }),
    commentCount: z.number().int().openapi({ example: 1 }),
    createdAt: z.iso.datetime(),
    author: authorSummaryDto,
    likedByMe: z.boolean().openapi({ example: false }),
  })
  .openapi('Post');

export const commentDto = z
  .object({
    id: z.uuid(),
    postId: z.uuid(),
    content: z.string().openapi({ example: 'Congrats, great work!' }),
    createdAt: z.iso.datetime(),
    author: authorSummaryDto,
  })
  .openapi('Comment');

export const likeResultDto = z
  .object({
    liked: z.boolean().openapi({ example: true }),
    likeCount: z.number().int().openapi({ example: 4 }),
  })
  .openapi('LikeResult');

export const deviceDto = z
  .object({
    id: z.uuid(),
    platform: z.string().openapi({ example: 'android' }),
  })
  .openapi('Device');

export const notificationDto = z
  .object({
    id: z.uuid(),
    type: z.enum(['POST_LIKED', 'POST_COMMENTED']).openapi({ example: 'POST_LIKED' }),
    postId: z.uuid().nullable(),
    read: z.boolean().openapi({ example: false }),
    createdAt: z.iso.datetime(),
    actor: authorSummaryDto,
  })
  .openapi('Notification');

export const unreadCountDto = z
  .object({
    unread: z.number().int().openapi({ example: 3 }),
  })
  .openapi('UnreadCount');

export const markReadResultDto = z
  .object({
    updated: z.number().int().openapi({ example: 3 }),
  })
  .openapi('MarkReadResult');

export const paginationMetaDto = z
  .object({
    nextCursor: z.string().nullable().openapi({ example: 'eyJjIjoiMjAyNi0...' }),
    hasMore: z.boolean().openapi({ example: true }),
    limit: z.number().int().openapi({ example: 20 }),
  })
  .openapi('PaginationMeta');

export const metaDto = z.object({
  requestId: z.string().openapi({ example: '3f6b9c2e-7d21-4c5f-9a1b-2c3d4e5f6a7b' }),
  timestamp: z.iso.datetime(),
  pagination: paginationMetaDto.optional(),
});

/** Wraps any data schema in the uniform success envelope. */
export const successEnvelope = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.literal(true).openapi({ example: true }),
    data,
    error: z.null(),
    meta: metaDto,
  });

export const errorEnvelope = z
  .object({
    success: z.literal(false).openapi({ example: false }),
    data: z.null(),
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'Request validation failed' }),
      details: z
        .array(z.object({ field: z.string(), message: z.string() }))
        .optional()
        .openapi({ example: [{ field: 'email', message: 'Invalid email address' }] }),
    }),
    meta: metaDto,
  })
  .openapi('ErrorResponse');
