import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLikeMutation } from '../useLikeMutation';
import { postsApi } from '../../api/endpoints';
import type { InfiniteData, Post } from '../../types/api';

jest.mock('../../api/endpoints', () => ({
  postsApi: { toggleLike: jest.fn() },
}));

const toggleLike = postsApi.toggleLike as jest.MockedFunction<typeof postsApi.toggleLike>;

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: 'p1',
  content: 'hello',
  likeCount: 3,
  commentCount: 0,
  createdAt: '2026-08-14T00:00:00.000Z',
  author: { id: 'u1', username: 'jane' },
  likedByMe: false,
  ...overrides,
});

const listCache = (...posts: Post[]): InfiniteData<Post> => ({
  pages: [{ items: posts, pagination: { nextCursor: null, hasMore: false, limit: 20 } }],
  pageParams: [null],
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const firstItem = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryData<InfiniteData<Post>>(key)?.pages[0].items[0];

beforeEach(() => jest.clearAllMocks());

describe('useLikeMutation', () => {
  const feedKey = ['feed'];

  it('applies the like optimistically before the request resolves', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost()));

    let resolve!: (value: { liked: boolean; likeCount: number }) => void;
    toggleLike.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => {
      expect(firstItem(queryClient, feedKey)?.likedByMe).toBe(true);
      expect(firstItem(queryClient, feedKey)?.likeCount).toBe(4);
    });

    await act(async () => {
      resolve({ liked: true, likeCount: 4 });
    });
  });

  it('decrements when unliking an already-liked post', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost({ likedByMe: true, likeCount: 3 })));
    toggleLike.mockResolvedValue({ liked: false, likeCount: 2 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: false });
    });

    await waitFor(() => {
      expect(firstItem(queryClient, feedKey)?.likedByMe).toBe(false);
      expect(firstItem(queryClient, feedKey)?.likeCount).toBe(2);
    });
  });

  it('rolls every touched cache back when the request fails', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost()));
    queryClient.setQueryData(['post', 'p1'], makePost());
    toggleLike.mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(firstItem(queryClient, feedKey)?.likedByMe).toBe(false);
    expect(firstItem(queryClient, feedKey)?.likeCount).toBe(3);
    expect(queryClient.getQueryData<Post>(['post', 'p1'])?.likedByMe).toBe(false);
    expect(queryClient.getQueryData<Post>(['post', 'p1'])?.likeCount).toBe(3);
  });

  it('touches only the post that was liked', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(
      feedKey,
      listCache(makePost({ id: 'p1' }), makePost({ id: 'p2', likeCount: 9 })),
    );
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => {
      const items = queryClient.getQueryData<InfiniteData<Post>>(feedKey)?.pages[0].items;
      expect(items?.[1].likeCount).toBe(9);
      expect(items?.[1].likedByMe).toBe(false);
    });
  });

  it('never lets an optimistic count go negative', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost({ likedByMe: true, likeCount: 0 })));
    toggleLike.mockResolvedValue({ liked: false, likeCount: 0 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: false });
    });

    await waitFor(() => expect(firstItem(queryClient, feedKey)?.likeCount).toBe(0));
  });

  it('adopts the server count even when it disagrees with the optimistic guess', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost({ likeCount: 3 })));
    // Two other people liked the same post while this request was in flight.
    toggleLike.mockResolvedValue({ liked: true, likeCount: 6 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(firstItem(queryClient, feedKey)?.likeCount).toBe(6);
  });

  it('updates the same post in every cache that holds it', async () => {
    const { queryClient, wrapper } = setup();
    const post = makePost();
    queryClient.setQueryData(['feed'], listCache(post));
    queryClient.setQueryData(['feed', 'jane'], listCache(post));
    queryClient.setQueryData(['userPosts', 'jane'], listCache(post));
    queryClient.setQueryData(['post', 'p1'], post);
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const key of [['feed'], ['feed', 'jane'], ['userPosts', 'jane']]) {
      expect(firstItem(queryClient, key)?.likedByMe).toBe(true);
      expect(firstItem(queryClient, key)?.likeCount).toBe(4);
    }
    expect(queryClient.getQueryData<Post>(['post', 'p1'])?.likedByMe).toBe(true);
    expect(queryClient.getQueryData<Post>(['post', 'p1'])?.likeCount).toBe(4);
  });

  it('updates a post cached only as a detail entry', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(['post', 'p1'], makePost());
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result } = await renderHook(() => useLikeMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ postId: 'p1', liked: true });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Post>(['post', 'p1']);
      expect(cached?.likedByMe).toBe(true);
      expect(cached?.likeCount).toBe(4);
    });
  });

  it('exposes a stable `toggle` that flips the post it is handed', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(feedKey, listCache(makePost({ likedByMe: false })));
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result, rerender } = await renderHook(() => useLikeMutation(), { wrapper });
    const firstToggle = result.current.toggle;
    rerender({});
    // List rows are memoized on this identity — if it changed per render,
    // every visible PostCard would re-render on every parent render.
    expect(result.current.toggle).toBe(firstToggle);

    await act(async () => {
      result.current.toggle(makePost({ likedByMe: false }));
    });

    await waitFor(() => expect(toggleLike).toHaveBeenCalledWith('p1', true));
  });
});
