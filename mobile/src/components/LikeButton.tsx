import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/theme';

interface LikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onPress: () => void;
}

export const LikeButton = ({ isLiked, likeCount, onPress }: LikeButtonProps) => {
  const theme = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: isLiked ? 1.2 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      if (isLiked) {
        Animated.timing(scale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [isLiked, scale]);

  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? `Unlike. ${likeCount} likes` : `Like. ${likeCount} likes`}
      accessibilityState={{ selected: isLiked }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isLiked ? "heart" : "heart-outline"}
          size={20}
          color={isLiked ? theme.like : theme.textSecondary}
          style={styles.actionIcon}
        />
      </Animated.View>
      <Text style={[styles.actionText, { color: isLiked ? theme.like : theme.textSecondary }]}>
        {likeCount}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: 6,
  },
  actionText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
  },
});
