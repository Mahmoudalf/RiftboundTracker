import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import {
  BATTLEFIELD_COUNT,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  type LegalityResult,
} from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

interface LegalityBarProps {
  result: LegalityResult;
  /** Opens the full issue list. Only meaningful with more than one issue. */
  onPress?: () => void;
}

function Count({ label, actual, required }: { label: string; actual: number; required: number }) {
  const done = actual === required;
  const over = actual > required;
  return (
    <View style={styles.count}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text
        style={[
          styles.countValue,
          { color: done ? color.win : over ? color.danger : color.text },
        ]}
      >
        {actual}
        <Text style={styles.countTotal}>/{required}</Text>
      </Text>
    </View>
  );
}

/**
 * Live deck status, pinned above the builder.
 *
 * Counts first, because those are what move as you build and a number next to
 * its target is read faster than a sentence. The single most specific issue
 * follows — never "deck is illegal", always the thing to go and fix.
 *
 * It reports and never blocks. Saving an illegal deck is allowed, because
 * deckbuilding is iterative and a builder that refuses to save a work in
 * progress just teaches people not to use it.
 */
export function LegalityBar({ result, onPress }: LegalityBarProps) {
  const { counts, issues, legal } = result;
  // Count issues are already shown as numbers, so the line adds what they can't.
  const headline = issues.find((i) => !i.code.endsWith('-count')) ?? issues[0];
  const extra = issues.length - 1;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={
        legal
          ? 'Deck is legal'
          : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}. ${headline?.message ?? ''}`
      }
      onPress={onPress}
      disabled={!onPress || issues.length === 0}
      style={styles.root}
    >
      <View style={styles.counts}>
        <Count label="Main" actual={counts.main} required={MAIN_DECK_SIZE} />
        <Count label="Runes" actual={counts.rune} required={RUNE_DECK_SIZE} />
        <Count label="Fields" actual={counts.battlefield} required={BATTLEFIELD_COUNT} />
      </View>

      <View style={styles.status}>
        {legal ? (
          <Text style={[styles.message, { color: color.win }]} numberOfLines={1}>
            Legal deck
          </Text>
        ) : (
          <Text style={[styles.message, { color: color.warning }]} numberOfLines={1}>
            {headline?.message}
            {extra > 0 ? <Text style={styles.more}>{`  +${extra} more`}</Text> : null}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.raised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  counts: { flexDirection: 'row', gap: space[6] },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: space[1.5] },
  countLabel: { ...text.microMeta, color: color.textMuted },
  countValue: { ...text.numeric, fontSize: 15 },
  countTotal: { ...text.numeric, fontSize: 13, color: color.textFaint },
  status: { flexDirection: 'row', alignItems: 'center' },
  message: { ...text.small, flex: 1 },
  more: { ...text.small, color: color.textMuted },
});
