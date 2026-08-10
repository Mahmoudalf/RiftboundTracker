import type { CardRow } from '@/db/schema/cards';
import type { DeckList } from '@/lib/legality';

/**
 * Goldfishing — drawing sample hands from a deck version without an opponent.
 *
 * Deliberately just the opener: **deal 4, recycle up to 2, then draw as far as
 * you care to look.** Turn structure and Rune channelling were modelled first
 * and taken back out — simulating the resource side without an opponent, a
 * board, or anything to spend Runes on produced numbers that looked like
 * information and were not. The question this answers is "do my opening cards
 * work together", and everything past the draw was scaffolding around it.
 *
 * The two rules it does keep are from the official Core Rules: the opening hand
 * is **4 cards**, and the one mulligan recycles up to **2** to the **bottom** of
 * the main deck. "Bottom", not "out", is the part worth being careful about — a
 * recycled card can come back later, so discarding it would quietly make every
 * deck look more consistent than it is.
 *
 * Pure and seeded. A hand can be described by a number, so a test can pin one
 * and a player can return to the opener they were looking at.
 */

export const OPENING_HAND = 4;
export const MULLIGAN_LIMIT = 2;

/** A card in a simulated zone. Copies are distinct entries, as they are in play. */
export interface GoldfishCard {
  /** Unique within a game, so two copies of a card can be told apart. */
  key: string;
  card: CardRow;
}

export interface GoldfishState {
  hand: GoldfishCard[];
  /** Face-down, in order. Index 0 is the top. */
  deck: GoldfishCard[];
  /** Whether the one mulligan has been spent. */
  mulliganed: boolean;
}

/**
 * A small deterministic PRNG (mulberry32).
 *
 * `Math.random` cannot be reproduced, and a hand you cannot reproduce is a hand
 * you cannot reason about — or write a test for.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, so every ordering is equally likely. */
function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Expand the main deck into one entry per physical copy. */
function expand(list: DeckList): GoldfishCard[] {
  const cards: GoldfishCard[] = [];
  for (const slot of list.slots) {
    if (slot.zone !== 'main') continue;
    for (let i = 0; i < slot.quantity; i++) {
      cards.push({ key: `${slot.card.id}:${i}`, card: slot.card });
    }
  }
  return cards;
}

/**
 * Shuffle up and deal an opening hand.
 *
 * The Champion occupies a main-deck slot in the rules, and `DeckList` stores it
 * in its own zone — so it is deliberately **not** in the simulated deck here.
 * Including it would put a card in the shuffle that the list does not say is
 * there; excluding it means the deck is one short. Both are wrong, and this is
 * the wrong that does not silently change the odds of everything else.
 */
export function deal(list: DeckList, seed: number): GoldfishState {
  const deck = shuffle(expand(list), rng(seed));

  return {
    hand: deck.slice(0, OPENING_HAND),
    deck: deck.slice(OPENING_HAND),
    mulliganed: false,
  };
}

/**
 * Spend the mulligan: chosen cards go to the bottom, then draw that many back.
 *
 * Keeping the hand still spends it — the mulligan is a decision, and "I looked
 * and kept" is one of its two answers.
 */
export function mulligan(state: GoldfishState, keys: readonly string[]): GoldfishState {
  if (state.mulliganed) return state;

  const chosen = keys.slice(0, MULLIGAN_LIMIT);
  if (chosen.length === 0) return { ...state, mulliganed: true };

  const set = new Set(chosen);
  const returned = state.hand.filter((c) => set.has(c.key));
  const kept = state.hand.filter((c) => !set.has(c.key));

  // Bottom, not gone: these can be drawn again later in the same game.
  const deck = [...state.deck, ...returned];

  return {
    hand: [...kept, ...deck.slice(0, returned.length)],
    deck: deck.slice(returned.length),
    mulliganed: true,
  };
}

/**
 * Draw one card.
 *
 * Running the deck out is not an error — it is a fact about the deck, and the
 * screen says so rather than the simulation stopping.
 */
export function draw(state: GoldfishState): GoldfishState {
  return {
    hand: [...state.hand, ...state.deck.slice(0, 1)],
    deck: state.deck.slice(1),
    // Drawing past the opener closes the mulligan window.
    mulliganed: true,
  };
}
