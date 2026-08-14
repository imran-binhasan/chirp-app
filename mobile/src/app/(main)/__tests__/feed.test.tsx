import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import FeedScreen from '../feed';
import { postsApi } from '../../../api/endpoints';
import type { Page, Post } from '../../../types/api';

jest.mock('../../../api/endpoints', () => ({
  postsApi: { feed: jest.fn(), toggleLike: jest.fn() },
}));

// FlashList's virtualization doesn't measure in the test renderer; a plain
// list keeps every row mounted so queries can find them.
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

const feed = postsApi.feed as jest.MockedFunction<typeof postsApi.feed>;

const makePost = (id: string, username: string, content: string): Post => ({
  id,
  content,
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date().toISOString(),
  author: { id: `u-${username}`, username },
  likedByMe: false,
});

const page = (items: Post[]): Page<Post> => ({
  items,
  pagination: { nextCursor: null, hasMore: false, limit: 20 },
});

function renderFeed() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeedScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

// The filter input debounces by 350ms; allow real time to pass rather than
// faking timers, which conflicts with RNTL's waitFor scheduling.
const DEBOUNCE_TIMEOUT = { timeout: 2000 };

describe('FeedScreen', () => {
  it('renders the posts returned by the API', async () => {
    feed.mockResolvedValue(page([makePost('p1', 'jane', 'first chirp')]));

    await renderFeed();

    expect(await screen.findByText('first chirp')).toBeTruthy();
    expect(feed).toHaveBeenCalledWith(expect.objectContaining({ username: undefined }));
  });

  it('shows an empty state when nobody has posted', async () => {
    feed.mockResolvedValue(page([]));

    await renderFeed();

    expect(await screen.findByText('No chirps yet')).toBeTruthy();
  });

  it('surfaces a failure with a retry control', async () => {
    feed.mockRejectedValue(new Error('offline'));

    await renderFeed();

    expect(await screen.findByTestId('error-state')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });

  it('opens a search field when the filter button is pressed', async () => {
    feed.mockResolvedValue(page([makePost('p1', 'jane', 'hello')]));
    await renderFeed();
    await screen.findByText('hello');

    await fireEvent.press(screen.getByTestId('feed-search-button'));

    expect(screen.getByTestId('feed-search-input')).toBeTruthy();
  });

  it('filters the feed by username — the requirement this screen exists for', async () => {
    feed.mockResolvedValue(page([makePost('p1', 'jane', 'hello')]));
    await renderFeed();
    await screen.findByText('hello');

    await fireEvent.press(screen.getByTestId('feed-search-button'));
    await fireEvent.changeText(screen.getByTestId('feed-search-input'), 'Jane');

    // Debounced, so this asserts the eventual call rather than an immediate one.
    await waitFor(
      () => expect(feed).toHaveBeenCalledWith(expect.objectContaining({ username: 'jane' })),
      DEBOUNCE_TIMEOUT,
    );
  });

  it('tells the user when a filtered feed has no results', async () => {
    feed.mockResolvedValue(page([]));
    await renderFeed();

    await fireEvent.press(screen.getByTestId('feed-search-button'));
    await fireEvent.changeText(screen.getByTestId('feed-search-input'), 'ghost');

    expect(await screen.findByText('No chirps from @ghost', {}, DEBOUNCE_TIMEOUT)).toBeTruthy();
  });

  it('clears the filter and returns to the full feed', async () => {
    feed.mockResolvedValue(page([makePost('p1', 'jane', 'hello')]));
    await renderFeed();
    await screen.findByText('hello');

    await fireEvent.press(screen.getByTestId('feed-search-button'));
    await fireEvent.changeText(screen.getByTestId('feed-search-input'), 'jane');
    await waitFor(
      () => expect(feed).toHaveBeenCalledWith(expect.objectContaining({ username: 'jane' })),
      DEBOUNCE_TIMEOUT,
    );

    await fireEvent.press(screen.getByLabelText('Clear username filter'));

    expect(screen.queryByTestId('feed-search-input')).toBeNull();
    await waitFor(
      () => expect(feed).toHaveBeenLastCalledWith(expect.objectContaining({ username: undefined })),
      DEBOUNCE_TIMEOUT,
    );
  });
});
