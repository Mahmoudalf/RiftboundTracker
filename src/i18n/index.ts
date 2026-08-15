import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { pseudo } from './pseudo';
import type { Catalogue, Key, Locale, Placeholders, RuntimeLocale, Translation } from './types';
import { useLocale } from './useLocale';

export { LOCALES, type Key, type Locale, type RuntimeLocale } from './types';
export { useLocale, deviceLocale, loadStoredLocale } from './useLocale';
export { pseudo } from './pseudo';
export { en } from './en';
export { de } from './de';
export { fr } from './fr';

/**
 * Translation, in about forty lines and no dependency.
 *
 * `i18next` and `i18n-js` were both considered and neither earns its weight
 * here: 250 strings across 3 locales needs a lookup and an interpolation, and
 * what this app actually wants from an i18n layer — **a key that fails to
 * compile when it does not exist** — is the one thing neither library gives.
 * `Key` is derived from the English catalogue, so `t('game.rezult.win')` is a
 * typecheck error rather than a blank label found in review.
 *
 * The catalogue is the durable asset and the runtime is deliberately thin: if
 * this ever does need a library — ICU message format, gendered plurals, a
 * translation-management platform — the files stay and only this file goes.
 */

const CATALOGUES: Record<Locale, Translation> = { en, de, fr };

/**
 * The second argument to `t`, if the string needs one.
 *
 * Written as a conditional **over `K` itself** rather than straight over
 * `Placeholders<Catalogue[K]>`. The difference is only in the error message,
 * and the message is the point: with the naive form, a mistyped key made
 * TypeScript widen `K` to the whole key union, whose placeholders are non-empty,
 * so it reported *"Expected 2 arguments, but got 1"* — blaming the arguments for
 * a typo in the key. Guarding on `K extends Key` first makes the constraint
 * failure surface as itself.
 */
type Params<K> = K extends Key
  ? Placeholders<Catalogue[K]> extends never
    ? []
    : [Record<Placeholders<Catalogue[K]>, string | number>]
  : never;

/** Fill `{named}` placeholders. Unknown names are left visible, never blanked. */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Look a key up in a locale, falling back to English.
 *
 * The fallback is what lets `de.ts` and `fr.ts` be `Partial` — a key nobody has
 * translated yet renders in English rather than as an empty box. That is a
 * development convenience only: `i18n.test.ts` fails the build if either file
 * is incomplete, so a gap cannot reach a release by being tolerated at runtime.
 */
function lookup(locale: RuntimeLocale, key: Key): string {
  if (locale === 'pseudo') return pseudo(en[key]);
  return CATALOGUES[locale][key] ?? en[key];
}

/**
 * Translate, outside React.
 *
 * Reads the store imperatively, so `lib/` helpers that format a label can use it
 * without becoming hooks. Components should prefer `useT()` below — this one
 * does not subscribe, so a component calling it will not re-render when the
 * language changes.
 */
export function t<K extends Key>(key: K, ...params: Params<K>): string {
  const template = lookup(useLocale.getState().locale, key);
  const values = params[0];
  return values ? interpolate(template, values) : template;
}

/**
 * Translate, inside React.
 *
 * Subscribes to the locale, so switching language re-renders the screen. The
 * returned function is the same `t` — the hook exists for the subscription, not
 * for a different implementation, because two implementations of translation is
 * how the two come to disagree.
 */
export function useT(): typeof t {
  useLocale((s) => s.locale);
  return t;
}
