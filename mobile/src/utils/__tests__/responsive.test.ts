import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useResponsive } from '../responsive';

// A proxy rather than a spread: react-native's entry point exposes every export
// as a lazy getter, and spreading it eagerly resolves modules the test env
// cannot load.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const mocked = jest.fn();
  return new Proxy(actual, {
    get: (target, prop) => (prop === 'useWindowDimensions' ? mocked : target[prop]),
  });
});

const dimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

const at = async (width: number) => {
  dimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
  const { result } = await renderHook(() => useResponsive());
  return result.current;
};

describe('useResponsive', () => {
  it.each([
    ['small phone', 375, 'bottom'],
    ['large phone', 430, 'bottom'],
    ['just below the rail breakpoint', 599, 'bottom'],
    ['small tablet / phone in landscape', 600, 'rail'],
    ['tablet in portrait', 834, 'rail'],
    ['just below the expanded breakpoint', 999, 'rail'],
    ['tablet in landscape', 1024, 'expandedRail'],
    ['desktop-class window', 1440, 'expandedRail'],
  ])('puts navigation on the %s at %ipx', async (_label, width, expected) => {
    expect((await at(width)).navLayout).toBe(expected);
  });

  it('only reports a rail width once navigation leaves the bottom', async () => {
    expect((await at(375)).navWidth).toBeUndefined();
    expect((await at(834)).navWidth).toBe(80);
    expect((await at(1024)).navWidth).toBe(240);
  });

  it('caps the reading column on tablets only', async () => {
    expect((await at(430)).contentMaxWidth).toBeUndefined();
    expect((await at(834)).contentMaxWidth).toBe(700);
  });

  it('leaves the rail narrower than the space left for content', async () => {
    const { width, navWidth, contentMaxWidth } = await at(1024);

    expect(width - navWidth!).toBeGreaterThanOrEqual(contentMaxWidth!);
  });

  it('scales gutters and avatars with the tablet breakpoint', async () => {
    expect(await at(375)).toMatchObject({ gutter: 16, avatarSize: 40, isTablet: false });
    expect(await at(834)).toMatchObject({ gutter: 24, avatarSize: 48, isTablet: true });
  });
});
