import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { queryKeys } from '../../api/queryKeys';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { ScreenContainer } from '../../components/ScreenContainer';
import { UserAvatar } from '../../components/UserAvatar';
import { PostCard } from '../../components/PostCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { useAuth } from '../../store/AuthContext';
import { useLikeMutation } from '../../hooks/useLikeMutation';
import { usePostList } from '../../hooks/usePostList';
import type { Post } from '../../types/api';

export default function ProfileScreen() {
  const theme = useThemeColors();
  const { gutter } = useResponsive();
  const { user, logout } = useAuth();
  const username = user?.username;

  const queryKey = queryKeys.userPosts(username ?? '');
  const { posts, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } =
    usePostList({ queryKey, username, enabled: Boolean(username) });

  const { toggle: toggleLike } = useLikeMutation();

  const renderPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} onLike={toggleLike} />,
    [toggleLike],
  );

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, [logout]);

  if (!user) return null;

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <TouchableOpacity
          onPress={confirmLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          hitSlop={8}
          testID="logout-button"
        >
          <Ionicons name="log-out-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingState label="Loading your chirps" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            <View style={[styles.profileHeader, { borderBottomColor: theme.border }]}>
              <UserAvatar username={user.username} size={80} />
              <Text style={[styles.username, { color: theme.text }]}>@{user.username}</Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                Member since {new Date(user.createdAt).getFullYear()}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="create-outline"
              title="No chirps yet"
              body="Anything you post will show up here."
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
  profileHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  username: { fontFamily: 'Outfit_500Medium', fontSize: 20 },
  meta: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  footer: { margin: 20 },
});
