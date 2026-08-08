import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { MatchRow as MatchRowType } from '@/db/schema/matches';
import { baseName } from '@/lib/card-identity';
import { bestOfLabel, matchDate, matchStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One logged match.
 *
 * The result is the only thing that gets colour, and it carries a letter as
 * well — W/L/D reads correctly in greyscale and to anyone who cannot separate
 * the green from the red, which the domain palette work in M1 established as
 * the rule for this app.
 *
 * The opponent comes from the **stored name**, not from a card lookup. That is
 * the whole point of migration 7: this row still says who you played after the
 * printing leaves the card library.
 */

interface MatchRowProps {
  match: MatchRowType;
  onPress?: () => void;
}

const RESULT_LETTER = { win: 'W', loss: 'L', draw: 'D' } as const;

export function MatchRow({ match, onPress }: MatchRowProps) {
  const opponent = match.oppLegendName
    ? baseName(match.oppLegendName)
    : (match.oppLabel ?? 'Unknown opponent');

  const champion = match.oppChampionName ? baseName(match.oppChampionName) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.result} against ${opponent}, ${matchDate(match.playedAt)}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <View
        style={[
          styles.badge,
          match.result === 'win' && styles.win,
          match.result === 'loss' && styles.loss,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            match.result === 'win' && styles.winText,
            match.result === 'loss' && styles.lossText,
          ]}
        >
          {RESULT_LETTER[match.result]}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.opponent} numberOfLines={1}>
          {opponent}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {metaLine(
            champion,
            matchStyleLabel(match.eventType),
            bestOfLabel(match.bestOf),
            matchDate(match.playedAt)
          )}
        </Text>
      </View>

      {match.notes ? <Text style={styles.noteMark}>note</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    paddingVertical: space[2],
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  win: { borderColor: color.win },
  loss: { borderColor: color.loss },
  badgeText: { ...text.numeric, fontSize: 13, color: color.textMuted },
  winText: { color: color.win },
  lossText: { color: color.loss },
  body: { flex: 1, gap: space[0.5] },
  opponent: { ...text.bodyMedium, color: color.text },
  meta: { ...text.microMeta, color: color.textMuted },
  noteMark: { ...text.microMeta, color: color.textFaint },
  pressed: { opacity: 0.7 },
});
