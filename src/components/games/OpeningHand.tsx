import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CardSlot, SLOT_GAP, slotWidthFor } from '@/components/games/CardSlot';
import { SectionLabel } from '@/components/ui/Field';
import type { CardRow } from '@/db/schema/cards';
import { color, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The opening deal and the mulligan, as the design's two rows of four.
 *
 * Riftbound deals **4** and lets you recycle **up to 2**, drawing that many
 * back. So the two rows are asking different questions and the second depends
 * on the first:
 *
 * - **Opening hand** — the four cards you were dealt, chosen together.
 * - **Mulligan** — the first two slots are *which of those four went back*, so
 *   they can only ever offer cards already in the hand above. The last two are
 *   *what you drew in their place*, from the whole deck, and only open once
 *   something has actually been sent back.
 *
 * Each row is picked in one visit rather than a slot at a time. The picker is a
 * full-screen modal, so a hand cost four trips through it; now it costs one,
 * and the count badge on each tile is what makes a hand holding two of the same
 * card recordable at all.
 *
 * That dependency is the reason this is one component rather than two: a
 * mulligan slot that offered the entire deck would let you record sending back
 * a card you were never dealt, and the two rows would stop describing the same
 * hand.
 */

/** From the Core Rules, and the numbers `lib/goldfish.ts` simulates. */
export const DEAL_SIZE = 4;
export const MAX_RECYCLED = 2;

export interface OpeningHandValue {
  /** All four dealt, in order. `null` in a slot means "not filled in yet". */
  dealt: (CardRow | null)[];
  /** Which of `dealt` went back, by index. */
  mulliganed: number[];
  /** What was drawn in their place. Positional, one per mulliganed slot. */
  replacements: (CardRow | null)[];
}

export const BLANK_HAND: OpeningHandValue = {
  dealt: [null, null, null, null],
  mulliganed: [],
  replacements: [],
};

/** Card id → copies, the shape `CardPickerSheet`'s multi-select works in. */
export type Counts = Record<string, number>;

function tally(cards: readonly (CardRow | null)[]): Counts {
  const counts: Counts = {};
  for (const card of cards) {
    if (card) counts[card.id] = (counts[card.id] ?? 0) + 1;
  }
  return counts;
}

/** Expand counts back into a flat list, in the pool's own order. */
function expand(counts: Counts, pool: readonly CardRow[]): CardRow[] {
  const out: CardRow[] = [];
  for (const card of pool) {
    for (let n = 0; n < (counts[card.id] ?? 0); n++) out.push(card);
  }
  return out;
}

/*
 * Counts in, hand out — a whole row at a time.
 *
 * These live beside the value type rather than in either screen because the log
 * form and the after-the-fact pass both drive them, and the rules they encode
 * (a mulligan is a subset of the deal; a replacement needs a mulligan to have
 * replaced) are the part that has to stay right in both.
 */
export const handCounts = {
  dealt: (hand: OpeningHandValue): Counts => tally(hand.dealt),
  mulliganed: (hand: OpeningHandValue): Counts =>
    tally(hand.mulliganed.map((index) => hand.dealt[index] ?? null)),
  replacements: (hand: OpeningHandValue): Counts => tally(hand.replacements),
};

/** Replace the whole deal, padded back out to four slots. */
export function applyDealt(
  hand: OpeningHandValue,
  counts: Counts,
  pool: readonly CardRow[]
): OpeningHandValue {
  const chosen = expand(counts, pool).slice(0, DEAL_SIZE);
  const dealt: (CardRow | null)[] = [...chosen, null, null, null, null].slice(0, DEAL_SIZE);

  /*
   * The mulligan is re-derived rather than carried across by index.
   *
   * Indexes point into the *old* deal, so replacing it would leave them
   * pointing at whatever now sits in those positions — silently marking a card
   * the user never sent back. Re-matching by card keeps every mulligan the new
   * deal can still account for and drops the rest.
   */
  const wanted = handCounts.mulliganed(hand);
  const mulliganed: number[] = [];
  const taken: Counts = {};
  dealt.forEach((card, index) => {
    if (!card) return;
    if ((taken[card.id] ?? 0) >= (wanted[card.id] ?? 0)) return;
    taken[card.id] = (taken[card.id] ?? 0) + 1;
    mulliganed.push(index);
  });

  return {
    dealt,
    mulliganed,
    replacements: hand.replacements.slice(0, mulliganed.length),
  };
}

/** Mark which of the dealt cards went back. Counts index into the deal. */
export function applyMulligan(hand: OpeningHandValue, counts: Counts): OpeningHandValue {
  const remaining = { ...counts };
  const mulliganed: number[] = [];

  hand.dealt.forEach((card, index) => {
    if (!card) return;
    if ((remaining[card.id] ?? 0) <= 0) return;
    remaining[card.id] = (remaining[card.id] ?? 0) - 1;
    mulliganed.push(index);
  });

  return {
    ...hand,
    mulliganed,
    // A replacement survives only while there is a card for it to have replaced.
    replacements: hand.replacements.slice(0, mulliganed.length),
  };
}

export function applyReplacements(
  hand: OpeningHandValue,
  counts: Counts,
  pool: readonly CardRow[]
): OpeningHandValue {
  return {
    ...hand,
    replacements: expand(counts, pool).slice(0, hand.mulliganed.length),
  };
}

export interface OpeningHandProps {
  value: OpeningHandValue;
  /**
   * Open the picker for a whole row.
   *
   * Per row, not per slot: the picker is a full-screen modal, and filling a
   * hand one slot at a time is four trips through it. Tapping any slot in a row
   * opens that row's picker with the current selection already in it.
   */
  onPickRow: (row: 'dealt' | 'mulligan' | 'replacement') => void;
}

export function OpeningHand({ value, onPickRow }: OpeningHandProps) {
  const { dealt, mulliganed, replacements } = value;
  const sentBack = mulliganed.length;

  /*
   * Divide the width the screen actually reports.
   *
   * A fixed 78 fit the design's 390pt mock by four points too many and wrapped
   * the fourth slot onto its own line — a row of four silently becoming two
   * rows of three and one. Measuring also gets narrow phones and split-screen
   * right for free, neither of which a constant ever would.
   */
  const { width } = useWindowDimensions();
  const slotWidth = slotWidthFor(width);

  return (
    <>
      <View style={styles.block}>
        <SectionLabel>Opening hand — from this deck</SectionLabel>
        <View style={styles.grid}>
          {dealt.map((card, i) => (
            <CardSlot
              key={`dealt-${i}`}
              width={slotWidth}
              card={card}
              state={mulliganed.includes(i) ? 'mulliganed' : 'kept'}
              placeholder="Card"
              onPress={() => onPickRow('dealt')}
              accessibilityLabel={
                card
                  ? `Card ${i + 1} of the opening hand: ${card.name}. Tap to choose the hand.`
                  : `Card ${i + 1} of the opening hand, not chosen. Tap to choose the hand.`
              }
            />
          ))}
        </View>
        <Text style={styles.helper}>
          Tap any slot to pick the whole hand — up to {DEAL_SIZE} cards, tapping one twice for a
          second copy.
        </Text>
      </View>

      <View style={styles.block}>
        <SectionLabel>Mulligan</SectionLabel>
        <View style={styles.grid}>
          {/*
            Two "which went back" slots, then two "what you drew" slots.
            Positional rather than a list, because the design draws four fixed
            slots and because it makes the up-to-2 rule visible instead of
            enforced — you can see there is no third place to put one.
          */}
          {[0, 1].map((n) => {
            const index = mulliganed[n];
            const card = index === undefined ? null : (dealt[index] ?? null);
            return (
              <CardSlot
                key={`mull-${n}`}
                width={slotWidth}
                card={card}
                state={card ? 'mulliganed' : 'empty'}
                placeholder="Mull"
                onPress={() => onPickRow('mulligan')}
                accessibilityLabel={
                  card
                    ? `Sent back: ${card.name}. Tap to change what went back.`
                    : `Mulligan slot ${n + 1}, empty. Tap to choose which dealt cards went back.`
                }
              />
            );
          })}
          {[0, 1].map((n) => (
            <CardSlot
              key={`repl-${n}`}
              width={slotWidth}
              card={replacements[n] ?? null}
              state="replacement"
              placeholder="Drew"
              // Only meaningful once something has gone back. Opening the
              // picker anyway would invite recording a replacement for a
              // mulligan that never happened.
              onPress={() => (sentBack > 0 ? onPickRow('replacement') : undefined)}
              accessibilityLabel={
                sentBack > 0
                  ? `Replacement ${n + 1}: ${replacements[n]?.name ?? 'not recorded'}. Tap to choose what you drew.`
                  : 'Replacement slot, unavailable until a card is sent back.'
              }
            />
          ))}
        </View>
        <Text style={styles.helper}>
          First two — pick which of your opening hand went back, up to {MAX_RECYCLED} at a time.
          Last two — the replacements you drew, once something has gone back.
        </Text>
        {sentBack > MAX_RECYCLED ? (
          <Text style={styles.warning}>
            {sentBack} sent back — Riftbound recycles at most {MAX_RECYCLED}. Left as entered.
          </Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP },
  helper: { ...text.caption, fontSize: 10.5, color: color.textMuted },
  warning: { ...text.caption, fontSize: 10.5, color: color.warning },
});
