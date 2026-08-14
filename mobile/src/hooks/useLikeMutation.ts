import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { postsApi } from '../api/endpoints';
import { postListKeys, queryKeys } from '../api/queryKeys';
import type { InfiniteData, LikeResult, Page, Post } from '../types/api';

interface LikeVariables {
  postId: string;
  liked: boolean;
}

interface LikeContext {
  /** Every cache entry we touched, so a failure can put all of them back. */
  snapshots: [QueryKey, unknown][];
}

type PostUpdater = (post: Post) => Post;

const optimistic =
  (likedByMe: boolean): PostUpdater =>
  (post) =>
    post.likedByMe === likedByMe
      ? post
      : { ...post, likedByMe, likeCount: Math.max(0, post.likeCount + (likedByMe ? 1 : -1)) };

/** The server's count is authoritative — it has seen every other user's taps. */
const authoritative =
  (result: LikeResult): PostUpdater =>
  (post) =>
    post.likedByMe === result.liked && post.likeCount === result.likeCount
      ? post
      : { ...post, likedByMe: result.liked, likeCount: result.likeCount };

interface HoldingCaches {
  lists: QueryKey[];
  detail: QueryKey | null;
}

/**
 * Every cache holding this post. Several screens render the same post at once,
 * so updating only the tapped one leaves the rest showing a stale heart.
 */

function cachesHolding(queryClient: QueryClient, postId: string): HoldingCaches {
  const lists: QueryKey[] = [];

  for (const listKey of postListKeys) {
    // A prefix match: ['feed'] also covers ['feed', 'janedoe'].
    for (const [key, data] of queryClient.getQueriesData<InfiniteData<Post>>({
      queryKey: listKey,
    })) {
      if (data?.pages.some((page) => page.items.some((post) => post.id === postId))) {
        lists.push(key);
      }
    }
  }

  const detailKey = queryKeys.post(postId);
  const detail = queryClient.getQueryData<Post>(detailKey) ? detailKey : null;

  return { lists, detail };
}

/** Every cache key the post lives in, for cancellation. */
const allKeys = ({ lists, detail }: HoldingCaches): QueryKey[] =>
  detail ? [...lists, detail] : lists;

/**
 * Rewrites the post across the given caches, snapshotting each first so a
 * failure can restore them. Lists and the detail entry hold different shapes,
 * hence tracking them separately rather than inspecting keys.
 */
function updateEverywhere(
  queryClient: QueryClient,
  caches: HoldingCaches,
  postId: string,
  apply: PostUpdater,
): [QueryKey, unknown][] {
  const snapshots: [QueryKey, unknown][] = [];

  for (const key of caches.lists) {
    const data = queryClient.getQueryData<InfiniteData<Post>>(key);
    if (!data) continue;
    snapshots.push([key, data]);
    queryClient.setQueryData<InfiniteData<Post>>(key, {
      ...data,
      pages: data.pages.map((page: Page<Post>) =>
        page.items.some((post) => post.id === postId)
          ? {
              ...page,
              items: page.items.map((post) => (post.id === postId ? apply(post) : post)),
            }
          : page,
      ),
    });
  }

  if (caches.detail) {
    const detail = queryClient.getQueryData<Post>(caches.detail);
    if (detail) {
      snapshots.push([caches.detail, detail]);
      queryClient.setQueryData<Post>(caches.detail, apply(detail));
    }
  }

  return snapshots;
}

/**
 * Optimistic like toggle shared by every screen that renders posts. `toggle`
 * is a stable reference, so memoized list rows stay memoized.
 */
export function useLikeMutation() {
  const queryClient = useQueryClient();

  const mutation = useMutation<LikeResult, unknown, LikeVariables, LikeContext>({
    mutationFn: ({ postId, liked }) => postsApi.toggleLike(postId, liked),

    onMutate: async ({ postId, liked }) => {
      const caches = cachesHolding(queryClient, postId);
      // Stops an in-flight refetch landing on top of the optimistic value.
      // Scoped to this post's caches so liking never aborts unrelated pagination.
      await Promise.all(
        allKeys(caches).map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );

      return { snapshots: updateEverywhere(queryClient, caches, postId, optimistic(liked)) };
    },

    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    // Writing the server's answer in directly keeps counts honest without
    // refetching every loaded page. Keys are re-resolved because a new page
    // may have arrived while the request was in flight.
    onSuccess: (result, { postId }) => {
      const caches = cachesHolding(queryClient, postId);
      updateEverywhere(queryClient, caches, postId, authoritative(result));
    },
  });

  const { mutate } = mutation;
  const toggle = useCallback(
    (post: Post) => mutate({ postId: post.id, liked: !post.likedByMe }),
    [mutate],
  );

  return { ...mutation, toggle };
}
