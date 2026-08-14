import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Outfit_400Regular, Outfit_500Medium } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { clearPersistedCache, persistOptions, queryClient } from '../api/queryClient';
import { AuthProvider } from '../store/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { onSessionExpired } from '../utils/authEvents';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const subscription = onSessionExpired(() => void clearPersistedCache());
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && fontError === null) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(main)" />
            </Stack>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
