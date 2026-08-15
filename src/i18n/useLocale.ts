import { create } from 'zustand';

import { LOCALES, type Locale, type RuntimeLocale } from './types';

/**
 * Which language the app is speaking.
 *
 * Device locale by default, overridable in Profile — the override matters more
 * than it looks: a player whose phone is in English but who thinks about the
 * game in German is an ordinary case, and a picker is the only way to serve it.
 *
 * The value is **not persisted yet**. Persisting a preference means a store
 * write on first launch and a read before first paint, and neither is worth
 * building before the strings themselves exist. Filed rather than forgotten —
 * see the roadmap's M7B list.
 */

/**
 * The device's language, if it is one the app speaks.
 *
 * `getLocales()` returns entries like `de-AT`, so only the language subtag is
 * compared — an Austrian phone gets German rather than falling back to English
 * over a region code the app does not care about.
 */
export function deviceLocale(): Locale {
  /*
   * Required lazily, and wrapped, because this is a **native** module.
   *
   * Two separate problems, one fix:
   *
   * - `expo-localization` was added to `app.json` as a config plugin, so a dev
   *   build compiled before it was installed does not contain it. A static
   *   import would then throw at *module scope*, taking the app down before
   *   first paint rather than failing somewhere recoverable.
   * - It also cannot be parsed by Vitest. `lib/` is pure, tested-in-Node code
   *   and several modules there now translate their output — a static import
   *   here would drag a React Native module into every one of those test files
   *   and break the suite. It did: `findings.test.ts` failed to load the moment
   *   `findings.ts` started calling `t()`.
   *
   * A missing device locale is not worth either. English is a correct answer,
   * and the picker in Profile still reaches every language.
   */
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    for (const entry of getLocales()) {
      const language = entry.languageCode?.toLowerCase();
      const match = LOCALES.find((l) => l === language);
      if (match) return match;
    }
  } catch {
    // `typeof` guarded: `__DEV__` is a React Native global and does not exist
    // in Node, where this module is now reachable from `lib/`'s test suite.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[i18n] expo-localization unavailable — defaulting to English. ' +
          'Rebuild the dev client to pick up the phone’s language.'
      );
    }
  }
  return 'en';
}

interface LocaleState {
  locale: RuntimeLocale;
  setLocale: (locale: RuntimeLocale) => void;
}

export const useLocale = create<LocaleState>((set) => ({
  locale: deviceLocale(),
  setLocale: (locale) => set({ locale }),
}));
