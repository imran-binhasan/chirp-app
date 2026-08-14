import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { RequireAuth } from '../RequireAuth';
import { useAuth } from '../../store/AuthContext';

jest.mock('../../store/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const session = (over: Partial<ReturnType<typeof useAuth>>) =>
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    ...over,
  });

const child = <Text>protected content</Text>;

beforeEach(() => jest.clearAllMocks());

describe('RequireAuth', () => {
  it('renders the screen once a session is present', async () => {
    session({ user: { id: 'u1', username: 'jane', email: 'j@e.com', createdAt: 'now' } });

    await render(<RequireAuth>{child}</RequireAuth>);

    expect(screen.getByText('protected content')).toBeTruthy();
  });

  it('holds the screen back while the session is still resolving', async () => {
    session({ loading: true });

    await render(<RequireAuth>{child}</RequireAuth>);

    // Mounting the children here would fire their queries with no token yet.
    expect(screen.queryByText('protected content')).toBeNull();
    expect(screen.getByTestId('loading-state')).toBeTruthy();
  });

  it('redirects a signed-out visitor instead of rendering the screen', async () => {
    session({ user: null, loading: false });

    await render(<RequireAuth>{child}</RequireAuth>);

    // A deep link (push tap, chirp:// URL) must not reach an authenticated
    // screen and answer itself with a 401 error state.
    expect(screen.queryByText('protected content')).toBeNull();
  });
});
