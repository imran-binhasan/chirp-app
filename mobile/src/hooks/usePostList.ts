import { useCallback, useMemo, useState } from 'react';
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
 * page — all three differ only by cache key and author filter.
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

  // Destructured so the callbacks below depend on react-query's stable
  // identities, not on `query` — a new object each render, which would defeat
  // every downstream React.memo.
  const { data, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const posts = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, posts, refreshing, onRefresh, loadMore };
}
