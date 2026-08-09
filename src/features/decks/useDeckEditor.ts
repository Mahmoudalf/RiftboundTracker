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
  /**
   * `zone:cardId` for every slot the editor was handed when it opened.
   *
   * Distinguishes "the user removed this card" from "the editor never saw it".
   * Both look identical in the draft, and only the database can tell them
   * apart — see `reconcileWithStored`.
   */
  loadedKeys: string[];

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
}

const EMPTY = {
  deckId: null,
  versionId: null,
  name: '',
  slots: [] as DeckSlot[],
  loadedKeys: [] as string[],
};

const slotKey = (slot: DeckSlot) => `${slot.zone}:${slot.card.id}`;

/**
 * Fold in cards that appeared in the stored version while the editor was open.
 *
 * The editor's draft is a snapshot of what the card mirror could resolve at the
 * moment it opened. A card sync finishing mid-session makes a previously
 * unresolvable card resolvable, so the *stored* list grows a card the draft
 * never had — and saving would then read as the user deleting it. On a locked
 * version that forks a version nobody asked for and drops the card from it.
 *
 * The three-way comparison is what makes this safe. A card in the stored list
 * but not in the draft is only re-added when the editor **never saw it**; if it
 * was there at load and is gone now, the user removed it and it stays removed.
 */
export function reconcileWithStored(
  draft: DeckList,
  stored: DeckList,
  loadedKeys: readonly string[]
): DeckList {
  const inDraft = new Set(draft.slots.map(slotKey));
  const seenAtLoad = new Set(loadedKeys);

  const appeared = stored.slots.filter(
    (slot) => !inDraft.has(slotKey(slot)) && !seenAtLoad.has(slotKey(slot))
  );

  return appeared.length === 0 ? draft : { slots: [...draft.slots, ...appeared] };
}

export const useDeckEditor = create<DeckEditorState>((set, get) => ({
  ...EMPTY,

  load: ({ deckId, versionId, name, list }) =>
    set({
      deckId,
      versionId,
      name,
      slots: list.slots.map((s) => ({ ...s })),
      /*
       * What the editor was handed at load, for `reconcileWithStored`. There
       * used to be a `baseline` fingerprint here too, feeding an `isDirty()`
       * nothing called — the editor diffs against the database at save time
       * instead, so a second answer to "has this changed" was one more thing
       * that could disagree.
       */
      loadedKeys: list.slots.map(slotKey),
    }),

  startNew: (legend) =>
    set({
      ...EMPTY,
      slots: [{ card: legend, zone: 'legend', quantity: 1 }],
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

}));
