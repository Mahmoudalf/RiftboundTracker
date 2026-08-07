import { StyleSheet, Text, View } from 'react-native';

import { describeDiff, type DeckDiff } from '@/lib/deck-diff';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A decklist change, rendered as chips.
 *
 * Shared by the save sheet, the version timeline, and version compare, so the
 * same edit reads identically wherever it appears — the diff is the app's unit
 * of "what happened to this deck", and it should look like one thing.
 *
 * Cuts come before additions because that is the order a swap is described in,
 * and the sign is carried by colour *and* by the leading `+` / `−`, never by
 * colour alone.
 */

interface DeckDiffViewProps {
  diff: DeckDiff;
  /** Cap the chips shown; the rest collapse into a "+N more" chip. */
  limit?: number;
  emptyMessage?: string;
}

export function DeckDiffView({ diff, limit, emptyMessage = 'No changes' }: DeckDiffViewProps) {
  const chips = describeDiff(diff);

  if (chips.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const shown = limit ? chips.slice(0, limit) : chips;
  const hidden = chips.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((chip) => (
        <View
          key={chip.key}
          style={[
            styles.chip,
            chip.sign === 1 && styles.chipAdd,
            chip.sign === -1 && styles.chipCut,
          ]}
        >
          <Text
            style={[
              styles.label,
              chip.sign === 1 && styles.labelAdd,
              chip.sign === -1 && styles.labelCut,
            ]}
            numberOfLines={1}
          >
            {chip.text}
          </Text>
        </View>
      ))}
      {hidden > 0 ? (
        <View style={styles.chip}>
          <Text style={styles.label}>+{hidden} more</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One line: "6 cards changed across Main deck, Runes". */
export function diffHeadline(diff: DeckDiff): string {
  if (diff.isEmpty) return 'Nothing changed';
  if (diff.cardSetIdentical) {
    const n = diff.reprinted.length;
    return `${n} ${n === 1 ? 'card' : 'cards'} swapped to a different printing`;
  }
  const n = diff.netCardsMoved;
  return `${n} ${n === 1 ? 'card' : 'cards'} in and out`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  chip: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    maxWidth: '100%',
  },
  // Colour is a second signal only: every chip already carries a leading `+` or
  // `−`, so the diff still reads correctly in greyscale.
  chipAdd: { borderColor: color.win },
  chipCut: { borderColor: color.loss },
  label: { ...text.microMeta, color: color.textSecondary },
  labelAdd: { color: color.win },
  labelCut: { color: color.loss },
  empty: { ...text.small, color: color.textFaint },
});
