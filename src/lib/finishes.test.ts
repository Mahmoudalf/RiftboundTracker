import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';

import { displayFinish, finishesFor, supportsFinish } from './finishes';

/**
 * The finish rules, against the real 1,451-card library.
 *
 * These assert the rule table, not the game. Nothing here can prove Riftbound
 * prints Legends in foil only — the card data does not say, which is the whole
 * reason this module exists. What the tests defend is that the stated rules are
 * applied consistently and that the permissive default holds, so a wrong rule
 * shows up as a missing option rather than as lost data.
 */

const SEED = join(process.cwd(), 'assets/seed/cards.json');
const hasSeed = existsSync(SEED);
const library: CardRow[] = hasSeed ? JSON.parse(readFileSync(SEED, 'utf8')).cards : [];

/**
 * The rule read through the exported surface.
 *
 * `isFoilOnly` is module-private — `finishesFor` is the only thing anything
 * outside needs — and a card offered one finish is exactly a card that is
 * foil-only.
 */
const isFoilOnly = (c: Parameters<typeof finishesFor>[0]) => finishesFor(c).length === 1;

function card(over: Partial<CardRow> = {}): CardRow {
  return {
    type: 'Unit',
    rarity: 'Common',
    supertype: null,
    signature: false,
    alternateArt: false,
    overnumbered: false,
    ...over,
  } as CardRow;
}

describe('isFoilOnly', () => {
  it('is false for an ordinary card', () => {
    expect(isFoilOnly(card())).toBe(false);
    expect(finishesFor(card())).toEqual(['standard', 'foil']);
  });

  it.each([
    ['a Legend', { type: 'Legend' }],
    ['Showcase rarity', { rarity: 'Showcase' }],
    ['a Signature supertype', { supertype: 'Signature' }],
    ['the signature flag', { signature: true }],
    ['alternate art', { alternateArt: true }],
    ['overnumbered', { overnumbered: true }],
  ])('is true for %s', (_label, over) => {
    expect(isFoilOnly(card(over as Partial<CardRow>))).toBe(true);
    expect(finishesFor(card(over as Partial<CardRow>))).toEqual(['foil']);
  });
});

describe('supportsFinish', () => {
  it('accepts either finish on an ordinary card', () => {
    expect(supportsFinish(card(), 'standard')).toBe(true);
    expect(supportsFinish(card(), 'foil')).toBe(true);
  });

  /*
   * The guard the write path relies on. A standard Legend is a printing that
   * does not exist, and the answer is "no" — not "here is a foil instead".
   * Substituting was the original behaviour and it recorded cards the user had
   * not asked for.
   */
  it('refuses standard on a foil-only card', () => {
    expect(supportsFinish(card({ type: 'Legend' }), 'standard')).toBe(false);
    expect(supportsFinish(card({ type: 'Legend' }), 'foil')).toBe(true);
  });
});

describe('displayFinish', () => {
  it('shows the requested finish when the card has it', () => {
    expect(displayFinish(card(), 'standard')).toBe('standard');
    expect(displayFinish(card(), 'foil')).toBe('foil');
  });

  /*
   * Display substitutes where the write path refuses: a blocked Legend tile
   * still shows how many foils you hold, which is more use than a zero for a
   * printing that cannot exist.
   */
  it('falls back to the only finish a foil-only card has', () => {
    expect(displayFinish(card({ type: 'Legend' }), 'standard')).toBe('foil');
  });
});

describe.skipIf(!hasSeed)('against the real library', () => {
  it('classifies every card without throwing', () => {
    expect(library).toHaveLength(1451);
    for (const c of library) expect(finishesFor(c).length).toBeGreaterThan(0);
  });

  it('marks every Legend foil-only', () => {
    const legends = library.filter((c) => c.type === 'Legend');
    expect(legends).toHaveLength(180);
    expect(legends.every(isFoilOnly)).toBe(true);
  });

  it('leaves the majority of the library with both finishes', () => {
    const both = library.filter((c) => !isFoilOnly(c));
    // Measured: 1,071 of 1,451. Asserted as a floor rather than an exact count
    // so a card-library resync does not fail the suite — the point is that the
    // rules stay a minority carve-out, not that the number never moves.
    expect(both.length).toBeGreaterThan(library.length / 2);
  });

  /*
   * The two Signature signals genuinely disagree upstream — 61 cards carry the
   * supertype, 36 carry the metadata flag — which is why the rule ORs them
   * rather than picking one and trusting it.
   */
  it('catches Signature cards under either spelling', () => {
    const bySupertype = library.filter((c) => c.supertype === 'Signature');
    const byFlag = library.filter((c) => c.signature);

    expect(bySupertype.length).not.toBe(byFlag.length);
    for (const c of [...bySupertype, ...byFlag]) expect(isFoilOnly(c)).toBe(true);
  });
});
