import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useThemeColors } from '../utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Redirect href="/(main)/feed" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.iconPlaceholder}>
          {/* Represents the minimalist bird icon */}
          <Text style={{ fontSize: 64, color: theme.text }}>🐦</Text>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Welcome to Chirp</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          A serene space for your thoughts. Join the conversation today.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Log In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconPlaceholder: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 32,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  primaryButton: {
    height: 56,
    borderRadius: 999, // Pill shape
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 18,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 18,
  },
});
