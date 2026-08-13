import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as controller from './posts.controller';
import {
  commentsQuerySchema,
  createCommentSchema,
  createPostSchema,
  feedQuerySchema,
  postIdParamsSchema,
} from './posts.validation';

export const postsRouter = Router();

postsRouter.use(authenticate);

postsRouter.post('/', validate({ body: createPostSchema }), controller.createPost);
postsRouter.get('/', validate({ query: feedQuerySchema }), controller.getFeed);
postsRouter.get('/:id', validate({ params: postIdParamsSchema }), controller.getPost);

postsRouter.post('/:id/like', validate({ params: postIdParamsSchema }), controller.toggleLike);

postsRouter.post(
  '/:id/comments',
  validate({ params: postIdParamsSchema, body: createCommentSchema }),
  controller.addComment,
);
// Alias: the task spec uses singular `/comment`, so support both forms.
postsRouter.post(
  '/:id/comment',
  validate({ params: postIdParamsSchema, body: createCommentSchema }),
  controller.addComment,
);
postsRouter.get(
  '/:id/comments',
  validate({ params: postIdParamsSchema, query: commentsQuerySchema }),
  controller.getComments,
);
