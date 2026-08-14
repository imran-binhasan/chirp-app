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

const listCache = (post: Post): InfiniteData<Post> => ({
  pages: [{ items: [post], pagination: { nextCursor: null, hasMore: false, limit: 20 } }],
  pageParams: [null],
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => jest.clearAllMocks());

describe('useLikeMutation — list mode', () => {
  const key = ['feed'];

  it('applies the like optimistically before the request resolves', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, listCache(makePost()));

    let resolve!: (value: { liked: boolean; likeCount: number }) => void;
    toggleLike.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = await renderHook(() => useLikeMutation(key), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<InfiniteData<Post>>(key);
      expect(cached?.pages[0].items[0].likedByMe).toBe(true);
      expect(cached?.pages[0].items[0].likeCount).toBe(4);
    });

    await act(async () => {
      resolve({ liked: true, likeCount: 4 });
    });
  });

  it('decrements when unliking an already-liked post', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, listCache(makePost({ likedByMe: true, likeCount: 3 })));
    toggleLike.mockResolvedValue({ liked: false, likeCount: 2 });

    const { result } = await renderHook(() => useLikeMutation(key), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<InfiniteData<Post>>(key);
      expect(cached?.pages[0].items[0].likedByMe).toBe(false);
      expect(cached?.pages[0].items[0].likeCount).toBe(2);
    });
  });

  it('rolls the cache back when the request fails', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, listCache(makePost()));
    toggleLike.mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useLikeMutation(key), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<InfiniteData<Post>>(key);
    expect(cached?.pages[0].items[0].likedByMe).toBe(false);
    expect(cached?.pages[0].items[0].likeCount).toBe(3);
  });

  it('touches only the post that was liked', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, {
      pages: [
        {
          items: [makePost({ id: 'p1' }), makePost({ id: 'p2', likeCount: 9 })],
          pagination: { nextCursor: null, hasMore: false, limit: 20 },
        },
      ],
      pageParams: [null],
    });
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result } = await renderHook(() => useLikeMutation(key), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<InfiniteData<Post>>(key);
      expect(cached?.pages[0].items[1].likeCount).toBe(9);
      expect(cached?.pages[0].items[1].likedByMe).toBe(false);
    });
  });

  it('never lets an optimistic count go negative', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, listCache(makePost({ likedByMe: true, likeCount: 0 })));
    toggleLike.mockResolvedValue({ liked: false, likeCount: 0 });

    const { result } = await renderHook(() => useLikeMutation(key), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<InfiniteData<Post>>(key);
      expect(cached?.pages[0].items[0].likeCount).toBe(0);
    });
  });
});

describe('useLikeMutation — detail mode', () => {
  const key = ['post', 'p1'];

  it('updates a single cached post', async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(key, makePost());
    toggleLike.mockResolvedValue({ liked: true, likeCount: 4 });

    const { result } = await renderHook(() => useLikeMutation(key, 'detail'), { wrapper });
    await act(async () => {
      result.current.mutate('p1');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Post>(key);
      expect(cached?.likedByMe).toBe(true);
      expect(cached?.likeCount).toBe(4);
    });
  });
});
