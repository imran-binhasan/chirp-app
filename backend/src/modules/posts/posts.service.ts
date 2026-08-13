import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error';
import { buildPagination, keysetWhere } from '../../common/pagination';
import { prisma } from '../../lib/prisma';
import { notifyPostInteraction } from '../notifications/notifications.service';
import { authorSelect } from '../users/user.select';
import type {
  CommentsQuery,
  CreateCommentInput,
  CreatePostInput,
  FeedQuery,
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
 * Like toggle. The @@unique([userId, postId]) constraint makes this
 * idempotent and race-proof; the counter moves in the same transaction so
 * feeds read counts in O(1).
 */
export async function toggleLike(userId: string, postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) throw new NotFoundError('Post not found');

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({ where: { userId_postId: { userId, postId } } });

    if (existing) {
      await tx.like.delete({ where: { userId_postId: { userId, postId } } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: updated.likeCount, actorUsername: null as string | null };
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
    return { liked: true, likeCount: updated.likeCount, actorUsername: created.user.username };
  });

  if (result.liked && post.authorId !== userId && result.actorUsername) {
    await notifyPostInteraction({
      type: 'POST_LIKED',
      recipientId: post.authorId,
      actorId: userId,
      actorUsername: result.actorUsername,
      postId,
    });
  }

  return { liked: result.liked, likeCount: result.likeCount };
}

export async function addComment(userId: string, postId: string, input: CreateCommentInput) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) throw new NotFoundError('Post not found');

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { postId, authorId: userId, content: input.content },
      include: authorRelation,
    });
    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    return created;
  });

  if (post.authorId !== userId) {
    await notifyPostInteraction({
      type: 'POST_COMMENTED',
      recipientId: post.authorId,
      actorId: userId,
      actorUsername: comment.author.username,
      postId,
      commentPreview: comment.content.slice(0, 80),
    });
  }

  return toCommentResponse(comment);
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
