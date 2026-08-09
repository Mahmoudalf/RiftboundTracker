import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import type { TextStyle } from 'react-native';

/**
 * Type system.
 *
 * **Space Grotesk** throughout the interface — technical and slightly odd (that
 * single-storey g, the flat terminals) without reading as a stock "gamer" face.
 * **JetBrains Mono** carries numbers and metadata, so records and counts align
 * in a column and never re-flow as they update.
 *
 * Body was Inter until the Hi-Fi design (2026-08-09) specified one UI face. The
 * old note said Inter held up better at 12–13px, which is true of Inter in
 * general and was worth trading for a single voice; watch the dense card lists
 * on a device before assuming it is settled.
 *
 * The third role is the signature: `meta` borrows the idiom printed along the
 * foot of every Riftbound card — `OGN • 007/298 • Greg Ghielmetti • ©2025RGI`.
 * Small, uppercase, widely tracked, bullet-separated. The app reuses it for its
 * own metadata lines (`v3 • 40 matches • 63%`), so the interface speaks in the
 * artifact's own vernacular rather than in generic caption styling.
 */

export const fonts = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
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

  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15, lineHeight: 21 },
  small: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, lineHeight: 16 },

  /** The card-footer idiom. Always uppercase — see `metaLine()`. */
  meta: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.95,
    textTransform: 'uppercase' as const,
  },
  microMeta: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.85,
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
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 14,
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
