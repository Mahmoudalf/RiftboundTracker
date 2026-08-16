import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
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

export function DeckDiffView({ diff, limit, emptyMessage }: DeckDiffViewProps) {
  const chips = describeDiff(diff);
  // Defaulted here rather than in the signature: a parameter default is
  // evaluated per render, but writing it as a literal froze it in English.
  const empty = emptyMessage ?? t('diff.noChanges');

  if (chips.length === 0) {
    return <Text style={styles.empty}>{empty}</Text>;
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
  if (diff.isEmpty) return t('diff.nothingChanged');
  if (diff.cardSetIdentical) {
    const n = diff.reprinted.length;
    return t(n === 1 ? 'diff.reprinted.one' : 'diff.reprinted.other', { count: n });
  }
  const n = diff.netCardsMoved;
  return t(n === 1 ? 'diff.moved.one' : 'diff.moved.other', { count: n });
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
