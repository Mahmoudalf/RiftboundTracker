import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  DISPLAY_NAME_MAX,
  completeOnboarding,
  displayName,
  onboardingDone,
  setDisplayName,
  setStoredLocale,
  storedLocale,
} from './settings';

/**
 * Preferences, against real SQLite.
 *
 * A key/value store has one failure mode worth defending: the absent case.
 * Every accessor here is read on a fresh install, where the table is empty, and
 * every one of them must answer without throwing.
 */

let db: TestDatabase;

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

describe('a fresh install', () => {
  it('has no display name and no stored locale', () => {
    expect(displayName()).toBeNull();
    expect(storedLocale()).toBeNull();
  });

  it('has not seen onboarding', () => {
    // The whole gate rests on this: an empty table must read as "show the
    // welcome", not as an error and not as "already done".
    expect(onboardingDone()).toBe(false);
  });
});

describe('onboarding', () => {
  it('stays done once completed', () => {
    completeOnboarding();
    expect(onboardingDone()).toBe(true);

    // Idempotent — the flow calls this on every exit path, and a second call
    // must not throw on the primary key.
    completeOnboarding();
    expect(onboardingDone()).toBe(true);
  });

  it('is independent of whether a name was given', () => {
    // Skipping every optional step still counts as having seen it. Inferring
    // "onboarded" from a display name would replay the welcome forever for
    // anyone who skipped.
    completeOnboarding();
    expect(displayName()).toBeNull();
    expect(onboardingDone()).toBe(true);
  });
});

describe('display name', () => {
  it('round-trips', () => {
    setDisplayName('Linus');
    expect(displayName()).toBe('Linus');
  });

  it('replaces rather than accumulating', () => {
    setDisplayName('First');
    setDisplayName('Second');

    expect(displayName()).toBe('Second');
    // The ON CONFLICT clause is the whole reason a second write is not an
    // error. If it ever became an INSERT, this row count catches it.
    const rows = db.getAllSync<{ n: number }>('SELECT COUNT(*) AS n FROM settings');
    expect(rows[0]?.n).toBe(1);
  });

  it('trims on write, so the stored value is the value', () => {
    setDisplayName('  Linus  ');
    expect(displayName()).toBe('Linus');
  });

  it('treats blank and whitespace-only as clearing it', () => {
    setDisplayName('Linus');
    setDisplayName('   ');
    expect(displayName()).toBeNull();

    setDisplayName('Linus');
    setDisplayName(null);
    expect(displayName()).toBeNull();
  });

  it('caps the length rather than storing an essay', () => {
    setDisplayName('x'.repeat(DISPLAY_NAME_MAX + 50));
    expect(displayName()).toHaveLength(DISPLAY_NAME_MAX);
  });

  it('keeps names the app must not mangle', () => {
    // Non-ASCII is the ordinary case in two of three shipped languages, and an
    // apostrophe is the character a hand-built SQL string would break on.
    for (const name of ['Jörg', "O'Brien", 'François', '日本語']) {
      setDisplayName(name);
      expect(displayName()).toBe(name);
    }
  });
});

describe('locale', () => {
  it('round-trips and clears', () => {
    setStoredLocale('de');
    expect(storedLocale()).toBe('de');

    setStoredLocale(null);
    expect(storedLocale()).toBeNull();
  });

  it('is independent of the display name', () => {
    setDisplayName('Linus');
    setStoredLocale('fr');
    setStoredLocale(null);

    // Clearing one key must not touch another — the DELETE is keyed, and a
    // missing WHERE clause would pass every test above but fail this one.
    expect(displayName()).toBe('Linus');
  });
});
