import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/**
 * The query client and its disk persister live here, not in the root layout,
 * so code outside the React tree — logout, the interceptor's session-expired
 * handler — can drop the persisted cache too. A cache on disk belongs to the
 * account that wrote it and must not survive into the next sign-in.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * Post lists only, so the feed renders instantly on a cold boot. The inbox and
 * account data are never written to disk. Persisted rows still carry this
 * account's `likedByMe`, which is why sign-out clears them.
 */
const shouldPersistQuery = (query: { queryKey: readonly unknown[] }): boolean =>
  query.queryKey[0] === 'feed' || query.queryKey[0] === 'userPosts';

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: asyncStoragePersister,
  buster: 'public-feed-cache-v2',
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

/**
 * `clear()` alone is not enough: the persister writes on a throttle, so an app
 * killed inside that window leaves the previous account's feed on disk.
 */
export async function clearPersistedCache(): Promise<void> {
  queryClient.clear();
  await asyncStoragePersister.removeClient();
}
