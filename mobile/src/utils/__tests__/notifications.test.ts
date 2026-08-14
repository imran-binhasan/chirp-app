/**
 * expo-notifications throws while it is being evaluated inside Expo Go, so the
 * guard has to keep the module from ever being required there.
 */
describe('getNotifications', () => {
  const loadIn = (executionEnvironment: string, appOwnership: string | null) => {
    let module!: typeof import('../notifications');
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: { executionEnvironment, appOwnership },
        ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
        AppOwnership: { Expo: 'expo', Guest: 'guest', Standalone: 'standalone' },
      }));
      module = require('../notifications');
    });
    return module;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.dontMock('expo-constants');
    jest.restoreAllMocks();
  });

  it('does not load expo-notifications in Expo Go', () => {
    const { getNotifications, isExpoGo, isPushSupported } = loadIn('storeClient', 'expo');

    expect(isExpoGo).toBe(true);
    expect(isPushSupported).toBe(false);
    expect(getNotifications()).toBeNull();
  });

  it('falls back to the legacy appOwnership flag', () => {
    const { isExpoGo } = loadIn('', 'expo');

    expect(isExpoGo).toBe(true);
  });

  it('loads and configures the module in a development build', () => {
    const Notifications = require('expo-notifications');
    const { getNotifications, isPushSupported } = loadIn('bare', null);

    expect(isPushSupported).toBe(true);
    expect(getNotifications()).toBeTruthy();
    expect(Notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('resolves the module only once', () => {
    const { getNotifications } = loadIn('bare', null);

    expect(getNotifications()).toBe(getNotifications());
  });
});
