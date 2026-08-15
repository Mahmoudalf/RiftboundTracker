import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CardSlot, SLOT_GAP, slotWidthFor } from '@/components/games/CardSlot';
import type { CardRow } from '@/db/schema/cards';
import { useT } from '@/i18n';
import { dealOf } from '@/lib/opening-hand';
import { color, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A recorded opening hand, read back.
 *
 * The read-only mirror of `OpeningHand`, and it exists because the sentence it
 * replaces was wrong in three separate ways:
 *
 * 1. **It called the whole deal "Kept".** `openingHand` held the cards *kept*
 *    until migration 20 redefined it as all four dealt, with `mulliganed` a
 *    subset rather than a disjoint set. The prose was never updated, so every
 *    card sent back was also listed as kept — the screen contradicted itself
 *    inside one sentence.
 * 2. **It joined card names with commas.** Riftbound names are `Name, Epithet`
 *    — "Kayle, Justified" — so `A, B, C` is unparseable: a four-card hand read
 *    as six items and there was no way to tell a separator from a name.
 * 3. **It dropped `replacements` entirely.** What you drew back was recorded
 *    since migration 20 and never displayed anywhere.
 *
 * Tiles instead of prose also match how the hand was *entered*, which is the
 * point `CardSlot` already makes: you recognise a card by its art long before
 * you finish reading its name, and a hand is a recognition task both ways.
 *
 * The deal is shown at its recorded length rather than padded to four. A hand
 * somebody filled in half of is a half-filled hand, and drawing two empty slots
 * after it would invent a claim the record does not make.
 */

export interface HandReadbackProps {
  /** All cards dealt, in order. Ids, resolved against `cards`. */
  dealt: readonly string[];
  /** Which of `dealt` went back. Ids, matched by count, not by position. */
  mulliganed: readonly string[];
  /** What was drawn in their place. */
  replacements: readonly string[];
  /** Resolved printings — see `cardsByIds`. Missing ids fall back to a name. */
  cards: Map<string, CardRow>;
  /** Names from the deck version, so a hand survives a printing leaving. */
  names: Map<string, string>;
}

export function HandReadback({
  dealt,
  mulliganed,
  replacements,
  cards,
  names,
}: HandReadbackProps) {
  const t = useT();
  const { width } = useWindowDimensions();
  // 32pt of screen padding only — this row is not inside a card here, unlike
  // the log form's, so the default 64 would size the tiles for chrome that is
  // not on this screen.
  const slotWidth = slotWidthFor(width, 32);

  const deal = dealOf(dealt, mulliganed);
  const sentBack = deal.filter((c) => c.sentBack).length;

  /** A tile for one recorded id: the printing if the library still has it. */
  const tile = (id: string, key: string, state: 'kept' | 'mulliganed' | 'replacement') => (
    <CardSlot
      key={key}
      width={slotWidth}
      card={cards.get(id) ?? null}
      state={state}
      // Named even when the art is gone, which is the whole reason the version
      // stores names alongside ids.
      placeholder={names.get(id) ?? t('match.hand.cardGone')}
    />
  );

  return (
    <View style={styles.root}>
      <View style={styles.block}>
        {/*
          Assembled from three keys rather than one sentence with two numbers.

          The two halves are independent facts — how many were dealt, and what
          happened to them — and a language may order them differently or use a
          different connector. Joining with `·` here keeps the separator out of
          the translation, where it would have been quietly retyped as a comma
          in one file and a dash in another.
        */}
        <Text style={styles.label}>
          {t('match.hand.dealt', { count: deal.length })} ·{' '}
          {sentBack > 0
            ? t('match.hand.sentBack', { count: sentBack })
            : t('match.hand.keptAll')}
        </Text>
        <View style={styles.grid}>
          {deal.map((card, i) =>
            tile(card.id, `dealt-${i}`, card.sentBack ? 'mulliganed' : 'kept')
          )}
        </View>
      </View>

      {replacements.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('match.hand.drewBack')}</Text>
          <View style={styles.grid}>
            {replacements.map((id, i) => tile(id, `repl-${i}`, 'replacement'))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  block: { gap: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP },
  // Sentence case at `textMuted`, like `ScoreRow`'s column labels: this names a
  // row inside a match card, not a section of the screen.
  label: { ...text.caption, fontSize: 9.5, lineHeight: 13, color: color.textMuted },
});
