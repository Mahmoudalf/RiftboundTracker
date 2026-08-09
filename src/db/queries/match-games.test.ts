import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cardHandStats,
  championTurnStats,
  handCoverage,
  performanceByMulliganCount,
} from '@/lib/analytics/hands';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, deleteDeck } from './decks';
import {
  gamesForMatches,
  listMatchGames,
  MatchGameError,
  saveMatchGames,
} from './match-games';
import { getMatch, listMatches, logMatch } from './matches';

/**
 * Per-game detail and the analytics over it.
 *
 * The load-bearing distinction throughout: **null means not recorded**, and an
 * empty array means recorded-and-empty. Collapsing the two turns a missing
 * observation into a real one, which is the same mistake the on-play nullable
 * exists to avoid.
 */

let db: TestDatabase;

function seedCard(overrides: Partial<CardRow> & { id: string }): CardRow {
  const card: CardRow = {
    riftboundId: `rb-${overrides.id}`, tcgplayerId: null, name: 'Test Card',
    cleanName: 'Test Card', collectorNumber: 1, energy: null, might: null, power: null,
    type: 'Spell', supertype: null, rarity: 'Common', domains: ['Fury'], domainKey: 'Fury',
    textPlain: null, textRich: null, flavour: null, tags: [], setId: 'OGN', setLabel: 'Origins',
    imageUrl: 'https://cdn.example/art.png', artist: 'Someone', accessibilityText: null,
    orientation: 'portrait', alternateArt: false, signature: false, overnumbered: false,
    isNew: false, updatedOn: null, ...overrides,
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

function makeMatch() {
  const legend = seedCard({
    id: 'legend-1', name: 'Vi - Piltover Enforcer', type: 'Legend',
    domains: ['Fury', 'Order'], domainKey: 'Fury,Order', tags: ['Vi'],
  });
  const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
  return { matchId: logMatch({ deckId, deckVersionId: versionId, result: 'win' }), deckId };
}

describe('saveMatchGames', () => {
  it('round-trips every field of a game', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      {
        gameNumber: 1,
        result: 'win',
        onPlay: true,
        scoreFor: 8,
        scoreAgainst: 6,
        championTurn: 4,
        oppChampionTurn: 5,
        openingHand: ['a', 'b', 'c'],
        mulliganed: ['d'],
        battlefields: ['bf1', 'bf2'],
        notes: 'close',
      },
    ]);

    const [game] = listMatchGames(matchId);
    expect(game).toMatchObject({
      gameNumber: 1, result: 'win', onPlay: true,
      scoreFor: 8, scoreAgainst: 6, championTurn: 4, oppChampionTurn: 5,
      notes: 'close',
    });
    expect(game!.openingHand).toEqual(['a', 'b', 'c']);
    expect(game!.mulliganed).toEqual(['d']);
    expect(game!.battlefields).toEqual(['bf1', 'bf2']);
  });

  /*
   * The two Battlefields are separate columns precisely so one being missing
   * cannot promote the other. A positional pair would make [theirs] and [mine]
   * the same row.
   */
  it('keeps each side of the Battlefields apart when only one is recorded', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      { gameNumber: 1, result: 'win', oppBattlefieldCardId: 'theirs-1' },
      { gameNumber: 2, result: 'loss', battlefieldCardId: 'mine-2' },
    ]);

    const [one, two] = listMatchGames(matchId);
    expect(one).toMatchObject({ battlefieldCardId: null, oppBattlefieldCardId: 'theirs-1' });
    expect(two).toMatchObject({ battlefieldCardId: 'mine-2', oppBattlefieldCardId: null });
  });

  it('keeps null distinct from an empty list', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      { gameNumber: 1, result: 'win' },
      { gameNumber: 2, result: 'loss', mulliganed: [], openingHand: ['a'] },
    ]);

    const games = listMatchGames(matchId);
    // Game 1: nothing recorded.
    expect(games[0]!.mulliganed).toBeNull();
    expect(games[0]!.openingHand).toBeNull();
    // Game 2: recorded, and they kept the hand — a real observation.
    expect(games[1]!.mulliganed).toEqual([]);
  });

  it('replaces the whole set rather than appending', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      { gameNumber: 1, result: 'win' },
      { gameNumber: 2, result: 'loss' },
    ]);
    saveMatchGames(matchId, [{ gameNumber: 1, result: 'draw' }]);

    const games = listMatchGames(matchId);
    expect(games).toHaveLength(1);
    expect(games[0]!.result).toBe('draw');
  });

  it('derives the match games-won summary from the detail', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      { gameNumber: 1, result: 'win' },
      { gameNumber: 2, result: 'loss' },
      { gameNumber: 3, result: 'win' },
    ]);

    // Two places holding the same fact is how they come to disagree.
    expect(getMatch(matchId)).toMatchObject({ gamesWon: 2, gamesLost: 1 });
  });

  it('clears the summary when the detail is removed', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [{ gameNumber: 1, result: 'win' }]);
    saveMatchGames(matchId, []);

    expect(listMatchGames(matchId)).toEqual([]);
    expect(getMatch(matchId)).toMatchObject({ gamesWon: null, gamesLost: null });
  });

  it('collects games across several matches', () => {
    const first = makeMatch();
    const second = makeMatch();
    saveMatchGames(first.matchId, [{ gameNumber: 1, result: 'win' }]);
    saveMatchGames(second.matchId, [
      { gameNumber: 1, result: 'loss' },
      { gameNumber: 2, result: 'win' },
    ]);

    expect(gamesForMatches([first.matchId, second.matchId])).toHaveLength(3);
    expect(gamesForMatches([])).toEqual([]);
  });
});

describe('audit regressions', () => {
  /**
   * Deleting a deck used to leave its matches live: `listDecks` hid the deck
   * while `listMatches()` kept returning its games, so a deleted deck's results
   * stayed in the cross-deck Stats totals with nothing to attribute them to.
   */
  it('takes a deck’s matches with it when the deck is deleted', () => {
    const { matchId, deckId } = makeMatch();
    saveMatchGames(matchId, [{ gameNumber: 1, result: 'win' }]);
    expect(listMatches()).toHaveLength(1);

    deleteDeck(deckId);

    expect(listMatches()).toEqual([]);
    expect(listMatches({ deckId })).toEqual([]);
    expect(getMatch(matchId)).toBeNull();
    // Soft, so the deletion still propagates rather than reappearing on sync.
    expect(
      db.getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM matches WHERE deleted_at IS NOT NULL'
      )!.n
    ).toBe(1);
  });

  /**
   * The unique index already stopped this, but as a raw
   * "UNIQUE constraint failed" out of the middle of a transaction — true, and
   * useless to a caller trying to tell the user what to fix.
   */
  it('rejects duplicate game numbers with a readable message', () => {
    const { matchId } = makeMatch();
    expect(() =>
      saveMatchGames(matchId, [
        { gameNumber: 1, result: 'win' },
        { gameNumber: 1, result: 'loss' },
      ])
    ).toThrow(MatchGameError);

    // And nothing was written on the way to refusing.
    expect(listMatchGames(matchId)).toEqual([]);
  });

  /**
   * Only observable because the test harness now enables `PRAGMA foreign_keys`
   * the way `migrate()` does. Before that, this wrote orphan rows in tests and
   * would have thrown on a device.
   */
  it('refuses games against a match that does not exist', () => {
    expect(() => saveMatchGames('no-such-match', [{ gameNumber: 1, result: 'win' }])).toThrow();
    expect(listMatchGames('no-such-match')).toEqual([]);
  });
});

describe('hand analytics', () => {
  const game = (n: number, over: Partial<Parameters<typeof saveMatchGames>[1][number]> = {}) => ({
    gameNumber: n,
    result: 'win' as const,
    ...over,
  });

  it('reports coverage so a pattern from 2 of 40 games cannot pass as one', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      game(1, { openingHand: ['a'] }),
      game(2),
      game(3),
    ]);

    expect(handCoverage(listMatchGames(matchId))).toEqual({ recorded: 1, total: 3 });
  });

  it('rates a card by how often it goes back, over games it was seen in', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      game(1, { openingHand: ['keep'], mulliganed: ['dud'] }),
      game(2, { openingHand: ['keep'], mulliganed: ['dud'] }),
      game(3, { openingHand: ['keep', 'dud'], mulliganed: [] }),
    ]);

    const stats = cardHandStats(listMatchGames(matchId), 3);
    const dud = stats.find((s) => s.cardId === 'dud')!;
    expect(dud.seen).toBe(3);
    expect(dud.mulliganed).toBe(2);
    expect(dud.mulliganRate).toBeCloseTo(2 / 3);
    // Thrown back most often, so it sorts first.
    expect(stats[0]!.cardId).toBe('dud');
  });

  it('hides cards seen too few times to mean anything', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [game(1, { openingHand: [], mulliganed: ['once'] })]);

    // A single mulligan of a card drawn once would otherwise top the list at
    // 100 % and bury the card there is actually a problem with.
    expect(cardHandStats(listMatchGames(matchId), 3)).toEqual([]);
    expect(cardHandStats(listMatchGames(matchId), 1)).toHaveLength(1);
  });

  it('groups performance by how many cards went back', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      game(1, { result: 'win', mulliganed: [], openingHand: ['a'] }),
      game(2, { result: 'win', mulliganed: [], openingHand: ['a'] }),
      game(3, { result: 'loss', mulliganed: ['x', 'y'], openingHand: ['a'] }),
    ]);

    const segments = performanceByMulliganCount(listMatchGames(matchId));
    expect(segments[0]).toMatchObject({ label: 'Kept the opening hand' });
    expect(segments[0]!.rate.wins).toBe(2);
    expect(segments[1]!.label).toBe('2 cards back');
    expect(segments[1]!.rate.losses).toBe(1);
  });

  it('ignores games with no hand recorded', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [game(1), game(2), game(3, { openingHand: ['a'] })]);

    // Two unrecorded games must not read as "kept the opening hand".
    const segments = performanceByMulliganCount(listMatchGames(matchId));
    expect(segments.reduce((n, s) => n + s.rate.total, 0)).toBe(1);
  });

  it('splits champion turn at the median rather than a fixed turn', () => {
    const { matchId } = makeMatch();
    saveMatchGames(matchId, [
      game(1, { result: 'win', championTurn: 3 }),
      game(2, { result: 'win', championTurn: 4 }),
      game(3, { result: 'loss', championTurn: 7 }),
    ]);

    const stats = championTurnStats(listMatchGames(matchId));
    expect(stats.recorded).toBe(3);
    expect(stats.median).toBe(4);
    expect(stats.averageTurn).toBeCloseTo(14 / 3);
    expect(stats.earlier.wins).toBe(2);
    expect(stats.later.losses).toBe(1);
  });

  it('is empty-safe when nothing was recorded', () => {
    expect(championTurnStats([])).toMatchObject({ recorded: 0, averageTurn: null });
    expect(cardHandStats([])).toEqual([]);
    expect(performanceByMulliganCount([])).toEqual([]);
    expect(handCoverage([])).toEqual({ recorded: 0, total: 0 });
  });
});
