import type { CardRow } from '@/db/schema/cards';
import type { DeckList } from '@/lib/legality';

/**
 * Goldfishing — drawing sample hands from a deck version without an opponent.
 *
 * The rules it obeys, from the official Core Rules:
 *
 *  - The opening hand is **4 cards** from the Main Deck.
 *  - You get **one** mulligan: recycle up to **2** cards to the **bottom** of
 *    the Main Deck, then draw the same number.
 *  - Each turn you channel **2** Runes (**3** on your first turn if you are on
 *    the draw) and draw **1** card.
 *
 * "Bottom", not "out of the deck", is the part worth being careful about: a
 * mulliganed card can come back later in the same game, so a simulator that
 * discarded it would quietly make every deck look more consistent than it is.
 *
 * Pure and seeded. A hand you are looking at can be described by a number, so a
 * test can pin one and a player can re-draw the same opener to compare lines.
 */

export const OPENING_HAND = 4;
export const MULLIGAN_LIMIT = 2;
// Private: `runesForTurn` is the answer callers want, and two constants beside
// it invite a caller to reimplement the rule.
const RUNES_PER_TURN = 2;
const RUNES_FIRST_TURN_ON_DRAW = 3;

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
  /** Runes channelled so far — the resource side of the board. */
  runes: GoldfishCard[];
  runeDeck: GoldfishCard[];
  /** Turns taken. 0 means the opening hand has been dealt and nothing else. */
  turn: number;
  /** Whether the one mulligan has been spent. */
  mulliganed: boolean;
  onDraw: boolean;
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

/** Expand a decklist's zone into one entry per physical copy. */
function expand(list: DeckList, zone: 'main' | 'rune'): GoldfishCard[] {
  const cards: GoldfishCard[] = [];
  for (const slot of list.slots) {
    if (slot.zone !== zone) continue;
    for (let i = 0; i < slot.quantity; i++) {
      cards.push({ key: `${slot.zone}:${slot.card.id}:${i}`, card: slot.card });
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
export function deal(list: DeckList, seed: number, onDraw = false): GoldfishState {
  const next = rng(seed);
  const deck = shuffle(expand(list, 'main'), next);
  const runeDeck = shuffle(expand(list, 'rune'), next);

  return {
    hand: deck.slice(0, OPENING_HAND),
    deck: deck.slice(OPENING_HAND),
    runes: [],
    runeDeck,
    turn: 0,
    mulliganed: false,
    onDraw,
  };
}

/**
 * Spend the mulligan: chosen cards go to the bottom, then draw that many back.
 *
 * Returns the state unchanged if the mulligan is already spent or nothing was
 * chosen — a no-op rather than a silently wasted mulligan.
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
    ...state,
    hand: [...kept, ...deck.slice(0, returned.length)],
    deck: deck.slice(returned.length),
    mulliganed: true,
  };
}

/** How many Runes are channelled on a given turn. */
export function runesForTurn(turn: number, onDraw: boolean): number {
  return turn === 1 && onDraw ? RUNES_FIRST_TURN_ON_DRAW : RUNES_PER_TURN;
}

/**
 * Take a turn: channel Runes, then draw one card.
 *
 * Running either deck out is not an error — it is a fact about the deck, and
 * the screen says so rather than the simulation stopping.
 */
export function takeTurn(state: GoldfishState): GoldfishState {
  const turn = state.turn + 1;
  const channel = runesForTurn(turn, state.onDraw);

  return {
    ...state,
    turn,
    runes: [...state.runes, ...state.runeDeck.slice(0, channel)],
    runeDeck: state.runeDeck.slice(channel),
    hand: [...state.hand, ...state.deck.slice(0, 1)],
    deck: state.deck.slice(1),
    // The mulligan window closes once the game starts.
    mulliganed: true,
  };
}
