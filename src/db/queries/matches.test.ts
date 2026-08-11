import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { conn, setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import {
  createDeck,
  getVersion,
  listDecks,
  listVersions,
  saveDeckEdit,
  versionMatchCounts,
} from './decks';
import {
  deckRecord,
  deleteMatch,
  getMatch,
  listMatches,
  battlefieldFields,
  logMatch,
  opponentBattlefieldFields,
  opponentChampionFields,
  opponentFields,
  undoMatch,
  updateMatch,
} from './matches';

/**
 * Match logging against a real database.
 *
 * The load-bearing test here is the lock: a match must never exist against a
 * version that can still be edited in place. Everything M3 built rests on one
 * insert doing two things atomically.
 */

let db: TestDatabase;

function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: `rb-${overrides.id}`,
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
    imageUrl: 'https://cdn.example/art.png',
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
    `INSERT OR REPLACE INTO cards
       (id, riftbound_id, name, clean_name, collector_number, type, supertype,
        rarity, domains, domain_key, tags, set_id, set_label, image_url, artist, orientation)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      card.id, card.riftboundId, card.name, card.cleanName, card.collectorNumber,
      card.type, card.supertype, card.rarity, JSON.stringify(card.domains),
      card.domainKey, JSON.stringify(card.tags), card.setId, card.setLabel,
      card.imageUrl, card.artist, card.orientation,
    ]
  );
  return card;
}

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
  const legend = seedCard({
    id: `legend-${name}`,
    name: 'Vi - Piltover Enforcer',
    type: 'Legend',
    domains: ['Fury', 'Order'],
    domainKey: 'Fury,Order',
    tags: ['Vi'],
  });
  return { legend, ...createDeck({ name, legend, champion: null }) };
}

describe('logMatch', () => {
  it('records the result and locks the version it was played with', () => {
    const { deckId, versionId } = makeDeck();
    expect(getVersion(versionId)!.lockedAt).toBeNull();

    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    const match = getMatch(id)!;
    expect(match.result).toBe('win');
    expect(match.deckId).toBe(deckId);
    expect(match.deckVersionId).toBe(versionId);
    expect(match.playedAt).toBeTruthy();

    // The lock is the point. Without it the next edit rewrites the list this
    // result was played with, in place.
    expect(getVersion(versionId)!.lockedAt).toBeTruthy();
  });

  it('makes the next edit fork instead of amending', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });
    const b = seedCard({ id: 'b', name: 'Card B' });

    const withCard = (card: CardRow) => ({
      slots: [
        { card: legend, quantity: 1, zone: 'legend' as const },
        { card, quantity: 2, zone: 'main' as const },
      ],
    });

    // An edit is a version whether or not the deck has been played.
    const built = saveDeckEdit(versionId, withCard(a));
    expect(built.outcome).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(2);

    logMatch({ deckId, deckVersionId: built.versionId, result: 'loss' });

    // And the same is true once it has: playing it never made the difference.
    const forked = saveDeckEdit(built.versionId, withCard(b));
    expect(forked.outcome).toBe('forked');
    expect(listVersions(deckId)).toHaveLength(3);
  });

  it('leaves the lock timestamp alone on later matches', () => {
    const { deckId, versionId } = makeDeck();
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    const first = getVersion(versionId)!.lockedAt;

    logMatch({ deckId, deckVersionId: versionId, result: 'loss' });
    expect(getVersion(versionId)!.lockedAt).toBe(first);
  });

  it('stores nothing it was not given', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    // The two-tap path supplies a deck, a result, and a timestamp. Everything
    // else must be null so analytics shrinks the sample rather than assuming.
    const match = getMatch(id)!;
    expect(match.onPlay).toBeNull();
    expect(match.oppLegendCardId).toBeNull();
    expect(match.oppDomains).toBeNull();
    expect(match.mulligans).toBeNull();
    expect(match.gamesWon).toBeNull();
    expect(match.notes).toBeNull();
    expect(match.eventType).toBe('casual');
  });

  it('round-trips the optional detail when it is given', () => {
    const { deckId, versionId } = makeDeck();
    const opp = seedCard({ id: 'opp', name: 'Yasuo', type: 'Legend' });

    const id = logMatch({
      deckId,
      deckVersionId: versionId,
      result: 'win',
      onPlay: true,
      gamesWon: 2,
      gamesLost: 1,
      oppLegendCardId: opp.id,
      oppDomains: ['Fury', 'Chaos'],
      oppLabel: 'Yasuo aggro',
      eventType: 'tournament',
      mulligans: 1,
      notes: 'Close one',
      tags: ['locals'],
    });

    const match = getMatch(id)!;
    expect(match.onPlay).toBe(true);
    expect(match.gamesWon).toBe(2);
    expect(match.oppLegendCardId).toBe('opp');
    expect(match.oppDomains).toEqual(['Fury', 'Chaos']);
    expect(match.oppLabel).toBe('Yasuo aggro');
    expect(match.eventType).toBe('tournament');
    expect(match.mulligans).toBe(1);
    expect(match.tags).toEqual(['locals']);
  });

  it('records the format and the match style', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({
      deckId, deckVersionId: versionId, result: 'win',
      bestOf: 3, eventType: 'tournament',
    });

    const match = getMatch(id)!;
    expect(match.bestOf).toBe(3);
    expect(match.eventType).toBe('tournament');
  });

  it('keeps the format unrecorded when it was not asked', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    // Bo-format is known before a match starts, so an absent value means the
    // player did not record it — not that it was a Bo1.
    expect(getMatch(id)!.bestOf).toBeNull();
  });

  it('records the opponent Champion by name as well as id', () => {
    const { deckId, versionId } = makeDeck();
    const yasuo = seedCard({ id: 'yasuo', name: 'Yasuo - Windrunner', type: 'Legend' });
    const champ = seedCard({
      id: 'yasuo-unit', name: 'Yasuo - Unforgiven', type: 'Unit', supertype: 'Champion',
    });

    const id = logMatch({
      deckId, deckVersionId: versionId, result: 'loss',
      ...opponentFields(yasuo),
      ...opponentChampionFields(champ),
    });

    db.runSync("DELETE FROM cards WHERE id IN ('yasuo', 'yasuo-unit')");

    const match = getMatch(id)!;
    expect(match.oppLegendName).toBe('Yasuo - Windrunner');
    expect(match.oppChampionName).toBe('Yasuo - Unforgiven');
  });

  it('records the Battlefield each side played, by name as well as id', () => {
    const { deckId, versionId } = makeDeck();
    const ours = seedCard({ id: 'bf-1', name: 'Star Spring', type: 'Battlefield' });
    const theirs = seedCard({ id: 'bf-2', name: 'Black Flame Altar', type: 'Battlefield' });

    const id = logMatch({
      deckId, deckVersionId: versionId, result: 'win',
      ...battlefieldFields(ours),
      ...opponentBattlefieldFields(theirs),
    });

    // Third time this pattern has been needed — deck cards, opponents, and now
    // Battlefields — so the name has to survive the card leaving the library.
    db.runSync("DELETE FROM cards WHERE id IN ('bf-1', 'bf-2')");

    const match = getMatch(id)!;
    expect(match.battlefieldName).toBe('Star Spring');
    expect(match.oppBattlefieldName).toBe('Black Flame Altar');
    expect(match.battlefieldCardId).toBe('bf-1');
    expect(match.oppBattlefieldCardId).toBe('bf-2');
  });

  it('leaves both Battlefields null when neither was recorded', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    const match = getMatch(id)!;
    expect(match.battlefieldCardId).toBeNull();
    expect(match.battlefieldName).toBeNull();
    expect(match.oppBattlefieldCardId).toBeNull();
    expect(match.oppBattlefieldName).toBeNull();
  });

  it('distinguishes on-the-draw from unknown', () => {
    const { deckId, versionId } = makeDeck();
    const drew = logMatch({ deckId, deckVersionId: versionId, result: 'win', onPlay: false });
    const unknown = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    // Recording "unknown" as false would bias the split rather than shrink it.
    expect(getMatch(drew)!.onPlay).toBe(false);
    expect(getMatch(unknown)!.onPlay).toBeNull();
  });
});

describe('the opponent outliving the card library', () => {
  /**
   * The migration-5 mistake, repeated on matches and caught before any device
   * wrote a row. A match is a permanent record; the card mirror is disposable.
   */
  it('still names the opponent after their printing leaves the mirror', () => {
    const { deckId, versionId } = makeDeck();
    const yasuo = seedCard({
      id: 'yasuo', name: 'Yasuo - Windrunner', type: 'Legend', domains: ['Chaos'],
    });

    const id = logMatch({
      deckId, deckVersionId: versionId, result: 'win', ...opponentFields(yasuo),
    });

    db.runSync('DELETE FROM cards WHERE id = ?', ['yasuo']);

    const match = getMatch(id)!;
    expect(match.oppLegendName).toBe('Yasuo - Windrunner');
    // Domains ride along, so the match still says something even with no card.
    expect(match.oppDomains).toEqual(['Chaos']);
    expect(match.oppLegendCardId).toBe('yasuo');
  });

  it('opponentFields refuses to record an id without a name', () => {
    const yasuo = seedCard({ id: 'yasuo', name: 'Yasuo', type: 'Legend', domains: ['Chaos'] });
    expect(opponentFields(yasuo)).toEqual({
      oppLegendCardId: 'yasuo',
      oppLegendName: 'Yasuo',
      oppDomains: ['Chaos'],
    });
    expect(opponentFields(null)).toEqual({
      oppLegendCardId: null,
      oppLegendName: null,
      oppDomains: null,
    });
  });

});

describe('transaction nesting', () => {
  /**
   * `logMatch` and `saveDeckEdit` each open a transaction and neither may run
   * inside the other. expo-sqlite implements `withTransactionSync` as a bare
   * BEGIN/COMMIT — byte-identical to the test harness — so a nested call throws
   * on the device exactly as it does here, and the harness cannot hide it.
   */
  it('throws if a transaction is nested, on the harness and the device alike', () => {
    expect(() =>
      conn().withTransactionSync(() => {
        conn().withTransactionSync(() => conn().runSync('SELECT 1'));
      })
    ).toThrow(/transaction within a transaction/i);
  });

  it('runs the log-then-fork gesture without nesting', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });

    // The sequence M4's UI performs when a match is logged and the deck is then
    // edited: two transactions back to back, never one inside the other.
    expect(() => {
      logMatch({ deckId, deckVersionId: versionId, result: 'win' });
      saveDeckEdit(versionId, {
        slots: [
          { card: legend, quantity: 1, zone: 'legend' },
          { card: a, quantity: 2, zone: 'main' },
        ],
      });
      listDecks();
    }).not.toThrow();
  });
});

describe('deckRecord', () => {
  it('counts wins, losses and draws for a deck and for one version', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });

    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    logMatch({ deckId, deckVersionId: versionId, result: 'loss' });

    const v2 = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    }).versionId;
    logMatch({ deckId, deckVersionId: v2, result: 'draw' });

    expect(deckRecord(deckId)).toEqual({ wins: 2, losses: 1, draws: 1, total: 4 });
    expect(deckRecord(deckId, versionId)).toEqual({ wins: 2, losses: 1, draws: 0, total: 3 });
    expect(deckRecord(deckId, v2)).toEqual({ wins: 0, losses: 0, draws: 1, total: 1 });
  });

  it('is all zeroes for a deck that has never played', () => {
    const { deckId } = makeDeck();
    expect(deckRecord(deckId)).toEqual({ wins: 0, losses: 0, draws: 0, total: 0 });
  });

  it('ignores soft-deleted matches', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    deleteMatch(id);

    expect(deckRecord(deckId).total).toBe(0);
    // The version stays locked — it was still played.
    expect(getVersion(versionId)!.lockedAt).toBeTruthy();
  });
});

describe('versionMatchCounts', () => {
  it('fills in now that the matches table exists', () => {
    const { deckId, versionId } = makeDeck();
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    logMatch({ deckId, deckVersionId: versionId, result: 'loss' });

    // Stubbed to an empty map through all of M3. This is the check the roadmap
    // said to re-run the moment matches landed.
    expect(versionMatchCounts(deckId).get(versionId)).toBe(2);
  });

  it('excludes soft-deleted matches', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    deleteMatch(id);
    expect(versionMatchCounts(deckId).get(versionId)).toBeUndefined();
  });
});

describe('undo and delete', () => {
  it('undo removes the row entirely, leaving nothing to sync', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    undoMatch(id);

    // A tombstone here would sync a phantom match to every other device — the
    // user corrected a mis-tap, they did not record and remove a real game.
    expect(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM matches WHERE id = ?', [id])!.n
    ).toBe(0);
    expect(deckRecord(deckId).total).toBe(0);
  });

  it('delete keeps a tombstone so the deletion propagates', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });

    deleteMatch(id);

    const raw = db.getFirstSync<{ deleted_at: string | null; dirty: number }>(
      'SELECT deleted_at, dirty FROM matches WHERE id = ?',
      [id]
    );
    expect(raw?.deleted_at).toBeTruthy();
    expect(raw?.dirty).toBe(1);
    expect(getMatch(id)).toBeNull();
  });

  /**
   * A mis-tap must not cost a version.
   *
   * Undo used to leave the lock in place, so one accidental tap on a fast-tap
   * surface locked a version permanently: the next edit forked a version the
   * user never earned, with no way back. The lock protects results, and after
   * an undo there are none.
   */
  it('releases the lock when the undo leaves no matches behind', () => {
    const { deckId, versionId, legend } = makeDeck();
    const a = seedCard({ id: 'a', name: 'Card A' });

    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    expect(getVersion(versionId)!.lockedAt).toBeTruthy();

    undoMatch(id);
    expect(getVersion(versionId)!.lockedAt).toBeNull();

    /*
     * The undo released the lock, and that is all it did. The next edit still
     * forks — it always would have — so what this test now pins is the lock
     * itself: released, and no longer standing in the way of the escape hatch.
     */
    const next = saveDeckEdit(versionId, {
      slots: [
        { card: legend, quantity: 1, zone: 'legend' },
        { card: a, quantity: 2, zone: 'main' },
      ],
    });
    expect(next.outcome).toBe('forked');
    expect(getVersion(versionId)!.lockedAt).toBeNull();
    expect(listVersions(deckId)).toHaveLength(2);
  });

  it('keeps the lock when another match still references the version', () => {
    const { deckId, versionId } = makeDeck();
    logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    const second = logMatch({ deckId, deckVersionId: versionId, result: 'loss' });

    undoMatch(second);
    expect(getVersion(versionId)!.lockedAt).toBeTruthy();
  });

  it('keeps the lock when a real match was played and then deleted', () => {
    const { deckId, versionId } = makeDeck();
    const played = logMatch({ deckId, deckVersionId: versionId, result: 'win' });
    const mistap = logMatch({ deckId, deckVersionId: versionId, result: 'loss' });

    deleteMatch(played); // a real game, removed — leaves a tombstone
    undoMatch(mistap); // a mis-tap, erased

    // The tombstone is the evidence that this list was genuinely played, so the
    // list stays immutable even though no live match references it.
    expect(getVersion(versionId)!.lockedAt).toBeTruthy();
    expect(deckRecord(deckId).total).toBe(0);
  });
});

describe('listMatches and updateMatch', () => {
  it('lists newest first and scopes to a deck', () => {
    const first = makeDeck('First');
    const second = makeDeck('Second');

    logMatch({
      deckId: first.deckId, deckVersionId: first.versionId, result: 'win',
      playedAt: '2026-08-01T10:00:00.000Z',
    });
    logMatch({
      deckId: first.deckId, deckVersionId: first.versionId, result: 'loss',
      playedAt: '2026-08-03T10:00:00.000Z',
    });
    logMatch({
      deckId: second.deckId, deckVersionId: second.versionId, result: 'draw',
      playedAt: '2026-08-02T10:00:00.000Z',
    });

    expect(listMatches().map((m) => m.result)).toEqual(['loss', 'draw', 'win']);
    expect(listMatches({ deckId: first.deckId })).toHaveLength(2);
    expect(listMatches({ limit: 1 })).toHaveLength(1);
  });

  it('patches only the fields it is given', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({
      deckId, deckVersionId: versionId, result: 'win', oppLabel: 'Yasuo aggro',
    });

    updateMatch(id, { result: 'loss' });

    const match = getMatch(id)!;
    expect(match.result).toBe('loss');
    expect(match.oppLabel).toBe('Yasuo aggro');
  });

  it('can clear an optional field back to null', () => {
    const { deckId, versionId } = makeDeck();
    const id = logMatch({ deckId, deckVersionId: versionId, result: 'win', onPlay: true });

    updateMatch(id, { onPlay: null });
    expect(getMatch(id)!.onPlay).toBeNull();
  });
});
