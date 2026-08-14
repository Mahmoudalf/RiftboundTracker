/**
 * Raw hex values — the one place any color literal is allowed to live.
 *
 * Plain JS (not TS) on purpose: `tailwind.config.js` must `require()` this at
 * build time, and `tokens.ts` / `domains.ts` import it at runtime. One file, so
 * the utility classes and the imperative styles cannot drift apart.
 *
 * ---
 *
 * **Retheme from the Hi-Fi design (2026-08-09).** A stark charcoal base with a
 * single coral-red accent: near-black surfaces, hairline borders at 8% white,
 * and one hot colour reserved for actions and current state. The previous
 * palette was a blue-black with a blue `info` and white primary buttons.
 *
 * Two earlier decisions are deliberately overridden here, and both are worth
 * knowing about rather than rediscovering:
 *
 * - The domain values were **sampled from Riot's Basic Rune card art** in M0
 *   and re-derived in OKLCH. The design replaces them with a desaturated set
 *   built to sit on charcoal without vibrating. Accuracy to the print colour
 *   loses to legibility on the surface they actually appear on.
 * - Body text was Inter. The design specifies Space Grotesk throughout, with
 *   JetBrains Mono for numbers and metadata. See `typography.ts`.
 */

/** @type {Record<string, string>} */
const neutral = {
  bg: '#141416',
  surface: '#1B1B1E',
  raised: '#232326',
  overlay: '#2A2A2D',
  /**
   * Hairlines, not solid greys. The design draws every division at 8% white so
   * it reads the same over `surface` and over card art; a flat hex would go
   * muddy over one and invisible over the other.
   */
  border: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  /**
   * Two heavier hairlines, from the Analytics hi-fi (`1_ANALYTIC02`).
   *
   * The design draws three weights of division, not one: `border` for passive
   * rules between content, `borderStrong` for a surface that is *itself* an
   * object you can read as a unit — a finding card — and `borderControl` for
   * something you can press. Collapsing them onto `border` made the finding
   * cards dissolve into the background they sit on.
   */
  borderStrong: 'rgba(255,255,255,0.12)',
  borderControl: 'rgba(255,255,255,0.14)',
  /** The rank numeral on a finding — deliberately below `textHint`. */
  textGhost: '#3F3F42',
  text: '#F5F5F6',
  textSecondary: '#C9C9CD',
  textMuted: '#9C9CA1',
  /**
   * The label on an *unselected* segmented control.
   *
   * A step below `textSecondary` and its own value in the design (19 uses), so
   * an inactive Bo1 beside a selected Bo3 recedes without going unreadable.
   * Sitting it on `textSecondary` made the two options look equally chosen.
   */
  textDim: '#ADADB2',
  /** Below AA by design — decorative and structural only, never information. */
  textFaint: '#67676B',
  /**
   * Helper copy under a field — the sentence explaining what the field does.
   *
   * Quieter than `textFaint` (10 uses in the design) because it sits *below* a
   * label that is already quiet, and two greys at the same value read as one
   * block of text rather than as a label and its explanation.
   */
  textHint: '#5A5A5D',
};

/**
 * The single accent.
 *
 * Primary action, active tab, current selection, the log button. The design is
 * explicit that it is used for nothing else: the moment coral appears on
 * something inert it stops meaning "this is the live one".
 */
const accent = '#FF4B4B';
/** Foreground on an accent fill — a near-black red, not pure black. */
const onAccent = '#1A0605';

/** @type {Record<string, string>} */
const semantic = {
  win: '#46C77E',
  loss: '#C7433D',
  draw: '#86868A',
  /**
   * Foregrounds for text sitting *inside* a filled result segment.
   *
   * Near-blacks tinted towards their own fill rather than one shared black, so
   * the count on a green bar and the count on a red one both read as belonging
   * to the bar rather than as a label dropped on top of it. Same reasoning as
   * `onAccent`, which is a near-black red for exactly this.
   */
  onWin: '#0C1A12',
  onLoss: '#1A0605',
  /**
   * The accent as a *state* rather than as a fill — a selected filter chip, an
   * opened drawer. The design tints the surface and the border and lifts the
   * label instead of inverting to a solid coral, because these controls stay
   * legible-but-quiet while a primary action should not.
   */
  accentSoft: 'rgba(255,75,75,0.12)',
  accentBorder: 'rgba(255,75,75,0.5)',
  accentBright: '#FF8A8A',
  provisional: '#67676B',
  warning: '#D9932E',
  danger: '#C7433D',
  /**
   * Inline actions — "Clear filters", "Done", a link into an event.
   *
   * The same coral as `accent`, kept as its own name so the two can diverge
   * without a sweep. Every current use is a tappable action, which is what the
   * accent is for.
   */
  info: accent,
};

/**
 * Domain colours, from the design's set.
 *
 * `base` is the design value. `bright` and `dim` are derived rather than
 * hand-picked so a corrected base cannot leave a stale tint behind it — `dim`
 * is the base sat down onto the shell for chip and gradient fills, `bright` is
 * lifted for anything that has to carry text.
 */
/*
 * **Hues corrected 2026-08-14.** The design's set had the right colours on the
 * wrong names, which put four domains at the wrong hue entirely:
 *
 * | Domain | Was | True hue | Error |
 * | --- | --- | --- | --- |
 * | Calm | blue `#4C86B0` | green 145° | 96° |
 * | Mind | purple `#8A6FD1` | blue 231° | 63° |
 * | Body | green `#5DA37A` | orange 52° | 105° |
 * | Chaos | magenta `#B15CA0` | purple 313° | 22° — the "pinkish" one |
 *
 * Measured against the official domain marks in `samples/Domains/`, which are
 * flat single-ink symbols and so the most direct statement of each hue.
 *
 * The fix **reassigns rather than restyles**: four of these values were already
 * right for *some* domain, so they moved to the one they actually match, and
 * only Body — which had no orange anywhere in the set — was minted, in OKLCH at
 * the kept set's median lightness and chroma (L 0.611 · C 0.103). Every domain
 * now sits within 18° of its own ink while the palette keeps the desaturated
 * character the retheme chose. Magenta `#B15CA0` is retired.
 *
 * Fury 27° and Body 52° are genuinely close, which is inherent to the game's
 * own palette — the glyph is what separates them, which is why colour never
 * carries meaning alone here.
 */
const DOMAIN_BASE = {
  Fury: '#C25B4A',
  Calm: '#5DA37A',
  Mind: '#4C86B0',
  Body: '#B47146',
  Chaos: '#8A6FD1',
  Order: '#B69A4C',
  /** Not in the design — the neutral draw grey, so colourless reads as absent. */
  Colorless: '#86868A',
};

/** Mix `hex` toward `target` by `amount` (0–1). */
function mix(hex, target, amount) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(target);
  const channel = (a, b) => Math.round(a + (b - a) * amount);
  return (
    '#' +
    [channel(r1, r2), channel(g1, g2), channel(b1, b2)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

const domains = Object.entries(DOMAIN_BASE).reduce((acc, [name, base]) => {
  acc[name] = {
    base,
    bright: mix(base, '#FFFFFF', 0.42),
    dim: mix(base, neutral.bg, 0.78),
  };
  return acc;
}, /** @type {Record<string, { base: string, bright: string, dim: string }>} */ ({}));

/** Foreground for text sitting on a domain `base` fill. */
const onDomainBase = '#141416';

const scrim = 'rgba(10, 10, 11, 0.74)';

/** Flattened `domain-fury`, `domain-fury-dim`, … for Tailwind. */
const domainUtilities = Object.entries(domains).reduce((acc, [name, c]) => {
  const key = name.toLowerCase();
  acc[key] = c.base;
  acc[`${key}-bright`] = c.bright;
  acc[`${key}-dim`] = c.dim;
  return acc;
}, /** @type {Record<string, string>} */ ({}));

module.exports = {
  neutral,
  semantic,
  accent,
  onAccent,
  domains,
  domainUtilities,
  onDomainBase,
  scrim,
};
