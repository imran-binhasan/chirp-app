import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import { ScreenContainer } from './ScreenContainer';
import { LoadingState } from './StateViews';

/**
 * Auth gate for screens outside the `(main)` tab group. `/post/[id]` and
 * `/user/[username]` are reachable by deep link with no session at all, and
 * would otherwise render, fire authenticated requests, and answer themselves
 * with a 401 instead of sending the visitor to sign in.
 *
 * Children stay unmounted until the session is known, so their queries never
 * fire against an empty Authorization header on a cold start.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading" />
      </ScreenContainer>
    );
  }

  if (!user) return <Redirect href="/welcome" />;

  return <>{children}</>;
}
