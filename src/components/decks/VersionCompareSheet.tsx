import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import type { DeckVersionRow } from '@/db/schema/decks';
import type { DeckDiff } from '@/lib/deck-diff';
import { MAIN_DECK_SIZE } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { DeckDiffView } from './DeckDiffView';

/**
 * Two versions, side by side.
 *
 * This is the screen the whole app exists to reach: *did the change help?*
 * Today it can only answer the first half — what actually changed — because
 * matches do not exist until M4 and win rates until M5. It says so plainly
 * rather than showing a hopeful empty chart, and the record row is already
 * wired to the match counts so it fills itself in when there is something to
 * fill in.
 *
 * The verdict line is deliberately absent. An honest comparison needs a
 * confidence interval behind it, and inventing one from a handful of games is
 * exactly the false precision `DATA-MODEL.md` §4 forbids.
 */

interface VersionCompareSheetProps {
  visible: boolean;
  a: DeckVersionRow | null;
  b: DeckVersionRow | null;
  diff: DeckDiff | null;
  matchCounts: Map<string, number>;
  onClose: () => void;
}

export function VersionCompareSheet({
  visible,
  a,
  b,
  diff,
  matchCounts,
  onClose,
}: VersionCompareSheetProps) {
  const insets = useSafeAreaInsets();

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

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What changed</Text>
            {diff ? (
              <DeckDiffView diff={diff} emptyMessage="These two lists are identical." />
            ) : null}
          </View>

          <Text style={styles.note}>
            Win rates and a verdict arrive with match tracking. Comparing two records without a
            confidence interval behind them is how a deck tracker starts lying to you, so this
            screen would rather say nothing yet.
          </Text>
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
  note: { ...text.small, color: color.textFaint },
  pressed: { opacity: 0.8 },
});
