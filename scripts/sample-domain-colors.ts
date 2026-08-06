/**
 * Re-derive the domain palette from Riot's own card art.
 *
 *   npx tsx scripts/sample-domain-colors.ts
 *
 * Basic Rune cards are a large domain symbol on a flat field of that domain's
 * color, which makes them the most reliable published source for the hues.
 *
 * The sampled values are *print* colors and are not directly usable: five of
 * the six fall below 3:1 on a dark surface. So the hue is extracted and kept,
 * and lightness/chroma are re-derived in OKLCH at a constant L per role — that
 * constant-L step is what makes the six read as one palette.
 *
 * Output is pasted into `src/theme/palette.js`. Re-run when a new set ships in
 * case Riot adjusts the printed colors.
 */

import { PNG } from 'pngjs';

const RUNE_QUERY = 'https://api.riftcodex.com/cards?size=100&set_id=ogn';
const SURFACE: RGB = [0x12, 0x14, 0x1a];

const L_BASE = 0.7;
const L_BRIGHT = 0.82;
const L_DIM = 0.28;
const C_TARGET = 0.16;

type RGB = [number, number, number];

/* ---------- color space ---------- */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function srgbToOklab([R, G, B]: RGB): [number, number, number] {
  const r = toLinear(R / 255), g = toLinear(G / 255), b = toLinear(B / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToSrgb([L, a, bb]: [number, number, number]): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
  ];
}

const inGamut = (rgb: RGB) => rgb.every((v) => v >= -0.5 && v <= 255.5);
const lchToLab = (L: number, C: number, H: number): [number, number, number] =>
  [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
const hue = (rgb: RGB) => {
  const [, a, b] = srgbToOklab(rgb);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};
const hex = (rgb: RGB) =>
  '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Largest chroma that stays inside sRGB at this lightness and hue. */
function maxChroma(L: number, H: number): number {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToSrgb(lchToLab(L, mid, H)))) lo = mid;
    else hi = mid;
  }
  return lo;
}
const build = (L: number, C: number, H: number) =>
  hex(oklabToSrgb(lchToLab(L, Math.min(C, maxChroma(L, H)), H)));

const luminance = (rgb: RGB) =>
  0.2126 * toLinear(rgb[0] / 255) + 0.7152 * toLinear(rgb[1] / 255) + 0.0722 * toLinear(rgb[2] / 255);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const parseHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

/* ---------- sampling ---------- */

function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const d = max - min;
  return [0, max ? d / max : 0, max];
}

/**
 * Dominant field color of a rune card.
 *
 * Restricted to the art window, then filtered to saturated mid-tones: the
 * symbol itself is near-white and the vignette near-black, so both drop out.
 */
function dominantColor(png: PNG): RGB {
  const { width: W, height: H, data } = png;
  const x0 = Math.floor(W * 0.12), x1 = Math.floor(W * 0.88);
  const y0 = Math.floor(H * 0.07), y1 = Math.floor(H * 0.5);

  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (W * y + x) << 2;
      const px: RGB = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (data[i + 3]! < 250) continue;
      const [, s, v] = rgbToHsv(px);
      if (s < 0.35 || v < 0.2 || v > 0.97) continue;
      const key = `${px[0] >> 3}_${px[1] >> 3}_${px[2] >> 3}`;
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += px[0]; e.g += px[1]; e.b += px[2];
      bins.set(key, e);
    }
  }

  const top = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  const n = top.reduce((s, e) => s + e.n, 0);
  return [
    top.reduce((s, e) => s + e.r, 0) / n,
    top.reduce((s, e) => s + e.g, 0) / n,
    top.reduce((s, e) => s + e.b, 0) / n,
  ];
}

async function main() {
  const res = await fetch(RUNE_QUERY);
  const { items } = (await res.json()) as {
    items: {
      name: string;
      classification: { type: string; supertype: string | null; domain: string[] };
      metadata: { alternate_art: boolean };
      media: { image_url: string };
    }[];
  };

  const runes = items.filter(
    (c) => c.classification.type === 'Rune' && c.classification.supertype === 'Basic' && !c.metadata.alternate_art
  );

  console.log('domain     print     hue     base      bright    dim       base:surface');

  for (const rune of runes) {
    const domain = rune.classification.domain[0];
    if (!domain) continue;

    const url = new URL(rune.media.image_url);
    url.searchParams.set('w', '320');
    url.searchParams.set('fm', 'png');

    const png = PNG.sync.read(Buffer.from(await (await fetch(url)).arrayBuffer()));
    const print = dominantColor(png);
    const H = hue(print);

    const base = build(L_BASE, C_TARGET, H);
    const bright = build(L_BRIGHT, C_TARGET * 0.85, H);
    const dim = build(L_DIM, C_TARGET * 0.55, H);

    console.log(
      domain.padEnd(10),
      hex(print),
      String(Math.round(H)).padStart(5),
      '  ', base, ' ', bright, ' ', dim, ' ',
      contrast(parseHex(base), SURFACE).toFixed(2).padStart(5)
    );
  }

  console.log('\nPaste the results into src/theme/palette.js.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
