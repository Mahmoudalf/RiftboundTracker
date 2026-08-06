/**
 * Raw hex values — the one place any color literal is allowed to live.
 *
 * Plain JS (not TS) on purpose: `tailwind.config.js` must `require()` this at
 * build time, and `tokens.ts` / `domains.ts` import it at runtime. One file, so
 * the utility classes and the imperative styles cannot drift apart.
 *
 * Derivation of the domain values is documented in `domains.ts`.
 */

/** @type {Record<string, string>} */
const neutral = {
  bg: '#0A0B0F',
  surface: '#12141A',
  raised: '#1A1D25',
  overlay: '#22262F',
  border: '#262A34',
  borderSubtle: '#1D212A',
  text: '#E8EAF0',
  textSecondary: '#9AA1B0',
  textMuted: '#828A9A',
  textFaint: '#5A616F',
};

/** @type {Record<string, string>} */
const semantic = {
  win: '#00C286',
  loss: '#FA7090',
  draw: '#9AA1B0',
  provisional: '#828A9A',
  warning: '#E8B339',
  danger: '#FA7090',
  info: '#1EA7F8',
};

/**
 * `print` is sampled from Riot's Basic Rune card art; `base`/`bright`/`dim` are
 * re-derived in OKLCH at constant lightness. See `domains.ts` for the reasoning.
 */
const domains = {
  Fury:      { print: '#931D1B', hue: 27,  base: '#F17166', bright: '#FFABA0', dim: '#4B110F' },
  Calm:      { print: '#37672E', hue: 141, base: '#61B652', bright: '#92DA85', dim: '#093302' },
  Mind:      { print: '#104C72', hue: 242, base: '#1EA7F8', bright: '#89CCFF', dim: '#002C47' },
  Body:      { print: '#C14C1C', hue: 40,  base: '#EF774B', bright: '#FFAD90', dim: '#4B1400' },
  Chaos:     { print: '#52327B', hue: 301, base: '#B084F1', bright: '#D0B4FF', dim: '#311B4C' },
  Order:     { print: '#A67F21', hue: 84,  base: '#C89500', bright: '#EDBC50', dim: '#362600' },
  Colorless: { print: '#8A8F99', hue: 265, base: '#9AA1B0', bright: '#C4CAD6', dim: '#22252D' },
};

/** Foreground for text sitting on a domain `base` fill. */
const onDomainBase = '#0A0B0F';

const scrim = 'rgba(5, 6, 9, 0.72)';

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
  domains,
  domainUtilities,
  onDomainBase,
  scrim,
};
