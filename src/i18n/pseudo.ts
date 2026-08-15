/**
 * Pseudo-localization: English, mechanically broken the way a translation will
 * break it.
 *
 * This exists to answer *"where does the design fall over in German"* **before
 * a word of German is written**, which is the cheapest order to learn it in.
 * Turn it on, walk the app, and every clipped label shows up at once — while the
 * copy is still free to change and nobody has been paid to translate a string
 * that is about to be shortened.
 *
 * It does three jobs at once, and each catches a different failure:
 *
 * 1. **Lengthens by ~35 %.** German runs about 30 % longer than English and
 *    short strings run far worse — "Draw" to "Unentschieden" is +225 %. This
 *    finds the containers that cannot take it. The app has **48**
 *    `numberOfLines={1}` call sites, every one of which clips silently rather
 *    than wrapping, so the failure is invisible without this.
 * 2. **Accents every vowel.** A missing glyph renders as tofu, so this proves
 *    font coverage on real devices. (Space Grotesk and JetBrains Mono were both
 *    checked and carry full de/fr coverage including `ß`, `œ` and guillemets —
 *    this keeps that true as fonts change.)
 * 3. **Brackets the string.** If you can see `⟦` but not `⟧`, that string is
 *    being truncated — which is otherwise indistinguishable from a string that
 *    simply is that long.
 *
 * Placeholders are left **exactly** intact. Mangling `{deck}` would make the
 * interpolation fail and turn a layout test into a bug hunt.
 */

/** Vowels swapped for accented counterparts, so tofu is visible. */
const ACCENTS: Record<string, string> = {
  a: 'á', e: 'é', i: 'î', o: 'ö', u: 'ü', y: 'ÿ', c: 'ç', n: 'ñ', s: 'š', ss: 'ß',
  A: 'Á', E: 'É', I: 'Î', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ',
};

/**
 * How much longer to make it.
 *
 * 0.35 rather than German's average 0.30: the average is measured over running
 * prose, and this app's tight spots hold single words, where the ratio is far
 * worse. Testing at the average would pass containers that real German breaks.
 */
const EXPANSION = 0.35;

/** Padding that reads as filler rather than as a word. */
const PAD = '·';

/**
 * Turn one English string into its pseudo-locale form.
 *
 * Exported and pure so it can be tested — the placeholder-preservation rule is
 * the part that would break quietly and take a debugging session to find.
 */
export function pseudo(source: string): string {
  // Split on placeholders, keeping them, so only the prose between is touched.
  const parts = source.split(/(\{[^}]+\})/g);

  const accented = parts
    .map((part) => {
      if (part.startsWith('{') && part.endsWith('}')) return part;
      return part.replace(/[aeiouycnAEIOUCN]/g, (ch) => ACCENTS[ch] ?? ch);
    })
    .join('');

  // Length is measured on the *visible* text: padding proportional to the
  // placeholder names rather than their values would test the wrong string.
  const visible = source.replace(/\{[^}]+\}/g, '').length;
  const padding = PAD.repeat(Math.max(1, Math.round(visible * EXPANSION)));

  return `⟦${accented}${padding}⟧`;
}
