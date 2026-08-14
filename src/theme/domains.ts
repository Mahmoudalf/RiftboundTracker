import palette from './palette';

/**
 * Riftbound domain colors.
 *
 * `print` is sampled directly from the Basic Rune card art Riot publishes
 * (`scripts/sample-domain-colors.ts`). Those values are authentic but unusable
 * as UI colors — they are ink on card stock, and five of the six fall below 3:1
 * against a dark surface (Chaos is 1.95:1).
 *
 * So the **hue** is taken from the sampled color and preserved exactly, while
 * lightness and chroma are re-derived in OKLCH at a constant L per role.
 * Holding L constant across all six is what makes the set read as one palette;
 * matching on *contrast ratio* instead leaves gold and green looking muddy next
 * to red, because yellow-ish hues reach a given ratio at much lower lightness.
 *
 * **The two paragraphs above describe the M0 derivation, not what ships.** The
 * Hi-Fi retheme replaced the set with its own desaturated values, and this file
 * kept claiming *"every `base` clears 6.3:1 on `surface`"*. Measured on
 * 2026-08-14 the shipped set runs **4.00 to 6.31**, and only Order clears 6.3.
 * All six clear the 3:1 a non-text UI mark needs — which is what these are —
 * but the sentence was describing a palette that had been replaced.
 *
 * The **hues** were corrected the same day. The design's set had the right
 * colours attached to the wrong names, leaving Calm blue, Mind purple, Body
 * green and Chaos magenta; see the table in `palette.js`.
 *
 * Color never carries meaning alone — a domain indicator always pairs this with
 * the domain's glyph or label. Fury (27°) and Body (52°) are genuinely close,
 * which is inherent to the game's own palette, so the glyph is what separates
 * them in practice.
 */

export const DOMAINS = [
  'Fury',
  'Calm',
  'Mind',
  'Body',
  'Chaos',
  'Order',
  'Colorless',
] as const;

export type Domain = (typeof DOMAINS)[number];

/** The six real domains, excluding Colorless. */
export const PLAYABLE_DOMAINS = DOMAINS.filter(
  (d): d is Exclude<Domain, 'Colorless'> => d !== 'Colorless'
);

export interface DomainColor {
  /** Sampled from the Basic Rune card art. Reference only — do not render. */
  print: string;
  /** OKLCH hue in degrees, derived from `print`. */
  hue: number;
  /** Primary accent: text, icons, gradient stops. L=0.70. */
  base: string;
  /** Emphasis: active states, the lighter end of a deck gradient. L=0.82. */
  bright: string;
  /** Chip and badge fill. L=0.28 — pair with `base` for the glyph. */
  dim: string;
  /** Foreground for text on a `base` fill. */
  onBase: string;
}

export const DOMAIN_COLORS: Record<Domain, DomainColor> = Object.fromEntries(
  Object.entries(palette.domains).map(([name, c]) => [
    name,
    { ...c, onBase: palette.onDomainBase },
  ])
) as Record<Domain, DomainColor>;

/**
 * Domain marks are drawn, not typed — see `components/cards/DomainGlyph.tsx`.
 * There is deliberately no Unicode glyph map here: those characters live in
 * fallback fonts that not every Android device carries, and a tofu box would
 * silently drop half of the "color never carries meaning alone" contract.
 */

export function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

export function domainColor(domain: string): DomainColor {
  return isDomain(domain) ? DOMAIN_COLORS[domain] : DOMAIN_COLORS.Colorless;
}

/** Canonical ordering, so a domain pair renders identically everywhere. */
export function sortDomains(domains: readonly string[]): Domain[] {
  return domains
    .filter(isDomain)
    .sort((a, b) => DOMAINS.indexOf(a) - DOMAINS.indexOf(b));
}

/**
 * Two-stop gradient identifying a deck, derived from its Legend's domains.
 *
 * This is what makes decks distinguishable in a list before you read a name, so
 * it has to be stable: domains are sorted canonically rather than taken in
 * whatever order the API returned them.
 */
export function deckGradient(domains: readonly string[]): [string, string] {
  const resolved = sortDomains(domains);

  if (resolved.length === 0) {
    return [DOMAIN_COLORS.Colorless.dim, DOMAIN_COLORS.Colorless.base];
  }
  const first = DOMAIN_COLORS[resolved[0]!];
  if (resolved.length === 1) return [first.dim, first.base];
  return [first.base, DOMAIN_COLORS[resolved[1]!]!.base];
}
