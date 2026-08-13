import { useWindowDimensions } from 'react-native';

/** Below this the device gets the single-column phone layout. */
const TABLET_BREAKPOINT = 700;

/**
 * Where primary navigation leaves the bottom edge for a side rail. Matches the
 * Material 3 medium window class, which also catches large phones in landscape
 * — the width at which a full-bleed bottom bar starts to feel stranded.
 */
const RAIL_BREAKPOINT = 600;

/**
 * Wide enough to afford labels beside the icons instead of under them. Set to
 * catch tablets in landscape while leaving them a compact rail in portrait.
 */
const EXPANDED_RAIL_BREAKPOINT = 1000;

/** Material 3 navigation rail width. */
const RAIL_WIDTH = 80;

/**
 * Narrower than the 360dp M3 drawer: this is a labelled rail, not a drawer with
 * sections, and the surplus is better spent on the reading column.
 */
const EXPANDED_RAIL_WIDTH = 240;

/**
 * Reading column cap. Feed rows stretched across a 10" tablet are unreadable,
 * so content is centred at a comfortable measure and the surplus width
 * becomes margin.
 */
const CONTENT_MAX_WIDTH = 700;

/** Where primary navigation sits, and how its items are laid out. */
export type NavLayout = 'bottom' | 'rail' | 'expandedRail';

export interface Responsive {
  width: number;
  isTablet: boolean;
  /** Max content width, or undefined on phones where it should fill. */
  contentMaxWidth: number | undefined;
  /** Horizontal padding that grows with available space. */
  gutter: number;
  /** Avatars and touch targets scale up slightly on large screens. */
  avatarSize: number;
  navLayout: NavLayout;
  /** Rail width, or undefined while navigation is still at the bottom. */
  navWidth: number | undefined;
}

function getNavLayout(width: number): NavLayout {
  if (width >= EXPANDED_RAIL_BREAKPOINT) return 'expandedRail';
  if (width >= RAIL_BREAKPOINT) return 'rail';
  return 'bottom';
}

const navWidths: Record<NavLayout, number | undefined> = {
  bottom: undefined,
  rail: RAIL_WIDTH,
  expandedRail: EXPANDED_RAIL_WIDTH,
};

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const navLayout = getNavLayout(width);

  return {
    width,
    isTablet,
    contentMaxWidth: isTablet ? CONTENT_MAX_WIDTH : undefined,
    gutter: isTablet ? 24 : 16,
    avatarSize: isTablet ? 48 : 40,
    navLayout,
    navWidth: navWidths[navLayout],
  };
}
