import palette from './palette';

/**
 * Design tokens for imperative styles — charts, SVG, animated values, and
 * anywhere a `className` cannot reach.
 *
 * Color literals live only in `palette.js`, which `tailwind.config.js` also
 * requires, so the utility classes and these values cannot drift apart.
 */

export const color = {
  ...palette.neutral,
  ...palette.semantic,
  accent: palette.accent,
  onAccent: palette.onAccent,
  scrim: palette.scrim,
} as const;

/*
 * Measured on `surface` (#1B1B1E):
 *   text 15.0:1 · textSecondary 10.5:1 · textMuted 6.5:1
 *   win 7.4:1 · loss 4.0:1 · accent 4.6:1
 * `textFaint` sits at 2.7:1 — below AA by design, decorative and structural
 * only, never information.
 */

/** 4pt base scale, matching Tailwind's default spacing. */
export const space = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  /** Tailwind's 2.5. The Analytics hi-fi leans on a 10pt step. */
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/**
 * From the design's form spec: 14px cards, 22px pills, 4px tags, 2px bars.
 *
 * `full` stays 9999 for anything genuinely circular — a badge, an avatar. Use
 * `pill` for the capsule shapes the design actually specifies, so a chip and a
 * circle are not the same token pretending to agree.
 */
export const radius = {
  none: 0,
  /** Tags. */
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  /** Cards, and the printed card's own corner. */
  card: 14,
  /** Chips, capsules, segmented controls. */
  pill: 22,
  /** Progress and win-rate bars. */
  bar: 2,
  full: 9999,
} as const;

/**
 * Minimum interactive target.
 *
 * Enforced by `components/ui/Pressable`, which measures itself and expands its
 * **touch area** with `hitSlop` to reach this — never its layout, so a 26 dp
 * control stays 26 dp and simply becomes tappable at 44. The match-log result
 * buttons are far larger by design; they get tapped under time pressure.
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

/*
 * `PROVISIONAL_THRESHOLD` lived here and duplicated `PROVISIONAL_N` in
 * `lib/analytics/summary.ts`. Both said 20, so changing either would have left
 * half the app disagreeing about what counts as enough evidence. It belongs
 * with the statistics — it is a rule about data, not about appearance.
 */

export type ColorToken = keyof typeof color;
