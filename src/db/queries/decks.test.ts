import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RULES_VERSION } from '@/lib/legality';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  archiveDeck,
  compareVersions,
  createDeck,
  deleteDeck,
  deleteVersion,
  getDeck,
  getVersion,
  listDecks,
  listVersions,
  loadDeckList,
  lockVersion,
  missingCards,
  renameDeck,
  saveDeckEdit,
  setCurrentVersion,
  setDeckNotes,
  setVersionLabel,
  setVersionNotes,
  versionCardNames,
  versionDiff,
  VersionHasMatchesError,
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

/**
 * Save an edit and load what it produced.
 *
 * Every edit forks, so the version passed in is deliberately left alone —
 * reading *it* back would assert only that the old version still holds the old
 * list, which it always will. These tests care where the edit landed.
 */
function saveAndLoad(
  versionId: string,
  list: Parameters<typeof saveDeckEdit>[1],
  options?: Parameters<typeof saveDeckEdit>[2]
) {
  const result = saveDeckEdit(versionId, list, options);
  return { ...result, list: loadDeckList(result.versionId) };
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

describe('saveDeckEdit', () => {
  it('round-trips a decklist through the database', () => {
    const { versionId, legend, champion } = makeDeck();
    const spell = seedCard({ id: 'spell-1', name: 'Fury Bolt', domains: ['Fury'] });

    const { list } = saveAndLoad(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: spell, quantity: 3, zone: 'main' },
      ],
    });

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
    const first = saveDeckEdit(versionId, {
      slots: [...base, { card: a, quantity: 2, zone: 'main' }],
    });
    // Edited again from the version the first edit produced, as the editor does.
    const second = saveAndLoad(first.versionId, {
      slots: [...base, { card: b, quantity: 1, zone: 'main' }],
    });

    const ids = second.list.slots.filter((s) => s.zone === 'main').map((s) => s.card.id);
    expect(ids).toEqual(['b']);
  });

  it('drops zero-quantity slots instead of writing them', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    const { list } = saveAndLoad(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 0, zone: 'main' },
      ],
    });
    expect(list.slots.filter((s) => s.zone === 'main')).toEqual([]);
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

    const saved = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: spell, quantity: 3, zone: 'main' },
        { card: bf, quantity: 3, zone: 'battlefield' },
      ],
    });

    // The counts belong to the version the edit produced, not the one it left.
    const version = getVersion(saved.versionId)!;
    expect(version.mainCount).toBe(4); // 3 spells + the Champion
    expect(version.battlefieldCount).toBe(3);
    expect(version.isLegal).toBe(false); // 4/40 main, 0/12 runes
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

    saveDeckEdit(versionId, { slots: [{ card: newLegend, quantity: 1, zone: 'legend' }] });

    const deck = getDeck(deckId)!;
    expect(deck.legendCardId).toBe('legend-2');
    expect(deck.domains).toEqual(['Fury', 'Chaos']);
    expect(deck.championCardId).toBeNull();
  });
});

/**
 * The version-locking mechanic — `DATA-MODEL.md` §3.
 *
 * Every number the app will ever show rests on this: a match must stay attached
 * to the exact list that played it. These tests assert the five invariants
 * directly, and read the database back rather than trusting the return value.
 */
describe('version locking', () => {
  /** What M4's match logger will do. Until then, the lock is set by hand. */
  function logGame(versionId: string) {
    lockVersion(versionId);
  }

  function withCards(versionId: string, legend: CardRow, cards: [CardRow, number][]) {
    return {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' as const },
        ...cards.map(([card, quantity]) => ({ card, quantity, zone: 'main' as const })),
      ],
    };
  }

  it('writes nothing when the list did not change (invariant 5)', () => {
    const { deckId, versionId } = makeDeck();
    const before = db.getFirstSync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM deck_version_cards'
    )!.n;

    const result = saveDeckEdit(versionId, loadDeckList(versionId));

    expect(result.outcome).toBe('no-op');
    expect(result.versionId).toBe(versionId);
    expect(listVersions(deckId)).toHaveLength(1);
    // Not merely "no new version" — no writes at all.
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM deck_version_cards')!.n
    ).toBe(before);
  });

  it('sees through slot reordering, which the editor does constantly', () => {
    const { versionId, legend, champion } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    });

    const reordered = {
      slots: [...loadDeckList(versionId).slots].reverse(),
    };
    expect(saveDeckEdit(versionId, reordered).outcome).toBe('no-op');
  });

  /*
   * A version records what the deck *was*. Swapping cards makes it a different
   * deck whether or not it has been played, so an unplayed version is not a
   * draft to be overwritten — it is the list that came before this one.
   */
  it('forks even when the version has no matches on it', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));

    expect(result.outcome).toBe('forked');
    expect(result.versionId).not.toBe(versionId);
    expect(result.versionNumber).toBe(2);
    expect(listVersions(deckId)).toHaveLength(2);
    expect(getDeck(deckId)!.currentVersionId).toBe(result.versionId);
    // The version left behind still holds what it always held.
    expect(loadDeckList(versionId).slots.filter((x) => x.zone === 'main')).toEqual([]);
  });

  it('forks once a match is logged, leaving the played list untouched', () => {
    const { deckId, versionId, legend, champion } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    const b = seedCard({ id: 'b', name: 'B' });

    // Build the list first — that edit is itself a version now — then play it.
    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: a, quantity: 3, zone: 'main' },
      ],
    });
    logGame(built.versionId);

    const result = saveDeckEdit(built.versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: b, quantity: 3, zone: 'main' },
      ],
    });

    expect(result.outcome).toBe('forked');
    expect(result.versionId).not.toBe(built.versionId);
    expect(result.versionNumber).toBe(3);

    // The played list is exactly as it was played (invariant 1).
    const played = loadDeckList(built.versionId).slots.filter((s) => s.zone === 'main');
    expect(played.map((s) => s.card.id)).toEqual(['a']);

    // The deck now points at the fork (invariant 3), which carries the change.
    const deck = getDeck(deckId)!;
    expect(deck.currentVersionId).toBe(result.versionId);
    expect(
      loadDeckList(result.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['b']);

    const forked = getVersion(result.versionId)!;
    expect(forked.parentVersionId).toBe(built.versionId);
    expect(forked.lockedAt).toBeNull();
    expect(forked.label).toBe('−3 A and 1 more');
  });

  /*
   * Reported from a device as "editing a deck no longer creates a version",
   * and reproduced here as the exact sequence rather than argued about.
   *
   * At the time it was correct-but-invisible: the fork was born unlocked, so
   * the next edit amended it. That behaviour is gone — every change is its own
   * version now, so the sequence below climbs v1 → v2 → v3 and the report has
   * no way to recur.
   */
  it('forks again on the next edit, so each change is its own version', () => {
    const { deckId, versionId, legend } = makeDeck();
    const [a, b, c] = [1, 2, 3].map((n) => seedCard({ id: `c${n}`, name: `Card ${n}` }));

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[a!, 3]]));
    logGame(built.versionId);

    const forked = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[b!, 3]]));
    expect(forked.outcome).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(3);

    // Second edit, no match logged in between — and it still gets its own version.
    const again = saveDeckEdit(forked.versionId, withCards(forked.versionId, legend, [[c!, 3]]));
    expect(again.outcome).toBe('forked');
    expect(again.versionId).not.toBe(forked.versionId);
    expect(listVersions(deckId)).toHaveLength(4);
    // The change went into the new version; the one before it kept its own list.
    expect(
      loadDeckList(again.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['c3']);
    expect(
      loadDeckList(forked.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['c2']);

    // Playing a version changes nothing about this: it already could not be
    // rewritten. The lock only still governs the escape hatch.
    logGame(again.versionId);
    expect(
      saveDeckEdit(again.versionId, withCards(again.versionId, legend, [[a!, 1]])).outcome
    ).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(5);
  });

  it('numbers versions contiguously from the deck maximum (invariant 4)', () => {
    const { deckId, versionId, legend } = makeDeck();
    const cards = [1, 2, 3].map((n) => seedCard({ id: `c${n}`, name: `Card ${n}` }));

    let current = versionId;
    for (const card of cards) {
      logGame(current);
      current = saveDeckEdit(current, withCards(current, legend, [[card, 1]])).versionId;
    }

    expect(listVersions(deckId).map((v) => v.versionNumber)).toEqual([4, 3, 2, 1]);
  });

  it('forks for a printing swap too, since the list it recorded has changed', () => {
    const { deckId, versionId, legend } = makeDeck();
    const standard = seedCard({ id: 'p1', name: 'Statikk Shock' });
    const alt = seedCard({ id: 'p2', name: 'Statikk Shock (Alternate Art)', alternateArt: true });

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[standard, 2]]));
    const result = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[alt, 2]]));

    /*
     * The two lists are identical to the rules, and it still forks.
     * `deck_version_cards` is the record of what was physically in the sleeve —
     * match detail renders it, the collection tracker checks ownership against
     * it, export emits it — so which printing was in there is part of what the
     * version recorded, not decoration on top of it.
     */
    expect(result.outcome).toBe('forked');
    expect(result.diff.cardSetIdentical).toBe(true);
    expect(listVersions(deckId)).toHaveLength(3);

    expect(
      loadDeckList(result.versionId)
        .slots.filter((x) => x.zone === 'main')
        .map((x) => x.card.id)
    ).toEqual(['p2']);
    expect(
      loadDeckList(built.versionId)
        .slots.filter((x) => x.zone === 'main')
        .map((x) => x.card.id)
    ).toEqual(['p1']);
  });

  /**
   * The finding that reversed a design decision.
   *
   * An earlier revision wrote art swaps in place even on a locked version,
   * arguing the two lists are identical to the rules. They are — but
   * `deck_version_cards` is also the record of what was physically in the
   * sleeve, which M4's match detail renders, M6's collection tracker checks
   * ownership against, and M6's export emits. Rewriting `card_id` there makes
   * all three describe a printing the player did not own at the time.
   */
  it('forks rather than rewriting a played version, even for art alone', () => {
    const { deckId, versionId, legend } = makeDeck();
    const standard = seedCard({ id: 'p1', name: 'Statikk Shock' });
    const alt = seedCard({ id: 'p2', name: 'Statikk Shock (Alternate Art)', alternateArt: true });

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[standard, 2]]));
    logGame(built.versionId);

    const before = db.getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [built.versionId]
    );

    const result = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[alt, 2]]));

    expect(result.outcome).toBe('forked');
    expect(result.diff.cardSetIdentical).toBe(true);
    expect(listVersions(deckId)).toHaveLength(3);

    // Byte-identical, row ids included — nothing about the played list moved.
    const after = db.getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [built.versionId]
    );
    expect(after).toEqual(before);

    // The new art lives on the fork, which is where the change belongs.
    expect(
      loadDeckList(result.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['p2']);
  });

  /**
   * Re-adding a card whose printing left the card library.
   *
   * `writeSlots` preserves rows it cannot resolve so a library resync never
   * deletes a card from a deck. Before `card_name` existed it could not tell
   * that the card being written was the same card as the row it was preserving,
   * so it kept both — and the deck held six copies by name the moment the old
   * printing came back, with the user having done nothing wrong.
   */
  it('does not duplicate a card when its old printing is unresolvable', () => {
    const { versionId, legend } = makeDeck();
    const alt = seedCard({ id: 'p-alt', name: 'Statikk Shock (Alternate Art)' });
    const standard = seedCard({ id: 'p-std', name: 'Statikk Shock' });

    let current = saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 3]])).versionId;

    // Upstream drops the alternate-art printing.
    db.runSync('DELETE FROM cards WHERE id = ?', ['p-alt']);
    expect(loadDeckList(current).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(missingCards(current).map((m) => m.name)).toEqual([
      'Statikk Shock (Alternate Art)',
    ]);

    // The player repairs the hole with the printing they can see.
    current = saveDeckEdit(current, withCards(current, legend, [[standard, 3]])).versionId;

    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      `SELECT card_id, quantity FROM deck_version_cards
        WHERE deck_version_id = ? AND zone = 'main'`,
      [current]
    );
    expect(rows).toEqual([{ card_id: 'p-std', quantity: 3 }]);

    // And the deck stays legal when the old printing returns.
    seedCard({ id: 'p-alt', name: 'Statikk Shock (Alternate Art)' });
    expect(
      loadDeckList(current)
        .slots.filter((s) => s.zone === 'main')
        .reduce((n, s) => n + s.quantity, 0)
    ).toBe(3);
  });

  it('still preserves an unresolvable card the user did not re-add', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const other = seedCard({ id: 'other', name: 'Something Else' });

    let current = saveDeckEdit(versionId, withCards(versionId, legend, [[ghost, 2]])).versionId;
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);
    current = saveDeckEdit(current, withCards(current, legend, [[other, 1]])).versionId;

    // The ghost rode across the fork rather than being dropped by it.
    expect(missingCards(current).map((m) => m.name)).toEqual(['Vanishing Act']);
  });

  /**
   * Going back to an older version and editing forks a *sibling*, not a child
   * of the newest node. The numbers are unique and increasing, but the parent
   * chain branches — which the timeline has to draw honestly, or it claims the
   * newest version contains changes it does not have.
   */
  it('forks a sibling when an older version is made current again', () => {
    const { deckId, versionId: v1, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });

    logGame(v1);
    const v2 = saveDeckEdit(v1, withCards(v1, legend, [[a, 2]])).versionId;

    setCurrentVersion(deckId, v1);
    const v3 = saveDeckEdit(v1, withCards(v1, legend, [[b, 2]]));

    expect(v3.outcome).toBe('forked');
    expect(v3.versionNumber).toBe(3);

    const byId = new Map(listVersions(deckId).map((v) => [v.id, v]));
    // Both forks hang off v1 — v3 is not descended from v2.
    expect(byId.get(v3.versionId)!.parentVersionId).toBe(v1);
    expect(byId.get(v2)!.parentVersionId).toBe(v1);

    // So v3's change is measured against v1 and contains nothing of v2's.
    const diff = versionDiff(v3.versionId)!;
    expect(diff.added.map((e) => e.card.id)).toEqual(['b']);
    // Nothing of v2's edit appears in v3's change — they are parallel branches,
    // and a timeline drawing them as a chain would claim otherwise.
    expect([...diff.added, ...diff.removed].map((e) => e.card.id)).not.toContain('a');
    expect(getDeck(deckId)!.currentVersionId).toBe(v3.versionId);
  });

  it('rewrites a locked version in place through the escape hatch', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    const b = seedCard({ id: 'b', name: 'B' });

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));
    logGame(built.versionId);

    const result = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[b, 2]]), {
      amendLocked: true,
    });

    // The one path that still writes in place, and the only one — every other
    // save forks now, so this is the whole of "overwrite" as a concept.
    expect(result.outcome).toBe('amended-locked');
    expect(result.versionId).toBe(built.versionId);
    expect(listVersions(deckId)).toHaveLength(2);
    expect(
      loadDeckList(built.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['b']);
  });

  it('carries cards missing from the mirror across a fork', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const a = seedCard({ id: 'a', name: 'A' });

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[ghost, 2]]));
    logGame(built.versionId);

    // A card-library resync drops the printing. It is now invisible to the
    // editor, so the edited list cannot contain it.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    const result = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[a, 1]]));
    expect(result.outcome).toBe('forked');

    // The row survived the fork, so the card returns when the mirror does.
    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      'SELECT card_id, quantity FROM deck_version_cards WHERE deck_version_id = ?',
      [result.versionId]
    );
    expect(rows.map((r) => r.card_id).sort()).toEqual(['a', 'ghost', 'legend-1']);
    expect(missingCards(result.versionId)).toHaveLength(1);
  });

  it('locks idempotently and never unlocks', () => {
    const { versionId } = makeDeck();
    lockVersion(versionId);
    const first = getVersion(versionId)!.lockedAt;
    lockVersion(versionId);

    expect(first).toBeTruthy();
    expect(getVersion(versionId)!.lockedAt).toBe(first);
  });

  it('refuses to delete a version that has matches (invariant 2)', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    logGame(versionId);
    const second = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 1]])).versionId;

    expect(() => deleteVersion(versionId)).toThrow(VersionHasMatchesError);
    expect(getVersion(versionId)).not.toBeNull();
    expect(second).toBeTruthy();
  });

  it('deletes an unplayed version and falls back to the one before it', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    logGame(versionId);
    const v2 = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 1]])).versionId;
    expect(getDeck(deckId)!.currentVersionId).toBe(v2);

    deleteVersion(v2);

    expect(listVersions(deckId).map((v) => v.id)).toEqual([versionId]);
    // The deck must never point at a version that is gone (invariant 3).
    expect(getDeck(deckId)!.currentVersionId).toBe(versionId);
  });

  it('never leaves a deck with no version at all', () => {
    const { versionId } = makeDeck();
    expect(() => deleteVersion(versionId)).toThrow();
  });

  /**
   * The fork copies rows the mirror cannot resolve, then `writeSlots` deletes
   * preserved rows whose name matches something being written. Those two
   * arrived in different passes, so the interaction is worth pinning: the
   * cleanup *does* delete a row the copy just made, and that is correct — the
   * user restated that card, and keeping both would double it.
   */
  it('drops a copied ghost the user restated, and keeps one they did not', () => {
    const { versionId, legend } = makeDeck();
    const alt = seedCard({ id: 'p-alt', name: 'Statikk Shock (Alternate Art)' });
    const std = seedCard({ id: 'p-std', name: 'Statikk Shock' });
    const unrelated = seedCard({ id: 'ghost-2', name: 'Vanishing Act' });

    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 3], [unrelated, 1]]));
    db.runSync("DELETE FROM cards WHERE id IN ('p-alt', 'ghost-2')");
    logGame(built.versionId);

    const forked = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[std, 3]]));
    expect(forked.outcome).toBe('forked');

    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      'SELECT card_id, quantity FROM deck_version_cards WHERE deck_version_id = ? ORDER BY card_id',
      [forked.versionId]
    );
    expect(rows.map((r) => r.card_id)).toEqual(['ghost-2', 'legend-1', 'p-std']);
    // Not six copies of Statikk Shock: the copied p-alt row was superseded.
    expect(rows.find((r) => r.card_id === 'p-std')?.quantity).toBe(3);

    // The parent still holds exactly what it played.
    expect(
      db
        .getAllSync<{ card_id: string }>(
          'SELECT card_id FROM deck_version_cards WHERE deck_version_id = ? ORDER BY card_id',
          [built.versionId]
        )
        .map((r) => r.card_id)
    ).toEqual(['ghost-2', 'legend-1', 'p-alt']);
  });

  /**
   * A card the editor is holding can leave the mirror mid-session. The delete
   * in `writeSlots` spares rows it cannot resolve, so the old row survives and
   * the new one lands on the same `(version, card_id, zone)` key.
   */
  it('does not violate the unique index when a held card leaves the mirror', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const built = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));

    // The draft still holds `a`; a resync drops the printing.
    db.runSync('DELETE FROM cards WHERE id = ?', ['a']);
    let after = '';
    expect(() => {
      after = saveDeckEdit(built.versionId, withCards(built.versionId, legend, [[a, 3]]))
        .versionId;
    }).not.toThrow();

    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      `SELECT card_id, quantity FROM deck_version_cards
        WHERE deck_version_id = ? AND zone = 'main'`,
      [after]
    );
    expect(rows).toEqual([{ card_id: 'a', quantity: 3 }]);
  });

  it('keeps the Champion when only its printing left the mirror', () => {
    const { deckId, versionId, legend, champion } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });

    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    });

    db.runSync('DELETE FROM cards WHERE id = ?', ['champ-1']);
    setCurrentVersion(deckId, versionId);

    const deck = getDeck(deckId)!;
    // The Champion is still in the version — it is the library that lost it, so
    // nulling the denormalized id would be losing data to a resync.
    expect(deck.championCardId).toBe('champ-1');
    expect(deck.legendCardId).toBe('legend-1');
    expect(deck.domains).toEqual(['Fury', 'Order']);
  });

  it('keeps the Legend and domains when the Legend printing left the mirror', () => {
    const { deckId, versionId } = makeDeck();
    db.runSync('DELETE FROM cards WHERE id = ?', ['legend-1']);
    setCurrentVersion(deckId, versionId);

    const deck = getDeck(deckId)!;
    expect(deck.legendCardId).toBe('legend-1');
    expect(deck.domains).toEqual(['Fury', 'Order']);
  });

  it('clears the Champion when the version genuinely has none', () => {
    const { deckId, versionId, legend } = makeDeck();
    saveDeckEdit(versionId, { slots: [{ card: legend, quantity: 1, zone: 'legend' }] });
    expect(getDeck(deckId)!.championCardId).toBeNull();
  });

  it('falls back to the highest remaining version, not to the parent', () => {
    const { deckId, versionId: v1, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });

    logGame(v1);
    const v2 = saveDeckEdit(v1, withCards(v1, legend, [[a, 1]])).versionId;
    setCurrentVersion(deckId, v1);
    const v3 = saveDeckEdit(v1, withCards(v1, legend, [[b, 1]])).versionId;

    // v3's parent is v1, but v2 exists — deleting v3 must not drop the user
    // two versions back.
    deleteVersion(v3);
    expect(getDeck(deckId)!.currentVersionId).toBe(v2);
  });

  /**
   * Comparing two versions that are not parent and child.
   *
   * `compareVersions` diffs two lists and knows nothing about ancestry, so a
   * branch should make no difference — but "compare across a fork" is exactly
   * the case a reader assumes is handled and never checks. Verified after the
   * device pass reported compare as partly broken: the data is right, so the
   * fault is in the interaction, not here.
   */
  it('compares across a branch, not only along the parent chain', () => {
    const { deckId, versionId: v1, legend } = makeDeck();
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) =>
      seedCard({ id, name: `Card ${id.toUpperCase()}` })
    ) as [CardRow, CardRow, CardRow, CardRow];

    const list = (...cards: CardRow[]) => ({
      slots: [
        { card: legend, quantity: 1, zone: 'legend' as const },
        ...cards.map((card) => ({ card, quantity: 2, zone: 'main' as const })),
      ],
    });

    saveDeckEdit(v1, list(a));
    logGame(v1);
    const v2 = saveDeckEdit(v1, list(a, b)).versionId;
    logGame(v2);
    const v3 = saveDeckEdit(v2, list(a, b, c)).versionId;

    // Back to v1 and fork a sibling of v2.
    setCurrentVersion(deckId, v1);
    const v4 = saveDeckEdit(v1, list(a, d)).versionId;

    const ids = (entries: { card: CardRow }[]) => entries.map((e) => e.card.id).sort();

    // Along the chain.
    expect(ids(compareVersions(v2, v3).added)).toEqual(['c']);

    // Across the branch: v4 never had b, and v2 never had d.
    const across = compareVersions(v2, v4);
    expect(ids(across.added)).toEqual(['d']);
    expect(ids(across.removed)).toEqual(['b']);

    // Two versions on different branches, neither an ancestor of the other.
    const cousins = compareVersions(v3, v4);
    expect(ids(cousins.added)).toEqual(['d']);
    expect(ids(cousins.removed)).toEqual(['b', 'c']);
    expect(cousins.isEmpty).toBe(false);
  });

  it('can point the deck back at an older version', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    logGame(versionId);
    const v2 = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 1]])).versionId;

    expect(getDeck(deckId)!.currentVersionId).toBe(v2);
    setCurrentVersion(deckId, versionId);
    expect(getDeck(deckId)!.currentVersionId).toBe(versionId);
  });

  it('reports the change that created a version, and any pair', () => {
    const { versionId, legend, champion } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Ashen Blade' });

    expect(versionDiff(versionId)).toBeNull(); // nothing precedes the first build

    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
      ],
    });
    logGame(versionId);
    const v2 = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: a, quantity: 3, zone: 'main' },
      ],
    }).versionId;

    const diff = versionDiff(v2)!;
    expect(diff.added.map((e) => e.card.id)).toEqual(['a']);
    expect(diff.netCardsMoved).toBe(3);
    expect(compareVersions(versionId, v2).added).toHaveLength(1);
    // Reversed, the same edit reads as a removal.
    expect(compareVersions(v2, versionId).removed).toHaveLength(1);
  });
});

describe('loadDeckList', () => {
  it('drops cards missing from the mirror rather than inventing them', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
      ],
    });

    // The mirror is re-synced and this printing is gone.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    expect(loadDeckList(built.versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(missingCards(built.versionId)).toHaveLength(1);
  });
});

/**
 * The name source for an opening hand.
 *
 * `matches.opening_hand` stores card ids alone. That is only safe because
 * this exists — the hand is always drawn from one deck version, and
 * `deck_version_cards.card_name` has carried the name since migration 5 for
 * precisely this class of problem. If this ever started joining `cards`, every
 * recorded hand would quietly lose its cards the next time a printing left the
 * library, and the match log would be back to storing pointers into a table the
 * app is free to throw away.
 */
describe('versionCardNames', () => {
  it('still names a card after its printing leaves the library', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
      ],
    });

    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    // `loadDeckList` cannot see it any more — this still can, which is the
    // whole point of reading the list rather than the mirror.
    expect(loadDeckList(built.versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(versionCardNames(built.versionId).get('ghost')).toBe('Vanishing Act');
  });

  it('leaves a nameless row out rather than inventing a placeholder', () => {
    const { versionId, legend } = makeDeck();
    const built = saveDeckEdit(versionId, {
      slots: [{ card: legend, quantity: 1, zone: 'legend' }],
    });

    // A row written before migration 5 has no name stored.
    db.runSync(
      `INSERT INTO deck_version_cards (id, deck_version_id, card_id, riftbound_id, quantity, zone)
       VALUES ('old-row', ?, 'nameless', 'rb-nameless', 1, 'main')`,
      [built.versionId]
    );

    const names = versionCardNames(built.versionId);
    // Absent, so a caller can tell "unknown card" from a card called "Unknown".
    expect(names.has('nameless')).toBe(false);
    expect(names.get(legend.id)).toBe(legend.name);
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

    const built = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: bf, quantity: 3, zone: 'battlefield' },
      ],
    });

    // Forge the state an old build left behind: wrong verdict, old stamp.
    db.runSync(
      'UPDATE deck_versions SET is_legal = 1, main_count = 99, rules_version = 0 WHERE id = ?',
      [built.versionId]
    );
    expect(getVersion(built.versionId)!.isLegal).toBe(true);

    listDecks();

    const repaired = getVersion(built.versionId)!;
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

/**
 * Notes and labels, now that screens can actually reach them.
 *
 * All four setters share one contract — blank clears rather than storing an
 * empty string. `setDeckNotes` did not, which nothing had noticed because no
 * caller existed: an emptied field left `''` behind, and `''` renders as a note
 * someone deliberately wrote nothing in rather than as no note at all.
 */
describe('notes and labels', () => {
  it('clears a deck note when the field is emptied', () => {
    const { deckId } = makeDeck();

    setDeckNotes(deckId, 'Sideboard the Gear matchup');
    expect(getDeck(deckId)?.notes).toBe('Sideboard the Gear matchup');

    setDeckNotes(deckId, '   ');
    expect(getDeck(deckId)?.notes).toBeNull();
  });

  it('labels a version that never passed through a fork sheet', () => {
    // v1 is the case that mattered: a label used to be set only at fork time,
    // so the first build could never have one.
    const { versionId } = makeDeck();
    expect(getVersion(versionId)?.label).toBeNull();

    setVersionLabel(versionId, 'Opening build');
    setVersionNotes(versionId, 'Straight from the precon, before any testing.');

    expect(getVersion(versionId)?.label).toBe('Opening build');
    expect(getVersion(versionId)?.notes).toBe('Straight from the precon, before any testing.');
  });

  it('clears a version label back to unlabelled', () => {
    const { versionId } = makeDeck();
    setVersionLabel(versionId, 'Typo');
    setVersionLabel(versionId, '');

    expect(getVersion(versionId)?.label).toBeNull();
  });

  /*
   * The common case, and the one the lock rule could plausibly have blocked.
   * v1 is almost always locked by the time anyone wants to name it — you play
   * the deck, then decide what that build was. Locking protects the card list,
   * not the label.
   */
  it('labels a version that has already been played', () => {
    const { deckId, versionId } = makeDeck();
    lockVersion(versionId);

    setVersionLabel(versionId, 'The build I took to Nexus Night');

    const version = getVersion(versionId)!;
    expect(version.label).toBe('The build I took to Nexus Night');
    expect(version.lockedAt).not.toBeNull();
    expect(listVersions(deckId)).toHaveLength(1);
  });

  it('trims a padded deck name rather than storing it', () => {
    const { deckId } = makeDeck();
    renameDeck(deckId, '  Vi Control  ');
    expect(getDeck(deckId)?.name).toBe('Vi Control');
  });

  it('leaves the version list and its cards alone', () => {
    const { deckId, versionId } = makeDeck();
    const before = loadDeckList(versionId);

    setVersionLabel(versionId, 'Renamed');
    setVersionNotes(versionId, 'A note');

    // Naming a version is not editing it: no fork, no card change, no lock.
    expect(listVersions(deckId)).toHaveLength(1);
    expect(loadDeckList(versionId).slots).toEqual(before.slots);
    expect(getVersion(versionId)?.lockedAt).toBeNull();
  });
});

describe('archiveDeck', () => {
  it('hides the deck from the list and puts it back', () => {
    const { deckId } = makeDeck('Archivable');

    archiveDeck(deckId, true);
    expect(listDecks().map((s) => s.deck.id)).not.toContain(deckId);
    expect(listDecks(true).map((s) => s.deck.id)).toContain(deckId);

    archiveDeck(deckId, false);
    expect(listDecks().map((s) => s.deck.id)).toContain(deckId);
  });

  /*
   * The distinction the confirm text promises. Archiving is not deleting, so
   * everything attached to the deck has to survive it — otherwise "your match
   * history is kept" is a lie told in a dialog.
   */
  it('keeps versions and matches intact', () => {
    const { deckId, versionId } = makeDeck('Archivable');
    lockVersion(versionId);

    archiveDeck(deckId, true);

    expect(listVersions(deckId)).toHaveLength(1);
    // Legend and Champion, as seeded — archiving touches neither.
    expect(loadDeckList(versionId).slots).toHaveLength(2);
    expect(getDeck(deckId)?.deletedAt).toBeNull();
  });
});
