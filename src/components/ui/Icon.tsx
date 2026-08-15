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
  | 'check'
  | 'pencil'
  | 'list'
  | 'gallery'
  | 'import'
  | 'arrow-down';

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
          {/*
            Three cards in an offset stack, each a complete shape.

            The previous drawing described the same idea but only closed the
            top card; the other two were open polylines — two edges each, with
            no corners. At 23 dp that read as one card with a pair of stray
            diagonals under it rather than as a stack. Here the front card is
            whole and the two behind show a top and a right edge with a real
            corner between them, which is what makes them read as cards.
          */}
          <Path d="M7.8 2.7H17.8a1.5 1.5 0 0 1 1.5 1.5V16.2" {...common} />
          <Path d="M5.4 5.1H15.4a1.5 1.5 0 0 1 1.5 1.5V18.6" {...common} />
          <Rect
            x="3"
            y="7.5"
            width="11.5"
            height="13.5"
            rx="1.5"
            {...common}
            fill={fill}
            fillOpacity={fillOpacity}
          />
        </>
      )}

      {name === 'cards' && (
        <>
          {/*
            A ring binder — the collection's own organising object.

            It was a 2×2 grid, which had two problems. The cells were different
            heights top and bottom, so it read as a broken grid rather than a
            deliberate one, and only the top two took the active fill, leaving
            the icon half-lit whenever the tab was selected. It was also about
            to collide with `gallery`, which is legitimately a 2×2 grid.
          */}
          {/*
            A binder, drawn as a silhouette rather than as internal detail.

            Three drawings failed here before this one, and each failed the same
            way: at 23 dp an icon is read by its **outline**, not its contents.
            A rectangle with a spine and ring marks read as a sidebar; two cards
            in a storage box merged into a blob; a 2×2 grid of card-proportioned
            rects was indistinguishable from `gallery` — a 1.3 aspect ratio is
            simply not perceptible at this size.
            The folder tab changes the shape itself, which survives the scale,
            and it is what the Collection tab actually holds: binders.
          */}
          <Path
            d="M3.5 19V6a1.5 1.5 0 0 1 1.5-1.5h4.3l2.2 2.6H19a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"
            {...common}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          {/* One card edge inside it, so the folder is holding something. */}
          <Path d="M9 20.5v-6.2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.2" {...common} />
        </>
      )}

      {name === 'list' && (
        <>
          {/*
            Rows with a leading mark, not a hamburger.

            Three bare lines would be `filter` at a different length — this set
            already spends that shape. The lead mark is the row's thumbnail,
            which is exactly what the list view puts there.
          */}
          <Path
            d="M4 7.5h2.5M9 7.5h11M4 12h2.5M9 12h11M4 16.5h2.5M9 16.5h11"
            {...common}
          />
        </>
      )}

      {name === 'gallery' && (
        <>
          {/* Square tiles, deliberately — `cards` is the same arrangement in
              card proportion, and squareness is what tells the two apart. They
              never appear together, but they should still mean different
              things: this is a layout, that is a collection of cards. */}
          <Rect x="4" y="4" width="7" height="7" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Rect x="13" y="4" width="7" height="7" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Rect x="4" y="13" width="7" height="7" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Rect x="13" y="13" width="7" height="7" rx="1.2" {...common} fill={fill} fillOpacity={fillOpacity} />
        </>
      )}

      {name === 'import' && (
        <>
          {/* Into a tray, so it cannot be mistaken for a plain download. */}
          <Path d="M12 3.5V13.5M8.5 10l3.5 3.5 3.5-3.5" {...common} />
          <Path d="M4.5 16v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" {...common} />
        </>
      )}

      {name === 'arrow-down' && (
        <Path d="M12 4.5v14M6.5 13l5.5 5.5 5.5-5.5" {...common} />
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

      {name === 'pencil' && (
        <>
          {/*
            Flat-terminal nib, not a tapered point.

            The set is drawn on a 24 grid with one stroke weight and squared-off
            ends, so a conventional pencil — which needs a taper and a second
            weight for the tip — would be the one icon here that looked bought
            rather than drawn. The barrel is a parallelogram and the nib is the
            same shape cut short, which keeps the whole thing on the grid.
          */}
          <Path d="M14.5 4.5 19.5 9.5 9 20H4v-5z" {...common} fill={fill} fillOpacity={fillOpacity} />
          <Path d="m12.5 6.5 5 5" {...common} />
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
