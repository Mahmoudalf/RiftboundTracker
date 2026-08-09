import type React from 'react';
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
 * `selecting` turns the whole column into a picker for comparison. It is a mode
 * rather than a gesture because the gesture version was not findable: a tap
 * opened the version's actions and only a long-press selected, so the natural
 * way to pick the second version silently did something else.
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
  /** Compare mode: a tap picks rather than opening the version's actions. */
  selecting: boolean;
  /** The version expanded in place, if any. */
  expandedId?: string | null;
  /** Rendered under the expanded node — its full change list and actions. */
  renderDetail?: (node: TimelineNode) => React.ReactNode;
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
  selecting,
  expandedId,
  renderDetail,
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
              accessibilityHint={
                selecting
                  ? 'Tap to pick this version for the comparison'
                  : 'Long press to compare with another version'
              }
              onPress={() => onPress(node)}
              onLongPress={selecting ? undefined : () => onLongPress(node)}
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
                {/* Only while picking — an empty circle on every node at rest
                    would read as a status the version does not have. */}
                {selecting ? (
                  <View style={[styles.pick, selected && styles.pickOn]} />
                ) : null}
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

              {/* Shown, or the notes field would be write-only — which is how
                  half of this screen's text became unreachable in the first
                  place. */}
              {version.notes ? (
                <Text style={styles.notes} numberOfLines={3}>
                  {version.notes}
                </Text>
              ) : null}

              {/* Collapsed shows the chips; open replaces them with the full
                  list, in place. */}
              {expandedId === version.id && renderDetail ? (
                renderDetail(node)
              ) : node.diff ? (
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
  dotCurrent: { backgroundColor: color.accent, borderColor: color.accent },
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  pick: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  pickOn: { backgroundColor: color.info, borderColor: color.info },
  number: { ...text.numeric, fontSize: 15, color: color.text },
  label: { ...text.bodyMedium, color: color.text, flex: 1 },
  meta: { ...text.microMeta, color: color.textMuted },
  notes: { ...text.small, color: color.textSecondary },
  pressed: { opacity: 0.75 },
});
