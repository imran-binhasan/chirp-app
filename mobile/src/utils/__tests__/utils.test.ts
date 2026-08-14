import { timeAgo } from '../timeAgo';
import {
  clearPushToken,
  clearTokens,
  getAccessToken,
  getPushToken,
  getRefreshToken,
  savePushToken,
  saveTokens,
} from '../tokenStorage';

describe('timeAgo', () => {
  const now = new Date('2026-08-14T12:00:00.000Z').getTime();
  beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(now));
  afterAll(() => jest.restoreAllMocks());

  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    ['seconds', 30 * 1000, '30s'],
    ['minutes', 5 * 60 * 1000, '5m'],
    ['hours', 3 * 60 * 60 * 1000, '3h'],
    ['days', 2 * 24 * 60 * 60 * 1000, '2d'],
  ])('formats %s', (_label, offset, expected) => {
    expect(timeAgo(ago(offset))).toBe(expected);
  });

  it('rolls over at each boundary rather than showing 60m or 24h', () => {
    expect(timeAgo(ago(60 * 1000))).toBe('1m');
    expect(timeAgo(ago(60 * 60 * 1000))).toBe('1h');
    expect(timeAgo(ago(24 * 60 * 60 * 1000))).toBe('1d');
  });
});

describe('tokenStorage', () => {
  beforeEach(async () => {
    await clearTokens();
    await clearPushToken();
  });

  it('round-trips an access and refresh pair', async () => {
    await saveTokens('access-1', 'refresh-1');

    expect(await getAccessToken()).toBe('access-1');
    expect(await getRefreshToken()).toBe('refresh-1');
  });

  it('returns null once tokens are cleared', async () => {
    await saveTokens('access-1', 'refresh-1');
    await clearTokens();

    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('keeps the push token separate from auth tokens', async () => {
    await saveTokens('access-1', 'refresh-1');
    await savePushToken('fcm-1');

    // Session expiry clears credentials but must not lose the device token,
    // which logout still needs in order to unregister the device.
    await clearTokens();

    expect(await getPushToken()).toBe('fcm-1');
    expect(await getAccessToken()).toBeNull();
  });

  it('rejects a non-string token instead of storing garbage', async () => {
    await expect(
      saveTokens(undefined as unknown as string, 'refresh-1'),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
