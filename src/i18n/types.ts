import type { en } from './en';

/**
 * The shape of a translation, and how a key is checked.
 *
 * English is the **source**, not one locale among three: `Key` is derived from
 * it, so a key that does not exist in `en.ts` is a typecheck failure at every
 * call site rather than an empty string on a screen. Adding a string is
 * therefore a two-step act by construction — write the English, then translate
 * it — and the compiler will not let the second step be skipped silently.
 */

export const LOCALES = ['en', 'de', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Every locale the app can be *set* to, including the development one.
 *
 * `pseudo` is not a language. It is English mechanically lengthened and
 * accented, used to find the places where a translation will break the layout
 * **before** any translation exists — see `pseudo.ts`. Kept out of `LOCALES` so
 * it can never appear in a language picker or be persisted as a preference.
 */
export type RuntimeLocale = Locale | 'pseudo';

export type Catalogue = typeof en;
export type Key = keyof Catalogue;

/**
 * The placeholder names a string expects, read out of the string itself.
 *
 * `'Logged · {deck} now {record}'` yields `'deck' | 'record'`, so passing the
 * wrong parameter name — or forgetting one — fails to compile. Four lines of
 * recursive template-literal types buys the whole class of "the interpolation
 * silently rendered `{deck}` to the user".
 */
export type Placeholders<S extends string> =
  S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholders<Rest> : never;

/**
 * A translation file other than the source.
 *
 * `Partial` on purpose, with a runtime fallback to English and a **test** that
 * asserts completeness. Requiring every key at compile time sounds stricter and
 * is worse in practice: adding one English string would break the build until
 * both translations were written, which pushes people towards writing the
 * translation badly rather than writing it later. The test is the gate, and it
 * names exactly which keys are missing.
 */
export type Translation = Partial<Record<Key, string>>;
