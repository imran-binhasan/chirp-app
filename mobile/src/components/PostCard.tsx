import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LikeButton } from './LikeButton';
import { ParsedText } from './ParsedText';
import { UserAvatar } from './UserAvatar';
import { useThemeColors } from '../utils/theme';
import { useResponsive } from '../utils/responsive';
import { timeAgo } from '../utils/timeAgo';
import type { Post } from '../types/api';

interface PostCardProps {
  post: Post;
  onLike: (post: Post) => void;
}

export const PostCard = React.memo(({ post, onLike }: PostCardProps) => {
  const theme = useThemeColors();
  const router = useRouter();
  const { gutter, avatarSize } = useResponsive();

  const handleLike = useCallback(() => onLike(post), [onLike, post]);
  const handlePostPress = useCallback(() => router.push(`/post/${post.id}`), [router, post.id]);
  const handleAvatarPress = useCallback(
    () => router.push(`/user/${post.author.username}`),
    [router, post.author.username],
  );

  return (
    <TouchableOpacity
      style={[styles.postContainer, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}
      onPress={handlePostPress}
      accessibilityRole="button"
      accessibilityLabel={`Chirp by ${post.author.username}: ${post.content}`}
      testID={`post-${post.id}`}
    >
      <TouchableOpacity
        style={styles.avatar}
        onPress={handleAvatarPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${post.author.username}'s profile`}
      >
        <UserAvatar username={post.author.username} size={avatarSize} />
      </TouchableOpacity>

      <View style={styles.postContent}>
        <TouchableOpacity style={styles.postHeader} onPress={handleAvatarPress}>
          <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>
            @{post.author.username}{' '}
            <Text style={{ color: theme.textSecondary }}>· {timeAgo(post.createdAt)}</Text>
          </Text>
        </TouchableOpacity>

        <ParsedText style={[styles.bodyText, { color: theme.text }]} text={post.content} />

        <View style={styles.actionRow}>
          <LikeButton isLiked={post.likedByMe} likeCount={post.likeCount} onPress={handleLike} />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePostPress}
            accessibilityRole="button"
            accessibilityLabel={`${post.commentCount} ${post.commentCount === 1 ? 'reply' : 'replies'}`}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>
              {post.commentCount}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

PostCard.displayName = 'PostCard';

const styles = StyleSheet.create({
  postContainer: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { marginRight: 10 },
  postContent: { flex: 1 },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    flexShrink: 1,
  },
  bodyText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
  },
});
