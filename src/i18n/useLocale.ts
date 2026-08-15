import { create } from 'zustand';

import { setStoredLocale, storedLocale } from '../db/queries/settings';

import { LOCALES, type Locale, type RuntimeLocale } from './types';

/**
 * Which language the app is speaking.
 *
 * Device locale by default, overridable in Settings — the override matters more
 * than it looks: a player whose phone is in English but who thinks about the
 * game in German is an ordinary case, and a picker is the only way to serve it.
 *
 * **Persisted since the Settings screen shipped**, in the `settings` table.
 *
 * Not read at module scope, though, and that is the whole design of this file.
 * The store initialises from the *device* locale, which needs nothing but the
 * OS; the stored override is loaded by `loadStoredLocale()` once the database
 * has migrated. So a language choice survives a restart without the database
 * becoming something the app must have before it can render its first frame.
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

/** Every value the picker can produce, for validating what came out of storage. */
function isRuntimeLocale(value: string): value is RuntimeLocale {
  return value === 'pseudo' || (LOCALES as readonly string[]).includes(value);
}

export const useLocale = create<LocaleState>((set) => ({
  locale: deviceLocale(),
  setLocale: (locale) => {
    set({ locale });
    /*
     * Written through, and failure is swallowed on purpose.
     *
     * The user's language has already changed by the line above; a database
     * that will not take the write should cost them the preference next
     * launch, not the language change they just made.
     *
     * Imported statically, unlike `expo-localization` above. The settings query
     * reaches its handle through `connection.ts`, which already defers
     * `expo-sqlite` behind its own lazy require — so this pulls in no native
     * module and `lib/`'s Node tests stay loadable.
     */
    try {
      setStoredLocale(locale);
    } catch {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[i18n] could not persist the language choice');
      }
    }
  },
}));

/**
 * Apply the stored language override, if there is one.
 *
 * Called once from the root layout after migrations have run. Silent when there
 * is nothing stored, which is every first launch — the device locale already
 * chosen at store creation is the right answer in that case.
 *
 * An unrecognised stored value is ignored rather than repaired. That is what a
 * downgrade looks like: a build that no longer speaks the language someone
 * picked should fall back, not crash and not rewrite their preference.
 */
export function loadStoredLocale(): void {
  try {
    const stored = storedLocale();
    if (stored !== null && isRuntimeLocale(stored)) {
      useLocale.setState({ locale: stored });
    }
  } catch {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[i18n] could not read the stored language — using the device locale');
    }
  }
}
