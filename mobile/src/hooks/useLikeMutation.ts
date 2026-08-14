import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { postsApi } from '../api/endpoints';
import type { InfiniteData, LikeResult, Page, Post } from '../types/api';

interface LikeContext {
  previous: unknown;
}

const applyToggle = (post: Post): Post => {
  const likedByMe = !post.likedByMe;
  return {
    ...post,
    likedByMe,
    likeCount: Math.max(0, post.likeCount + (likedByMe ? 1 : -1)),
  };
};

/**
 * Optimistic like toggle shared by every screen that renders posts.
 *
 * @param queryKey the cache entry to update — a feed/profile list, or one post
 * @param mode     'list' for infinite-query caches, 'detail' for a single post
 */
export function useLikeMutation(queryKey: QueryKey, mode: 'list' | 'detail' = 'list') {
  const queryClient = useQueryClient();

  return useMutation<LikeResult, unknown, string, LikeContext>({
    mutationFn: (postId: string) => postsApi.toggleLike(postId),

    onMutate: async (postId) => {
      // Stop any in-flight refetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      if (mode === 'list') {
        queryClient.setQueryData<InfiniteData<Post>>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: Page<Post>) => ({
              ...page,
              items: page.items.map((post) => (post.id === postId ? applyToggle(post) : post)),
            })),
          };
        });
      } else {
        queryClient.setQueryData<Post>(queryKey, (old) => (old ? applyToggle(old) : old));
      }

      return { previous };
    },

    onError: (_error, _postId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
