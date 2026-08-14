import { useCallback, useState } from 'react';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { postsApi } from '../api/endpoints';
import type { Page, Post } from '../types/api';

interface UsePostListOptions {
  queryKey: QueryKey;
  /** Restrict to one author. Omit for the global feed. */
  username?: string;
  enabled?: boolean;
}

/**
 * The cursor-paginated post list behind the feed, your profile and any user's
 * page. All three differ only by cache key and author filter.
 */
export function usePostList({ queryKey, username, enabled = true }: UsePostListOptions) {
  const query = useInfiniteQuery<Page<Post>>({
    queryKey,
    queryFn: ({ pageParam }) =>
      postsApi.feed({ cursor: pageParam as string | null, limit: 20, username }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const posts: Post[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  return { ...query, posts, refreshing, onRefresh, loadMore };
}
