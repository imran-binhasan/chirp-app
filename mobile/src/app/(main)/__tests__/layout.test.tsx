import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
// Re-exported from the tabs entry point rather than the router root.
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import MainLayout from '../_layout';

// See responsive.test.ts: react-native's exports are lazy getters, so the
// override has to proxy rather than spread.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const mocked = jest.fn();
  return new Proxy(actual, {
    get: (target, prop) => (prop === 'useWindowDimensions' ? mocked : target[prop]),
  });
});

// Captures what the layout hands to the navigator; the shared expo-router mock
// throws its props away.
const capturedOptions: BottomTabNavigationOptions[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Redirect: () => null,
  Tabs: Object.assign(
    ({ screenOptions }: { screenOptions: BottomTabNavigationOptions }) => {
      capturedOptions.push(screenOptions);
      return null;
    },
    { Screen: () => null },
  ),
}));

jest.mock('../../../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));

jest.mock('../../../store/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'jane' }, loading: false }),
}));

jest.mock('../../../api/endpoints', () => ({
  notificationsApi: { unreadCount: jest.fn(() => Promise.resolve({ unread: 0 })) },
}));

const dimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

let queryClient: QueryClient | undefined;

// The unread badge polls on an interval; without this the timer outlives the test.
afterEach(() => queryClient?.clear());

async function optionsAt(width: number): Promise<BottomTabNavigationOptions> {
  capturedOptions.length = 0;
  dimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <MainLayout />
    </QueryClientProvider>,
  );
  // The badge query resolves into a second render; waiting for it keeps that
  // state update inside act().
  await waitFor(() => expect(capturedOptions.length).toBeGreaterThan(1));
  return capturedOptions[capturedOptions.length - 1];
}

describe('MainLayout navigation', () => {
  it('keeps the bottom bar on phones', async () => {
    const options = await optionsAt(390);

    expect(options.tabBarPosition).toBe('bottom');
    expect(options.tabBarVariant).toBe('uikit');
    // Left undefined so the platform keeps its own landscape label behaviour.
    expect(options.tabBarLabelPosition).toBeUndefined();
  });

  it('moves to a compact rail on a tablet in portrait', async () => {
    const options = await optionsAt(834);

    expect(options.tabBarPosition).toBe('left');
    expect(options.tabBarVariant).toBe('material');
    expect(options.tabBarLabelPosition).toBe('below-icon');
    expect(options.tabBarStyle).toMatchObject({ width: 80, minWidth: 80 });
  });

  it('labels the rail beside the icons once the window is wide', async () => {
    const options = await optionsAt(1280);

    expect(options.tabBarPosition).toBe('left');
    expect(options.tabBarLabelPosition).toBe('beside-icon');
    expect(options.tabBarStyle).toMatchObject({ width: 240, minWidth: 240 });
  });

  // The navigator throws on these combinations rather than degrading, so a
  // regression here is a crash on rotation rather than a cosmetic slip.
  it.each([320, 599, 600, 834, 1000, 1280])('emits a valid combination at %ipx', async (width) => {
    const { tabBarPosition, tabBarVariant, tabBarLabelPosition } = await optionsAt(width);
    const onSide = tabBarPosition === 'left' || tabBarPosition === 'right';

    if (tabBarVariant === 'material') expect(onSide).toBe(true);
    if (tabBarLabelPosition === 'below-icon' && onSide) expect(tabBarVariant).toBe('material');
  });
});
