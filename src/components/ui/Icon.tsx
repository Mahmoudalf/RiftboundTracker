import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Hand-drawn icon set.
 *
 * Deliberately not a stock icon pack: these are built from the same angular,
 * flat-terminal geometry as the card frames, on a 24-unit grid with a uniform
 * 1.75 stroke, so the navigation reads as part of the same object as the cards.
 */

export type IconName =
  | 'decks'
  | 'cards'
  | 'stats'
  | 'profile'
  | 'plus'
  | 'search'
  | 'filter'
  | 'close'
  | 'chevron-right'
  | 'check';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Filled variant for active navigation states. */
  active?: boolean;
}

export function Icon({ name, size = 24, color = '#E8EAF0', active = false }: IconProps) {
  const stroke = color;
  const fill = active ? color : 'none';
  const fillOpacity = active ? 0.18 : 0;
  const common = {
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'decks' && (
        <>
          {/* Three stacked cards, offset — a deck seen edge-on. */}
          <Path d="M7.5 6.2 14.2 4l3 8.6-6.7 2.2z" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M5 9.5 11 20l7-2.4" {...common} />
          <Path d="M3.4 13.2 8 20.6" {...common} />
        </>
      )}

      {name === 'cards' && (
        <>
          {/* Gallery grid, card aspect ratio rather than squares. */}
          <Rect x="3.5" y="3.5" width="7" height="8.5" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Rect x="13.5" y="3.5" width="7" height="8.5" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Rect x="3.5" y="14.5" width="7" height="6" rx="1.2" {...common} />
          <Rect x="13.5" y="14.5" width="7" height="6" rx="1.2" {...common} />
        </>
      )}

      {name === 'stats' && (
        <>
          {/* Columns plus a trend line — the version timeline in miniature. */}
          <Path d="M4 20V13" {...common} />
          <Path d="M9.33 20v-4" {...common} />
          <Path d="M14.67 20V9.5" {...common} />
          <Path d="M20 20V6" {...common} />
          <Path d="M4 10.5 9.33 12l5.34-5.2L20 3.5" {...common} strokeWidth={1.4} opacity={0.55} />
        </>
      )}

      {name === 'profile' && (
        <>
          {/* Hex bust — echoes the Body domain glyph rather than a generic avatar. */}
          <Path d="M12 3.5 16.5 6v5L12 13.5 7.5 11V6z" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Path d="M4.5 20.5c0-3.6 3.36-5.5 7.5-5.5s7.5 1.9 7.5 5.5" {...common} />
        </>
      )}

      {name === 'plus' && (
        <>
          <Path d="M12 5.5v13M5.5 12h13" {...common} strokeWidth={2.25} />
        </>
      )}

      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="6.5" {...common} />
          <Path d="m16 16 4.5 4.5" {...common} />
        </>
      )}

      {name === 'filter' && (
        <>
          <Path d="M3.5 6.5h17M6.5 12h11M10 17.5h4" {...common} />
        </>
      )}

      {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" {...common} />}

      {name === 'chevron-right' && <Path d="m9.5 5.5 6.5 6.5-6.5 6.5" {...common} />}

      {name === 'check' && <Path d="m4.5 12.5 5 5 10-11" {...common} strokeWidth={2} />}
    </Svg>
  );
}
