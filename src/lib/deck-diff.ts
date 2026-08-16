import type { CardRow } from '@/db/schema/cards';
import { t } from '@/i18n';

import { baseName, cardKey, variantLabel } from './card-identity';
import type { DeckList, DeckSlot, DeckZone } from './legality';

/**
 * What separates two decklists.
 *
 * This is the engine behind the whole version model: it decides whether a save
 * is a change at all, it writes the default version label, and it is what the
 * timeline shows instead of two lists side by side. Pure and heavily tested —
 * a wrong answer here either spams the deck's history with versions that
 * changed nothing, or silently rewrites a list that matches were played on.
 *
 * ## Cards, not printings
 *
 * Entries are keyed on `cardKey()` — the card's name with any printing
 * treatment stripped — because that is the unit the rules and the statistics
 * both work in. Swapping "Vi" for "Vi (Alternate Art)" changes nothing about
 * how the deck plays, so it must not fork a version: the two would be
 * indistinguishable in every comparison the app can offer, and the split
 * sample would make both of them less trustworthy.
 *
 * That change is still real to the player who made it, so it is reported
 * separately as a **reprint** rather than dropped. `cardSetIdentical` is the
 * flag the save path uses: true means "same deck, different art", which is
 * written in place even on a locked version.
 */

export interface DiffEntry {
  /** The printing to show. For a change, the one on the newer side. */
  card: CardRow;
  zone: DeckZone;
  quantity: number;
}

export interface ChangedEntry {
  card: CardRow;
  zone: DeckZone;
  from: number;
  to: number;
}

/** Same card, same count, different printing — an art swap. */
export interface ReprintEntry {
  zone: DeckZone;
  from: CardRow;
  to: CardRow;
  quantity: number;
}

export interface DeckDiff {
  added: DiffEntry[];
  removed: DiffEntry[];
  changed: ChangedEntry[];
  reprinted: ReprintEntry[];
  /** Cards present in both lists at the same count. */
  unchanged: number;
  /** Total cards in plus out — the headline "how big was this change". */
  netCardsMoved: number;
  zonesTouched: DeckZone[];
  /** Nothing differs at all, art included. Drives the no-op guard. */
  isEmpty: boolean;
  /**
   * No card was added, removed, or re-counted. Art may still differ.
   *
   * The deck is the same deck to the rules, so a locked version may be updated
   * in place rather than forked.
   */
  cardSetIdentical: boolean;
}

interface Group {
  zone: DeckZone;
  total: number;
  /** printing id → copies of that exact printing */
  printings: Map<string, { card: CardRow; quantity: number }>;
}

/** The zone a diff entry sorts under, so chips read Champion → Main → Runes. */
const ZONE_RANK: Record<DeckZone, number> = {
  legend: 0,
  champion: 1,
  main: 2,
  rune: 3,
  battlefield: 4,
  sideboard: 5,
};

function group(slots: readonly DeckSlot[]): Map<string, Group> {
  const out = new Map<string, Group>();
  for (const slot of slots) {
    if (slot.quantity <= 0) continue;
    const key = `${slot.zone}\u0000${cardKey(slot.card)}`;
    const entry = out.get(key) ?? { zone: slot.zone, total: 0, printings: new Map() };
    entry.total += slot.quantity;
    const printing = entry.printings.get(slot.card.id);
    if (printing) printing.quantity += slot.quantity;
    else entry.printings.set(slot.card.id, { card: slot.card, quantity: slot.quantity });
    out.set(key, entry);
  }
  return out;
}

/** The printing to name a group by: whichever has the most copies. */
function representative(g: Group): CardRow {
  let best: { card: CardRow; quantity: number } | null = null;
  for (const printing of g.printings.values()) {
    if (!best || printing.quantity > best.quantity) best = printing;
  }
  // Groups only exist because a slot created them, so this cannot be empty.
  return best!.card;
}

/**
 * Pair the printings that left a group against the ones that arrived.
 *
 * Only called when the group's total is unchanged, so the two sides sum to the
 * same number and zip cleanly. Sorted by printing id so the pairing is stable
 * across runs rather than dependent on slot order.
 */
function reprintsOf(zone: DeckZone, before: Group, after: Group): ReprintEntry[] {
  const gone: { card: CardRow; quantity: number }[] = [];
  const arrived: { card: CardRow; quantity: number }[] = [];

  const ids = new Set([...before.printings.keys(), ...after.printings.keys()]);
  for (const id of [...ids].sort()) {
    const delta = (after.printings.get(id)?.quantity ?? 0) - (before.printings.get(id)?.quantity ?? 0);
    if (delta > 0) arrived.push({ card: after.printings.get(id)!.card, quantity: delta });
    if (delta < 0) gone.push({ card: before.printings.get(id)!.card, quantity: -delta });
  }

  const out: ReprintEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < gone.length && j < arrived.length) {
    const from = gone[i]!;
    const to = arrived[j]!;
    const quantity = Math.min(from.quantity, to.quantity);
    out.push({ zone, from: from.card, to: to.card, quantity });
    from.quantity -= quantity;
    to.quantity -= quantity;
    if (from.quantity === 0) i++;
    if (to.quantity === 0) j++;
  }
  return out;
}

export function diffLists(before: DeckList, after: DeckList): DeckDiff {
  const a = group(before.slots);
  const b = group(after.slots);

  const added: DiffEntry[] = [];
  const removed: DiffEntry[] = [];
  const changed: ChangedEntry[] = [];
  const reprinted: ReprintEntry[] = [];
  let unchanged = 0;
  let netCardsMoved = 0;

  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(key);
    const to = b.get(key);

    if (!from && to) {
      added.push({ card: representative(to), zone: to.zone, quantity: to.total });
      netCardsMoved += to.total;
      continue;
    }
    if (from && !to) {
      removed.push({ card: representative(from), zone: from.zone, quantity: from.total });
      netCardsMoved += from.total;
      continue;
    }
    if (!from || !to) continue;

    if (from.total !== to.total) {
      changed.push({
        card: representative(to),
        zone: to.zone,
        from: from.total,
        to: to.total,
      });
      netCardsMoved += Math.abs(to.total - from.total);
      continue;
    }

    unchanged += to.total;
    reprinted.push(...reprintsOf(to.zone, from, to));
  }

  /** Chips read in zone order, then alphabetically, in every surface. */
  function sortEntries<T extends { zone: DeckZone }>(entries: T[], nameOf: (e: T) => string) {
    entries.sort(
      (x, y) => ZONE_RANK[x.zone] - ZONE_RANK[y.zone] || nameOf(x).localeCompare(nameOf(y))
    );
  }

  sortEntries(added, (e) => baseName(e.card.name));
  sortEntries(removed, (e) => baseName(e.card.name));
  sortEntries(changed, (e) => baseName(e.card.name));
  sortEntries(reprinted, (e) => baseName(e.to.name));

  const zonesTouched = [
    ...new Set([
      ...added.map((e) => e.zone),
      ...removed.map((e) => e.zone),
      ...changed.map((e) => e.zone),
      ...reprinted.map((e) => e.zone),
    ]),
  ].sort((x, y) => ZONE_RANK[x] - ZONE_RANK[y]);

  const cardSetIdentical =
    added.length === 0 && removed.length === 0 && changed.length === 0;

  return {
    added,
    removed,
    changed,
    reprinted,
    unchanged,
    netCardsMoved,
    zonesTouched,
    isEmpty: cardSetIdentical && reprinted.length === 0,
    cardSetIdentical,
  };
}

/**
 * A canonical key for a list's **card set**, ignoring printings.
 *
 * Two versions with the same key are the same deck to every rule and every
 * statistic — `diffLists` between them returns `cardSetIdentical: true`. This
 * is what lets analytics pool their matches into one sample, which is the
 * promise that justified making an art swap fork a locked version rather than
 * rewrite it: the record stays honest, and the statistical power is recovered
 * at read time instead of destroyed at write time.
 */
export function cardSetKey(list: DeckList): string {
  const totals = new Map<string, number>();
  for (const slot of list.slots) {
    if (slot.quantity <= 0) continue;
    const key = `${slot.zone} ${cardKey(slot.card)}`;
    totals.set(key, (totals.get(key) ?? 0) + slot.quantity);
  }
  return [...totals.entries()]
    .map(([key, quantity]) => `${key}:${quantity}`)
    .sort()
    .join('|');
}

/** How many distinct entries the diff has, reprints included. */
export function diffSize(diff: DeckDiff): number {
  return diff.added.length + diff.removed.length + diff.changed.length + diff.reprinted.length;
}

const MINUS = '−';
const ARROW = '→';

/** One chip per entry, ordered removals-then-additions the way a swap reads. */
export function describeDiff(diff: DeckDiff): { key: string; text: string; sign: 1 | -1 | 0 }[] {
  const chips: { key: string; text: string; sign: 1 | -1 | 0 }[] = [];

  for (const e of diff.removed) {
    chips.push({
      key: `-${e.zone}:${e.card.id}`,
      text: `${MINUS}${e.quantity} ${baseName(e.card.name)}`,
      sign: -1,
    });
  }
  for (const e of diff.added) {
    chips.push({
      key: `+${e.zone}:${e.card.id}`,
      text: `+${e.quantity} ${baseName(e.card.name)}`,
      sign: 1,
    });
  }
  for (const e of diff.changed) {
    const delta = e.to - e.from;
    chips.push({
      key: `~${e.zone}:${e.card.id}`,
      text: `${delta > 0 ? '+' : MINUS}${Math.abs(delta)} ${baseName(e.card.name)}`,
      sign: delta > 0 ? 1 : -1,
    });
  }
  for (const e of diff.reprinted) {
    chips.push({
      key: `art${e.zone}:${e.from.id}:${e.to.id}`,
      text: `${baseName(e.to.name)} ${ARROW} ${variantLabel(e.to.name) ?? 'Standard'}`,
      sign: 0,
    });
  }

  return chips;
}

/**
 * The default label for a forked version.
 *
 * Leads with the largest single change, because that is how players describe
 * an edit to each other — "the build where I cut the Bewitching Spirits". Cuts
 * beat additions on a tie: a card leaving is the more memorable half of a swap.
 *
 * Always editable, and null when nothing changed.
 */
export function suggestLabelFromDiff(diff: DeckDiff): string | null {
  const candidates: { weight: number; cut: boolean; text: string }[] = [];

  for (const e of diff.removed) {
    candidates.push({
      weight: e.quantity,
      cut: true,
      text: `${MINUS}${e.quantity} ${baseName(e.card.name)}`,
    });
  }
  for (const e of diff.added) {
    candidates.push({
      weight: e.quantity,
      cut: false,
      text: `+${e.quantity} ${baseName(e.card.name)}`,
    });
  }
  for (const e of diff.changed) {
    const delta = e.to - e.from;
    candidates.push({
      weight: Math.abs(delta),
      cut: delta < 0,
      text: `${delta > 0 ? '+' : MINUS}${Math.abs(delta)} ${baseName(e.card.name)}`,
    });
  }

  if (candidates.length === 0) {
    const reprint = diff.reprinted[0];
    if (!reprint) return null;
    return t('diff.newArt', { name: baseName(reprint.to.name) });
  }

  candidates.sort(
    (x, y) =>
      y.weight - x.weight ||
      Number(y.cut) - Number(x.cut) ||
      x.text.localeCompare(y.text)
  );

  const headline = candidates[0]!.text;
  const others = candidates.length - 1;
  return others > 0 ? `${headline} and ${others} more` : headline;
}
