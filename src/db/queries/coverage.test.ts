import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cardKey } from '@/lib/card-identity';
import { finishesFor } from '@/lib/finishes';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { adjustCardQuantity, createBinder } from './collection';
import { availableForDeck, deckCoverage } from './coverage';
import { archiveDeck, createDeck, saveDeckEdit } from './decks';

/**
 * Deck coverage â€” how much of a deck you own, with copies shared between decks.
 *
 * The rule under test is the one a per-deck count would get wrong: three copies
 * cannot be sleeved in two decks at once, so the second deck must see what the
 * first left behind.
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

function seedCard(id: string, name: string, type = 'Unit'): CardRow {
  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, rarity,
        domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `ogn-${id}-1`,
      name,
      // Deliberately the API's normalised form, which is what migration 12
      // wrongly stored in binder_cards â€” so a regression there shows up here.
      name.replace(/[-()]/g, '').replace(/\s+/g, ' ').trim(),
      1,
      type,
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
    name,
    cleanName: name,
    type,
    supertype: null,
    rarity: 'Common',
    domains: ['Fury'],
    domainKey: 'Fury',
    tags: [],
    setId: 'OGN',
    setLabel: 'Origins',
    imageUrl: 'https://cdn.example/a-744x1039.png',
    artist: 'A',
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    textPlain: null,
    textRich: null,
    flavour: null,
    accessibilityText: null,
    tcgplayerId: null,
    updatedOn: null,
  };
}

/**
 * A deck holding one card at a given count, created in call order.
 *
 * `ownLegend` defaults on so the Legend does not appear as a shortfall in every
 * assertion â€” the tests here are about the card under test, not about whether a
 * Legend was catalogued.
 */
function deckWith(name: string, card: CardRow, quantity: number, ownLegend = true) {
  const legend = seedCard(`${name}-legend`, `${name} Legend`, 'Legend');
  const { deckId, versionId } = createDeck({ name, legend, champion: null });
  saveDeckEdit(versionId, {
    slots: [
      { card: legend, quantity: 1, zone: 'legend' },
      { card, quantity, zone: 'main' },
    ],
  });
  if (ownLegend) own(legend, 1);
  return deckId;
}

/** Files copies in the only finish the card was printed in. */
function own(card: CardRow, quantity: number, binder = 'Main') {
  if (quantity === 0) return;
  const id =
    db.getFirstSync<{ id: string }>('SELECT id FROM binders WHERE name = ?', [binder])?.id ??
    createBinder({ name: binder });
  adjustCardQuantity(id, card, quantity, finishesFor(card)[0]!);
}

describe('deckCoverage', () => {
  it('counts every zone, not just the main deck', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const deckId = deckWith('Solo', vi, 3, false);

    // Legend + 3 Vi.
    expect(deckCoverage(deckId).required).toBe(4);
    expect(deckCoverage(deckId).owned).toBe(0);
  });

  it('reports what you own of a single deck', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const deckId = deckWith('Solo', vi, 3);
    own(vi, 2);

    const coverage = deckCoverage(deckId);
    // Legend + 2 of the 3 Vi.
    expect(coverage.owned).toBe(3);
    expect(coverage.required).toBe(4);
    expect(coverage.shortfalls).toEqual([{ name: 'Vi - Piltover Enforcer', need: 3, have: 2 }]);
  });

  /*
   * The decision this whole module exists for. Three copies, two decks each
   * asking for three: the older deck takes them, the newer one sees none.
   */
  it('does not lend the same copies to two decks', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    const first = deckWith('First', vi, 3);
    const second = deckWith('Second', vi, 3);

    // Legend + 3 Vi, all of them accounted for.
    expect(deckCoverage(first).owned).toBe(4);
    expect(deckCoverage(first).shortfalls).toEqual([]);

    const later = deckCoverage(second);
    expect(later.shortfalls).toContainEqual({
      name: 'Vi - Piltover Enforcer',
      need: 3,
      have: 0,
    });
  });

  it('splits copies when the older deck needs fewer than you own', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    deckWith('First', vi, 1);
    const second = deckWith('Second', vi, 3);

    // One went to the older deck; two are left.
    expect(deckCoverage(second).shortfalls).toContainEqual({
      name: 'Vi - Piltover Enforcer',
      need: 3,
      have: 2,
    });
  });

  it('returns copies to the pool when a deck is archived', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    const first = deckWith('First', vi, 3);
    const second = deckWith('Second', vi, 3);

    expect(deckCoverage(second).shortfalls).toHaveLength(1);

    archiveDeck(first, true);

    // Archiving says "not playing this" â€” its cards go back in the pool.
    expect(deckCoverage(second).shortfalls).toEqual([]);
  });

  it('accepts a different printing for a listed card', () => {
    const standard = seedCard('vi', 'Vi - Piltover Enforcer');
    const alt = seedCard('vi-alt', 'Vi - Piltover Enforcer (Alternate Art)');
    const deckId = deckWith('Solo', standard, 3);

    own(alt, 3);

    // Same card to the rules, so it fills the slot.
    expect(deckCoverage(deckId).shortfalls).toEqual([]);
  });

  it('accepts a foil for a listed card', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const deckId = deckWith('Solo', vi, 2, false);

    const binder = createBinder({ name: 'Foils' });
    adjustCardQuantity(binder, vi, 2, 'foil');

    expect(deckCoverage(deckId).owned).toBe(2);
  });

  it('never exceeds what the deck asks for, however many you own', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const deckId = deckWith('Solo', vi, 2, false);
    own(vi, 40);

    const coverage = deckCoverage(deckId);
    expect(coverage.owned).toBeLessThanOrEqual(coverage.required);
    expect(coverage.owned).toBe(2);
  });

  it('reports 0 of n for an empty collection rather than failing', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const deckId = deckWith('Solo', vi, 3, false);

    const coverage = deckCoverage(deckId);
    expect(coverage.owned).toBe(0);
    expect(coverage.required).toBe(4);
  });

  /*
   * Coverage reads every live deck, so its cost scales with how many decks you
   * have â€” not with the deck you are looking at. That is a different axis from
   * the version-history measurement, and it lands on *every* focus of deck
   * detail, so it is worth a number rather than a shrug.
   */
  it('measures the cost of allocating across many decks', () => {
    const pool = Array.from({ length: 60 }, (_, i) => seedCard(`p${i}`, `Pool ${i}`));
    for (const card of pool) own(card, 3);

    const rows: string[] = [];
    let last = '';
    for (const target of [5, 20, 50]) {
      while (
        db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM decks')!.n < target
      ) {
        const n = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM decks')!.n;
        const legend = seedCard(`d${n}-lg`, `Deck ${n} Legend`, 'Legend');
        const { deckId, versionId } = createDeck({ name: `Deck ${n}`, legend, champion: null });
        saveDeckEdit(versionId, {
          slots: [
            { card: legend, quantity: 1, zone: 'legend' },
            // 48 more slots, so each deck is realistically sized.
            ...pool.slice(0, 48).map((card) => ({ card, quantity: 1, zone: 'main' as const })),
          ],
        });
        last = deckId;
      }

      const start = performance.now();
      const result = deckCoverage(last);
      const ms = performance.now() - start;
      expect(result.required).toBe(49);
      rows.push(`${String(target).padStart(3)} decks | deckCoverage ${ms.toFixed(1).padStart(5)} ms`);
    }

    console.log(`\nCoverage scaling (49-slot decks)\n${rows.join('\n')}\n`);
  }, 60_000);

  it('orders shortfalls by how many copies are missing', () => {
    const a = seedCard('a', 'Card A');
    const b = seedCard('b', 'Card B');
    const legend = seedCard('lg', 'A Legend', 'Legend');
    const { deckId, versionId } = createDeck({ name: 'Deck', legend, champion: null });
    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 3, zone: 'main' },
        { card: b, quantity: 3, zone: 'main' },
      ],
    });
    own(a, 2); // short 1
    own(b, 0); // short 3
    own(legend, 1);

    expect(deckCoverage(deckId).shortfalls.map((s) => s.name)).toEqual(['Card B', 'Card A']);
  });
});

/**
 * The builder's per-card number.
 *
 * It has to agree with `deckCoverage` by construction â€” two answers to "do I
 * own this?" that could disagree is the failure the collection tracker avoided
 * when it refused to keep a flat owned-quantity column beside binder contents.
 */
describe('availableForDeck', () => {
  const key = (name: string) => cardKey({ name });

  it('reports what an older deck has left over', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);

    const first = deckWith('First', vi, 2);
    const second = deckWith('Second', vi, 1);

    // The older deck claims first and sees the whole pool.
    expect(availableForDeck(first).get(key('Vi - Piltover Enforcer'))?.available).toBe(3);
    // The newer one sees what is left: 3 owned, 2 already sleeved elsewhere.
    expect(availableForDeck(second).get(key('Vi - Piltover Enforcer'))?.available).toBe(1);
  });

  it('does not deduct the deckâ€™s own copies', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    const only = deckWith('Only', vi, 3);

    // Listing all three does not make them unavailable to the deck listing
    // them â€” otherwise the badge would fall to zero as you built and read as
    // though your own cards had been taken.
    expect(availableForDeck(only).get(key('Vi - Piltover Enforcer'))?.available).toBe(3);
  });

  it('treats a deck with no cards as last in line', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    deckWith('Established', vi, 2);

    const legend = seedCard('n-lg', 'New Legend', 'Legend');
    const { deckId } = createDeck({ name: 'Brand new', legend, champion: null });

    expect(availableForDeck(deckId).get(key('Vi - Piltover Enforcer'))?.available).toBe(1);
  });

  it('gives an archived deckâ€™s copies back to the pool', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 3);
    const older = deckWith('Older', vi, 3);
    const newer = deckWith('Newer', vi, 3);

    expect(availableForDeck(newer).get(key('Vi - Piltover Enforcer'))?.available).toBe(0);
    archiveDeck(older, true);
    expect(availableForDeck(newer).get(key('Vi - Piltover Enforcer'))?.available).toBe(3);
  });

  it('counts a different printing and a foil as the same card', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    const alt = seedCard('vi-alt', 'Vi - Piltover Enforcer (Alternate Art)');
    own(vi, 1);
    own(alt, 1);

    const legend = seedCard('lg2', 'Another Legend', 'Legend');
    const { deckId } = createDeck({ name: 'Solo', legend, champion: null });

    // `cardKey` collapses printings, so the alternate art satisfies the same
    // slot â€” the rule the 3-copy limit already counts by.
    expect(availableForDeck(deckId).get(key('Vi - Piltover Enforcer'))?.available).toBe(2);
  });

  it('never disagrees with deckCoverage about what a deck can field', () => {
    const vi = seedCard('vi', 'Vi - Piltover Enforcer');
    own(vi, 4);
    deckWith('Older', vi, 3);
    const newer = deckWith('Newer', vi, 3);

    const available = availableForDeck(newer).get(key('Vi - Piltover Enforcer'))?.available ?? 0;
    const shortfall = deckCoverage(newer).shortfalls.find(
      (s) => s.name === 'Vi - Piltover Enforcer'
    );

    // One copy left for a deck that lists three: the tile and the deck-level
    // shortfall are the same fact read two ways.
    expect(available).toBe(1);
    expect(shortfall).toEqual({ name: 'Vi - Piltover Enforcer', need: 3, have: 1 });
  });
});

