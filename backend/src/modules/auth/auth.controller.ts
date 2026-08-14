import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as authService from './auth.service';
import type { LoginInput, RefreshInput, SignupInput } from './auth.validation';

export const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body as SignupInput);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, result, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body as LoginInput);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh((req.body as RefreshInput).refreshToken);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout((req.body as RefreshInput).refreshToken);
  sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, user);
});
