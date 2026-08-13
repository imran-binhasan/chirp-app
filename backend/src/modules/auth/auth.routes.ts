import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { authLimiter } from '../../common/middleware/rate-limit';
import { validate } from '../../common/middleware/validate';
import * as controller from './auth.controller';
import { loginSchema, logoutSchema, refreshSchema, signupSchema } from './auth.validation';

export const authRouter = Router();

authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), controller.signup);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', authLimiter, validate({ body: refreshSchema }), controller.refresh);
authRouter.post('/logout', authLimiter, validate({ body: logoutSchema }), controller.logout);
authRouter.get('/me', authenticate, controller.me);
