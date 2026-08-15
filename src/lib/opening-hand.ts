/**
 * Reading a recorded opening hand back out of the database.
 *
 * The write side lives in `components/games/OpeningHand.tsx`, next to the
 * control that captures it. This is the read side, and it is here rather than
 * in a component because it has to reconcile **two storage formats** and that is
 * exactly the kind of rule that should be pinned by tests rather than by a
 * screenshot.
 */

/** One card of the deal, and whether it survived the mulligan. */
export interface DealtCard {
  id: string;
  sentBack: boolean;
}

/**
 * The deal, with each card marked kept or sent back.
 *
 * Two things make this more than `mulliganed.includes(id)`:
 *
 * **A hand can hold two copies of one card** and send back only one. Testing
 * membership by id alone would mark both. Consuming a budget per id marks as
 * many copies as were actually recycled — the same rule `applyMulligan` uses on
 * the way in.
 *
 * **Two formats exist.** `openingHand` held only the cards *kept* until it was
 * redefined as the whole deal, with `mulliganed` becoming a subset rather than a
 * disjoint set — and migration 20, which added `replacements`, did not backfill
 * the rows written under the old meaning. So any mulliganed id the deal cannot
 * account for belongs to a pre-redefinition row, where the true deal was
 * `kept ∪ mulliganed`; appending the remainder reconstructs it. Under the
 * current format the budget always empties and nothing is appended, so one pass
 * reads both without having to know which it is looking at.
 */
export function dealOf(
  dealt: readonly string[],
  mulliganed: readonly string[]
): DealtCard[] {
  const budget = new Map<string, number>();
  for (const id of mulliganed) budget.set(id, (budget.get(id) ?? 0) + 1);

  const cards: DealtCard[] = dealt.map((id) => {
    const left = budget.get(id) ?? 0;
    if (left <= 0) return { id, sentBack: false };
    budget.set(id, left - 1);
    return { id, sentBack: true };
  });

  for (const [id, left] of budget) {
    for (let n = 0; n < left; n++) cards.push({ id, sentBack: true });
  }
  return cards;
}
