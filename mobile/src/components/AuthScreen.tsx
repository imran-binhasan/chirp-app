import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useThemeColors } from '../utils/theme';
import { ScreenContainer } from './ScreenContainer';

interface AuthScreenProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Form-level failure (not tied to one field), e.g. wrong credentials. */
  formError?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled: boolean;
  footerPrompt: string;
  footerAction: string;
  onFooterPress: () => void;
}

/** Shared chrome for login and signup — identical apart from their fields. */
export function AuthScreen({
  title,
  subtitle,
  children,
  formError,
  submitLabel,
  submittingLabel,
  onSubmit,
  isSubmitting,
  disabled,
  footerPrompt,
  footerAction,
  onFooterPress,
}: AuthScreenProps) {
  const theme = useThemeColors();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          </View>

          <View style={styles.form}>{children}</View>

          {formError ? (
            <View
              style={[styles.banner, { backgroundColor: theme.inputBackground }]}
              accessibilityRole="alert"
              testID="form-error"
            >
              <Text style={[styles.bannerText, { color: theme.danger }]}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submit,
                { backgroundColor: theme.primary, opacity: disabled || isSubmitting ? 0.5 : 1 },
              ]}
              onPress={onSubmit}
              disabled={disabled || isSubmitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: disabled || isSubmitting, busy: isSubmitting }}
              accessibilityLabel={submitLabel}
              testID="submit-button"
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.primaryText} size="small" style={styles.spinner} />
              ) : null}
              <Text style={[styles.submitText, { color: theme.primaryText }]}>
                {isSubmitting ? submittingLabel : submitLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={onFooterPress}
              accessibilityRole="link"
              accessibilityLabel={footerAction}
            >
              <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                {footerPrompt}{' '}
                <Text style={{ color: theme.text, fontFamily: 'Outfit_500Medium' }}>
                  {footerAction}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },
  header: { marginTop: 32, marginBottom: 36 },
  title: { fontFamily: 'Outfit_500Medium', fontSize: 32, marginBottom: 8 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 16 },
  form: { gap: 20 },
  banner: { marginTop: 20, padding: 14, borderRadius: 10 },
  bannerText: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20 },
  footer: { marginTop: 'auto', paddingTop: 32 },
  submit: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  spinner: { marginRight: 8 },
  submitText: { fontFamily: 'Outfit_500Medium', fontSize: 18 },
  link: { alignItems: 'center' },
  linkText: { fontFamily: 'Outfit_400Regular', fontSize: 16 },
});
