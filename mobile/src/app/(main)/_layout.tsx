import React from 'react';
import { I18nManager } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import { useResponsive } from '../../utils/responsive';
import { useThemeColors } from '../../utils/theme';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuth } from '../../store/AuthContext';

export default function MainLayout() {
  const theme = useThemeColors();
  const { navLayout, navWidth } = useResponsive();
  const { user, loading } = useAuth();
  usePushNotifications();

  const isRail = navLayout !== 'bottom';

  const { data: unread = 0 } = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => (await notificationsApi.unreadCount()).unread,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        // Navigation moves to the leading edge once there is room, the way X
        // and Threads do on tablets: a bottom bar that wide reads as a
        // stretched phone and sits far from the centred content column.
        tabBarPosition: isRail ? (I18nManager.isRTL ? 'right' : 'left') : 'bottom',
        // 'material' gives the M3 rail treatment, and is also the only variant
        // that permits labels under the icon on a side rail.
        tabBarVariant: isRail ? 'material' : 'uikit',
        tabBarLabelPosition: !isRail
          ? undefined
          : navLayout === 'expandedRail'
            ? 'beside-icon'
            : 'below-icon',
        tabBarStyle: {
          backgroundColor: theme.background,
          borderColor: theme.border,
          // minWidth too: the rail otherwise falls back to the 360dp drawer width.
          ...(isRail ? { width: navWidth, minWidth: navWidth } : null),
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "create" : "create-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Ping',
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
