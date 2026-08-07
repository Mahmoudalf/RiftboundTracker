import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { DeckVersionRow } from '@/db/schema/decks';
import type { DeckDiff } from '@/lib/deck-diff';
import { MAIN_DECK_SIZE } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

import { DeckDiffView } from './DeckDiffView';

/**
 * The deck's history, newest first.
 *
 * Each node is a version and the change that created it, so the column reads as
 * the story of the deck rather than as a list of database rows. The diff chips
 * are the point — a version number and a date say nothing a player recognises,
 * "−2 Bewitching Spirit" is the thing they actually remember doing.
 *
 * Long-press two nodes to compare them. That gesture is discoverable from the
 * hint under the list rather than from a mode switch, because comparing is
 * something you want occasionally and a permanent control for it would sit
 * there unused.
 */

export interface TimelineNode {
  version: DeckVersionRow;
  /** Change from its parent. Null for the first version. */
  diff: DeckDiff | null;
  matchCount: number;
  isCurrent: boolean;
  /** The version number this one was forked from, for off-chain parents. */
  parentNumber: number | null;
}

interface VersionTimelineProps {
  nodes: TimelineNode[];
  /** Versions picked for comparison, in pick order. */
  selectedIds: string[];
  onPress: (node: TimelineNode) => void;
  onLongPress: (node: TimelineNode) => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function VersionTimeline({
  nodes,
  selectedIds,
  onPress,
  onLongPress,
}: VersionTimelineProps) {
  return (
    <View style={styles.root}>
      {nodes.map((node, index) => {
        const { version } = node;
        const selected = selectedIds.includes(version.id);
        const below = nodes[index + 1];

        /*
         * The connecting line is a claim about ancestry, so it is only drawn
         * when the node below really is this one's parent.
         *
         * Versions are listed newest-first by number, which is *not* the same
         * as a chain: going back to v1 through this screen and editing forks v3
         * from v1, leaving v2 as its sibling. Drawing a line straight down
         * would say v3 came from v2 and therefore contains v2's changes, which
         * is a claim about the deck that is simply false — and unlike a
         * cosmetic slip, the user would act on it.
         */
        const linkedBelow = !!below && below.version.id === version.parentVersionId;
        const branched = !!version.parentVersionId && !linkedBelow;

        return (
          <View key={version.id} style={styles.row}>
            <View style={styles.gutter}>
              <View style={[styles.dot, node.isCurrent && styles.dotCurrent]} />
              {linkedBelow ? <View style={styles.line} /> : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Version ${version.versionNumber}${
                version.label ? `, ${version.label}` : ''
              }, ${node.matchCount} matches`}
              accessibilityHint="Long press to compare with another version"
              onPress={() => onPress(node)}
              onLongPress={() => onLongPress(node)}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.node,
                selected && styles.nodeSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.number}>v{version.versionNumber}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {version.label ?? (version.parentVersionId ? 'Untitled change' : 'First build')}
                </Text>
              </View>

              <Text style={styles.meta}>
                {metaLine(
                  branched && node.parentNumber !== null
                    ? `Forked from v${node.parentNumber}`
                    : null,
                  formatDate(version.createdAt),
                  `${version.mainCount}/${MAIN_DECK_SIZE}`,
                  version.isLegal ? 'Legal' : 'Incomplete',
                  // A locked version with no matches only exists before M4, via
                  // the dev lock. "No matches yet" there would contradict the
                  // editor banner standing right next to it.
                  node.matchCount > 0
                    ? `${node.matchCount} ${node.matchCount === 1 ? 'match' : 'matches'}`
                    : version.lockedAt
                      ? 'Locked'
                      : 'No matches yet',
                  node.isCurrent ? 'Current' : null
                )}
              </Text>

              {node.diff ? (
                <DeckDiffView diff={node.diff} limit={6} emptyMessage="No card changes" />
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[1] },
  row: { flexDirection: 'row', gap: space[3] },
  gutter: { width: 10, alignItems: 'center', paddingTop: space[4] },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.textMuted,
  },
  dotCurrent: { backgroundColor: color.text, borderColor: color.text },
  line: { flex: 1, width: 1, backgroundColor: color.borderSubtle, marginTop: space[1] },
  node: {
    flex: 1,
    gap: space[1.5],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  nodeSelected: { borderColor: color.info, backgroundColor: color.surface },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  number: { ...text.numeric, fontSize: 15, color: color.text },
  label: { ...text.bodyMedium, color: color.text, flex: 1 },
  meta: { ...text.microMeta, color: color.textMuted },
  pressed: { opacity: 0.75 },
});
