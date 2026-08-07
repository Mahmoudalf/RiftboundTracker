import { describe, expect, it } from 'vitest';

import { LATEST_VERSION, MIGRATIONS, migrate, rebuildSearchIndex } from './migrations';
import {
  applyMigrationsUpTo,
  createTestDatabase,
  insertCard,
  listTables,
  type TestDatabase,
} from './testing';

/**
 * Migration tests run the real DDL against a real SQLite database.
 *
 * The point is the **upgrade path**, not the fresh install. Migrating an empty
 * database forward proves almost nothing; what matters is that a populated
 * database on someone's phone survives the next version. M2 adds decks and
 * match history at v3, and by then a wiped card mirror is an annoyance while a
 * wiped deck history is unrecoverable.
 *
 * The parameterised suite at the bottom covers every version automatically, so
 * a new migration is tested the moment it is added to MIGRATIONS.
 */

const search = (db: TestDatabase, term: string) =>
  db.getAllSync<{ id: string }>(
    `SELECT c.id FROM cards c WHERE c.rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`,
    [term]
  );

describe('migrate — fresh database', () => {
  it('applies every migration and records the version', () => {
    const db = createTestDatabase();
    const result = migrate(db as never);

    expect(result).toEqual({ from: 0, to: LATEST_VERSION });
    expect(db.userVersion()).toBe(LATEST_VERSION);
    expect(listTables(db)).toEqual(expect.arrayContaining(['cards', 'sets', 'sync_meta', 'cards_fts']));
    db.close();
  });

  it('seeds the single sync_meta row exactly once', () => {
    const db = createTestDatabase();
    migrate(db as never);
    migrate(db as never);

    const rows = db.getAllSync<{ id: number }>('SELECT id FROM sync_meta');
    expect(rows).toHaveLength(1);
    db.close();
  });

  it('is idempotent — a second run changes nothing', () => {
    const db = createTestDatabase();
    migrate(db as never);
    const id = insertCard(db, { name: 'Vi' });

    const second = migrate(db as never);
    expect(second.from).toBe(LATEST_VERSION);
    expect(db.getAllSync('SELECT id FROM cards')).toHaveLength(1);
    expect(db.getFirstSync<{ name: string }>('SELECT name FROM cards WHERE id = ?', [id])?.name).toBe('Vi');
    db.close();
  });
});

describe('migrate — upgrade path from a populated database', () => {
  it('preserves card rows when upgrading v1 -> latest', () => {
    const db = createTestDatabase();

    // A device on the previous release: schema v1, real data, no FTS table yet.
    applyMigrationsUpTo(db, MIGRATIONS, 1);
    expect(db.userVersion()).toBe(1);
    expect(listTables(db)).not.toContain('cards_fts');

    const ids = [
      insertCard(db, { name: 'Vi', clean_name: 'Vi' }),
      insertCard(db, { name: 'Jinx', clean_name: 'Jinx' }),
      insertCard(db, { name: 'Viktor', clean_name: 'Viktor' }),
    ];
    db.runSync('UPDATE sync_meta SET card_count = ?, last_synced_at = ? WHERE id = 1', [
      3,
      '2026-08-01T00:00:00Z',
    ]);

    const result = migrate(db as never);

    expect(result).toEqual({ from: 1, to: LATEST_VERSION });
    expect(db.getAllSync('SELECT id FROM cards')).toHaveLength(3);
    for (const id of ids) {
      expect(db.getFirstSync('SELECT id FROM cards WHERE id = ?', [id])).not.toBeNull();
    }

    // sync_meta must survive too, or every device re-downloads the library.
    const meta = db.getFirstSync<{ card_count: number; last_synced_at: string }>(
      'SELECT card_count, last_synced_at FROM sync_meta WHERE id = 1'
    );
    expect(meta?.card_count).toBe(3);
    expect(meta?.last_synced_at).toBe('2026-08-01T00:00:00Z');
    db.close();
  });

  it('indexes rows that already existed before the FTS table was added', () => {
    const db = createTestDatabase();
    applyMigrationsUpTo(db, MIGRATIONS, 1);
    insertCard(db, { name: 'Vi', clean_name: 'Vi', text_plain: 'Punch things.' });
    insertCard(db, { name: 'Jinx', clean_name: 'Jinx', text_plain: 'Blow things up.' });

    migrate(db as never);

    // Regression guard. The v2 triggers only fire on writes made after they
    // exist, so the migration has to backfill the index itself. It cannot lean
    // on syncCards to do it: sync skips entirely when the mirror is already
    // complete, which is exactly the state an upgrading device is in. Without
    // the backfill, search returns nothing — silently, and forever.
    expect(search(db, '"vi"*')).toHaveLength(1);
    expect(search(db, '"punch"*')).toHaveLength(1);
    expect(search(db, '"jinx"*')).toHaveLength(1);
    db.close();
  });

  it('rebuildSearchIndex is safe to run again afterwards', () => {
    const db = createTestDatabase();
    applyMigrationsUpTo(db, MIGRATIONS, 1);
    insertCard(db, { name: 'Vi', clean_name: 'Vi' });
    migrate(db as never);

    rebuildSearchIndex(db as never);
    expect(search(db, '"vi"*')).toHaveLength(1);
    db.close();
  });

  it('keeps FTS in sync for writes made after upgrading', () => {
    const db = createTestDatabase();
    applyMigrationsUpTo(db, MIGRATIONS, 1);
    insertCard(db, { name: 'Old Card', clean_name: 'Old Card' });
    migrate(db as never);
    rebuildSearchIndex(db as never);

    const id = insertCard(db, { name: 'Ekko', clean_name: 'Ekko', text_plain: 'Rewind time.' });
    expect(search(db, '"ekko"*')).toHaveLength(1);

    db.runSync('UPDATE cards SET name = ?, text_plain = ? WHERE id = ?', [
      'Ekko Reborn',
      'Stop time.',
      id,
    ]);
    expect(search(db, '"rewind"*')).toHaveLength(0);
    expect(search(db, '"reborn"*')).toHaveLength(1);

    db.runSync('DELETE FROM cards WHERE id = ?', [id]);
    expect(search(db, '"reborn"*')).toHaveLength(0);
    db.close();
  });
});

describe('migrate — every version upgrades a populated database', () => {
  // Parameterised so a new migration is covered the moment it is appended.
  // When M2 adds v3, this runs the v2-populated -> v3 case with no edits.
  for (const migration of MIGRATIONS) {
    const from = migration.version - 1;

    it(`v${from} (populated) -> v${LATEST_VERSION} preserves card data`, () => {
      const db = createTestDatabase();

      if (from === 0) {
        // Nothing exists to populate before the first migration.
        migrate(db as never);
        expect(db.userVersion()).toBe(LATEST_VERSION);
        db.close();
        return;
      }

      applyMigrationsUpTo(db, MIGRATIONS, from);
      const id = insertCard(db, { name: 'Survivor', clean_name: 'Survivor' });
      const before = db.getAllSync('SELECT id FROM cards').length;

      expect(() => migrate(db as never)).not.toThrow();

      expect(db.userVersion()).toBe(LATEST_VERSION);
      expect(db.getAllSync('SELECT id FROM cards')).toHaveLength(before);
      expect(db.getFirstSync('SELECT id FROM cards WHERE id = ?', [id])).not.toBeNull();
      db.close();
    });
  }

  /**
   * The parameterised case above only proves *card* data survives, and cards
   * are disposable. Decks are not — they are the one thing in the database that
   * cannot be regenerated, so the migration that alters `deck_versions` gets
   * its own check with real deck rows in place.
   */
  it('preserves decks and stamps them stale when adding rules_version (v3 -> v4)', () => {
    const db = createTestDatabase();
    applyMigrationsUpTo(db, MIGRATIONS, 3);

    const timestamp = '2026-08-01T10:00:00.000Z';
    db.runSync(
      `INSERT INTO decks (id, name, domains, created_at, updated_at, current_version_id)
       VALUES ('d1', 'Vi Aggro', '["Fury","Order"]', ?, ?, 'v1')`,
      [timestamp, timestamp]
    );
    db.runSync(
      `INSERT INTO deck_versions
         (id, deck_id, version_number, main_count, is_legal, created_at, updated_at)
       VALUES ('v1', 'd1', 1, 40, 1, ?, ?)`,
      [timestamp, timestamp]
    );
    db.runSync(
      `INSERT INTO deck_version_cards
         (id, deck_version_id, card_id, riftbound_id, quantity, zone)
       VALUES ('c1', 'v1', 'card-x', 'ogn-001-100', 3, 'main')`
    );

    expect(() => migrate(db as never)).not.toThrow();
    expect(db.userVersion()).toBe(LATEST_VERSION);

    const deck = db.getFirstSync<{ name: string }>('SELECT name FROM decks WHERE id = ?', ['d1']);
    expect(deck?.name).toBe('Vi Aggro');

    const version = db.getFirstSync<{ main_count: number; rules_version: number }>(
      'SELECT main_count, rules_version FROM deck_versions WHERE id = ?',
      ['v1']
    );
    expect(version?.main_count).toBe(40);
    // Stamped 0, so the query layer recomputes it under the corrected rules
    // rather than trusting a verdict written by the old ones.
    expect(version?.rules_version).toBe(0);

    expect(
      db.getAllSync('SELECT id FROM deck_version_cards WHERE deck_version_id = ?', ['v1'])
    ).toHaveLength(1);

    db.close();
  });

  /**
   * `card_name` is a repair as much as an addition: it exists so a save can
   * tell that a card it is writing is the same card as a row it cannot resolve.
   * That only works if existing decks get named too, so the backfill is the
   * part worth testing — including the row it deliberately cannot name.
   */
  it('backfills card names onto existing deck rows (v4 -> v5)', () => {
    const db = createTestDatabase();
    applyMigrationsUpTo(db, MIGRATIONS, 4);

    const timestamp = '2026-08-01T10:00:00.000Z';
    db.runSync(
      `INSERT INTO cards
         (id, riftbound_id, name, clean_name, type, rarity, domains, domain_key,
          tags, set_id, set_label)
       VALUES ('card-x', 'ogn-001-100', 'Statikk Shock', 'Statikk Shock', 'Spell',
               'Common', '["Fury"]', 'Fury', '[]', 'OGN', 'Origins')`
    );
    db.runSync(
      `INSERT INTO decks (id, name, domains, created_at, updated_at, current_version_id)
       VALUES ('d1', 'Vi Aggro', '["Fury"]', ?, ?, 'v1')`,
      [timestamp, timestamp]
    );
    db.runSync(
      `INSERT INTO deck_versions (id, deck_id, version_number, created_at, updated_at)
       VALUES ('v1', 'd1', 1, ?, ?)`,
      [timestamp, timestamp]
    );
    db.runSync(
      `INSERT INTO deck_version_cards (id, deck_version_id, card_id, riftbound_id, quantity, zone)
       VALUES ('c1', 'v1', 'card-x', 'ogn-001-100', 3, 'main'),
              ('c2', 'v1', 'card-gone', 'ogn-999-999', 1, 'main')`
    );

    migrate(db as never);

    const rows = db.getAllSync<{ id: string; card_name: string | null }>(
      'SELECT id, card_name FROM deck_version_cards ORDER BY id'
    );
    expect(rows).toEqual([
      { id: 'c1', card_name: 'Statikk Shock' },
      // Already unresolvable when the migration ran. Null rather than a
      // fabricated name — the fallback is to preserve the row untouched.
      { id: 'c2', card_name: null },
    ]);

    db.close();
  });

  it('has contiguous, ascending version numbers starting at 1', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
    expect(LATEST_VERSION).toBe(versions[versions.length - 1]);
  });
});
