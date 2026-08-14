import { describe, expect, it } from 'vitest';

import type { MatchRow, GameRow, Result } from '@/db/schema/games';

import { findings, nextStep, type VersionRef } from './findings';

/**
 * The findings layer.
 *
 * Every test here is the same test twice: that a claim appears when the data
 * supports it, and that it stays silent when it does not. The silence is the
 * harder half and the reason the module exists — a screen that manufactures a
 * sentence out of four games is exactly the failure this prevents.
 *
 * Kept apart from `analytics.test.ts` because that file tests the statistics
 * and this one tests the editorial judgement laid over them. They fail for
 * different reasons and a reader chasing one should not have to read the other.
 */

function game(overrides: Partial<GameRow> & { result: Result }): GameRow {
  return {
    id: Math.random().toString(36).slice(2),
    deckId: 'deck',
    deckVersionId: 'version',
    playedAt: '2026-08-01T10:00:00.000Z',
    bestOf: null,
    matchesWon: null,
    matchesLost: null,
    onPlay: null,
    oppLegendCardId: null,
    oppChampionCardId: null,
    oppLegendName: null,
    oppChampionName: null,
    battlefieldCardId: null,
    battlefieldName: null,
    oppBattlefieldCardId: null,
    oppBattlefieldName: null,
    oppDomains: null,
    eventId: null,
    gameStyle: 'casual',
    notes: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    userId: null,
    dirty: true,
    updatedByDevice: null,
    ...overrides,
  } as GameRow;
}

function matchRow(overrides: Partial<MatchRow> & { result: Result }): MatchRow {
  return {
    id: Math.random().toString(36).slice(2),
    gameId: 'game',
    matchNumber: 1,
    onPlay: null,
    scoreFor: null,
    scoreAgainst: null,
    openingHand: null,
    mulliganed: null,
    replacements: null,
    battlefieldCardId: null,
    oppBattlefieldCardId: null,
    notes: null,
    ...overrides,
  } as MatchRow;
}

const wins = (n: number) => Array.from({ length: n }, () => game({ result: 'win' }));
const losses = (n: number) => Array.from({ length: n }, () => game({ result: 'loss' }));

/** Games against a named Legend, so they land in a matchup segment. */
const versus = (legend: string, result: Result, n: number) =>
  Array.from({ length: n }, () => game({ result, oppLegendName: legend }));

const onVersion = (versionId: string, result: Result, n: number) =>
  Array.from({ length: n }, () => game({ result, deckVersionId: versionId }));

const VERSIONS: VersionRef[] = [
  { id: 'v3', number: 3, label: null },
  { id: 'v2', number: 2, label: null },
  { id: 'v1', number: 1, label: null },
];

/** A lopsided v3-against-v2, the shape several tests need. */
const versionSwing = () => [
  ...onVersion('v3', 'loss', 30),
  ...onVersion('v3', 'win', 5),
  ...onVersion('v2', 'win', 30),
  ...onVersion('v2', 'loss', 5),
];

describe('findings', () => {
  it('says nothing at all when nothing separates', () => {
    expect(findings([...wins(6), ...losses(4)], [])).toEqual([]);
  });

  it('is empty-safe', () => {
    expect(findings([], [])).toEqual([]);
  });
});

describe('nextStep', () => {
  it('turns silence into a target rather than a dead end', () => {
    expect(nextStep([...wins(6), ...losses(4)])).toMatch(/more games/);
  });

  it('has nothing to say about no games at all', () => {
    expect(nextStep([])).toBeNull();
  });

  it('still gives a target when every game was drawn', () => {
    // Under the half-point rule these are 50%, not "no rate", so there is a
    // real interval to narrow and a real number of games that would narrow it.
    const drawn = Array.from({ length: 4 }, () => game({ result: 'draw' }));
    expect(nextStep(drawn)).toMatch(/more games/);
  });
});

describe('the version finding', () => {
  it('names both versions when the newer one is measurably behind', () => {
    const found = findings(versionSwing(), [], { versions: VERSIONS, deckId: 'deck' });
    const version = found.find((f) => f.kind === 'version');

    expect(version?.headline).toBe('v3 is behind v2.');
    expect(version?.link).toEqual({ to: 'deck', id: 'deck' });
  });

  it('compares the last two versions that were played, not the last two that exist', () => {
    /*
     * v3 exists and was never taken to a table. "Did my change work" means the
     * two lists that actually have records — skipping the unplayed fork is what
     * makes the question answerable rather than blank.
     */
    const games = [
      ...onVersion('v2', 'win', 30),
      ...onVersion('v2', 'loss', 5),
      ...onVersion('v1', 'loss', 30),
      ...onVersion('v1', 'win', 5),
    ];

    expect(findings(games, [], { versions: VERSIONS })[0]?.headline).toBe(
      'v2 is beating v1.'
    );
  });

  it('prefers a version label over its number', () => {
    const labelled: VersionRef[] = [
      { id: 'v3', number: 3, label: 'More removal' },
      { id: 'v2', number: 2, label: null },
    ];
    const games = [
      ...onVersion('v3', 'win', 30),
      ...onVersion('v3', 'loss', 5),
      ...onVersion('v2', 'loss', 30),
      ...onVersion('v2', 'win', 5),
    ];

    expect(findings(games, [], { versions: labelled })[0]?.headline).toBe(
      'More removal is beating v2.'
    );
  });

  it('makes no version claim when more than one deck is in scope', () => {
    // Version numbers are per deck, so with no version list there is nothing to
    // compare that would not compare one deck's v3 against another's.
    expect(findings(versionSwing(), [], {}).some((f) => f.kind === 'version')).toBe(false);
  });

  it('says nothing when two versions are close', () => {
    const games = [
      ...onVersion('v3', 'win', 6),
      ...onVersion('v3', 'loss', 4),
      ...onVersion('v2', 'win', 4),
      ...onVersion('v2', 'loss', 6),
    ];
    expect(findings(games, [], { versions: VERSIONS })).toEqual([]);
  });
});

describe('the matchup finding', () => {
  it('measures a matchup against the other games, not against the deck overall', () => {
    /*
     * The regression this guards.
     *
     * The overall rate *contains* the matchup's own games, so a lopsided
     * matchup drags the baseline towards itself — the worse it is, the better
     * it hides. Only the complement is a disjoint sample.
     */
    const games = [
      ...versus('Vi', 'loss', 12),
      ...versus('Zed', 'win', 30),
      ...versus('Zed', 'loss', 2),
    ];
    const matchup = findings(games, []).find((f) => f.kind === 'matchup');

    expect(matchup?.headline).toBe('Vi decks beat you.');
    expect(matchup?.evidence).toContain('in your other games');
  });

  it('still finds a matchup big enough to drag the average towards itself', () => {
    /*
     * The masking effect, in the one shape that separates the two baselines.
     *
     * Vi is two thirds of every game played, so it pulls the overall rate down
     * to 47 % — close enough to Vi's own 30 % that the intervals overlap and a
     * comparison against the overall would find **nothing**. Against the other
     * games (80 %) it is unmissable. The bigger the problem, the better it hid.
     */
    const games = [
      ...versus('Vi', 'win', 12),
      ...versus('Vi', 'loss', 28),
      ...versus('Zed', 'win', 16),
      ...versus('Zed', 'loss', 4),
    ];
    expect(findings(games, []).find((f) => f.kind === 'matchup')?.headline).toBe(
      'Vi decks beat you.'
    );
  });

  it('will not make a claim about a matchup thinner than the floor', () => {
    // 0–4 is not yet a matchup problem, however lopsided it looks. Those four
    // games still count towards everyone else's baseline, which is why Zed can
    // still be the subject here — the floor governs being described, not being
    // counted.
    const games = [
      ...versus('Vi', 'loss', 4),
      ...versus('Zed', 'win', 30),
      ...versus('Zed', 'loss', 2),
    ];
    const matchup = findings(games, []).find((f) => f.kind === 'matchup');
    expect(matchup?.key).not.toContain('vi');
  });

  it('breaks a two-opponent tie towards the matchup you are losing', () => {
    /*
     * With two opponents each is the other's complement, so both findings have
     * identical strength and are the same fact from either end. The one you can
     * act on is the one you lose.
     */
    const games = [
      ...versus('Vi', 'loss', 12),
      ...versus('Zed', 'win', 30),
      ...versus('Zed', 'loss', 2),
    ];
    expect(findings(games, []).find((f) => f.kind === 'matchup')?.headline).toBe(
      'Vi decks beat you.'
    );
  });

  it('reports one matchup, not one per opponent', () => {
    const games = [
      ...versus('Vi', 'loss', 12),
      ...versus('Jinx', 'loss', 12),
      ...versus('Zed', 'win', 40),
    ];
    expect(findings(games, []).filter((f) => f.kind === 'matchup')).toHaveLength(1);
  });

  it('reports a matchup you are winning, not only ones you lose', () => {
    // Three opponents, so this is not the symmetric two-group tie above: Vi
    // stands out against a genuinely even baseline, and neither even matchup
    // separates from its own complement.
    const games = [
      ...versus('Vi', 'win', 14),
      ...versus('Zed', 'win', 15),
      ...versus('Zed', 'loss', 15),
      ...versus('Jinx', 'win', 15),
      ...versus('Jinx', 'loss', 15),
    ];
    const matchups = findings(games, []).filter((f) => f.kind === 'matchup');

    expect(matchups).toHaveLength(1);
    expect(matchups[0]?.headline).toBe('You beat Vi decks.');
  });
});

describe('the card finding', () => {
  const dealt = (n: number, thrown: number) =>
    Array.from({ length: n }, (_, i) =>
      matchRow({
        result: 'win',
        openingHand: ['card', 'other'],
        mulliganed: i < thrown ? ['card'] : [],
      })
    );

  it('names the card you send back more often than you keep', () => {
    const card = findings([], dealt(8, 6), { cardName: () => 'Statikk Shock' }).find(
      (f) => f.kind === 'card'
    );

    expect(card?.headline).toBe('You throw Statikk Shock back more often than you keep it.');
    expect(card?.evidence).toBe('6 of 8 opening hands it was dealt in');
    expect(card?.link).toEqual({ to: 'card', id: 'card' });
  });

  it('stays quiet about a card thrown less than half the time', () => {
    expect(findings([], dealt(8, 3), { cardName: () => 'Statikk Shock' })).toEqual([]);
  });

  it('stays quiet below the seen floor, where the drawer would still list it', () => {
    // Four hands clears `cardHandStats`' own floor of three but not the
    // stricter one a *finding* has to meet.
    expect(findings([], dealt(4, 4), { cardName: () => 'Statikk Shock' })).toEqual([]);
  });

  it('will not name a card whose printing has left the library', () => {
    expect(findings([], dealt(8, 6), { cardName: () => null })).toEqual([]);
  });
});

describe('ranking', () => {
  it('orders by what changes a decision, one per kind, capped', () => {
    const games = [
      ...versionSwing(),
      ...versus('Vi', 'loss', 12),
      ...versus('Zed', 'win', 40),
    ];
    const matches = Array.from({ length: 8 }, (_, i) =>
      matchRow({
        result: 'win',
        openingHand: ['card'],
        mulliganed: i < 6 ? ['card'] : [],
      })
    );

    const found = findings(games, matches, {
      versions: VERSIONS,
      cardName: () => 'Statikk Shock',
    });

    // The literal cap, not the constant: asserting against the value the module
    // exports would pass whatever that value became.
    expect(found).toHaveLength(3);
    expect(found.map((f) => f.kind)).toEqual(['version', 'matchup', 'card']);
  });
});
