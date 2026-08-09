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
  FinishNotPrintedError,
  listBinders,
  missingFromLibrary,
  ownedCounts,
  quantityIn,
  renameBinder,
} from './collection';

/**
 * The collection, against real SQLite.
 *
 * The invariant worth defending: owned totals are derived from binders, so
 * there is no second number to keep in step. Most of these tests are really
 * asking one question — can the sum ever disagree with the rows it came from?
 */

let db: TestDatabase;

/** What the screen does: find in the rows it already loaded, not a new query. */
const binderNamed = (id: string) => listBinders().find((b) => b.id === id) ?? null;

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

function seedCard(id: string, name = `Card ${id}`): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      name,
      name,
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
  return {
    id,
    riftboundId: `ogn-${id}-1`,
    tcgplayerId: null,
    name,
    cleanName: name,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    type: 'Unit',
    supertype: null,
    rarity: 'Common',
    domains: ['Fury'],
    domainKey: 'Fury',
    textPlain: null,
    textRich: null,
    flavour: null,
    tags: [],
    setId: 'OGN',
    setLabel: 'Origins',
    imageUrl: 'https://cdn.example/a-744x1039.png',
    artist: 'A',
    accessibilityText: null,
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    updatedOn: null,
  };
}

describe('binder CRUD', () => {
  it('creates, lists, renames and deletes', () => {
    const id = createBinder({ name: 'Trade binder', accent: 'Fury' });

    expect(listBinders()).toHaveLength(1);
    expect(binderNamed(id)?.name).toBe('Trade binder');
    expect(binderNamed(id)?.accent).toBe('Fury');

    renameBinder(id, 'Trades', 'Calm');
    expect(binderNamed(id)?.name).toBe('Trades');
    expect(binderNamed(id)?.accent).toBe('Calm');

    deleteBinder(id);
    expect(listBinders()).toHaveLength(0);
    expect(binderNamed(id)).toBeNull();
  });

  it('soft deletes, so sync can propagate the removal', () => {
    const id = createBinder({ name: 'Gone' });
    deleteBinder(id);

    const row = db.getFirstSync<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM binders WHERE id = ?',
      [id]
    );
    expect(row?.deleted_at).not.toBeNull();
  });

  it('keeps binders in creation order and never reuses a sort slot', () => {
    createBinder({ name: 'First' });
    const second = createBinder({ name: 'Second' });
    deleteBinder(second);
    createBinder({ name: 'Third' });

    expect(listBinders().map((b) => b.name)).toEqual(['First', 'Third']);
  });

  it('falls back to a name rather than storing an empty one', () => {
    const id = createBinder({ name: '   ' });
    expect(binderNamed(id)?.name).toBe('Binder');
  });
});

describe('cards in a binder', () => {
  it('counts distinct cards and total copies separately', () => {
    const id = createBinder({ name: 'Main' });
    adjustCardQuantity(id, seedCard('a'), 3);
    adjustCardQuantity(id, seedCard('b'), 1);

    const binder = binderNamed(id)!;
    expect(binder.distinctCards).toBe(2);
    expect(binder.totalCards).toBe(4);
  });

  it('updates one row rather than adding a second', () => {
    const id = createBinder({ name: 'Main' });
    const card = seedCard('a');

    adjustCardQuantity(id, card, 2);
    adjustCardQuantity(id, card, 3);

    expect(binderQuantities(id).size).toBe(1);
    expect(quantityIn(id, 'a')).toBe(5);
  });

  /*
   * A zero row would be invisible in the UI and still hold the unique index, so
   * the next add would collide with something the user cannot see.
   */
  it('removes the row at zero instead of storing a zero', () => {
    const id = createBinder({ name: 'Main' });
    const card = seedCard('a');

    adjustCardQuantity(id, card, 2);
    adjustCardQuantity(id, card, -2);

    expect(binderQuantities(id).size).toBe(0);
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(0);

    // And the slot is genuinely free again.
    adjustCardQuantity(id, card, 1);
    expect(quantityIn(id, 'a')).toBe(1);
  });

  it('clamps adjustments at zero', () => {
    const id = createBinder({ name: 'Main' });
    const card = seedCard('a');

    expect(adjustCardQuantity(id, card, 1)).toBe(1);
    expect(adjustCardQuantity(id, card, 2)).toBe(3);
    expect(adjustCardQuantity(id, card, -10)).toBe(0);
    expect(binderQuantities(id).size).toBe(0);
  });

  /*
   * The grid draws from `cards`, so a card whose printing has left the library
   * cannot be rendered — but it is still owned, still counted, and must still
   * be nameable. Otherwise a binder reads "61 copies" above 59 tiles and the
   * count looks broken.
   */
  it('still names a card whose printing has left the library', () => {
    const id = createBinder({ name: 'Main' });
    adjustCardQuantity(id, seedCard('ghost', 'Vanished Card'), 2);
    adjustCardQuantity(id, seedCard('here', 'Still Here'), 1);

    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    expect(missingFromLibrary(id)).toEqual([{ name: 'Vanished Card', quantity: 2 }]);
    // Gone from the grid, still owned.
    expect(ownedCounts().get('ghost')).toBe(2);
    expect(binderNamed(id)?.totalCards).toBe(3);
  });

  it('reports nothing missing when every card resolves', () => {
    const id = createBinder({ name: 'Main' });
    adjustCardQuantity(id, seedCard('a'), 1);
    expect(missingFromLibrary(id)).toEqual([]);
  });
});

describe('finishes', () => {
  const unit = () => seedCard('unit', 'Some Unit');

  // `seedCard` writes a plain Unit, so foil-only status comes from the type.
  const asLegend = () => ({ ...unit(), id: 'lg', type: 'Legend' }) as CardRow;

  it('keeps standard and foil as separate rows of the same card', () => {
    const id = createBinder({ name: 'Main' });
    const card = unit();

    adjustCardQuantity(id, card, 3, 'standard');
    adjustCardQuantity(id, card, 1, 'foil');

    const counts = binderQuantities(id).get(card.id)!;
    expect(counts).toEqual({ standard: 3, foil: 1, total: 4 });
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(2);
  });

  it('counts both finishes towards what you own', () => {
    const id = createBinder({ name: 'Main' });
    const card = unit();

    adjustCardQuantity(id, card, 2, 'standard');
    adjustCardQuantity(id, card, 2, 'foil');

    expect(ownedCounts().get(card.id)).toBe(4);
    expect(binderNamed(id)?.totalCards).toBe(4);
    // One card in two treatments is still one card. Counting rows here would
    // report "2 cards · 4 copies" for a single card, which is just wrong.
    expect(binderNamed(id)?.distinctCards).toBe(1);
  });

  it('removes only the finish being adjusted', () => {
    const id = createBinder({ name: 'Main' });
    const card = unit();

    adjustCardQuantity(id, card, 2, 'standard');
    adjustCardQuantity(id, card, 1, 'foil');
    adjustCardQuantity(id, card, -2, 'standard');

    expect(binderQuantities(id).get(card.id)).toEqual({ standard: 0, foil: 1, total: 1 });
    expect(quantityIn(id, card.id)).toBe(1);
  });

  /*
   * The rule enforced at the write, not only in the UI. An earlier version
   * substituted a foil here, so tapping a Legend with Standard selected added a
   * copy the user had not asked for — the one thing a collection tracker must
   * never do. It refuses now, and writes nothing at all.
   */
  it('refuses a finish the card was never printed in', () => {
    const id = createBinder({ name: 'Main' });
    seedCard('lg', 'A Legend');
    const card = asLegend();

    expect(() => adjustCardQuantity(id, card, 1, 'standard')).toThrow(FinishNotPrintedError);

    expect(binderQuantities(id).size).toBe(0);
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(0);
    expect(binderNamed(id)?.totalCards).toBe(0);
  });

  it('accepts the finish that card does have', () => {
    const id = createBinder({ name: 'Main' });
    seedCard('lg', 'A Legend');

    expect(adjustCardQuantity(id, asLegend(), 1, 'foil')).toBe(1);
    expect(binderQuantities(id).get('lg')).toEqual({ standard: 0, foil: 1, total: 1 });
  });

  it('refuses on the default finish too, rather than only when asked explicitly', () => {
    const id = createBinder({ name: 'Main' });
    seedCard('lg', 'A Legend');
    expect(() => adjustCardQuantity(id, asLegend(), 1)).toThrow(FinishNotPrintedError);
  });

  it('defaults to standard when no finish is named', () => {
    const id = createBinder({ name: 'Main' });
    const card = unit();
    adjustCardQuantity(id, card, 1);

    expect(binderQuantities(id).get(card.id)?.standard).toBe(1);
  });
});

describe('owned totals', () => {
  it('sums the same card across binders', () => {
    const trade = createBinder({ name: 'Trade' });
    const box = createBinder({ name: 'Deck box' });
    const card = seedCard('vi', 'Vi');

    adjustCardQuantity(trade, card, 2);
    adjustCardQuantity(box, card, 1);

    expect(ownedCounts().get('vi')).toBe(3);
  });

  it('stops counting a binder the moment it is deleted', () => {
    const trade = createBinder({ name: 'Trade' });
    const box = createBinder({ name: 'Deck box' });
    const card = seedCard('vi', 'Vi');

    adjustCardQuantity(trade, card, 2);
    adjustCardQuantity(box, card, 1);
    deleteBinder(trade);

    // The tombstone still holds its rows, and they must not be counted.
    expect(ownedCounts().get('vi')).toBe(1);
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM binder_cards')!.n
    ).toBe(2);
  });

  it('omits cards owned nowhere rather than reporting zero', () => {
    const id = createBinder({ name: 'Main' });
    seedCard('unowned');
    adjustCardQuantity(id, seedCard('owned'), 1);

    const counts = ownedCounts();
    expect(counts.has('unowned')).toBe(false);
    expect(counts.get('owned')).toBe(1);
  });

  /** The property the whole model exists for. */
  it('never lets the total disagree with the binders behind it', () => {
    const a = createBinder({ name: 'A' });
    const b = createBinder({ name: 'B' });
    const card = seedCard('x');

    adjustCardQuantity(a, card, 4);
    adjustCardQuantity(b, card, 2);
    adjustCardQuantity(a, card, -1);

    const perBinder = [a, b].reduce((n, id) => n + quantityIn(id, 'x'), 0);
    expect(ownedCounts().get('x')).toBe(perBinder);
    expect(perBinder).toBe(5);
  });
});

/**
 * The header's numbers.
 *
 * Derived from the same `ownedCounts()` map the badges read, not from a second
 * query — so "213 owned" and the badges under it cannot tell different stories.
 * A `collectionSummary()` doing this in SQL existed briefly and was deleted for
 * being a second answer to a question the loaded data already answers.
 */
describe('the numbers the header shows', () => {
  const summary = () => {
    const counts = ownedCounts();
    let total = 0;
    for (const n of counts.values()) total += n;
    return { distinctCards: counts.size, totalCards: total };
  };

  it('reports zero for an empty collection', () => {
    expect(summary()).toEqual({ distinctCards: 0, totalCards: 0 });
  });

  it('stays at zero for a binder with nothing in it', () => {
    createBinder({ name: 'Empty' });
    expect(summary()).toEqual({ distinctCards: 0, totalCards: 0 });
  });

  it('counts a card held in two binders once, but both its copies', () => {
    const a = createBinder({ name: 'A' });
    const b = createBinder({ name: 'B' });
    const shared = seedCard('shared');

    adjustCardQuantity(a, shared, 2);
    adjustCardQuantity(b, shared, 1);
    adjustCardQuantity(b, seedCard('other'), 1);

    expect(summary()).toEqual({ distinctCards: 2, totalCards: 4 });
  });
});
