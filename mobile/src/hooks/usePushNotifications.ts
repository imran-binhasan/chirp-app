import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/endpoints';
import { queryKeys } from '../api/queryKeys';
import { getNotifications } from '../utils/notifications';
import { savePushToken } from '../utils/tokenStorage';

/** Payload the backend attaches to every like/comment push. */
interface PushData {
  type?: string;
  postId?: string;
  actorUsername?: string;
}

async function registerDevice(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Interactions',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#37B4E2',
    });
  }

  // Emulators and simulators cannot receive push messages.
  if (!Device.isDevice) return;

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.status === 'granted'
      ? true
      : (await Notifications.requestPermissionsAsync()).status === 'granted';
  if (!granted) return;

  // getDevicePushTokenAsync returns the raw FCM token, which is what the
  // backend's firebase-admin sendEachForMulticast expects.
  const { data: token } = await Notifications.getDevicePushTokenAsync();

  await devicesApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android');
  // Remembered so logout can unregister this device server-side.
  await savePushToken(token);
}

export function usePushNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    registerDevice().catch((error: unknown) => {
      console.warn(
        'Push registration failed:',
        error instanceof Error ? error.message : String(error),
      );
    });
  }, []);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const openTarget = (data: PushData) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
      if (data?.postId) router.push(`/post/${data.postId}`);
    };

    // A tap that cold-started the app is only available through this call.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openTarget(response.notification.request.content.data as PushData);
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openTarget(response.notification.request.content.data as PushData);
    });

    // Arriving in the foreground should refresh the badge without navigating.
    const receiveSub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    });

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [router, queryClient]);
}
