import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  adjustCardQuantity,
  binderQuantities,
  createBinder,
  deleteBinder,
  listBinders,
  ownedCounts,
  quantityIn,
} from './collection';

/**
 * Audit probes — things that should be impossible, attempted directly.
 *
 * Separate from `collection.test.ts`, which asserts the feature works. These
 * try to break it: reuse a soft-deleted binder's key space, drive quantities
 * past the boundaries, and confirm a foreign-key cascade that is configured but
 * intentionally unreachable.
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

function seedCard(id: string): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      id,
      id,
      1,
      'Unit',
      'Common',
      '["Fury"]',
      'Fury',
      '[]',
      'OGN',
      'Origins',
      'https://cdn.example/a-744x1039.png',
      'A',
      'portrait',
    ]
  );
  return { id, riftboundId: `ogn-${id}-1`, name: id, cleanName: id } as CardRow;
}

describe('probe: the unique index under a soft delete', () => {
  /*
   * `binder_cards` has no `deleted_at`, so a deleted binder's rows survive with
   * live-looking keys. If anything ever wrote to that binder again it would
   * upsert into a tombstone. Nothing can today — the rail only lists live
   * binders — but the write path must not depend on the UI for that.
   */
  it('upserts into a tombstoned binder without corrupting anything', () => {
    const id = createBinder({ name: 'Deleted' });
    const card = seedCard('a');
    adjustCardQuantity(id, card, 2);
    deleteBinder(id);

    // Reaching past the UI, exactly as a stale reference would.
    expect(() => adjustCardQuantity(id, card, 1)).not.toThrow();

    // One row, not two — the index still holds across the tombstone.
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(1);
    // And it still does not count towards what you own.
    expect(ownedCounts().has('a')).toBe(false);
  });
});

describe('probe: quantity boundaries', () => {
  it('cannot be driven negative by repeated removes', () => {
    const id = createBinder({ name: 'B' });
    const card = seedCard('a');

    adjustCardQuantity(id, card, 1);
    for (let i = 0; i < 5; i++) adjustCardQuantity(id, card, -1);

    expect(quantityIn(id, 'a')).toBe(0);
    expect(
      db.getFirstSync<{ n: number | null }>('SELECT MIN(quantity) AS n FROM binder_cards')!.n
    ).toBeNull();
  });

  it('survives a large count without overflowing the sum', () => {
    const id = createBinder({ name: 'Bulk' });
    adjustCardQuantity(id, seedCard('a'), 100_000);
    expect(ownedCounts().get('a')).toBe(100_000);
  });

  it('ignores a zero adjustment instead of creating an empty row', () => {
    const id = createBinder({ name: 'B' });
    adjustCardQuantity(id, seedCard('a'), 0);
    expect(binderQuantities(id).size).toBe(0);
  });
});

describe('probe: the cascade nothing can reach', () => {
  /*
   * The FK is `ON DELETE CASCADE`, and `deleteBinder` is a soft delete, so the
   * cascade never fires in the app. Asserted anyway: if a hard delete is ever
   * added — for a real "delete permanently" — this says what it will do, and
   * confirms foreign keys are actually on in the test harness.
   */
  it('takes the cards with it on a hard delete', () => {
    const id = createBinder({ name: 'B' });
    adjustCardQuantity(id, seedCard('a'), 3);

    db.runSync('DELETE FROM binders WHERE id = ?', [id]);

    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(0);
  });

  it('refuses a card row pointing at no binder at all', () => {
    expect(() =>
      db.runSync(
        `INSERT INTO binder_cards
           (id, binder_id, card_id, quantity, created_at, updated_at)
         VALUES ('x', 'nope', 'a', 1, '2026-01-01', '2026-01-01')`
      )
    ).toThrow();
  });
});

describe('probe: upgrading a device that already has a collection', () => {
  /*
   * Migration 13 adds `finish` to a table that already holds rows on any device
   * that used the previous build. The dangerous part is the index swap — the
   * old unique index is on (binder_id, card_id) and the new one adds finish, so
   * a botched migration either drops the constraint or fails on existing data.
   */
  it('keeps existing rows and defaults them to standard', () => {
    const upgrading = createTestDatabase();
    applyMigrationsUpTo(upgrading, MIGRATIONS, 12);
    setTestConnection(upgrading);

    upgrading.runSync(
      `INSERT INTO binders (id, name, sort_order, created_at, updated_at)
       VALUES ('b1', 'Existing', 0, '2026-01-01', '2026-01-01')`
    );
    upgrading.runSync(
      `INSERT INTO binder_cards
         (id, binder_id, card_id, card_name, quantity, created_at, updated_at)
       VALUES ('r1', 'b1', 'vi', 'Vi', 3, '2026-01-01', '2026-01-01')`
    );

    applyMigrationsUpTo(upgrading, MIGRATIONS, 13);

    // The copies survive, attributed to standard — claiming they were foil
    // would invent information nobody recorded.
    expect(binderQuantities('b1').get('vi')).toEqual({ standard: 3, foil: 0, total: 3 });

    // The new constraint is live: same card, same binder, same finish collides.
    expect(() =>
      upgrading.runSync(
        `INSERT INTO binder_cards
           (id, binder_id, card_id, quantity, finish, created_at, updated_at)
         VALUES ('r2', 'b1', 'vi', 1, 'standard', '2026-01-01', '2026-01-01')`
      )
    ).toThrow();

    // ...and the same card in the other finish is now allowed, which is the
    // whole point of the index change.
    expect(() =>
      upgrading.runSync(
        `INSERT INTO binder_cards
           (id, binder_id, card_id, quantity, finish, created_at, updated_at)
         VALUES ('r3', 'b1', 'vi', 1, 'foil', '2026-01-01', '2026-01-01')`
      )
    ).not.toThrow();

    expect(binderQuantities('b1').get('vi')).toEqual({ standard: 3, foil: 1, total: 4 });

    setTestConnection(null);
    upgrading.close();
  });
});

describe('probe: migration 14 repairs stored card names', () => {
  /*
   * Migration 12 stored the API's normalised search string in
   * `binder_cards.card_name`. Every other table stores the display name, and
   * `cardKey()` derives identity from the display form — so ownership could
   * never have matched a deck. Migration 14 repairs it from the mirror.
   */
  it('rewrites a normalised name to the display name', () => {
    const upgrading = createTestDatabase();
    applyMigrationsUpTo(upgrading, MIGRATIONS, 13);
    setTestConnection(upgrading);

    upgrading.runSync(
      `INSERT INTO cards
         (id, riftbound_id, name, clean_name, collector_number, type, rarity,
          domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
       VALUES ('vi','ogn-vi-1','Vi - Piltover Enforcer (Signature)',
               'Vi Piltover Enforcer Signature',1,'Unit','Rare',
               '["Fury"]','Fury','[]','OGN','Origins','https://x/a.png','A','portrait')`
    );
    upgrading.runSync(
      `INSERT INTO binders (id, name, sort_order, created_at, updated_at)
       VALUES ('b1','B',0,'2026-01-01','2026-01-01')`
    );
    // Exactly what migration 12 would have written.
    upgrading.runSync(
      `INSERT INTO binder_cards
         (id, binder_id, card_id, card_name, quantity, finish, created_at, updated_at)
       VALUES ('r1','b1','vi','Vi Piltover Enforcer Signature',2,'standard','2026-01-01','2026-01-01')`
    );
    // A row whose printing has already left the library.
    upgrading.runSync(
      `INSERT INTO binder_cards
         (id, binder_id, card_id, card_name, quantity, finish, created_at, updated_at)
       VALUES ('r2','b1','ghost','Gone Card',1,'standard','2026-01-01','2026-01-01')`
    );

    applyMigrationsUpTo(upgrading, MIGRATIONS, 14);

    const names = upgrading.getAllSync<{ id: string; card_name: string }>(
      'SELECT id, card_name FROM binder_cards ORDER BY id'
    );
    expect(names).toEqual([
      { id: 'r1', card_name: 'Vi - Piltover Enforcer (Signature)' },
      // Unresolvable rows keep what they have: a slightly wrong name beats none.
      { id: 'r2', card_name: 'Gone Card' },
    ]);
    // Quantities are untouched — this repairs a label, not a count.
    expect(
      upgrading.getFirstSync<{ n: number }>('SELECT SUM(quantity) AS n FROM binder_cards')!.n
    ).toBe(3);

    setTestConnection(null);
    upgrading.close();
  });
});

describe('probe: binders are independent', () => {
  it('removing a card from one binder leaves the other alone', () => {
    const a = createBinder({ name: 'A' });
    const b = createBinder({ name: 'B' });
    const card = seedCard('x');

    adjustCardQuantity(a, card, 2);
    adjustCardQuantity(b, card, 2);
    adjustCardQuantity(a, card, -2);

    expect(quantityIn(a, 'x')).toBe(0);
    expect(quantityIn(b, 'x')).toBe(2);
    expect(ownedCounts().get('x')).toBe(2);
  });

  it('renaming one binder does not touch another with the same name', () => {
    const a = createBinder({ name: 'Binder' });
    createBinder({ name: 'Binder' });

    expect(listBinders()).toHaveLength(2);
    expect(listBinders().filter((x) => x.id === a).length).toBe(1);
  });
});
