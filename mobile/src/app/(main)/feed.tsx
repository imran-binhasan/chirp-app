import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Image, TextInput, ActivityIndicator } from 'react-native';
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
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Post } from '../../types/api';

export default function FeedScreen() {
  const theme = useThemeColors();
  const { gutter } = useResponsive();

  const [searchOpen, setSearchOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const username = useDebouncedValue(usernameInput.trim().toLowerCase());

  const queryKey = useMemo(() => queryKeys.feed(username || undefined), [username]);

  const { posts, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } =
    usePostList({ queryKey, username: username || undefined });

  // A stable callback, so PostCard's React.memo actually holds and scrolling
  // does not re-render every visible row on each parent render.
  const { toggle: toggleLike } = useLikeMutation();

  const renderPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} onLike={toggleLike} />,
    [toggleLike],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setUsernameInput('');
  }, []);

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        {searchOpen ? (
          <View style={[styles.searchBar, { backgroundColor: theme.inputBackground }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Filter by username"
              placeholderTextColor={theme.textSecondary}
              value={usernameInput}
              onChangeText={(value) => setUsernameInput(value.replace(/^@+/, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              accessibilityLabel="Filter feed by username"
              testID="feed-search-input"
            />
            <TouchableOpacity
              onPress={closeSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear username filter"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.slot} />
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Chirp"
            />
            <TouchableOpacity
              onPress={() => setSearchOpen(true)}
              style={styles.slot}
              accessibilityRole="button"
              accessibilityLabel="Filter feed by username"
              hitSlop={8}
              testID="feed-search-button"
            >
              <Ionicons name="search" size={22} color={theme.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {username ? (
        <View style={[styles.notice, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
            Showing chirps from <Text style={{ color: theme.text }}>@{username}</Text>
          </Text>
        </View>
      ) : null}

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
              title={username ? `No chirps from @${username}` : 'No chirps yet'}
              body={
                username
                  ? 'Try a different username, or clear the filter to see everyone.'
                  : 'Be the first to post something.'
              }
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
  slot: { width: 40, alignItems: 'flex-end' },
  logo: { width: 36, height: 36 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 15, height: '100%' },
  notice: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  noticeText: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  footer: { margin: 20 },
});
