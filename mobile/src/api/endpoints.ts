import { del, get, getPage, post } from './client';
import type {
  AuthResponse,
  Comment,
  CursorParams,
  Device,
  DevicePlatform,
  FeedParams,
  LikeResult,
  LoginRequest,
  Notification,
  Page,
  Post,
  SignupRequest,
  UnreadCount,
  User,
} from '../types/api';

/**
 * Every API route the app calls, in one place. Screens import these instead of
 * writing URL strings, so a route change is a one-line edit and every call site
 * is typed end to end.
 */

export const authApi = {
  signup: (body: SignupRequest) => post<AuthResponse>('/auth/signup', body),
  login: (body: LoginRequest) => post<AuthResponse>('/auth/login', body),
  logout: (refreshToken: string) => post<{ message: string }>('/auth/logout', { refreshToken }),
  me: () => get<User>('/auth/me'),
};

export const postsApi = {
  feed: (params: FeedParams): Promise<Page<Post>> =>
    getPage<Post>('/posts', {
      cursor: params.cursor,
      limit: params.limit ?? 20,
      username: params.username,
    }),

  byId: (postId: string) => get<Post>(`/posts/${postId}`),

  create: (content: string) => post<Post>('/posts', { content }),

  toggleLike: (postId: string) => post<LikeResult>(`/posts/${postId}/like`),

  comments: (postId: string, params: CursorParams): Promise<Page<Comment>> =>
    getPage<Comment>(`/posts/${postId}/comments`, {
      cursor: params.cursor,
      limit: params.limit ?? 20,
    }),

  addComment: (postId: string, content: string) =>
    post<Comment>(`/posts/${postId}/comments`, { content }),
};

export const notificationsApi = {
  list: (params: CursorParams): Promise<Page<Notification>> =>
    getPage<Notification>('/notifications', {
      cursor: params.cursor,
      limit: params.limit ?? 20,
    }),

  unreadCount: () => get<UnreadCount>('/notifications/unread-count'),

  markAllRead: () => post<{ updated: number }>('/notifications/read'),
};

export const devicesApi = {
  register: (token: string, platform: DevicePlatform) =>
    post<Device>('/devices', { token, platform }),

  unregister: (token: string) => del<{ message: string }>(`/devices/${encodeURIComponent(token)}`),
};
