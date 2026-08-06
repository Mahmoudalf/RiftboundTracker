import { create } from 'zustand';

import type { CardRow } from '@/db/schema/cards';
import {
  checkLegality,
  defaultZoneFor,
  type DeckList,
  type DeckSlot,
  type DeckZone,
  type LegalityResult,
} from '@/lib/legality';

/**
 * The deck editor's working draft.
 *
 * Edits are held here and written to SQLite only on save, for two reasons.
 * Backing out of the editor must leave no trace — under the version model an
 * accidental write is not a lost keystroke, it is a spurious version in the
 * deck's history. And legality has to be recomputed on every single change,
 * which is a pure function over this draft rather than a round trip.
 */

interface DeckEditorState {
  deckId: string | null;
  versionId: string | null;
  name: string;
  slots: DeckSlot[];
  /** The list as loaded, for the no-op check on save. */
  baseline: string;

  load: (input: {
    deckId: string;
    versionId: string;
    name: string;
    list: DeckList;
  }) => void;
  /**
   * Begin a deck that does not exist yet.
   *
   * The build flow writes nothing until the final step, so backing out of it
   * leaves no half-built deck in the list — the same reason the editor holds a
   * draft rather than saving as you type.
   */
  startNew: (legend: CardRow) => void;
  reset: () => void;
  /** Replace everything in one zone. Used to seed the default rune deck. */
  replaceZone: (zone: DeckZone, slots: DeckSlot[]) => void;

  setName: (name: string) => void;
  /** Add one copy, or set an explicit quantity. Removes the slot at zero. */
  setQuantity: (card: CardRow, zone: DeckZone, quantity: number) => void;
  adjust: (card: CardRow, zone: DeckZone, delta: number) => void;
  add: (card: CardRow) => void;
  setLegend: (card: CardRow) => void;
  setChampion: (card: CardRow | null) => void;

  quantityOf: (cardId: string, zone: DeckZone) => number;
  list: () => DeckList;
  legality: () => LegalityResult;
  /** True when the draft differs from what was loaded. */
  isDirty: () => boolean;
}

/**
 * Canonical serialisation of a decklist, used for the no-op check.
 *
 * Sorted so that reordering slots — which the editor does whenever a card is
 * removed and re-added — is not mistaken for a change. Opening the editor and
 * backing out must never produce a new version.
 */
function fingerprint(slots: readonly DeckSlot[]): string {
  return slots
    .filter((s) => s.quantity > 0)
    .map((s) => `${s.zone}:${s.card.id}:${s.quantity}`)
    .sort()
    .join('|');
}

const EMPTY = {
  deckId: null,
  versionId: null,
  name: '',
  slots: [] as DeckSlot[],
  baseline: '',
};

export const useDeckEditor = create<DeckEditorState>((set, get) => ({
  ...EMPTY,

  load: ({ deckId, versionId, name, list }) =>
    set({
      deckId,
      versionId,
      name,
      slots: list.slots.map((s) => ({ ...s })),
      baseline: fingerprint(list.slots),
    }),

  startNew: (legend) =>
    set({
      ...EMPTY,
      slots: [{ card: legend, zone: 'legend', quantity: 1 }],
      // No baseline: a brand-new deck is dirty from its first card.
      baseline: '',
    }),

  reset: () => set({ ...EMPTY }),

  replaceZone: (zone, slots) =>
    set((state) => ({
      slots: [...state.slots.filter((s) => s.zone !== zone), ...slots],
    })),

  setName: (name) => set({ name }),

  setQuantity: (card, zone, quantity) =>
    set((state) => {
      const next = state.slots.filter((s) => !(s.card.id === card.id && s.zone === zone));
      if (quantity > 0) next.push({ card, zone, quantity });
      return { slots: next };
    }),

  adjust: (card, zone, delta) => {
    const current = get().quantityOf(card.id, zone);
    get().setQuantity(card, zone, Math.max(0, current + delta));
  },

  add: (card) => {
    const zone = defaultZoneFor(card);
    // Legend and Champion are single slots — adding replaces rather than stacks.
    if (zone === 'legend') return get().setLegend(card);
    get().adjust(card, zone, 1);
  },

  setLegend: (card) =>
    set((state) => {
      const rest = state.slots.filter((s) => s.zone !== 'legend');
      return { slots: [{ card, zone: 'legend', quantity: 1 }, ...rest] };
    }),

  setChampion: (card) =>
    set((state) => {
      const rest = state.slots.filter((s) => s.zone !== 'champion');
      return {
        slots: card ? [...rest, { card, zone: 'champion', quantity: 1 }] : rest,
      };
    }),

  quantityOf: (cardId, zone) =>
    get().slots.find((s) => s.card.id === cardId && s.zone === zone)?.quantity ?? 0,

  list: () => ({ slots: get().slots }),

  legality: () => checkLegality({ slots: get().slots }),

  isDirty: () => fingerprint(get().slots) !== get().baseline,
}));
