import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go dropped remote-push support with SDK 53, and the module now throws
 * while it is being evaluated — a static `import` therefore takes down every
 * route that transitively imports it, not just the push code path. Detect the
 * client up front so the module is never required there.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === AppOwnership.Expo;

/** Push needs a raw FCM token, which only a development build or the APK can mint. */
export const isPushSupported = !isExpoGo;

// `undefined` means "not resolved yet", `null` means "resolved to unavailable".
let cached: NotificationsModule | null | undefined;

/**
 * Returns expo-notifications, or null when push is unavailable. Callers must
 * treat null as "run without push" rather than as an error.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (!isPushSupported) {
    console.log('Push notifications need a development build — skipped in Expo Go.');
    cached = null;
    return cached;
  }

  try {
    // Deliberately a require: it must not run until we know the host supports it.
    const notifications = require('expo-notifications') as NotificationsModule;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = notifications;
  } catch (error: unknown) {
    console.warn(
      'expo-notifications is unavailable:',
      error instanceof Error ? error.message : String(error),
    );
    cached = null;
  }

  return cached;
}
