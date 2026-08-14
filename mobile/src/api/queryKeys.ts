/**
 * Every cache key in the app. Invalidation only works when writer and reader
 * spell the key identically, and the `as const` tuples make a mismatch a
 * compile error rather than a silently stale screen.
 */
export const queryKeys = {
  /** Matches every feed variant, filtered or not — use to invalidate all. */
  feedAll: ['feed'] as const,
  feed: (username?: string) => (username ? (['feed', username] as const) : (['feed'] as const)),

  /** Matches every user's post list. */
  userPostsAll: ['userPosts'] as const,
  userPosts: (username: string) => ['userPosts', username] as const,

  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string) => ['comments', postId] as const,

  notifications: ['notifications'] as const,
  unreadCount: ['unreadCount'] as const,
} as const;

/** Keys holding post lists — the ones a new post or like must invalidate. */
export const postListKeys = [queryKeys.feedAll, queryKeys.userPostsAll] as const;
