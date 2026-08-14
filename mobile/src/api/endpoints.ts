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
  MarkReadResult,
  Notification,
  Page,
  Post,
  SignupRequest,
  UnreadCount,
  User,
} from '../types/api';

/** Every API route the app calls. Screens import these instead of URL strings. */

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

  toggleLike: (postId: string, liked: boolean) => post<LikeResult>(`/posts/${postId}/like`, { liked }),

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

  markRead: (notificationId: string) =>
    post<MarkReadResult>(`/notifications/${notificationId}/read`),

  markAllRead: () => post<MarkReadResult>('/notifications/read'),
};

export const devicesApi = {
  register: (token: string, platform: DevicePlatform) =>
    post<Device>('/devices', { token, platform }),

  unregister: (token: string) => del<{ message: string }>('/devices', { token }),
};
