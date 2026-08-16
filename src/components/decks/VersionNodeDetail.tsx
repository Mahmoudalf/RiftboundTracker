import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { useT } from '@/i18n';
import { baseName } from '@/lib/card-identity';
import type { DeckDiff } from '@/lib/deck-diff';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * An expanded version node — the full change list, in place.
 *
 * Built from the design's declarations:
 *
 *   card     margin-top:13 · border:1px rgba(255,255,255,.08) · radius:14
 *            background:#1B1B1E · padding:16
 *   counts   mono 500 10.5px · #9C9CA1 · margin-bottom:15
 *   columns  display:flex · gap:16 · each flex:1 min-width:0
 *   heading  mono 700 9.5px · tracked · uppercase · #67676B · margin-bottom:9
 *   in       mono 500 11px · #46C77E, ellipsised
 *   out      mono 500 11px · #C7433D, ellipsised
 *   actions  two pills, flex:1 · height:36 · radius:22
 *
 * This replaces an `Alert` action sheet. A modal cannot show the change list it
 * is asking you to act on, which is the whole reason to open a version.
 *
 * **Deviation, stated:** the design shows two buttons. Renaming and deleting a
 * version were reachable only from the removed `Alert`, and the design never
 * drew them, so they are kept here as a third, quieter row rather than made
 * unreachable — the mistake that produced known gaps 6 and 7.
 */

interface VersionNodeDetailProps {
  diff: DeckDiff | null;
  matchCount: number;
  isCurrent: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onFork: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function entryLabel(card: { name: string }, quantity: number, sign: string): string {
  return `${sign}${quantity} ${baseName(card.name)}`;
}

export function VersionNodeDetail({
  diff,
  matchCount,
  isCurrent,
  canDelete,
  onOpen,
  onFork,
  onRename,
  onDelete,
}: VersionNodeDetailProps) {
  const t = useT();
  const ins = [
    ...(diff?.added ?? []).map((e) => entryLabel(e.card, e.quantity, '+')),
    ...(diff?.changed ?? [])
      .filter((c) => c.to > c.from)
      .map((c) => entryLabel(c.card, c.to - c.from, '+')),
  ];
  const outs = [
    ...(diff?.removed ?? []).map((e) => entryLabel(e.card, e.quantity, '−')),
    ...(diff?.changed ?? [])
      .filter((c) => c.to < c.from)
      .map((c) => entryLabel(c.card, c.from - c.to, '−')),
  ];

  return (
    <View style={styles.root}>
      <Text style={styles.counts}>
        {metaLine(
          diff
            ? t('version.changeCount', { count: ins.length + outs.length })
            : t('version.firstBuild'),
          t(matchCount === 1 ? 'version.matchCount.one' : 'version.matchCount.other', {
            count: matchCount,
          })
        )}
      </Text>

      {ins.length > 0 || outs.length > 0 ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnHead}>{ins.length} in</Text>
            <View style={styles.list}>
              {ins.map((line) => (
                <Text key={line} style={styles.in} numberOfLines={1}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.columnHead}>{outs.length} out</Text>
            <View style={styles.list}>
              {outs.map((line) => (
                <Text key={line} style={styles.out} numberOfLines={1}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>
          {t(diff ? 'version.printingsOnly' : 'version.whereItStarted')}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isCurrent}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.action,
            isCurrent && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.actionLabel}>
            {t(isCurrent ? 'version.currentList' : 'version.openList')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onFork}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{t('version.fork')}</Text>
        </Pressable>
      </View>

      <View style={styles.minor}>
        <Pressable accessibilityRole="button" onPress={onRename} hitSlop={8}>
          <Text style={styles.minorLabel}>{t('version.labelNotes')}</Text>
        </Pressable>
        {canDelete ? (
          <Pressable accessibilityRole="button" onPress={onDelete} hitSlop={8}>
            <Text style={styles.minorDanger}>{t('version.delete')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    padding: space[4],
  },
  counts: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10.5,
    color: color.textMuted,
    marginBottom: 15,
  },
  columns: { flexDirection: 'row', gap: space[4] },
  column: { flex: 1, minWidth: 0 },
  columnHead: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: color.textFaint,
    marginBottom: 9,
  },
  list: { gap: 7 },
  in: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: color.win },
  out: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: color.loss },
  empty: { ...text.caption, color: color.textMuted },

  actions: { flexDirection: 'row', gap: space[2], paddingTop: space[4] },
  action: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionLabel: { ...text.smallMedium, fontSize: 12, color: color.textSecondary },

  minor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[4],
    paddingTop: space[3],
  },
  minorLabel: { ...text.microMeta, color: color.textMuted },
  minorDanger: { ...text.microMeta, color: color.danger },
  pressed: { opacity: 0.75 },
});
