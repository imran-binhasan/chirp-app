import React from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState, ErrorState, LoadingState } from '../StateViews';
import { ApiError } from '../../api/errors';

function networkError(): AxiosError {
  return new AxiosError('Network Error');
}

function serverError(status: number, message: string): AxiosError {
  const error = new AxiosError('failed');
  error.response = {
    status,
    statusText: '',
    data: {
      success: false,
      data: null,
      error: { code: 'CONFLICT', message },
      meta: { requestId: 'r', timestamp: '' },
    },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('LoadingState', () => {
  it('exposes an accessible label for the spinner', async () => {
    await render(<LoadingState label="Loading feed" />);
    expect(screen.getByLabelText('Loading feed')).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('shows the user-facing message from an ApiError', async () => {
    await render(
      <ErrorState error={new ApiError({ message: 'Post not found', code: 'NOT_FOUND' })} />,
    );
    expect(screen.getByText('Post not found')).toBeTruthy();
  });

  it('normalizes a raw axios failure rather than showing its internals', async () => {
    await render(<ErrorState error={networkError()} />);

    expect(screen.queryByText('Network Error')).toBeNull();
    expect(screen.getByText(/connection/i)).toBeTruthy();
  });

  it('shows an offline icon for network failures', async () => {
    await render(<ErrorState error={networkError()} />);
    expect(screen.getByTestId('icon-cloud-offline-outline')).toBeTruthy();
  });

  it('calls onRetry when the user taps Try again', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={networkError()} onRetry={onRetry} />);

    await fireEvent.press(screen.getByLabelText('Try again'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry control when no handler is given', async () => {
    await render(<ErrorState error={serverError(409, 'Already exists')} />);
    expect(screen.queryByLabelText('Try again')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders a title with optional body and icon', async () => {
    await render(
      <EmptyState icon="notifications-outline" title="All caught up" body="Nothing new here." />,
    );

    expect(screen.getByText('All caught up')).toBeTruthy();
    expect(screen.getByText('Nothing new here.')).toBeTruthy();
    expect(screen.getByTestId('icon-notifications-outline')).toBeTruthy();
  });

  it('renders with a title alone', async () => {
    await render(<EmptyState title="No replies yet" />);
    expect(screen.getByText('No replies yet')).toBeTruthy();
  });
});
