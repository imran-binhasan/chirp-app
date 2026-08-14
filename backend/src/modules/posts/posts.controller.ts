import type { Request } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as postsService from './posts.service';
import type {
  CommentsQuery,
  CreateCommentInput,
  CreatePostInput,
  FeedQuery,
  LikeInput,
  PostIdParams,
} from './posts.validation';

// Express 5 types params loosely; validate() has already parsed them as uuids.
const postId = (req: Request): string => (req.params as unknown as PostIdParams).id;

export const createPost = asyncHandler(async (req, res) => {
  const post = await postsService.createPost(req.user!.id, req.body as CreatePostInput);
  sendSuccess(res, post, 201);
});

export const getFeed = asyncHandler(async (req, res) => {
  const { items, pagination } = await postsService.getFeed(
    req.query as unknown as FeedQuery,
    req.user!.id,
  );
  sendSuccess(res, items, 200, pagination);
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await postsService.getPostById(postId(req), req.user!.id);
  sendSuccess(res, post);
});

export const toggleLike = asyncHandler(async (req, res) => {
  const result = await postsService.toggleLike(
    req.user!.id,
    postId(req),
    req.body as LikeInput,
  );
  sendSuccess(res, result);
});

export const addComment = asyncHandler(async (req, res) => {
  const comment = await postsService.addComment(
    req.user!.id,
    postId(req),
    req.body as CreateCommentInput,
  );
  sendSuccess(res, comment, 201);
});

export const getComments = asyncHandler(async (req, res) => {
  const { items, pagination } = await postsService.getComments(
    postId(req),
    req.query as unknown as CommentsQuery,
  );
  sendSuccess(res, items, 200, pagination);
});
