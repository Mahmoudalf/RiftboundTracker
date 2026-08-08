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

    saveDeckEdit(versionId, {
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
    saveDeckEdit(versionId, { slots: [...base, { card: a, quantity: 2, zone: 'main' }] });
    saveDeckEdit(versionId, { slots: [...base, { card: b, quantity: 1, zone: 'main' }] });

    const ids = loadDeckList(versionId)
      .slots.filter((s) => s.zone === 'main')
      .map((s) => s.card.id);
    expect(ids).toEqual(['b']);
  });

  it('drops zero-quantity slots instead of writing them', () => {
    const { versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    saveDeckEdit(versionId, {
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

    saveDeckEdit(versionId, {
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
  function logMatch(versionId: string) {
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

  it('amends in place while the version has no matches', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));

    expect(result.outcome).toBe('amended');
    expect(result.versionId).toBe(versionId);
    expect(listVersions(deckId)).toHaveLength(1);
    expect(getDeck(deckId)!.currentVersionId).toBe(versionId);
  });

  it('forks once a match is logged, leaving the played list untouched', () => {
    const { deckId, versionId, legend, champion } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });
    const b = seedCard({ id: 'b', name: 'B' });

    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: a, quantity: 3, zone: 'main' },
      ],
    });
    logMatch(versionId);

    const result = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: champion, quantity: 1, zone: 'champion' },
        { card: b, quantity: 3, zone: 'main' },
      ],
    });

    expect(result.outcome).toBe('forked');
    expect(result.versionId).not.toBe(versionId);
    expect(result.versionNumber).toBe(2);

    // The played list is exactly as it was played (invariant 1).
    const played = loadDeckList(versionId).slots.filter((s) => s.zone === 'main');
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
    expect(forked.parentVersionId).toBe(versionId);
    expect(forked.lockedAt).toBeNull();
    expect(forked.label).toBe('−3 A and 1 more');
  });

  /*
   * Reported from a device as "editing a deck no longer creates a version".
   * Reproduced here as the exact sequence rather than argued about: the fork is
   * unlocked when it is born, so the *next* edit amends it. Correct, and
   * indistinguishable from a broken save if the UI says nothing — which is why
   * gap 2 is a defect even though nothing here is.
   */
  it('amends the fork on the next edit, because a fork starts unlocked', () => {
    const { deckId, versionId, legend } = makeDeck();
    const [a, b, c] = [1, 2, 3].map((n) => seedCard({ id: `c${n}`, name: `Card ${n}` }));

    saveDeckEdit(versionId, withCards(versionId, legend, [[a!, 3]]));
    logMatch(versionId);

    const forked = saveDeckEdit(versionId, withCards(versionId, legend, [[b!, 3]]));
    expect(forked.outcome).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(2);

    // Second edit, no match logged in between. No v3 — and the fork carries it.
    const again = saveDeckEdit(forked.versionId, withCards(forked.versionId, legend, [[c!, 3]]));
    expect(again.outcome).toBe('amended');
    expect(again.versionId).toBe(forked.versionId);
    expect(listVersions(deckId)).toHaveLength(2);
    expect(
      loadDeckList(forked.versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['c3']);

    // A match on the fork restores forking, so the rule is "played versions are
    // immutable", not "the first edit is special".
    logMatch(forked.versionId);
    expect(
      saveDeckEdit(forked.versionId, withCards(forked.versionId, legend, [[a!, 1]])).outcome
    ).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(3);
  });

  it('numbers versions contiguously from the deck maximum (invariant 4)', () => {
    const { deckId, versionId, legend } = makeDeck();
    const cards = [1, 2, 3].map((n) => seedCard({ id: `c${n}`, name: `Card ${n}` }));

    let current = versionId;
    for (const card of cards) {
      logMatch(current);
      current = saveDeckEdit(current, withCards(current, legend, [[card, 1]])).versionId;
    }

    expect(listVersions(deckId).map((v) => v.versionNumber)).toEqual([4, 3, 2, 1]);
  });

  it('swaps art in place while the version has no matches', () => {
    const { deckId, versionId, legend } = makeDeck();
    const standard = seedCard({ id: 'p1', name: 'Statikk Shock' });
    const alt = seedCard({ id: 'p2', name: 'Statikk Shock (Alternate Art)', alternateArt: true });

    saveDeckEdit(versionId, withCards(versionId, legend, [[standard, 2]]));
    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 2]]));

    expect(result.outcome).toBe('reprinted');
    expect(result.diff.cardSetIdentical).toBe(true);
    expect(listVersions(deckId)).toHaveLength(1);
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

    saveDeckEdit(versionId, withCards(versionId, legend, [[standard, 2]]));
    logMatch(versionId);

    const before = db.getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [versionId]
    );

    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 2]]));

    expect(result.outcome).toBe('forked');
    expect(result.diff.cardSetIdentical).toBe(true);
    expect(listVersions(deckId)).toHaveLength(2);

    // Byte-identical, row ids included — nothing about the played list moved.
    const after = db.getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [versionId]
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

    saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 3]]));

    // Upstream drops the alternate-art printing.
    db.runSync('DELETE FROM cards WHERE id = ?', ['p-alt']);
    expect(loadDeckList(versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(missingCards(versionId).map((m) => m.name)).toEqual([
      'Statikk Shock (Alternate Art)',
    ]);

    // The player repairs the hole with the printing they can see.
    saveDeckEdit(versionId, withCards(versionId, legend, [[standard, 3]]));

    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      `SELECT card_id, quantity FROM deck_version_cards
        WHERE deck_version_id = ? AND zone = 'main'`,
      [versionId]
    );
    expect(rows).toEqual([{ card_id: 'p-std', quantity: 3 }]);

    // And the deck stays legal when the old printing returns.
    seedCard({ id: 'p-alt', name: 'Statikk Shock (Alternate Art)' });
    expect(
      loadDeckList(versionId)
        .slots.filter((s) => s.zone === 'main')
        .reduce((n, s) => n + s.quantity, 0)
    ).toBe(3);
  });

  it('still preserves an unresolvable card the user did not re-add', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const other = seedCard({ id: 'other', name: 'Something Else' });

    saveDeckEdit(versionId, withCards(versionId, legend, [[ghost, 2]]));
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);
    saveDeckEdit(versionId, withCards(versionId, legend, [[other, 1]]));

    expect(missingCards(versionId).map((m) => m.name)).toEqual(['Vanishing Act']);
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

    logMatch(v1);
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

    saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));
    logMatch(versionId);

    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[b, 2]]), {
      amendLocked: true,
    });

    expect(result.outcome).toBe('amended-locked');
    expect(listVersions(deckId)).toHaveLength(1);
    expect(
      loadDeckList(versionId)
        .slots.filter((s) => s.zone === 'main')
        .map((s) => s.card.id)
    ).toEqual(['b']);
  });

  it('carries cards missing from the mirror across a fork', () => {
    const { versionId, legend } = makeDeck();
    const ghost = seedCard({ id: 'ghost', name: 'Vanishing Act' });
    const a = seedCard({ id: 'a', name: 'A' });

    saveDeckEdit(versionId, withCards(versionId, legend, [[ghost, 2]]));
    logMatch(versionId);

    // A card-library resync drops the printing. It is now invisible to the
    // editor, so the edited list cannot contain it.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    const result = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 1]]));
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
    logMatch(versionId);
    const second = saveDeckEdit(versionId, withCards(versionId, legend, [[a, 1]])).versionId;

    expect(() => deleteVersion(versionId)).toThrow(VersionHasMatchesError);
    expect(getVersion(versionId)).not.toBeNull();
    expect(second).toBeTruthy();
  });

  it('deletes an unplayed version and falls back to the one before it', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'A' });

    logMatch(versionId);
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

    saveDeckEdit(versionId, withCards(versionId, legend, [[alt, 3], [unrelated, 1]]));
    db.runSync("DELETE FROM cards WHERE id IN ('p-alt', 'ghost-2')");
    logMatch(versionId);

    const forked = saveDeckEdit(versionId, withCards(versionId, legend, [[std, 3]]));
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
          [versionId]
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
    saveDeckEdit(versionId, withCards(versionId, legend, [[a, 2]]));

    // The draft still holds `a`; a resync drops the printing.
    db.runSync('DELETE FROM cards WHERE id = ?', ['a']);
    expect(() =>
      saveDeckEdit(versionId, withCards(versionId, legend, [[a, 3]]))
    ).not.toThrow();

    const rows = db.getAllSync<{ card_id: string; quantity: number }>(
      `SELECT card_id, quantity FROM deck_version_cards
        WHERE deck_version_id = ? AND zone = 'main'`,
      [versionId]
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

    logMatch(v1);
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
    logMatch(v1);
    const v2 = saveDeckEdit(v1, list(a, b)).versionId;
    logMatch(v2);
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
    logMatch(versionId);
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
    logMatch(versionId);
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
    saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: ghost, quantity: 2, zone: 'main' },
      ],
    });

    // The mirror is re-synced and this printing is gone.
    db.runSync('DELETE FROM cards WHERE id = ?', ['ghost']);

    expect(loadDeckList(versionId).slots.filter((s) => s.zone === 'main')).toEqual([]);
    expect(missingCards(versionId)).toHaveLength(1);
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

    saveDeckEdit(versionId, {
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
