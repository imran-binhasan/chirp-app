/* eslint-env jest */

// ─── expo-secure-store ───────────────────────────────────────────────────────
// Backed by an in-memory map so token storage behaves like the real thing.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn((key) => Promise.resolve(store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn((key, value) => {
      if (typeof value !== 'string') {
        return Promise.reject(new TypeError('SecureStore values must be strings'));
      }
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

// ─── @expo/vector-icons ──────────────────────────────────────────────────────
// Pulls in expo-font → expo-asset, which isn't resolvable in the jest env.
// Icons carry no logic worth exercising, so render them as plain views.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = ({ name, ...rest }) => React.createElement(View, { testID: `icon-${name}`, ...rest });
  return { Ionicons: Icon, MaterialIcons: Icon, FontAwesome: Icon, AntDesign: Icon };
});

// ─── expo-router ─────────────────────────────────────────────────────────────
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

jest.mock('expo-router', () => ({
  __mockRouter: mockRouter,
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(() => ({})),
  Redirect: () => null,
  Stack: Object.assign(() => null, { Screen: () => null }),
  Tabs: Object.assign(() => null, { Screen: () => null }),
  Link: () => null,
}));

// ─── expo-notifications ──────────────────────────────────────────────────────
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ data: 'fcm-test-token' })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// ─── react-native-safe-area-context ──────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, style }) => React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

global.__DEV__ = true;
// React 19's concurrent renderer requires this for act() to be recognised.
global.IS_REACT_ACT_ENVIRONMENT = true;
