import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { errorMessage } from '../../api/errors';
import { useThemeColors } from '../../utils/theme';
import { useResponsive } from '../../utils/responsive';
import { ScreenContainer } from '../../components/ScreenContainer';

const MAX_LENGTH = 2000;
const WARN_AT = 1900;

export default function CreateScreen() {
  const theme = useThemeColors();
  const router = useRouter();
  const { gutter } = useResponsive();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const createMutation = useMutation({
    mutationFn: (text: string) => postsApi.create(text),
    onSuccess: () => {
      setContent('');
      Keyboard.dismiss();
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userPostsAll });
      router.navigate('/(main)/feed');
    },
  });

  const trimmed = content.trim();
  const remaining = MAX_LENGTH - content.length;
  // maxLength already caps the input, so emptiness is all that is left to guard.
  const isInvalid = trimmed.length === 0;

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingHorizontal: gutter }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New chirp</Text>
        <TouchableOpacity
          style={[styles.button, { opacity: isInvalid || createMutation.isPending ? 0.5 : 1 }]}
          disabled={isInvalid || createMutation.isPending}
          onPress={() => createMutation.mutate(trimmed)}
          accessibilityRole="button"
          accessibilityLabel="Publish chirp"
          accessibilityState={{ disabled: isInvalid, busy: createMutation.isPending }}
          testID="publish-button"
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Chirp</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.body, { paddingHorizontal: gutter }]}
      >
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="What's happening?"
          placeholderTextColor={theme.textSecondary}
          multiline
          autoFocus
          maxLength={MAX_LENGTH}
          value={content}
          onChangeText={setContent}
          accessibilityLabel="Chirp text"
          testID="compose-input"
        />

        <View style={styles.statusRow}>
          {createMutation.isError ? (
            <Text style={[styles.error, { color: theme.danger }]} accessibilityRole="alert">
              {errorMessage(createMutation.error)}
            </Text>
          ) : (
            <View />
          )}
          <Text
            style={[
              styles.counter,
              { color: content.length > WARN_AT ? theme.danger : theme.textSecondary },
            ]}
          >
            {remaining}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: 'Outfit_500Medium', fontSize: 20 },
  button: {
    backgroundColor: '#37B4E2',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 74,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontFamily: 'Outfit_500Medium', fontSize: 14 },
  body: { flex: 1, paddingTop: 16 },
  input: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    fontSize: 20,
    lineHeight: 28,
    textAlignVertical: 'top',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  error: { fontFamily: 'Outfit_400Regular', fontSize: 13, flex: 1 },
  counter: { fontFamily: 'Outfit_400Regular', fontSize: 14, fontVariant: ['tabular-nums'] },
});
