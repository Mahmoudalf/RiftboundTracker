import palette from './palette';

/**
 * Design tokens for imperative styles — charts, SVG, animated values, and
 * anywhere a `className` cannot reach.
 *
 * Color literals live only in `palette.js`, which `tailwind.config.js` also
 * requires, so the utility classes and these values cannot drift apart.
 *
 * Contrast ratios in comments are measured against `color.surface` (#12141A).
 */

export const color = {
  ...palette.neutral,
  ...palette.semantic,
  scrim: palette.scrim,
} as const;

/*
 * For reference, measured on #12141A:
 *   text 15.31:1 · textSecondary 7.10:1 · textMuted 5.30:1
 *   win 7.94:1 · loss 6.82:1
 * `textFaint` sits below AA by design — decorative only, never information.
 */

/** 4pt base scale, matching Tailwind's default spacing. */
export const space = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  /** Matches the printed card's corner. */
  card: 10,
  full: 9999,
} as const;

/**
 * Minimum interactive target, enforced on every pressable. The match-log result
 * buttons are far larger — they get tapped under time pressure.
 */
export const HIT_TARGET = 44;

export const duration = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 360,
} as const;

/**
 * Springs rather than timing curves, because springs stay interruptible: a
 * sheet grabbed mid-animation must follow the finger instead of finishing its
 * curve first.
 */
export const spring = {
  default: { damping: 20, stiffness: 220, mass: 1 },
  /** Sheets and other large surfaces — deliberately heavier. */
  sheet: { damping: 24, stiffness: 180, mass: 1 },
  /** Press feedback. */
  press: { damping: 15, stiffness: 400, mass: 0.6 },
} as const;

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
} as const;

/** Riftbound cards are 744x1039 — every card surface uses this ratio. */
export const CARD_ASPECT = 744 / 1039;

/** Below this many matches, stats render as provisional. See docs/DATA-MODEL.md §4. */
export const PROVISIONAL_THRESHOLD = 20;

export type ColorToken = keyof typeof color;
