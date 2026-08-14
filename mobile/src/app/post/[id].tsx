import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { postsApi } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { errorMessage } from '../../api/errors';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { timeAgo } from '../../utils/timeAgo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ParsedText } from '../../components/ParsedText';
import { UserAvatar } from '../../components/UserAvatar';
import { LikeButton } from '../../components/LikeButton';
import { RequireAuth } from '../../components/RequireAuth';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { useLikeMutation } from '../../hooks/useLikeMutation';
import type { Comment, Page } from '../../types/api';

/** Reachable by deep link and by a push-notification tap — hence the gate. */
export default function PostDetailRoute() {
  return (
    <RequireAuth>
      <PostDetailScreen />
    </RequireAuth>
  );
}

function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const postId = params.id ?? '';
  const router = useRouter();
  const theme = useThemeColors();
  const { gutter, avatarSize } = useResponsive();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const postQuery = useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: () => postsApi.byId(postId),
    enabled: Boolean(postId),
  });

  const commentsQuery = useInfiniteQuery<Page<Comment>>({
    queryKey: queryKeys.comments(postId),
    queryFn: ({ pageParam }) =>
      postsApi.comments(postId, { cursor: pageParam as string | null, limit: 20 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    enabled: Boolean(postId),
  });

  const { toggle: toggleLike } = useLikeMutation();

  const commentMutation = useMutation({
    mutationFn: (content: string) => postsApi.addComment(postId, content),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      // The header's commentCount lives on this query.
      void queryClient.invalidateQueries({ queryKey: queryKeys.post(postId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userPostsAll });
    },
  });

  const post = postQuery.data;
  const comments = commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const loadMore = useCallback(() => {
    if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
      void commentsQuery.fetchNextPage();
    }
  }, [commentsQuery]);

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <View style={[styles.row, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push(`/user/${item.author.username}`)}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.author.username}'s profile`}
        >
          <UserAvatar username={item.author.username} size={32} />
        </TouchableOpacity>
        <View style={styles.rowBody}>
          <Text style={[styles.username, { color: theme.text }]}>
            @{item.author.username}{' '}
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              · {timeAgo(item.createdAt)}
            </Text>
          </Text>
          <ParsedText style={[styles.body, { color: theme.text }]} text={item.content} />
        </View>
      </View>
    ),
    [theme, router, gutter],
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Chirp</Text>
        <View style={styles.slot} />
      </View>

      {postQuery.isLoading ? (
        <LoadingState label="Loading chirp" />
      ) : postQuery.isError || !post ? (
        <ErrorState error={postQuery.error} onRetry={postQuery.refetch} />
      ) : (
        <FlashList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={[styles.post, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={() => router.push(`/user/${post.author.username}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${post.author.username}'s profile`}
              >
                <UserAvatar username={post.author.username} size={avatarSize} />
              </TouchableOpacity>
              <View style={styles.rowBody}>
                <Text style={[styles.username, { color: theme.text }]}>
                  @{post.author.username}{' '}
                  <Text style={[styles.muted, { color: theme.textSecondary }]}>
                    · {timeAgo(post.createdAt)}
                  </Text>
                </Text>
                <ParsedText
                  style={[styles.body, { color: theme.text }, styles.postBody]}
                  text={post.content}
                />
                <View style={styles.actions}>
                  <LikeButton
                    isLiked={post.likedByMe}
                    likeCount={post.likeCount}
                    onPress={() => toggleLike(post)}
                  />
                  <Text style={[styles.muted, { color: theme.textSecondary }]}>
                    {post.commentCount} {post.commentCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            commentsQuery.isLoading ? (
              <LoadingState label="Loading replies" />
            ) : (
              <EmptyState title="No replies yet" body="Start the conversation below." />
            )
          }
          ListFooterComponent={
            commentsQuery.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} color={theme.primary} />
            ) : null
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {commentMutation.isError ? (
          <Text style={[styles.replyError, { color: theme.danger }]} accessibilityRole="alert">
            {errorMessage(commentMutation.error)}
          </Text>
        ) : null}
        <View
          style={[
            styles.composer,
            { borderTopColor: theme.border, backgroundColor: theme.background, paddingHorizontal: gutter },
          ]}
        >
          <TextInput
            style={[styles.composerInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
            placeholder="Post your reply"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            multiline
            accessibilityLabel="Write a reply"
            testID="reply-input"
          />
          <TouchableOpacity
            style={[
              styles.replyButton,
              { opacity: !draft.trim() || commentMutation.isPending ? 0.5 : 1 },
            ]}
            disabled={!draft.trim() || commentMutation.isPending}
            onPress={() => commentMutation.mutate(draft.trim())}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            testID="reply-submit"
          >
            {commentMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.replyButtonText}>Reply</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  post: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { marginRight: 10 },
  rowBody: { flex: 1 },
  username: { fontFamily: 'Outfit_500Medium', fontSize: 15 },
  muted: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21 },
  postBody: { marginVertical: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 },
  footer: { margin: 20 },
  replyError: { fontFamily: 'Outfit_400Regular', fontSize: 13, paddingHorizontal: 16, paddingBottom: 6 },
  composer: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    gap: 12,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
  },
  replyButton: {
    backgroundColor: '#37B4E2',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 2,
    minWidth: 72,
    alignItems: 'center',
  },
  replyButtonText: { color: '#fff', fontFamily: 'Outfit_500Medium', fontSize: 14 },
});
