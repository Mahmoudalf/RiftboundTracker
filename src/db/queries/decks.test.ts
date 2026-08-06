import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RULES_VERSION } from '@/lib/legality';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  archiveDeck,
  createDeck,
  deleteDeck,
  getDeck,
  getVersion,
  listDecks,
  listVersions,
  loadDeckList,
  missingCardCount,
  renameDeck,
  saveDeckList,
  VersionLockedError,
} from './decks';

/**
 * Deck queries against a real SQLite database.
 *
 * These run the actual SQL, so they catch the two failure modes that typecheck
 * cannot: a column name that does not exist, and a `SELECT *` row hydrated onto
 * the wrong keys. The card gallery already shipped that second bug once.
 */

let db: TestDatabase;

/** Insert a card into the mirror with every column the current schema has. */
function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: 'ogn-001-100',
    tcgplayerId: null,
    name: 'Test Card',
    cleanName: 'Test Card',
    collectorNumber: 1,
    energy: null,
    might: null,
    power: null,
    type: 'Spell',
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
    imageUrl: 'https://cdn.example/art-744x1039.png',
    artist: 'Someone',
    accessibilityText: null,
    orientation: 'portrait',
    alternateArt: false,
    signature: false,
    overnumbered: false,
    isNew: false,
    updatedOn: null,
    ...overrides,
  };

  db.runSync(
    `INSERT INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, supertype,
        rarity, domains, domain_key, tags, set_id, set_label, image_url, artist,
        orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      card.id,
      card.riftboundId,
      card.name,
      card.cleanName,
      card.collectorNumber,
      card.type,
      card.supertype,
      card.rarity,
      JSON.stringify(card.domains),
      card.domainKey,
      JSON.stringify(card.tags),
      card.setId,
      card.setLabel,
      card.imageUrl,
      card.artist,
      card.orientation,
    ]
  );
  return card;
}

const LEGEND_INPUT = {
  id: 'legend-1',
  name: 'Vi - Piltover Enforcer',
  type: 'Legend',
  domains: ['Fury', 'Order'],
  domainKey: 'Fury,Order',
  tags: ['Vi'],
};

const CHAMPION_INPUT = {
  id: 'champ-1',
  name: 'Vi - Enforcer',
  type: 'Unit',
  supertype: 'Champion',
  domains: ['Fury'],
  tags: ['Vi', 'Piltover'],
};

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

function makeDeck(name = 'Vi Aggro') {
  const legend = seedCard({ ...LEGEND_INPUT });
  const champion = seedCard({ ...CHAMPION_INPUT });
  return { legend, champion, ...createDeck({ name, legend, champion }) };
}

describe('createDeck', () => {
  it('creates a deck and its first version together', () => {
    const { deckId, versionId } = makeDeck();

    const deck = getDeck(deckId);
    expect(deck?.name).toBe('Vi Aggro');
    expect(deck?.currentVersionId).toBe(versionId);
    expect(deck?.domains).toEqual(['Fury', 'Order']);

    const version = getVersion(versionId);
    expect(version?.versionNumber).toBe(1);
    expect(version?.deckId).toBe(deckId);
    expect(version?.lockedAt).toBeNull();
  });

  it('hydrates camelCase fields off snake_case columns', () => {
    const { deckId, versionId } = makeDeck();
    const deck = getDeck(deckId)!;
    const version = getVersion(versionId)!;

    // The exact class of bug that blanked every card in the gallery.
    expect(deck.currentVersionId).toBeDefined();
    expect(deck.legendCardId).toBe('legend-1');
    expect(deck.championCardId).toBe('champ-1');
    expect(deck.createdAt).toBeTruthy();
    expect(version.versionNumber).toBeDefined();
    expect(version.battlefieldCount).toBeDefined();
    expect(version.parentVersionId).toBeNull();
  });

  it('seeds the version with the Legend and Champion', () => {
    const { versionId } = makeDeck();
    const list = loadDeckList(versionId);

    expect(list.slots.map((s) => s.zone).sort()).toEqual(['champion', 'legend']);
    // The joined card row must hydrate as a full card, not a bag of undefineds.
    const legendSlot = list.slots.find((s) => s.zone === 'legend')!;
    expect(legendSlot.card.name).toBe('Vi - Piltover Enforcer');
    expect(legendSlot.card.imageUrl).toBe('https://cdn.example/art-744x1039.png');
    expect(legendSlot.card.domains).toEqual(['Fury', 'Order']);
  });
});

describe('saveDeckList', () => {
  it('round-trips a decklist through the database', () => {
    const { versionId, legend, champion } = makeDeck();
    const spell = seedCard({ id: 'spell-1', name: 'Fury Bolt', domains: ['Fury'] });

    saveDeckList(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: spell, quantity: 3, zone: 'main' },
      ],
    });

    const list = loadDeckList(versionId);
    const main = list.slots.filter((s) => s.zone === 'main');
    expect(main).toHaveLength(1);
    expect(main[0]!.quantity).toBe(3);
    expect(main[0]!.card.id).toBe('spell-1');
  });

  it('replaces the previous list rather than appending to it', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    const b = seedCard({ id: 'b', name: 'B' });

    const base = [{ card: legend, quantity: 1, zone: 'legend' as const }];
    saveDeckList(versionId, { slots: [...base, { card: a, quantity: 2, zone: 'main' }] });
    saveDeckList(versionId, { slots: [...base, { card: b, quantity: 1, zone: 'main' }] });

    const ids = loadDeckList(versionId)
      .slots.filter((s) => s.zone === 'main')
      .map((s) => s.card.id);
    expect(ids).toEqual(['b']);
  });

  it('drops zero-quantity slots instead of writing them', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    saveDeckList(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 0, zone: 'main' },
      ],
    });
    expect(loadDeckList(versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
  });

  it('updates the denormalized counts and legality flag', () => {
    const { versionId, legend, champion } = makeDeck();
    const spell = seedCard({ id: 'spell-1', name: 'Fury Bolt', domains: ['Fury'] });
    const bf = seedCard({
      id: 'bf-1',
      name: 'Star Spring',
      type: 'Battlefield',
      domains: ['Colorless'],
      domainKey: 'Colorless',
    });

    saveDeckList(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: spell, quantity: 3, zone: 'main' },
        { card: bf, quantity: 3, zone: 'battlefield' },
      ],
    });

    const version = getVersion(versionId)!;
    expect(version.mainCount).toBe(4); // 3 spells + the Champion
    expect(version.battlefieldCount).toBe(3);
    expect(version.isLegal).toBe(false); // 4/40 main, 0/12 runes
  });

  it('refuses to rewrite a locked version', () => {
    const { versionId } = makeDeck();
    // Simulate M4 attaching a match to this version.
    db.runSync('UPDATE deck_versions SET locked_at = ? WHERE id = ?', [
      new Date().toISOString(),
      versionId,
    ]);

    expect(() => saveDeckList(versionId, { slots: [] })).toThrow(VersionLockedError);
    // And nothing was written on the way to throwing.
    expect(loadDeckList(versionId).slots.length).toBeGreaterThan(0);
  });

  it('keeps the deck row in step when the Legend changes', () => {
    const { deckId, versionId } = makeDeck();
    const newLegend = seedCard({
      id: 'legend-2',
      name: 'Pyke - Bloodharbor Ripper',
      type: 'Legend',
      domains: ['Fury', 'Chaos'],
      domainKey: 'Chaos,Fury',
      tags: ['Pyke'],
    });

    saveDeckList(versionId, { slots: [{ card: newLegend, quantity: 1, zone: 'legend' }] });

    const deck = getDeck(deckId)!;
    expect(deck.legendCardId).toBe('legend-2');
    expect(deck.domains).toEqual(['Fury', 'Chaos']);
    expect(deck.championCardId).toBeNull();
  });
});

describe('loadDeckList', () => {
  it('drops cards missing from the mirror rather than inventing them', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    saveDeckList(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
      ],
    });

    // The mirror is re-synced and this printing is gone.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    expect(loadDeckList(versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(missingCardCount(versionId)).toBe(1);
  });
});

describe('listDecks', () => {
  it('returns decks with their current version and version count', () => {
    const { deckId } = makeDeck('First');
    const summaries = listDecks();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.deck.id).toBe(deckId);
    expect(summaries[0]!.version?.versionNumber).toBe(1);
    expect(summaries[0]!.versionCount).toBe(1);
  });

  it('hides archived and deleted decks by default', () => {
    const first = makeDeck('Keep');
    seedCard({ id: 'legend-2', name: 'Other Legend', type: 'Legend', tags: ['X'] });

    archiveDeck(first.deckId, true);
    expect(listDecks()).toHaveLength(0);
    expect(listDecks(true)).toHaveLength(1);

    archiveDeck(first.deckId, false);
    deleteDeck(first.deckId);
    expect(listDecks()).toHaveLength(0);
    expect(listDecks(true)).toHaveLength(0);
  });

  it('soft-deletes so sync can propagate the deletion', () => {
    const { deckId } = makeDeck();
    deleteDeck(deckId);

    const raw = db.getFirstSync<{ deleted_at: string | null; dirty: number }>(
      'SELECT deleted_at, dirty FROM decks WHERE id = ?',
      [deckId]
    );
    expect(raw?.deleted_at).toBeTruthy();
    expect(raw?.dirty).toBe(1);
    // Versions go with it, so they cannot resurface on another device.
    expect(listVersions(deckId)).toEqual([]);
  });
});

describe('stale legality cache', () => {
  /**
   * A version saved under an older revision of the rules keeps claiming the old
   * verdict until something recomputes it. This is the repair path for the
   * three rule corrections found in the M2 audit.
   */
  it('recomputes versions stamped with an older rules revision', () => {
    const { deckId, versionId, legend } = makeDeck();
    const bf = seedCard({
      id: 'bf-1',
      name: 'Star Spring',
      type: 'Battlefield',
      domains: ['Colorless'],
      domainKey: 'Colorless',
    });

    saveDeckList(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: bf, quantity: 3, zone: 'battlefield' },
      ],
    });

    // Forge the state an old build left behind: wrong verdict, old stamp.
    db.runSync(
      'UPDATE deck_versions SET is_legal = 1, main_count = 99, rules_version = 0 WHERE id = ?',
      [versionId]
    );
    expect(getVersion(versionId)!.isLegal).toBe(true);

    listDecks();

    const repaired = getVersion(versionId)!;
    expect(repaired.rulesVersion).toBe(RULES_VERSION);
    expect(repaired.mainCount).toBe(0);
    // 3 copies of one Battlefield violates rule 103.4.c.
    expect(repaired.isLegal).toBe(false);
    expect(deckId).toBeTruthy();
  });

  it('leaves the cache alone when the mirror is empty', () => {
    const { versionId } = makeDeck();
    db.runSync('UPDATE deck_versions SET is_legal = 1, rules_version = 0 WHERE id = ?', [
      versionId,
    ]);

    // Mid-resync: every card gone. Recomputing now would cache "0/40, illegal"
    // over a deck that is fine, which is worse than a stale answer.
    db.runSync('DELETE FROM cards');
    listDecks();

    const version = getVersion(versionId)!;
    expect(version.rulesVersion).toBe(0);
    expect(version.isLegal).toBe(true);
  });

  it('does not mark repaired rows dirty for sync', () => {
    const { versionId } = makeDeck();
    db.runSync(
      'UPDATE deck_versions SET rules_version = 0, dirty = 0, updated_at = ? WHERE id = ?',
      ['2020-01-01T00:00:00.000Z', versionId]
    );

    listDecks();

    const raw = db.getFirstSync<{ dirty: number; updated_at: string }>(
      'SELECT dirty, updated_at FROM deck_versions WHERE id = ?',
      [versionId]
    );
    // Nothing the user did changed, so this must not push a write to every device.
    expect(raw?.dirty).toBe(0);
    expect(raw?.updated_at).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('renameDeck', () => {
  it('renames and marks the row dirty for sync', () => {
    const { deckId } = makeDeck();
    renameDeck(deckId, 'Vi Control');

    expect(getDeck(deckId)?.name).toBe('Vi Control');
    expect(
      db.getFirstSync<{ dirty: number }>('SELECT dirty FROM decks WHERE id = ?', [deckId])
        ?.dirty
    ).toBe(1);
  });
});
