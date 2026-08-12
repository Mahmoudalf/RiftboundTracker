import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WinRateBar } from '@/components/stats/WinRateBar';
import { Pressable } from '@/components/ui/Pressable';
import type { DeckVersionRow } from '@/db/schema/decks';
import { rateOf, separable, type Rate } from '@/lib/analytics/summary';
import { gamesNeeded } from '@/lib/analytics/wilson';
import type { DeckDiff } from '@/lib/deck-diff';
import { MAIN_DECK_SIZE } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { DeckDiffView } from './DeckDiffView';

/**
 * Two versions, side by side — *did the change help?*
 *
 * The screen the whole app exists to reach, and the one most able to mislead.
 * A deck tracker that answers this question loosely is worse than one that does
 * not answer it, because a confident wrong answer gets acted on: cards come out
 * of a deck that was fine.
 *
 * So the verdict is bounded by the intervals rather than by the point estimates.
 * If two Wilson intervals overlap, the data does not separate the versions and
 * the screen says exactly that — plus how many more matches would. 6–4 against
 * 4–6 is not a finding, however much it looks like one.
 */

interface VersionCompareSheetProps {
  visible: boolean;
  a: DeckVersionRow | null;
  b: DeckVersionRow | null;
  diff: DeckDiff | null;
  matchCounts: Map<string, number>;
  /** Matches for each version, keyed by version id. */
  matchesByVersion?: Map<string, Parameters<typeof rateOf>[0]>;
  onClose: () => void;
}

export function VersionCompareSheet({
  visible,
  a,
  b,
  diff,
  matchCounts,
  matchesByVersion,
  onClose,
}: VersionCompareSheetProps) {
  const insets = useSafeAreaInsets();

  const rateA: Rate | null = a && matchesByVersion ? rateOf(matchesByVersion.get(a.id) ?? []) : null;
  const rateB: Rate | null = b && matchesByVersion ? rateOf(matchesByVersion.get(b.id) ?? []) : null;

  const verdict = (() => {
    if (!rateA || !rateB) return null;
    if (rateA.decided === 0 || rateB.decided === 0) {
      return 'One of these has no decided matches yet, so there is nothing to compare.';
    }
    if (separable(rateA, rateB)) {
      const better = (rateB.rate ?? 0) > (rateA.rate ?? 0) ? b : a;
      return `v${better?.versionNumber} is measurably ahead — the intervals do not overlap.`;
    }
    const thinner = rateA.decided <= rateB.decided ? rateA : rateB;
    const more = gamesNeeded(thinner.wins, thinner.decided);
    return more === null
      ? 'Too close to call — the intervals overlap, and no realistic number of matches would separate them.'
      : `Too close to call — the intervals overlap. About ${more} more ${
          more === 1 ? 'match' : 'matches'
        } would start to separate them.`;
  })();

  return (
    <Modal
      visible={visible && !!a && !!b}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            v{a?.versionNumber} → v{b?.versionNumber}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.columns}>
            {[a, b].map((version, index) =>
              version ? (
                <View key={version.id} style={styles.column}>
                  <Text style={styles.columnNumber}>v{version.versionNumber}</Text>
                  <Text style={styles.columnLabel} numberOfLines={2}>
                    {version.label ?? (index === 0 ? 'Earlier' : 'Later')}
                  </Text>
                  <Text style={styles.stat}>
                    {version.mainCount}/{MAIN_DECK_SIZE} main
                  </Text>
                  <Text style={styles.stat}>
                    {matchCounts.get(version.id) ?? 0} matches
                  </Text>
                  <Text style={[styles.stat, version.isLegal ? styles.legal : styles.illegal]}>
                    {version.isLegal ? 'Legal' : 'Incomplete'}
                  </Text>
                </View>
              ) : null
            )}
          </View>

          {rateA && rateB ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Did it help?</Text>
              <WinRateBar rate={rateA} label={`v${a?.versionNumber}`} compact />
              <WinRateBar rate={rateB} label={`v${b?.versionNumber}`} compact />
              {verdict ? <Text style={styles.verdict}>{verdict}</Text> : null}
              <Text style={styles.note}>
                Correlational, not causal. The metagame moves and pilots improve, so a version that
                looks better may simply have been played later.
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What changed</Text>
            {diff ? (
              <DeckDiffView diff={diff} emptyMessage="These two lists are identical." />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space[4],
  },
  title: { ...text.title, color: color.text },
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.raised,
  },
  closeLabel: { ...text.smallMedium, color: color.text },
  content: { paddingBottom: space[12], gap: space[6] },
  columns: { flexDirection: 'row', gap: space[3] },
  column: {
    flex: 1,
    gap: space[1],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  columnNumber: { ...text.numeric, fontSize: 20, color: color.text },
  columnLabel: { ...text.smallMedium, color: color.textSecondary },
  stat: { ...text.microMeta, color: color.textMuted },
  legal: { color: color.win },
  illegal: { color: color.warning },
  section: { gap: space[2] },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  verdict: { ...text.small, color: color.text, paddingTop: space[1] },
  note: { ...text.small, color: color.textFaint },
  pressed: { opacity: 0.8 },
});
