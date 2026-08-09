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
  text: '#F5F5F6',
  textSecondary: '#C9C9CD',
  textMuted: '#9C9CA1',
  /** Below AA by design — decorative and structural only, never information. */
  textFaint: '#67676B',
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
const DOMAIN_BASE = {
  Fury: '#C25B4A',
  Calm: '#4C86B0',
  Mind: '#8A6FD1',
  Body: '#5DA37A',
  Chaos: '#B15CA0',
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
