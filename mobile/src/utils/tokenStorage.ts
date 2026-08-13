import * as SecureStore from 'expo-secure-store';

/**
 * Single owner of every credential key. Screens and interceptors go through
 * these helpers so a key is never spelled out (and mistyped) in two places.
 */
const ACCESS_TOKEN = 'accessToken';
const REFRESH_TOKEN = 'refreshToken';
const PUSH_TOKEN = 'devicePushToken';

export const getAccessToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(ACCESS_TOKEN);

export const getRefreshToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(REFRESH_TOKEN);

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN);
}

/** Kept so logout can unregister this device from push on the server. */
export const getPushToken = (): Promise<string | null> => SecureStore.getItemAsync(PUSH_TOKEN);

export const savePushToken = (token: string): Promise<void> =>
  SecureStore.setItemAsync(PUSH_TOKEN, token);

export const clearPushToken = (): Promise<void> => SecureStore.deleteItemAsync(PUSH_TOKEN);
