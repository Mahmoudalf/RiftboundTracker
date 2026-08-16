import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { useT } from '@/i18n';
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

/**
 * One zone's count against its threshold.
 *
 * `minimum` is what separates the Main Deck from the other two. Without it this
 * treated every threshold as exact, so a legal 41-card Main Deck (103.2 — "at
 * least 40") was painted in `danger` red beside a status line reading "Legal
 * deck". The colour and the notation both have to know which kind of rule they
 * are drawing, or they contradict the verdict standing next to them.
 */
function Count({
  label,
  actual,
  required,
  minimum = false,
}: {
  label: string;
  actual: number;
  required: number;
  minimum?: boolean;
}) {
  const done = minimum ? actual >= required : actual === required;
  // A minimum cannot be exceeded, only met — so there is no "over" to warn about.
  const over = !minimum && actual > required;
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
        <Text style={styles.countTotal}>
          /{required}
          {minimum ? '+' : ''}
        </Text>
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
  const t = useT();
  const { counts, issues, legal } = result;
  // Count issues are already shown as numbers, so the line adds what they can't.
  const headline = issues.find((i) => !i.code.endsWith('-count')) ?? issues[0];
  const extra = issues.length - 1;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={
        legal
          ? t('legality.legalA11y')
          : t(issues.length === 1 ? 'legality.issuesA11y.one' : 'legality.issuesA11y.other', {
              count: issues.length,
              headline: headline?.message ?? '',
            })
      }
      onPress={onPress}
      disabled={!onPress || issues.length === 0}
      style={styles.root}
    >
      <View style={styles.counts}>
        <Count label={t('legality.main')} actual={counts.main} required={MAIN_DECK_SIZE} minimum />
        <Count label={t('legality.runes')} actual={counts.rune} required={RUNE_DECK_SIZE} />
        <Count label={t('legality.fields')} actual={counts.battlefield} required={BATTLEFIELD_COUNT} />
      </View>

      <View style={styles.status}>
        {legal ? (
          <Text style={[styles.message, { color: color.win }]} numberOfLines={1}>{t('legality.legal')}</Text>
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
