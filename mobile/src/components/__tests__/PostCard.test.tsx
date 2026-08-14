import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PostCard } from '../PostCard';
import type { Post } from '../../types/api';

const { __mockRouter } = jest.requireMock('expo-router') as {
  __mockRouter: { push: jest.Mock };
};

const post: Post = {
  id: 'post-1',
  content: 'Shipping the new feed today',
  likeCount: 4,
  commentCount: 2,
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  author: { id: 'user-1', username: 'jane' },
  likedByMe: false,
};

beforeEach(() => jest.clearAllMocks());

describe('PostCard', () => {
  it('shows the author, body and both counters', async () => {
    await render(<PostCard post={post} onLike={jest.fn()} />);

    expect(screen.getByText(/@jane/)).toBeTruthy();
    expect(screen.getByText('Shipping the new feed today')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('calls onLike with the current post state', async () => {
    const onLike = jest.fn();
    await render(<PostCard post={post} onLike={onLike} />);

    await fireEvent.press(screen.getByLabelText(/^Like\./));

    expect(onLike).toHaveBeenCalledWith(post);
  });

  it('labels the like control by current state for screen readers', async () => {
    const { rerender } = await render(<PostCard post={post} onLike={jest.fn()} />);
    expect(screen.getByLabelText('Like. 4 likes')).toBeTruthy();

    await rerender(<PostCard post={{ ...post, likedByMe: true, likeCount: 5 }} onLike={jest.fn()} />);
    expect(screen.getByLabelText('Unlike. 5 likes')).toBeTruthy();
  });

  it('opens the post when the card is pressed', async () => {
    await render(<PostCard post={post} onLike={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('post-post-1'));

    expect(__mockRouter.push).toHaveBeenCalledWith('/post/post-1');
  });

  it('opens the author profile when the avatar is pressed', async () => {
    await render(<PostCard post={post} onLike={jest.fn()} />);

    await fireEvent.press(screen.getByLabelText("View jane's profile"));

    expect(__mockRouter.push).toHaveBeenCalledWith('/user/jane');
  });

  it('uses singular wording for a single reply', async () => {
    await render(<PostCard post={{ ...post, commentCount: 1 }} onLike={jest.fn()} />);
    expect(screen.getByLabelText('1 reply')).toBeTruthy();
  });

  it('renders a zero-count post without falling back to blanks', async () => {
    await render(
      <PostCard post={{ ...post, likeCount: 0, commentCount: 0 }} onLike={jest.fn()} />,
    );
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});
