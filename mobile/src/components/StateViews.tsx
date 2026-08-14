import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../utils/theme';
import { toApiError } from '../api/errors';

/** The three states every list screen needs, so wording and spacing match. */

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.center} testID="loading-state">
      <ActivityIndicator size="large" color={theme.primary} accessibilityLabel={label} />
    </View>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const theme = useThemeColors();
  const apiError = toApiError(error);

  return (
    <View style={styles.center} testID="error-state">
      <Ionicons
        name={apiError.code === 'NETWORK_ERROR' ? 'cloud-offline-outline' : 'alert-circle-outline'}
        size={40}
        color={theme.textSecondary}
      />
      <Text style={[styles.message, { color: theme.text }]}>{apiError.message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={[styles.retryText, { color: theme.primary }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  const theme = useThemeColors();

  return (
    <View style={styles.empty} testID="empty-state">
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: theme.border }]}>
          <Ionicons name={icon} size={30} color={theme.text} />
        </View>
      ) : null}
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  message: { fontFamily: 'Outfit_400Regular', fontSize: 16, textAlign: 'center', lineHeight: 22 },
  retry: { paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontFamily: 'Outfit_500Medium', fontSize: 15 },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 12 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: 'Outfit_500Medium', fontSize: 20, textAlign: 'center' },
  emptyBody: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
