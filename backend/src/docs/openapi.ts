import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  signupSchema,
} from '../modules/auth/auth.validation';
import { deviceTokenParamsSchema, registerDeviceSchema } from '../modules/devices/devices.validation';
import { notificationsQuerySchema } from '../modules/notifications/notifications.validation';
import {
  commentsQuerySchema,
  createCommentSchema,
  createPostSchema,
  feedQuerySchema,
  postIdParamsSchema,
} from '../modules/posts/posts.validation';
import {
  authResponseDto,
  commentDto,
  deviceDto,
  errorEnvelope,
  likeResultDto,
  markReadResultDto,
  messageDto,
  notificationDto,
  postDto,
  refreshResponseDto,
  successEnvelope,
  unreadCountDto,
  userSelfDto,
} from './dto';

/**
 * The OpenAPI document is GENERATED from the same zod schemas that validate
 * incoming requests — documentation and validation can never drift apart.
 */

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Short-lived access token returned by /auth/signup, /auth/login or /auth/refresh.',
});

const bearer = [{ bearerAuth: [] }];

const jsonBody = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const ok = (description: string, schema: z.ZodType) => ({
  description,
  content: { 'application/json': { schema: successEnvelope(schema) } },
});
const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorEnvelope } },
});

// ─── Auth ────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/auth/signup',
  tags: ['Auth'],
  summary: 'Create an account',
  request: { body: jsonBody(signupSchema) },
  responses: {
    201: ok('Account created — user and token pair', authResponseDto),
    400: err('Validation error'),
    409: err('Username or email already taken'),
    429: err('Rate limited'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in with email or username',
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: ok('Authenticated — user and token pair', authResponseDto),
    400: err('Validation error'),
    401: err('Invalid credentials'),
    429: err('Rate limited'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the token pair',
  description:
    'Issues a new access + refresh token and revokes the presented refresh token. ' +
    'Presenting an already-rotated token revokes all sessions of that user (reuse detection).',
  request: { body: jsonBody(refreshSchema) },
  responses: {
    200: ok('New token pair', refreshResponseDto),
    400: err('Validation error'),
    401: err('Invalid, expired, or reused refresh token'),
    429: err('Rate limited'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Revoke a refresh token (idempotent)',
  request: { body: jsonBody(logoutSchema) },
  responses: {
    200: ok('Logged out', messageDto),
    400: err('Validation error'),
    429: err('Rate limited'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Get the authenticated user',
  security: bearer,
  responses: {
    200: ok('Current user', userSelfDto),
    401: err('Missing/invalid access token'),
  },
});

// ─── Posts ───────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/posts',
  tags: ['Posts'],
  summary: 'Create a text-only post (max 2000 characters)',
  security: bearer,
  request: { body: jsonBody(createPostSchema) },
  responses: {
    201: ok('Post created', postDto),
    400: err('Validation error'),
    401: err('Missing/invalid access token'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/posts',
  tags: ['Posts'],
  summary: 'Get the feed — newest first, cursor-paginated, optional username filter',
  security: bearer,
  request: { query: feedQuerySchema },
  responses: {
    200: ok('Page of posts (meta.pagination carries nextCursor/hasMore)', z.array(postDto)),
    400: err('Invalid cursor or query'),
    401: err('Missing/invalid access token'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/posts/{id}',
  tags: ['Posts'],
  summary: 'Get a single post',
  security: bearer,
  request: { params: postIdParamsSchema },
  responses: {
    200: ok('Post', postDto),
    401: err('Missing/invalid access token'),
    404: err('Post not found'),
  },
});

// ─── Interactions ────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/posts/{id}/like',
  tags: ['Interactions'],
  summary: 'Toggle like on a post',
  description:
    'Idempotent toggle: first call likes, second call un-likes. The response carries the ' +
    'authoritative state. Liking someone else\'s post sends them an FCM push notification.',
  security: bearer,
  request: { params: postIdParamsSchema },
  responses: {
    200: ok('Authoritative like state', likeResultDto),
    401: err('Missing/invalid access token'),
    404: err('Post not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/posts/{id}/comments',
  tags: ['Interactions'],
  summary: 'Add a comment (max 1000 characters)',
  security: bearer,
  request: { params: postIdParamsSchema, body: jsonBody(createCommentSchema) },
  responses: {
    201: ok('Comment created', commentDto),
    400: err('Validation error'),
    401: err('Missing/invalid access token'),
    404: err('Post not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/posts/{id}/comment',
  tags: ['Interactions'],
  summary: 'Add a comment — singular alias (max 1000 characters)',
  security: bearer,
  request: { params: postIdParamsSchema, body: jsonBody(createCommentSchema) },
  responses: {
    201: ok('Comment created', commentDto),
    400: err('Validation error'),
    401: err('Missing/invalid access token'),
    404: err('Post not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/posts/{id}/comments',
  tags: ['Interactions'],
  summary: 'Get comments — newest first, cursor-paginated',
  security: bearer,
  request: { params: postIdParamsSchema, query: commentsQuerySchema },
  responses: {
    200: ok('Page of comments', z.array(commentDto)),
    400: err('Invalid cursor or query'),
    401: err('Missing/invalid access token'),
    404: err('Post not found'),
  },
});

// ─── Devices ─────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post',
  path: '/devices',
  tags: ['Devices'],
  summary: 'Register (or refresh) an FCM device token for push notifications',
  security: bearer,
  request: { body: jsonBody(registerDeviceSchema) },
  responses: {
    200: ok('Device registered', deviceDto),
    400: err('Validation error'),
    401: err('Missing/invalid access token'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/devices/{token}',
  tags: ['Devices'],
  summary: 'Unregister an FCM device token on logout (idempotent)',
  security: bearer,
  request: { params: deviceTokenParamsSchema },
  responses: {
    200: ok('Device unregistered', messageDto),
    401: err('Missing/invalid access token'),
  },
});

// ─── Notifications ───────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get',
  path: '/notifications',
  tags: ['Notifications'],
  summary: 'List your notifications, newest first (cursor-paginated)',
  description:
    'Read-only — this does NOT mark anything as read. Call POST /notifications/read for that.',
  security: bearer,
  request: { query: notificationsQuerySchema },
  responses: {
    200: ok('A page of notifications', z.array(notificationDto)),
    400: err('Validation error'),
    401: err('Missing/invalid access token'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/notifications/unread-count',
  tags: ['Notifications'],
  summary: 'Number of unread notifications (for the inbox badge)',
  security: bearer,
  responses: {
    200: ok('Unread count', unreadCountDto),
    401: err('Missing/invalid access token'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/notifications/read',
  tags: ['Notifications'],
  summary: 'Mark all of your notifications as read (idempotent)',
  security: bearer,
  responses: {
    200: ok('Number of rows updated', markReadResultDto),
    401: err('Missing/invalid access token'),
  },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Mini Social Feed API',
      version: '1.0.0',
      description:
        'REST API for the Mini Social Feed app. All responses share one envelope: ' +
        '`{ success, data, error, meta }`. List endpoints are cursor-paginated ' +
        '(`meta.pagination.nextCursor`).',
    },
    servers: [{ url: '/api/v1' }],
  });
}
