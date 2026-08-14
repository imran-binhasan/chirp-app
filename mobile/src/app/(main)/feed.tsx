import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { queryKeys } from '../../api/queryKeys';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { ScreenContainer } from '../../components/ScreenContainer';
import { PostCard } from '../../components/PostCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { useLikeMutation } from '../../hooks/useLikeMutation';
import { usePostList } from '../../hooks/usePostList';
import type { Post } from '../../types/api';

export default function FeedScreen() {
  const theme = useThemeColors();
  const { gutter } = useResponsive();

  const queryKey = queryKeys.feed();

  const { posts, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } =
    usePostList({ queryKey });

  const likeMutation = useLikeMutation(queryKey);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onLike={(id) => likeMutation.mutate(id)} />
    ),
    [likeMutation],
  );

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <View style={styles.slot} />
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Chirp"
        />
        <View style={styles.slot} />
      </View>

      {isLoading ? (
        <LoadingState label="Loading feed" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No chirps yet"
              body="Be the first to post something."
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
  slot: { width: 40 },
  logo: { width: 36, height: 36 },
  footer: { margin: 20 },
});