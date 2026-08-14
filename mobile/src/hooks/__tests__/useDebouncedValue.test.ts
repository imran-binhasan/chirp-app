import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '../useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', async () => {
    const { result } = await renderHook(() => useDebouncedValue('jane', 300));
    expect(result.current).toBe('jane');
  });

  it('withholds an update until the delay elapses', async () => {
    const { result, rerender } = await renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'j' } },
    );

    await rerender({ value: 'jane' });
    expect(result.current).toBe('j');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('jane');
  });

  it('only emits the final value when typing quickly', async () => {
    // The feed filter would otherwise fire one request per keystroke.
    const { result, rerender } = await renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: '' } },
    );

    for (const value of ['j', 'ja', 'jan', 'jane']) {
      await rerender({ value });
      await act(async () => {
        jest.advanceTimersByTime(100); // never long enough to settle
      });
    }

    expect(result.current).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('jane');
  });
});
