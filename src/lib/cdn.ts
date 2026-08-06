/**
 * Card image URLs.
 *
 * Every image request in the app goes through this module. Two reasons:
 *
 * 1. **Size.** Riot serves card art from a Sanity CDN that supports on-the-fly
 *    transforms. A source PNG is ~790 KB; the same image at `w=240&fm=webp&q=70`
 *    is ~9 KB — 83x smaller (measured, docs/API.md §5). A 1,451-card grid is
 *    impossible at full size and trivial at thumbnail size.
 *
 * 2. **Portability.** Hotlinking Riot's CDN is the standard approach for fan
 *    apps, but if it ever stops working this is the single place that has to
 *    change to point at a proxy or a self-hosted cache.
 */

export type ImagePreset = 'thumb' | 'card' | 'full';

const PRESETS: Record<ImagePreset, { w: number; q: number }> = {
  /** Gallery grid, deck list rows. */
  thumb: { w: 240, q: 70 },
  /** Deck builder rail, medium cards. */
  card: { w: 480, q: 80 },
  /** Card detail, pinch-zoom. */
  full: { w: 744, q: 90 },
};

/**
 * Apply a transform preset to a card image URL.
 *
 * Source URLs already carry `?accountingTag=RB`, so parameters are appended to
 * the existing query rather than replacing it.
 */
export function cardImage(url: string | null | undefined, preset: ImagePreset = 'thumb'): string | undefined {
  if (!url) return undefined;

  const { w, q } = PRESETS[preset];

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('w', String(w));
    parsed.searchParams.set('fm', 'webp');
    parsed.searchParams.set('q', String(q));
    return parsed.toString();
  } catch {
    // A malformed URL should degrade to no image, never throw into a list render.
    return undefined;
  }
}

/**
 * Low-resolution placeholder for progressive loading, used as expo-image's
 * `placeholder` so the grid never flashes empty rectangles while scrolling.
 */
export function cardImageBlur(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('w', '24');
    parsed.searchParams.set('fm', 'webp');
    parsed.searchParams.set('q', '30');
    parsed.searchParams.set('blur', '20');
    return parsed.toString();
  } catch {
    return undefined;
  }
}
