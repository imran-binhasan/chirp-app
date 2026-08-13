import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { devicesRouter } from './modules/devices/devices.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { postsRouter } from './modules/posts/posts.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/posts', postsRouter);
v1Router.use('/devices', devicesRouter);
v1Router.use('/notifications', notificationsRouter);
