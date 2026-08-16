import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WinRateBar } from '@/components/stats/WinRateBar';
import { Pressable } from '@/components/ui/Pressable';
import type { DeckVersionRow } from '@/db/schema/decks';
import { useT } from '@/i18n';
import { rateOf, separable, type Rate } from '@/lib/analytics/summary';
import { gamesNeeded } from '@/lib/analytics/wilson';
import type { DeckDiff } from '@/lib/deck-diff';
import { MAIN_DECK_TARGET } from '@/lib/legality';
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
  const t = useT();
  const insets = useSafeAreaInsets();

  const rateA: Rate | null = a && matchesByVersion ? rateOf(matchesByVersion.get(a.id) ?? []) : null;
  const rateB: Rate | null = b && matchesByVersion ? rateOf(matchesByVersion.get(b.id) ?? []) : null;

  const verdict = (() => {
    if (!rateA || !rateB) return null;
    // `total`, not `decided`: since 2026-08-14 a draw is half a win and half a
    // loss, so a version with nothing but draws has a real rate to compare.
    if (rateA.total === 0 || rateB.total === 0) {
      return t('version.nothingToCompare');
    }
    if (separable(rateA, rateB)) {
      const better = (rateB.rate ?? 0) > (rateA.rate ?? 0) ? b : a;
      return t('version.ahead', { number: better?.versionNumber ?? '' });
    }
    const thinner = rateA.total <= rateB.total ? rateA : rateB;
    const more = gamesNeeded(thinner.points, thinner.total);
    return more === null
      ? t('version.tooClose')
      : t('version.tooCloseWithEstimate', {
          count: more,
          games: t(more === 1 ? 'finding.game' : 'finding.games'),
        });
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
            accessibilityLabel={t('ui.close')}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{t('action.done')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.columns}>
            {[a, b].map((version, index) =>
              version ? (
                <View key={version.id} style={styles.column}>
                  <Text style={styles.columnNumber}>v{version.versionNumber}</Text>
                  <Text style={styles.columnLabel} numberOfLines={2}>
                    {version.label ?? t(index === 0 ? 'version.earlier' : 'version.later')}
                  </Text>
                  <Text style={styles.stat}>
                    {t('version.mainCount', {
                      count: version.mainCount,
                      target: MAIN_DECK_TARGET,
                    })}
                  </Text>
                  <Text style={styles.stat}>
                    {t('version.matchCount.other', { count: matchCounts.get(version.id) ?? 0 })}
                  </Text>
                  <Text style={[styles.stat, version.isLegal ? styles.legal : styles.illegal]}>
                    {t(version.isLegal ? 'version.legal' : 'version.incomplete')}
                  </Text>
                </View>
              ) : null
            )}
          </View>

          {rateA && rateB ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('version.didItHelp')}</Text>
              <WinRateBar rate={rateA} label={`v${a?.versionNumber}`} compact />
              <WinRateBar rate={rateB} label={`v${b?.versionNumber}`} compact />
              {verdict ? <Text style={styles.verdict}>{verdict}</Text> : null}
              <Text style={styles.note}>{t('version.correlational')}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('version.whatChanged')}</Text>
            {diff ? (
              <DeckDiffView diff={diff} emptyMessage={t('version.identical')} />
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
