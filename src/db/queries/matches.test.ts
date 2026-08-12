import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cardHandStats,
  CLOSE_MARGIN,
  handCoverage,
  performanceByMulliganCount,
  scoreStats,
} from '@/lib/analytics/hands';

import { setTestConnection } from '../connection';
import { MIGRATIONS } from '../migrations';
import type { CardRow } from '../schema/cards';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '../testing';

import { createDeck, deleteDeck } from './decks';
import { getGame, listGames, logGame } from './games';
import {
  matchesForGames,
  listMatches,
  MatchError,
  saveMatches,
} from './matches';

/**
 * Per-match detail and the analytics over it.
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

function makeGame() {
  const legend = seedCard({
    id: 'legend-1', name: 'Vi - Piltover Enforcer', type: 'Legend',
    domains: ['Fury', 'Order'], domainKey: 'Fury,Order', tags: ['Vi'],
  });
  const { deckId, versionId } = createDeck({ name: 'Vi', legend, champion: null });
  return { gameId: logGame({ deckId, deckVersionId: versionId, result: 'win' }), deckId };
}

describe('saveMatches', () => {
  it('round-trips every field of a game', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      {
        matchNumber: 1,
        result: 'win',
        onPlay: true,
        scoreFor: 8,
        scoreAgainst: 6,
        openingHand: ['a', 'b', 'c'],
        mulliganed: ['d'],
        battlefields: ['bf1', 'bf2'],
        notes: 'close',
      },
    ]);

    const [game] = listMatches(gameId);
    expect(game).toMatchObject({
      matchNumber: 1, result: 'win', onPlay: true,
      scoreFor: 8, scoreAgainst: 6,
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
    const { gameId } = makeGame();
    saveMatches(gameId, [
      { matchNumber: 1, result: 'win', oppBattlefieldCardId: 'theirs-1' },
      { matchNumber: 2, result: 'loss', battlefieldCardId: 'mine-2' },
    ]);

    const [one, two] = listMatches(gameId);
    expect(one).toMatchObject({ battlefieldCardId: null, oppBattlefieldCardId: 'theirs-1' });
    expect(two).toMatchObject({ battlefieldCardId: 'mine-2', oppBattlefieldCardId: null });
  });

  it('keeps null distinct from an empty list', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      { matchNumber: 1, result: 'win' },
      { matchNumber: 2, result: 'loss', mulliganed: [], openingHand: ['a'] },
    ]);

    const games = listMatches(gameId);
    // Game 1: nothing recorded.
    expect(games[0]!.mulliganed).toBeNull();
    expect(games[0]!.openingHand).toBeNull();
    // Game 2: recorded, and they kept the hand — a real observation.
    expect(games[1]!.mulliganed).toEqual([]);
  });

  it('replaces the whole set rather than appending', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      { matchNumber: 1, result: 'win' },
      { matchNumber: 2, result: 'loss' },
    ]);
    saveMatches(gameId, [{ matchNumber: 1, result: 'draw' }]);

    const games = listMatches(gameId);
    expect(games).toHaveLength(1);
    expect(games[0]!.result).toBe('draw');
  });

  it('derives the match games-won summary from the detail', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      { matchNumber: 1, result: 'win' },
      { matchNumber: 2, result: 'loss' },
      { matchNumber: 3, result: 'win' },
    ]);

    // Two places holding the same fact is how they come to disagree.
    expect(getGame(gameId)).toMatchObject({ matchesWon: 2, matchesLost: 1 });
  });

  it('clears the summary when the detail is removed', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [{ matchNumber: 1, result: 'win' }]);
    saveMatches(gameId, []);

    expect(listMatches(gameId)).toEqual([]);
    expect(getGame(gameId)).toMatchObject({ matchesWon: null, matchesLost: null });
  });

  it('collects games across several matches', () => {
    const first = makeGame();
    const second = makeGame();
    saveMatches(first.gameId, [{ matchNumber: 1, result: 'win' }]);
    saveMatches(second.gameId, [
      { matchNumber: 1, result: 'loss' },
      { matchNumber: 2, result: 'win' },
    ]);

    expect(matchesForGames([first.gameId, second.gameId])).toHaveLength(3);
    expect(matchesForGames([])).toEqual([]);
  });
});

describe('audit regressions', () => {
  /**
   * Deleting a deck used to leave its games live: `listDecks` hid the deck
   * while `listGames()` kept returning them, so a deleted deck's results
   * stayed in the cross-deck Stats totals with nothing to attribute them to.
   */
  it('takes a deck’s games with it when the deck is deleted', () => {
    const { gameId, deckId } = makeGame();
    saveMatches(gameId, [{ matchNumber: 1, result: 'win' }]);
    expect(listGames()).toHaveLength(1);

    deleteDeck(deckId);

    expect(listGames()).toEqual([]);
    expect(listGames({ deckId })).toEqual([]);
    expect(getGame(gameId)).toBeNull();
    // Soft, so the deletion still propagates rather than reappearing on sync.
    // `games`, not `matches` — the individual plays carry no tombstone of their
    // own; they belong to a game and go wherever it goes.
    expect(
      db.getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM games WHERE deleted_at IS NOT NULL'
      )!.n
    ).toBe(1);
  });

  /**
   * The unique index already stopped this, but as a raw
   * "UNIQUE constraint failed" out of the middle of a transaction — true, and
   * useless to a caller trying to tell the user what to fix.
   */
  it('rejects duplicate match numbers with a readable message', () => {
    const { gameId } = makeGame();
    expect(() =>
      saveMatches(gameId, [
        { matchNumber: 1, result: 'win' },
        { matchNumber: 1, result: 'loss' },
      ])
    ).toThrow(MatchError);

    // And nothing was written on the way to refusing.
    expect(listMatches(gameId)).toEqual([]);
  });

  /**
   * Only observable because the test harness now enables `PRAGMA foreign_keys`
   * the way `migrate()` does. Before that, this wrote orphan rows in tests and
   * would have thrown on a device.
   */
  it('refuses games against a match that does not exist', () => {
    expect(() => saveMatches('no-such-match', [{ matchNumber: 1, result: 'win' }])).toThrow();
    expect(listMatches('no-such-match')).toEqual([]);
  });
});

describe('hand analytics', () => {
  const game = (n: number, over: Partial<Parameters<typeof saveMatches>[1][number]> = {}) => ({
    matchNumber: n,
    result: 'win' as const,
    ...over,
  });

  it('reports coverage so a pattern from 2 of 40 games cannot pass as one', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { openingHand: ['a'] }),
      game(2),
      game(3),
    ]);

    expect(handCoverage(listMatches(gameId))).toEqual({ recorded: 1, total: 3 });
  });

  /*
   * `openingHand` is the whole deal and `mulliganed` is a subset of it, so
   * "dud" appears in *both* arrays on the matches where it went back.
   */
  it('rates a card by how often it goes back, over matches it was dealt in', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { openingHand: ['keep', 'dud'], mulliganed: ['dud'] }),
      game(2, { openingHand: ['keep', 'dud'], mulliganed: ['dud'] }),
      game(3, { openingHand: ['keep', 'dud'], mulliganed: [] }),
    ]);

    const stats = cardHandStats(listMatches(gameId), 3);
    const dud = stats.find((s) => s.cardId === 'dud')!;
    expect(dud.seen).toBe(3);
    expect(dud.kept).toBe(1);
    expect(dud.mulliganed).toBe(2);
    expect(dud.mulliganRate).toBeCloseTo(2 / 3);
    // Thrown back most often, so it sorts first.
    expect(stats[0]!.cardId).toBe('dud');
  });

  /**
   * The bug the redefinition invites, pinned.
   *
   * Adding `openingHand.length + mulliganed.length` was right when the two
   * were disjoint and is now double-counting: a card thrown back every single
   * time would be seen twice per match and report a 50 % mulligan rate — a
   * plausible-looking number for the most obviously wrong card in the deck.
   */
  it('counts a card once per match even when it is in both arrays', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { openingHand: ['always'], mulliganed: ['always'] }),
      game(2, { openingHand: ['always'], mulliganed: ['always'] }),
      game(3, { openingHand: ['always'], mulliganed: ['always'] }),
    ]);

    const stat = cardHandStats(listMatches(gameId), 3)[0]!;
    expect(stat.seen).toBe(3);
    expect(stat.mulliganed).toBe(3);
    expect(stat.kept).toBe(0);
    expect(stat.mulliganRate).toBe(1);
    // Never kept, so there is no performance to report rather than a 0 % one.
    expect(stat.whenKept).toBeNull();
  });

  /**
   * Rows written before `openingHand` meant "the whole deal" hold a mulliganed
   * id that is absent from it. Dropping those would silently shrink a sample.
   */
  it('still counts a mulliganed card missing from the recorded deal', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { openingHand: ['kept'], mulliganed: ['legacy'] }),
      game(2, { openingHand: ['kept'], mulliganed: ['legacy'] }),
    ]);

    const legacy = cardHandStats(listMatches(gameId), 2).find((s) => s.cardId === 'legacy')!;
    expect(legacy.seen).toBe(2);
    expect(legacy.mulliganed).toBe(2);
  });

  it('round-trips the replacements drawn after a mulligan', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, {
        openingHand: ['a', 'b', 'c', 'd'],
        mulliganed: ['a', 'b'],
        replacements: ['e', 'f'],
      }),
    ]);

    const [match] = listMatches(gameId);
    expect(match!.replacements).toEqual(['e', 'f']);
    // And they stay out of the denominator: a card drawn *because* of a
    // mulligan was never part of the keep decision.
    expect(cardHandStats(listMatches(gameId), 1).map((s) => s.cardId).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('hides cards seen too few times to mean anything', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [game(1, { openingHand: [], mulliganed: ['once'] })]);

    // A single mulligan of a card drawn once would otherwise top the list at
    // 100 % and bury the card there is actually a problem with.
    expect(cardHandStats(listMatches(gameId), 3)).toEqual([]);
    expect(cardHandStats(listMatches(gameId), 1)).toHaveLength(1);
  });

  it('groups performance by how many cards went back', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { result: 'win', mulliganed: [], openingHand: ['a'] }),
      game(2, { result: 'win', mulliganed: [], openingHand: ['a'] }),
      game(3, { result: 'loss', mulliganed: ['x', 'y'], openingHand: ['a'] }),
    ]);

    const segments = performanceByMulliganCount(listMatches(gameId));
    expect(segments[0]).toMatchObject({ label: 'Kept the opening hand' });
    expect(segments[0]!.rate.wins).toBe(2);
    expect(segments[1]!.label).toBe('2 cards back');
    expect(segments[1]!.rate.losses).toBe(1);
  });

  it('ignores games with no hand recorded', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [game(1), game(2), game(3, { openingHand: ['a'] })]);

    // Two unrecorded games must not read as "kept the opening hand".
    const segments = performanceByMulliganCount(listMatches(gameId));
    expect(segments.reduce((n, s) => n + s.rate.total, 0)).toBe(1);
  });

  /*
   * Four champion-turn tests lived here — median split, the opponent's own
   * column, per-side coverage, and an identical run leaving `later` empty.
   *
   * Removed with the field in migration 19. They were correct, and that is the
   * point: a passing test for a column that no longer exists is dead weight
   * that reads as coverage.
   */
});

describe('score analytics', () => {
  const game = (n: number, over: Partial<Parameters<typeof saveMatches>[1][number]> = {}) => ({
    matchNumber: n,
    result: 'win' as const,
    ...over,
  });

  it('separates close games from clear ones, each with its own interval', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { result: 'win', scoreFor: 8, scoreAgainst: 7 }),
      game(2, { result: 'loss', scoreFor: 6, scoreAgainst: 8 }),
      game(3, { result: 'loss', scoreFor: 1, scoreAgainst: 8 }),
    ]);

    const stats = scoreStats(listMatches(gameId));
    const close = stats.segments.find((s) => s.key === 'close')!;
    const clear = stats.segments.find((s) => s.key === 'clear')!;

    expect(close.rate.total).toBe(2);
    expect(clear.rate.total).toBe(1);
    expect(close.label).toBe(`Decided by ${CLOSE_MARGIN} or fewer`);
  });

  /*
   * The two means read from opposite sides of the result on purpose. Averaging
   * "points conceded" across losses too would fold in the 8 the opponent scores
   * by definition, turning a measure of *how close* into a measure of how often
   * you lose.
   */
  it('averages conceded points over wins and scored points over losses', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { result: 'win', scoreFor: 8, scoreAgainst: 4 }),
      game(2, { result: 'win', scoreFor: 8, scoreAgainst: 6 }),
      game(3, { result: 'loss', scoreFor: 2, scoreAgainst: 8 }),
    ]);

    const stats = scoreStats(listMatches(gameId));
    expect(stats.concededInWins).toBe(5);
    expect(stats.scoredInLosses).toBe(2);
  });

  it('keeps draws out of both buckets', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { result: 'draw', scoreFor: 7, scoreAgainst: 7 }),
      game(2, { result: 'win', scoreFor: 8, scoreAgainst: 7 }),
    ]);

    const stats = scoreStats(listMatches(gameId));
    // Recorded, and counted in coverage — just not rated, because a margin of
    // zero says nothing about a game nobody won.
    expect(stats.coverage.recorded).toBe(2);
    expect(stats.segments.reduce((n, s) => n + s.rate.total, 0)).toBe(1);
  });

  it('needs both halves of a score before it counts one', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      game(1, { result: 'win', scoreFor: 8 }),
      game(2, { result: 'win', scoreAgainst: 3 }),
      game(3, { result: 'win', scoreFor: 8, scoreAgainst: 3 }),
    ]);

    // A margin cannot be computed from one side, and half a score must not be
    // rounded into a whole one.
    expect(scoreStats(listMatches(gameId)).coverage).toEqual({ recorded: 1, total: 3 });
  });

  it('is empty-safe', () => {
    expect(scoreStats([])).toMatchObject({
      coverage: { recorded: 0, total: 0 },
      concededInWins: null,
      scoredInLosses: null,
      segments: [],
    });
  });
});

/**
 * The in-depth pass, driven the way `app/match/[id]/games.tsx` drives it.
 *
 * The structural hazard in this feature is that `saveMatches` **replaces**
 * every row rather than patching one. The depth screen only asks about scores,
 * Champion turns and opening hands — so anything the *log* recorded and the
 * depth screen fails to hand back is deleted, silently, by an edit that looks
 * like it only added detail. Nothing on either screen would show it.
 */
describe('the depth pass over a logged match', () => {
  it('adds detail without erasing what the log recorded', () => {
    const { gameId } = makeGame();

    // What M4's log form writes: result, turn order, both Battlefields.
    saveMatches(gameId, [
      {
        matchNumber: 1,
        result: 'win',
        onPlay: true,
        battlefieldCardId: 'mine',
        oppBattlefieldCardId: 'theirs',
      },
      {
        matchNumber: 2,
        result: 'loss',
        onPlay: false,
        battlefieldCardId: 'mine-2',
        oppBattlefieldCardId: 'theirs-2',
      },
    ]);

    // What the depth screen then does: carry every existing field forward and
    // overlay the second tier on top.
    const before = listMatches(gameId);
    saveMatches(
      gameId,
      before.map((game, i) => ({
        matchNumber: game.matchNumber,
        result: game.result,
        onPlay: game.onPlay,
        battlefieldCardId: game.battlefieldCardId,
        oppBattlefieldCardId: game.oppBattlefieldCardId,
        battlefields: game.battlefields,
        notes: game.notes,
        scoreFor: i === 0 ? 8 : 5,
        scoreAgainst: i === 0 ? 3 : 8,
        openingHand: ['kept-a', 'kept-b', 'kept-c'],
        mulliganed: ['back-a'],
      }))
    );

    const after = listMatches(gameId);
    expect(after).toHaveLength(2);

    // The log's answers, untouched.
    expect(after[0]).toMatchObject({
      matchNumber: 1,
      result: 'win',
      onPlay: true,
      battlefieldCardId: 'mine',
      oppBattlefieldCardId: 'theirs',
    });
    expect(after[1]).toMatchObject({
      matchNumber: 2,
      result: 'loss',
      onPlay: false,
      battlefieldCardId: 'mine-2',
    });

    // And the new detail beside them.
    expect(after[0]).toMatchObject({ scoreFor: 8, scoreAgainst: 3 });
    expect(after[0]!.mulliganed).toEqual(['back-a']);

    // The match's derived summary still agrees with the games it was derived
    // from — the depth pass must not change a record it does not ask about.
    expect(getGame(gameId)).toMatchObject({ matchesWon: 1, matchesLost: 1, result: 'win' });
  });

  /*
   * `null` and `[]` are different answers, and this is the round trip that
   * proves it survives SQLite rather than only the TypeScript.
   */
  it('keeps a deal of nothing apart from no deal at all', () => {
    const { gameId } = makeGame();
    saveMatches(gameId, [
      { matchNumber: 1, result: 'win', openingHand: [], mulliganed: ['a', 'b'] },
      { matchNumber: 2, result: 'win' },
    ]);

    const [everythingBack, notRecorded] = listMatches(gameId);
    expect(everythingBack!.openingHand).toEqual([]);
    expect(notRecorded!.openingHand).toBeNull();

    // Only the first is a recorded observation. Counting the second would turn
    // a missing answer into "kept the whole hand".
    expect(handCoverage(listMatches(gameId))).toEqual({ recorded: 1, total: 2 });
  });
});
