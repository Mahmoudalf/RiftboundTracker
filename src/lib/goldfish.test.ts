import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';
import type { DeckList } from '@/lib/legality';

import { deal, draw, mulligan, OPENING_HAND } from './goldfish';

const card = (id: string): CardRow => ({ id, name: id }) as CardRow;

/** 40 distinct main-deck cards, so positions are identifiable. Runes are not
    simulated — the opener is the whole question. */
const list: DeckList = {
  slots: [
    ...Array.from({ length: 40 }, (_, i) => ({
      card: card(`m${i}`),
      quantity: 1,
      zone: 'main' as const,
    })),
    // Present in the list and deliberately not in the shuffle.
    { card: card('rune-fury'), quantity: 6, zone: 'rune' as const },
    { card: card('legend'), quantity: 1, zone: 'legend' as const },
  ],
};

describe('deal', () => {
  it('opens on four cards from the main deck only', () => {
    const state = deal(list, 1);

    expect(state.hand).toHaveLength(OPENING_HAND);
    expect(state.deck).toHaveLength(36);
    expect(state.mulliganed).toBe(false);
    // Runes and the Legend are in the list, never in the shuffle.
    expect([...state.hand, ...state.deck].every((c) => c.card.id.startsWith('m'))).toBe(true);
  });

  it('is reproducible from its seed, and different between seeds', () => {
    const a = deal(list, 42).hand.map((c) => c.key);
    const b = deal(list, 42).hand.map((c) => c.key);
    const c = deal(list, 43).hand.map((c) => c.key);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('gives every copy of a card its own entry', () => {
    const playset: DeckList = {
      slots: [{ card: card('x'), quantity: 3, zone: 'main' }],
    };
    const state = deal(playset, 2);
    expect(new Set(state.hand.map((c) => c.key)).size).toBe(3);
  });
});

describe('mulligan', () => {
  /*
   * The rule that matters: recycled cards go to the *bottom*, not out of the
   * game. A simulator that removed them would make every deck look more
   * consistent than it is.
   */
  it('puts the returned cards on the bottom and draws that many back', () => {
    const start = deal(list, 5);
    const returned = start.hand.slice(0, 2).map((c) => c.key);
    const after = mulligan(start, returned);

    expect(after.hand).toHaveLength(OPENING_HAND);
    expect(after.deck).toHaveLength(36);
    expect(after.deck.slice(-2).map((c) => c.key).sort()).toEqual([...returned].sort());
    expect(after.hand.some((c) => returned.includes(c.key))).toBe(false);
  });

  it('takes at most two, however many are named', () => {
    const start = deal(list, 9);
    const after = mulligan(
      start,
      start.hand.map((c) => c.key)
    );

    expect(after.hand).toHaveLength(OPENING_HAND);
    // Two of the opener survive.
    const survivors = after.hand.filter((c) => start.hand.some((s) => s.key === c.key));
    expect(survivors).toHaveLength(2);
  });

  it('is offered once', () => {
    const start = deal(list, 11);
    const once = mulligan(start, [start.hand[0]!.key]);

    expect(once.mulliganed).toBe(true);
    expect(mulligan(once, [once.hand[0]!.key])).toBe(once);
  });

  it('keeping the hand still spends it', () => {
    const start = deal(list, 13);
    const kept = mulligan(start, []);

    expect(kept.mulliganed).toBe(true);
    expect(kept.hand).toEqual(start.hand);
  });
});

describe('draw', () => {
  it('moves one card from the top of the deck to the hand', () => {
    const start = deal(list, 3);
    const after = draw(start);

    expect(after.hand).toHaveLength(OPENING_HAND + 1);
    expect(after.deck).toHaveLength(35);
    expect(after.hand[OPENING_HAND]!.key).toBe(start.deck[0]!.key);
  });

  it('closes the mulligan window', () => {
    const drawn = draw(deal(list, 3));
    expect(drawn.mulliganed).toBe(true);
    expect(mulligan(drawn, [drawn.hand[0]!.key])).toBe(drawn);
  });

  /* Running the deck out is a fact about the deck, not an error. */
  it('runs out quietly rather than throwing', () => {
    let state = deal(list, 17);
    for (let i = 0; i < 60; i++) state = draw(state);

    expect(state.deck).toHaveLength(0);
    expect(state.hand).toHaveLength(40);
  });
});
