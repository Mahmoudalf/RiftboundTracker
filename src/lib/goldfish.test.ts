import { describe, expect, it } from 'vitest';

import type { CardRow } from '@/db/schema/cards';
import type { DeckList } from '@/lib/legality';

import { deal, mulligan, OPENING_HAND, runesForTurn, takeTurn } from './goldfish';

const card = (id: string): CardRow => ({ id, name: id }) as CardRow;

/** 40 distinct main-deck cards and 12 runes, so positions are identifiable. */
const list: DeckList = {
  slots: [
    ...Array.from({ length: 40 }, (_, i) => ({
      card: card(`m${i}`),
      quantity: 1,
      zone: 'main' as const,
    })),
    { card: card('rune-fury'), quantity: 6, zone: 'rune' as const },
    { card: card('rune-order'), quantity: 6, zone: 'rune' as const },
  ],
};

describe('deal', () => {
  it('opens on four cards', () => {
    const state = deal(list, 1);
    expect(state.hand).toHaveLength(OPENING_HAND);
    expect(state.deck).toHaveLength(36);
    expect(state.turn).toBe(0);
    expect(state.mulliganed).toBe(false);
  });

  it('is reproducible from its seed, and different between seeds', () => {
    const a = deal(list, 42).hand.map((c) => c.key);
    const b = deal(list, 42).hand.map((c) => c.key);
    const c = deal(list, 43).hand.map((c) => c.key);

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('gives every copy its own entry', () => {
    const state = deal(list, 7);
    const runes = [...state.runeDeck];
    expect(runes).toHaveLength(12);
    expect(new Set(runes.map((r) => r.key)).size).toBe(12);
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
    // Still in the deck, at the very bottom.
    const bottom = after.deck.slice(-2).map((c) => c.key);
    expect(bottom.sort()).toEqual([...returned].sort());
    // And they are no longer in hand.
    expect(after.hand.map((c) => c.key).some((k) => returned.includes(k))).toBe(false);
  });

  it('takes at most two, however many are named', () => {
    const start = deal(list, 9);
    const after = mulligan(start, start.hand.map((c) => c.key));

    // Two swapped, two kept.
    const keptFromOpener = after.hand.filter((c) =>
      start.hand.slice(2).some((s) => s.key === c.key)
    );
    expect(keptFromOpener.length).toBeGreaterThanOrEqual(2);
    expect(after.hand).toHaveLength(OPENING_HAND);
  });

  it('is offered once', () => {
    const start = deal(list, 11);
    const once = mulligan(start, [start.hand[0]!.key]);
    const twice = mulligan(once, [once.hand[0]!.key]);

    expect(once.mulliganed).toBe(true);
    expect(twice).toBe(once);
  });

  it('keeping the hand still spends the mulligan', () => {
    const start = deal(list, 13);
    const kept = mulligan(start, []);

    expect(kept.mulliganed).toBe(true);
    expect(kept.hand).toEqual(start.hand);
  });
});

describe('turns', () => {
  it('channels two runes, or three on the first turn when on the draw', () => {
    expect(runesForTurn(1, false)).toBe(2);
    expect(runesForTurn(1, true)).toBe(3);
    expect(runesForTurn(2, true)).toBe(2);
  });

  it('channels and draws one', () => {
    const state = takeTurn(deal(list, 3));

    expect(state.turn).toBe(1);
    expect(state.runes).toHaveLength(2);
    expect(state.runeDeck).toHaveLength(10);
    expect(state.hand).toHaveLength(OPENING_HAND + 1);
    expect(state.deck).toHaveLength(35);
  });

  it('closes the mulligan window once the game starts', () => {
    const started = takeTurn(deal(list, 3));
    expect(started.mulliganed).toBe(true);
    expect(mulligan(started, [started.hand[0]!.key])).toBe(started);
  });

  /* Running a deck out is a fact about the deck, not an error. */
  it('runs out quietly rather than throwing', () => {
    let state = deal(list, 17);
    for (let i = 0; i < 60; i++) state = takeTurn(state);

    expect(state.deck).toHaveLength(0);
    expect(state.runeDeck).toHaveLength(0);
    expect(state.hand).toHaveLength(40);
    expect(state.runes).toHaveLength(12);
  });
});
