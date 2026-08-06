import Svg, { Circle, Path } from 'react-native-svg';

import { domainColor, type Domain } from '@/theme/domains';

/**
 * Domain glyphs, drawn rather than typed.
 *
 * These were Unicode placeholders (✦ ❋ ◈ ⬢ ✷ ◉), which was a real risk and not
 * a cosmetic one: several of those codepoints live in Noto Sans Symbols rather
 * than Roboto, and a device without that fallback renders a tofu box. The
 * accessibility contract for this app is "color never carries meaning alone" —
 * the glyph *is* the other half, so it cannot be allowed to silently vanish on
 * exactly the devices with the thinnest font coverage.
 *
 * Six distinct silhouettes — triangle, droplet, diamond, hexagon, star, ring —
 * chosen to stay separable at the 10px they render at inside a filter chip,
 * where fine interior detail would disappear. Filled shapes, not line art, for
 * the same reason. They are original marks on the same 24-unit grid as the
 * icon set, not reproductions of Riot's official domain symbols.
 */

const PATHS: Record<Exclude<Domain, 'Colorless' | 'Order'>, string> = {
  // Blade — aggression, upward thrust.
  Fury: 'M12 2 L20 19.5 L12 15.2 L4 19.5 Z',
  // Droplet — reactive, flowing.
  Calm: 'M12 2.5 C16.2 8.8 19 12 19 15 A7 7 0 0 1 5 15 C5 12 7.8 8.8 12 2.5 Z',
  // Faceted gem — knowledge, clarity.
  Mind: 'M12 2 L20.5 12 L12 22 L3.5 12 Z',
  // Hexagon — grounded, physical.
  Body: 'M12 2.2 L20.2 7 L20.2 17 L12 21.8 L3.8 17 L3.8 7 Z',
  // Splintered star — disruption.
  Chaos: 'M12 1.8 L14.4 9.6 L22.2 12 L14.4 14.4 L12 22.2 L9.6 14.4 L1.8 12 L9.6 9.6 Z',
};

interface DomainGlyphProps {
  domain: Domain;
  size?: number;
  /** Defaults to the domain's own accent. */
  color?: string;
}

export function DomainGlyph({ domain, size = 12, color }: DomainGlyphProps) {
  const fill = color ?? domainColor(domain).base;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {domain === 'Order' ? (
        // Ring — structure, containment. Stroked so the centre stays open,
        // which is what separates it from Mind's solid diamond at small sizes.
        <Circle cx="12" cy="12" r="8" fill="none" stroke={fill} strokeWidth="4" />
      ) : domain === 'Colorless' ? (
        <Circle cx="12" cy="12" r="7.5" fill="none" stroke={fill} strokeWidth="2.5" />
      ) : (
        <Path d={PATHS[domain]} fill={fill} />
      )}
    </Svg>
  );
}
