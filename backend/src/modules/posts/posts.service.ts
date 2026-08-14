import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error';
import { buildPagination, keysetWhere } from '../../common/pagination';
import { prisma } from '../../lib/prisma';
import {
  recordPostInteractionNotification,
  schedulePostInteractionPush,
  type PostInteractionNotification,
} from '../notifications/notifications.service';
import { authorSelect } from '../users/user.select';
import type {
  CommentsQuery,
  CreateCommentInput,
  CreatePostInput,
  FeedQuery,
  LikeInput,
} from './posts.validation';

const authorRelation = { author: { select: authorSelect } } as const;

type PostWithAuthor = Prisma.PostGetPayload<{ include: typeof authorRelation }>;
type CommentWithAuthor = Prisma.CommentGetPayload<{ include: typeof authorRelation }>;

function toPostResponse(post: PostWithAuthor, likedPostIds: Set<string>) {
  return {
    id: post.id,
    content: post.content,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    likedByMe: likedPostIds.has(post.id),
  };
}

function toCommentResponse(comment: CommentWithAuthor) {
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
  };
}

/** One indexed batch query per page — no N+1 when rendering `likedByMe`. */
async function getLikedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const likes = await prisma.like.findMany({
    where: { userId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(likes.map((like) => like.postId));
}

export async function createPost(authorId: string, input: CreatePostInput) {
  const post = await prisma.post.create({
    data: { authorId, content: input.content },
    include: authorRelation,
  });
  return toPostResponse(post, new Set());
}

export async function getFeed(query: FeedQuery, viewerId: string) {
  const { limit, cursor, username } = query;

  const posts = await prisma.post.findMany({
    where: {
      ...(username ? { author: { username: username.toLowerCase() } } : {}),
      ...keysetWhere(cursor),
    },
    include: authorRelation,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const { page, pagination } = buildPagination(posts, limit);
  const likedPostIds = await getLikedPostIds(
    viewerId,
    page.map((post) => post.id),
  );

  return { items: page.map((post) => toPostResponse(post, likedPostIds)), pagination };
}

export async function getPostById(postId: string, viewerId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: authorRelation });
  if (!post) throw new NotFoundError('Post not found');
  const likedPostIds = await getLikedPostIds(viewerId, [postId]);
  return toPostResponse(post, likedPostIds);
}

/**
 * Sends `liked` explicitly for retry-safe behaviour; omitting it toggles.
 * State changes are serialised under a row lock — the unique constraint alone
 * prevents duplicate rows but still lets concurrent toggles surface a P2002.
 */
export async function toggleLike(userId: string, postId: string, input: LikeInput = {}) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "posts" WHERE "id" = ${postId} FOR UPDATE`;
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { authorId: true, likeCount: true },
    });
    if (!post) throw new NotFoundError('Post not found');

    const existing = await tx.like.findUnique({ where: { userId_postId: { userId, postId } } });
    const shouldLike = input.liked ?? !existing;

    if (existing && !shouldLike) {
      await tx.like.delete({ where: { userId_postId: { userId, postId } } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return {
        liked: false,
        likeCount: updated.likeCount,
        authorId: post.authorId,
        actorUsername: null as string | null,
        notification: null as PostInteractionNotification | null,
      };
    }

    if (existing) {
      return {
        liked: true,
        likeCount: post.likeCount,
        authorId: post.authorId,
        actorUsername: null as string | null,
        notification: null as PostInteractionNotification | null,
      };
    }

    const created = await tx.like.create({
      data: { userId, postId },
      include: { user: { select: { username: true } } },
    });
    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    const candidate: PostInteractionNotification | null =
      post.authorId === userId
        ? null
        : {
            type: 'POST_LIKED',
            recipientId: post.authorId,
            actorId: userId,
            actorUsername: created.user.username,
            postId,
          };
    // Only push when the inbox row was new; a re-like is not worth a second buzz.
    const announced = candidate ? await recordPostInteractionNotification(tx, candidate) : false;

    return {
      liked: true,
      likeCount: updated.likeCount,
      authorId: post.authorId,
      actorUsername: created.user.username,
      notification: announced ? candidate : null,
    };
  });

  if (result.notification) schedulePostInteractionPush(result.notification);

  return { liked: result.liked, likeCount: result.likeCount };
}

export async function addComment(userId: string, postId: string, input: CreateCommentInput) {
  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundError('Post not found');
    const created = await tx.comment.create({
      data: { postId, authorId: userId, content: input.content },
      include: authorRelation,
    });
    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    const notification: PostInteractionNotification | null =
      post.authorId === userId
        ? null
        : {
            type: 'POST_COMMENTED',
            recipientId: post.authorId,
            actorId: userId,
            actorUsername: created.author.username,
            postId,
            commentPreview: created.content.slice(0, 80),
          };
    if (notification) await recordPostInteractionNotification(tx, notification);
    return { comment: created, notification };
  });

  if (result.notification) schedulePostInteractionPush(result.notification);

  return toCommentResponse(result.comment);
}

export async function getComments(postId: string, query: CommentsQuery) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new NotFoundError('Post not found');

  const { limit, cursor } = query;
  const comments = await prisma.comment.findMany({
    where: { postId, ...keysetWhere(cursor) },
    include: authorRelation,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const { page, pagination } = buildPagination(comments, limit);
  return { items: page.map(toCommentResponse), pagination };
}
