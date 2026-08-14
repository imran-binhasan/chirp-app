import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { notificationsApi } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { timeAgo } from '../../utils/timeAgo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { UserAvatar } from '../../components/UserAvatar';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { Notification, Page } from '../../types/api';

export default function InboxScreen() {
  const theme = useThemeColors();
  const { gutter, avatarSize } = useResponsive();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<Page<Notification>>({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) =>
      notificationsApi.list({ cursor: pageParam as string | null, limit: 20 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
  });

  const notifications = query.data?.pages.flatMap((page) => page.items) ?? [];

  // Reading no longer mutates server-side, so the app decides when the user
  // has actually seen the list and clears the badge itself.
  const markRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount }),
  });

  const hasUnread = notifications.some((item) => !item.read);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (hasUnread && !dismissed && !markRead.isPending) {
      setDismissed(true);
      markRead.mutate();
    }
  }, [hasUnread, dismissed, markRead]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setDismissed(false);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => {
      const isLike = item.type === 'POST_LIKED';
      const action = isLike ? 'liked your chirp' : 'replied to your chirp';

      return (
        <TouchableOpacity
          style={[
            styles.row,
            {
              borderBottomColor: theme.border,
              paddingHorizontal: gutter,
              backgroundColor: item.read ? theme.background : theme.unreadHighlight,
            },
          ]}
          onPress={() => item.postId && router.push(`/post/${item.postId}`)}
          disabled={!item.postId}
          accessibilityRole="button"
          accessibilityLabel={`${item.actor.username} ${action}, ${timeAgo(item.createdAt)} ago`}
        >
          <View style={styles.iconSlot}>
            <Ionicons
              name={isLike ? 'heart' : 'chatbubble'}
              size={22}
              color={isLike ? theme.like : theme.primary}
            />
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push(`/user/${item.actor.username}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.actor.username}'s profile`}
          >
            <UserAvatar username={item.actor.username} size={avatarSize} />
          </TouchableOpacity>
          <View style={styles.body}>
            <Text style={[styles.text, { color: theme.text }]}>
              <Text style={styles.bold}>{item.actor.username}</Text> {action}{' '}
              <Text style={{ color: theme.textSecondary }}>· {timeAgo(item.createdAt)}</Text>
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [theme, router, gutter, avatarSize],
  );

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Ping</Text>
      </View>

      {query.isLoading ? (
        <LoadingState label="Loading notifications" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <FlashList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              body="When someone likes or replies to your chirps, it shows up here — and on your device as a push notification."
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={theme.primary} />
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: 'Outfit_500Medium', fontSize: 20 },
  row: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  iconSlot: { width: 30, alignItems: 'flex-end', marginRight: 12 },
  avatar: { marginRight: 12 },
  body: { flex: 1, justifyContent: 'center' },
  text: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21 },
  bold: { fontFamily: 'Outfit_500Medium' },
  footer: { margin: 20 },
});
