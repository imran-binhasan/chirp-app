import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi, devicesApi } from '../../api/endpoints';
import { emitSessionExpired } from '../../utils/authEvents';
import {
  clearPushToken,
  clearTokens,
  getAccessToken,
  getPushToken,
  getRefreshToken,
  savePushToken,
  saveTokens,
} from '../../utils/tokenStorage';
import type { User } from '../../types/api';

jest.mock('../../api/endpoints', () => ({
  authApi: { me: jest.fn(), logout: jest.fn() },
  devicesApi: { unregister: jest.fn() },
}));

const me = authApi.me as jest.MockedFunction<typeof authApi.me>;
const logout = authApi.logout as jest.MockedFunction<typeof authApi.logout>;
const unregister = devicesApi.unregister as jest.MockedFunction<typeof devicesApi.unregister>;

const user: User = {
  id: 'u1',
  username: 'jane',
  email: 'jane@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await clearTokens();
  await clearPushToken();
  logout.mockResolvedValue({ message: 'ok' });
  unregister.mockResolvedValue({ message: 'ok' });
});

describe('AuthProvider — boot', () => {
  it('stays signed out when there is no stored token', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(me).not.toHaveBeenCalled();
  });

  it('restores the session from a stored token', async () => {
    await saveTokens('access-1', 'refresh-1');
    me.mockResolvedValue(user);

    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(result.current.loading).toBe(false);
  });

  it('discards an unusable token rather than looping on it', async () => {
    await saveTokens('access-bad', 'refresh-bad');
    me.mockRejectedValue(new Error('401'));

    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(await getAccessToken()).toBeNull();
  });
});

describe('AuthProvider — login', () => {
  it('persists both tokens and sets the user', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('access-1', 'refresh-1', user);
    });

    expect(result.current.user).toEqual(user);
    expect(await getAccessToken()).toBe('access-1');
    expect(await getRefreshToken()).toBe('refresh-1');
  });
});

describe('AuthProvider — logout', () => {
  it('revokes the refresh token and unregisters the device server-side', async () => {
    await saveTokens('access-1', 'refresh-1');
    await savePushToken('fcm-1');
    me.mockResolvedValue(user);

    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.logout();
    });

    // Without these the token stays valid for 30 days and the phone keeps
    // receiving pushes for an account that has signed out.
    expect(logout).toHaveBeenCalledWith('refresh-1');
    expect(unregister).toHaveBeenCalledWith('fcm-1');

    expect(result.current.user).toBeNull();
    expect(await getAccessToken()).toBeNull();
    expect(await getPushToken()).toBeNull();
  });

  it('still clears local state when the server calls fail', async () => {
    await saveTokens('access-1', 'refresh-1');
    me.mockResolvedValue(user);
    logout.mockRejectedValue(new Error('offline'));
    unregister.mockRejectedValue(new Error('offline'));

    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(await getAccessToken()).toBeNull();
  });
});

describe('AuthProvider — involuntary expiry', () => {
  it('clears the user when the interceptor reports the session is gone', async () => {
    await saveTokens('access-1', 'refresh-1');
    me.mockResolvedValue(user);

    const { wrapper } = setup();
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    // The interceptor clears storage, then fires this. If the provider ignores
    // it the app keeps rendering an authenticated shell with no tokens — the
    // dead-end state users had to force-quit out of.
    await act(async () => {
      emitSessionExpired();
    });

    await waitFor(() => expect(result.current.user).toBeNull());
  });
});
