/**
 * Wire types for the Mini Social Feed API, mirroring the backend's response
 * DTOs in `backend/src/docs/dto.ts`.
 */

/** Every endpoint — success and failure — responds in this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: ApiErrorBody | null;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/** Error codes the backend's central handler can emit. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_JSON'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

// ─── Resources ───────────────────────────────────────────────────────────────

/** Public author summary embedded in posts, comments and notifications. */
export interface AuthorSummary {
  id: string;
  username: string;
}

/** The authenticated user (adds fields only they may see). */
export interface User extends AuthorSummary {
  email: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface RefreshResponse {
  tokens: TokenPair;
}

export interface Post {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: AuthorSummary;
  likedByMe: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: AuthorSummary;
}

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

export type NotificationType = 'POST_LIKED' | 'POST_COMMENTED';

export interface Notification {
  id: string;
  type: NotificationType;
  postId: string | null;
  read: boolean;
  createdAt: string;
  actor: AuthorSummary;
}

export interface UnreadCount {
  unread: number;
}

/** Rows the server actually flipped — 0 when the notification was already read. */
export interface MarkReadResult {
  updated: number;
}

export interface Device {
  id: string;
  platform: DevicePlatform;
}

export type DevicePlatform = 'android' | 'ios' | 'web';

// ─── Request shapes ──────────────────────────────────────────────────────────

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  /** Email OR username. */
  identifier: string;
  password: string;
}

export interface FeedParams {
  cursor?: string | null;
  limit?: number;
  username?: string;
}

export interface CursorParams {
  cursor?: string | null;
  limit?: number;
}

// ─── Pagination helpers ──────────────────────────────────────────────────────

/** A single page of a cursor-paginated list, as react-query caches it. */
export interface Page<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** The shape `useInfiniteQuery` builds from successive pages. */
export interface InfiniteData<T> {
  pages: Page<T>[];
  pageParams: unknown[];
}
