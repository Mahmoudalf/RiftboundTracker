import { Image, type ImageSourcePropType } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { domainColor, type Domain } from '@/theme/domains';

import BodyMark from '../../../assets/domains/Body.png';
import CalmMark from '../../../assets/domains/Calm.png';
import ChaosMark from '../../../assets/domains/Chaos.png';
import FuryMark from '../../../assets/domains/Fury.png';
import MindMark from '../../../assets/domains/Mind.png';
import OrderMark from '../../../assets/domains/Order.png';

/**
 * Domain marks — the real ones, as of 2026-08-14.
 *
 * These were hand-drawn stand-ins (triangle, droplet, diamond, hexagon, star,
 * ring) whose own comment admitted they were "original marks, not reproductions
 * of Riot's official domain symbols". They existed to replace Unicode
 * placeholders (✦ ❋ ◈ ⬢ ✷ ◉), several of which live in Noto Sans Symbols rather
 * than Roboto and rendered as tofu on devices without that fallback. The
 * accessibility contract is *colour never carries meaning alone* — the glyph is
 * the other half, so it could not be allowed to silently vanish.
 *
 * Both problems stay solved: these are images, so no font can fail to draw
 * them, and the six silhouettes remain sharply distinct at the 10 px they
 * render at inside a filter chip.
 *
 * ## Why they are tinted rather than shown in their own colours
 *
 * The sources are single-colour marks in Riot's print inks — Fury `#B32F29`,
 * Mind `#23779B`, Order `#CEA903`. `theme/domains.ts` already holds those under
 * `print` and labels them **reference only — do not render**: they are ink on
 * card stock, and five of the six fall below 3:1 against a dark surface.
 *
 * So the asset ships as a white silhouette carrying nothing but alpha, and the
 * tint comes from the palette, where every `base` clears 6.3:1 on `surface`.
 * The shape is Riot's; the colour stays the app's. This also keeps the `color`
 * prop working — `DomainBadge` and the filter chips both override it — which a
 * baked-in colour would have quietly broken.
 *
 * ## No white was keyed out, and no blend mode is involved
 *
 * The sources look like marks on white in a file preview; they are not. They
 * already carry a correct alpha channel, and only 13–33 % of each frame is
 * opaque. Worth stating because the alternative was tempting and wrong: no
 * blend mode removes white on a **dark** surface. `multiply` clears white only
 * over light backgrounds and would crush these marks to near-black on
 * `#141416`; `screen` clears black and would keep the square.
 *
 * ## Colorless
 *
 * No mark was supplied, and one was not invented. It keeps the drawn ring,
 * which is the right shape for it anyway — Colorless is the absence of a
 * domain, and an open ring reads as exactly that beside six filled marks.
 */

const MARKS: Record<Exclude<Domain, 'Colorless'>, ImageSourcePropType> = {
  Fury: FuryMark,
  Calm: CalmMark,
  Mind: MindMark,
  Body: BodyMark,
  Chaos: ChaosMark,
  Order: OrderMark,
};

interface DomainGlyphProps {
  domain: Domain;
  size?: number;
  /** Defaults to the domain's own accent. */
  color?: string;
}

export function DomainGlyph({ domain, size = 12, color }: DomainGlyphProps) {
  const tint = color ?? domainColor(domain).base;

  if (domain === 'Colorless') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Circle cx="12" cy="12" r="7.5" fill="none" stroke={tint} strokeWidth="2.5" />
      </Svg>
    );
  }

  return (
    <Image
      source={MARKS[domain]}
      // `contain`, not `cover`: the marks are not all the same aspect inside
      // their square, and cropping one to fill would clip a wing off Order.
      resizeMode="contain"
      // Tint lives in `style` rather than the prop of the same name — it is the
      // long-standing Image *style* property and needs no version caveat.
      style={{ width: size, height: size, tintColor: tint }}
      accessible={false}
    />
  );
}
