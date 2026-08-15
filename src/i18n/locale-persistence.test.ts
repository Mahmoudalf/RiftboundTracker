import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../db/connection';
import { MIGRATIONS } from '../db/migrations';
import { setStoredLocale, storedLocale } from '../db/queries/settings';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../db/testing';

import { loadStoredLocale, useLocale } from './useLocale';

/**
 * The language choice, across a restart.
 *
 * Two modules that must agree and have no compiler-visible link between them:
 * `useLocale` reaches the query layer through a lazy `require`, precisely so
 * that `lib/`'s Node tests do not drag a database in. A lazy require is exactly
 * the kind of edge nothing else checks — a wrong path typechecks, lints, and
 * fails only on a device — so it is checked here.
 *
 * `loadStoredLocale` standing in for a restart is fair: it is the only thing
 * the root layout calls, and the store is module state that survives between
 * these cases the same way it survives a navigation.
 */

let db: TestDatabase;

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
  // `deviceLocale()` finds no expo-localization under Node and answers 'en',
  // which is the state a fresh store is in anyway.
  useLocale.setState({ locale: 'en' });
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

describe('choosing a language', () => {
  it('writes through to the database', () => {
    useLocale.getState().setLocale('de');

    expect(useLocale.getState().locale).toBe('de');
    expect(storedLocale()).toBe('de');
  });

  it('survives a restart', () => {
    useLocale.getState().setLocale('fr');

    // The store as a fresh launch would build it — device locale, nothing else.
    useLocale.setState({ locale: 'en' });
    loadStoredLocale();

    expect(useLocale.getState().locale).toBe('fr');
  });
});

describe('loading a stored language', () => {
  it('leaves the device locale alone when nothing is stored', () => {
    loadStoredLocale();
    expect(useLocale.getState().locale).toBe('en');
  });

  it('ignores a value this build does not speak', () => {
    // What a downgrade looks like: someone picked a language, then installed a
    // build that no longer has it. Falling back beats crashing, and the stored
    // value is deliberately left in place rather than repaired — the older
    // build has no business editing the newer one's preference.
    setStoredLocale('kr');
    loadStoredLocale();

    expect(useLocale.getState().locale).toBe('en');
    expect(storedLocale()).toBe('kr');
  });

  it('does not write anything back', () => {
    setStoredLocale('de');
    loadStoredLocale();

    // Loading is a read. If it ever routed through `setLocale` it would write
    // on every launch, which is how a preference file ends up rewritten by the
    // act of reading it.
    const rows = db.getAllSync<{ n: number }>('SELECT COUNT(*) AS n FROM settings');
    expect(rows[0]?.n).toBe(1);
  });
});

describe('a database that will not answer', () => {
  it('still changes the language', () => {
    // The write is best-effort by design: the user's language has already
    // changed by the time the store reaches for the database, and a failed
    // write should cost them the preference next launch, not the change they
    // just made.
    setTestConnection({
      execSync: () => {},
      getFirstSync: () => {
        throw new Error('no database');
      },
      getAllSync: () => {
        throw new Error('no database');
      },
      runSync: () => {
        throw new Error('no database');
      },
      withTransactionSync: (fn: () => void) => fn(),
    });

    expect(() => useLocale.getState().setLocale('de')).not.toThrow();
    expect(useLocale.getState().locale).toBe('de');

    // And reading is equally forgiving.
    expect(() => loadStoredLocale()).not.toThrow();
  });
});
