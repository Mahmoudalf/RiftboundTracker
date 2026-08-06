import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import type { TextStyle } from 'react-native';

/**
 * Type system.
 *
 * Display is **Space Grotesk** — technical and slightly odd (that single-storey
 * g, the flat terminals) without reading as a stock "gamer" face. Body is
 * **Inter**, which holds up at the 12–13px a dense card list needs.
 *
 * The third role is the signature: `meta` borrows the idiom printed along the
 * foot of every Riftbound card — `OGN • 007/298 • Greg Ghielmetti • ©2025RGI`.
 * Small, uppercase, widely tracked, bullet-separated. The app reuses it for its
 * own metadata lines (`v3 • 40 matches • 63%`), so the interface speaks in the
 * artifact's own vernacular rather than in generic caption styling.
 */

export const fonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
};

/** Stats must never jitter as they update, so figures are always tabular. */
const TABULAR: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

export const text = {
  /** Screen titles. */
  display: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  /** Section headers, deck names. */
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 17,
    lineHeight: 24,
  },

  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 21 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },

  /** The card-footer idiom. Always uppercase — see `metaLine()`. */
  meta: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  microMeta: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  /** Headline stat readouts — legible across a table. */
  stat: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    ...TABULAR,
  },
  statLarge: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -1.7,
    ...TABULAR,
  },
  /** Inline numbers inside prose — records, counts, percentages. */
  numeric: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
    ...TABULAR,
  },
} satisfies Record<string, TextStyle>;

/**
 * Join metadata in the card-footer style: ` • ` separated, empty parts dropped.
 *
 *   metaLine('OGN', '007/298', 'Greg Ghielmetti')  →  'OGN • 007/298 • Greg Ghielmetti'
 *   metaLine('v3', '40 matches', '63%')            →  'v3 • 40 matches • 63%'
 */
export function metaLine(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== '')
    .join(' • ');
}
