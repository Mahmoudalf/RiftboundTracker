import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { SetCompletion } from '@/db/queries/collection';
import { useT } from '@/i18n';
import { color, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * How far through each set you are.
 *
 * The design's bar: label left, `owned/total` right in mono, then an 8px track
 * at radius 4 with a coral fill. No percentage — the count is the honest
 * number, and "3%" beside "11/352" says less than the fraction does.
 *
 * Only the three you have got furthest with are shown. The rest are one tap
 * away rather than gone: seven full-width bars, most of them empty, buried the
 * binders below the fold on a screen whose job is the binders.
 */

const SHOWN = 3;

export function SetProgress({ sets }: { sets: readonly SetCompletion[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(
    () =>
      // Furthest along first — by cards collected, then by the larger set, so a
      // shelf of untouched sets still orders sensibly instead of arbitrarily.
      [...sets].sort((a, b) => b.owned - a.owned || b.total - a.total),
    [sets]
  );

  const hidden = Math.max(0, ranked.length - SHOWN);
  const visible = expanded ? ranked : ranked.slice(0, SHOWN);

  return (
    <View style={styles.list}>
      {visible.map((set) => {
        const pct = set.total > 0 ? (set.owned / set.total) * 100 : 0;
        return (
          <View key={set.setId}>
            <View style={styles.head}>
              <Text style={styles.label} numberOfLines={1}>
                {set.label}
              </Text>
              <Text style={styles.count}>
                {set.owned.toLocaleString()}/{set.total.toLocaleString()}
              </Text>
            </View>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: set.total, now: set.owned }}
              accessibilityLabel={t('collection.setProgress.a11y', {
                label: set.label,
                owned: set.owned,
                total: set.total,
              })}
            >
              {/* Zero renders as an empty track rather than a hairline — a
                  sliver of coral would claim progress that has not happened. */}
              {set.owned > 0 ? <View style={[styles.fill, { width: `${pct}%` }]} /> : null}
            </View>
          </View>
        );
      })}

      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((e) => !e)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          {/* The singular is its own key rather than an inline ternary: German
              and French both inflect "set", and picking the form by English
              grammar would be wrong in either even with the words translated. */}
          <Text style={styles.moreLabel}>
            {expanded
              ? t('collection.showFewerSets')
              : hidden === 1
                ? t('collection.showOneMoreSet')
                : t('collection.showMoreSets', { count: hidden })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[4] },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2], marginBottom: 7 },
  label: { ...text.smallMedium, fontSize: 12.5, color: color.text, flexShrink: 1 },
  count: { ...text.numeric, fontSize: 11, color: color.textSecondary },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: 8, backgroundColor: color.accent, borderRadius: 4 },

  more: { minHeight: 32, justifyContent: 'center' },
  moreLabel: { ...text.microMeta, color: color.textMuted },
  pressed: { opacity: 0.6 },
});
