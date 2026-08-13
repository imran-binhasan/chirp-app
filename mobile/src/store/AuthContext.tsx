import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, devicesApi } from '../api/endpoints';
import { onSessionExpired } from '../utils/authEvents';
import {
  clearPushToken,
  clearTokens,
  getAccessToken,
  getPushToken,
  getRefreshToken,
  saveTokens,
} from '../utils/tokenStorage';

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadSession = async () => {
      try {
        if (await getAccessToken()) {
          setUser(await authApi.me());
        }
      } catch {
        // Token is unusable and the interceptor could not rescue it.
        await clearTokens();
      } finally {
        setLoading(false);
      }
    };
    void loadSession();
  }, []);

  // The interceptor clears storage but cannot touch React state — do it here,
  // otherwise the app keeps rendering an authenticated shell with no tokens.
  useEffect(() => {
    const subscription = onSessionExpired(() => setUser(null));
    return () => subscription.remove();
  }, []);

  const login = useCallback(
    async (accessToken: string, refreshToken: string, userData: User) => {
      await saveTokens(accessToken, refreshToken);
      setUser(userData);
    },
    [],
  );

  const logout = useCallback(async () => {
    // Clear state first so the UI never blocks on a network round-trip.
    setUser(null);
    queryClient.clear();

    const [refreshToken, pushToken] = await Promise.all([getRefreshToken(), getPushToken()]);

    // Best-effort server cleanup: revoke the refresh token so it cannot be
    // replayed for the next 30 days, and stop this device receiving pushes
    // meant for the account that just signed out.
    await Promise.allSettled([
      pushToken ? devicesApi.unregister(pushToken) : Promise.resolve(),
      refreshToken ? authApi.logout(refreshToken) : Promise.resolve(),
    ]);

    await Promise.all([clearTokens(), clearPushToken()]);
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
