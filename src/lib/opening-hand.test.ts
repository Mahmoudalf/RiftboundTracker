import { describe, expect, it } from 'vitest';

import { dealOf } from './opening-hand';

/**
 * Reading a recorded hand back.
 *
 * The screen this feeds replaced a sentence that got the same facts wrong three
 * ways, so the two rules that sentence had no way to express are what is pinned
 * here: a hand can hold two copies of one card and send back only one of them,
 * and two storage formats exist for the same columns.
 */

const kept = (deal: ReturnType<typeof dealOf>) =>
  deal.filter((c) => !c.sentBack).map((c) => c.id);
const back = (deal: ReturnType<typeof dealOf>) =>
  deal.filter((c) => c.sentBack).map((c) => c.id);

describe('dealOf', () => {
  it('marks nothing when the hand was kept', () => {
    const deal = dealOf(['a', 'b', 'c', 'd'], []);
    expect(deal).toHaveLength(4);
    expect(back(deal)).toEqual([]);
  });

  it('marks only the copies that actually went back', () => {
    // The case from the screenshot: two "Kayle, Justified", one recycled.
    const deal = dealOf(['roar', 'blade', 'kayle', 'kayle'], ['kayle']);

    expect(deal).toHaveLength(4);
    expect(back(deal)).toEqual(['kayle']);
    expect(kept(deal)).toEqual(['roar', 'blade', 'kayle']);
  });

  it('marks both copies when both went back', () => {
    const deal = dealOf(['roar', 'blade', 'kayle', 'kayle'], ['kayle', 'kayle']);
    expect(back(deal)).toEqual(['kayle', 'kayle']);
    expect(kept(deal)).toEqual(['roar', 'blade']);
  });

  it('does not grow the deal under the current format', () => {
    // `mulliganed` is a subset of `openingHand`, so every id is accounted for
    // in place and nothing is appended.
    const deal = dealOf(['a', 'b', 'c', 'd'], ['b', 'd']);
    expect(deal.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(back(deal)).toEqual(['b', 'd']);
  });

  /*
   * `openingHand` held only the cards *kept* before it was redefined as the
   * whole deal, and no migration backfilled the rows written that way. Under
   * that format the deal is `kept ∪ mulliganed`, so the ids the deal cannot
   * account for are real dealt cards rather than corruption.
   */
  it('reconstructs the deal from a pre-redefinition row', () => {
    const deal = dealOf(['a', 'b'], ['c', 'd']);

    expect(deal).toHaveLength(4);
    expect(kept(deal)).toEqual(['a', 'b']);
    expect(back(deal)).toEqual(['c', 'd']);
  });

  it('reconstructs a partially-overlapping row without double counting', () => {
    // 'b' appears once in the deal and once in the mulligan: it is that one
    // card, sent back — not a kept 'b' plus a second, appended one.
    const deal = dealOf(['a', 'b'], ['b', 'z']);

    expect(deal).toHaveLength(3);
    expect(kept(deal)).toEqual(['a']);
    expect(back(deal)).toEqual(['b', 'z']);
  });

  it('survives a hand with nothing recorded in it', () => {
    expect(dealOf([], [])).toEqual([]);
  });
});
