import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go dropped remote push in SDK 53, and the module now throws while being
 * evaluated — a static import would take down every route that reaches it, not
 * just the push path. Detect the host up front and never require it there.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === AppOwnership.Expo;

/** Push needs a raw FCM token, which only a development build or the APK can mint. */
export const isPushSupported = !isExpoGo;

// `undefined` means "not resolved yet", `null` means "resolved to unavailable".
let cached: NotificationsModule | null | undefined;

/** Null means "run without push", not "something went wrong". */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (!isPushSupported) {
    console.log('Push notifications need a development build — skipped in Expo Go.');
    cached = null;
    return cached;
  }

  try {
    // A require, not an import: it must not run until the host is known good.
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
