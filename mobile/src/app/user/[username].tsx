import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { queryKeys } from '../../api/queryKeys';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { ScreenContainer } from '../../components/ScreenContainer';
import { UserAvatar } from '../../components/UserAvatar';
import { PostCard } from '../../components/PostCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { useLikeMutation } from '../../hooks/useLikeMutation';
import { usePostList } from '../../hooks/usePostList';
import type { Post } from '../../types/api';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ username: string }>();
  const username = params.username ?? '';
  const theme = useThemeColors();
  const router = useRouter();
  const { gutter } = useResponsive();

  const queryKey = queryKeys.userPosts(username);
  const { posts, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } =
    usePostList({ queryKey, username, enabled: Boolean(username) });

  const likeMutation = useLikeMutation(queryKey);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onLike={(id) => likeMutation.mutate(id)} />
    ),
    [likeMutation],
  );

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>@{username}</Text>
        <View style={styles.slot} />
      </View>

      {isLoading ? (
        <LoadingState label={`Loading chirps from ${username}`} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            <View style={[styles.profileHeader, { borderBottomColor: theme.border }]}>
              <UserAvatar username={username} size={80} />
              <Text style={[styles.username, { color: theme.text }]}>@{username}</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="person-outline"
              title="Nothing here yet"
              body={`@${username} hasn't posted any chirps.`}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: 'Outfit_500Medium', fontSize: 20 },
  slot: { width: 24 },
  profileHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  username: { fontFamily: 'Outfit_500Medium', fontSize: 20 },
  footer: { margin: 20 },
});
