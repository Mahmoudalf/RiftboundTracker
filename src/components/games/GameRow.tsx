import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { GameRow as GameRowType } from '@/db/schema/games';
import { baseName } from '@/lib/card-identity';
import { bestOfLabel, gameDate, gameStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One logged game.
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

interface GameRowProps {
  game: GameRowType;
  onPress?: () => void;
}

const RESULT_LETTER = { win: 'W', loss: 'L', draw: 'D' } as const;

export function GameRow({ game, onPress }: GameRowProps) {
  const opponent = game.oppLegendName
    ? baseName(game.oppLegendName)
    : (game.oppLabel ?? 'Unknown opponent');

  const champion = game.oppChampionName ? baseName(game.oppChampionName) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.result} against ${opponent}, ${gameDate(game.playedAt)}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <View
        style={[
          styles.badge,
          game.result === 'win' && styles.win,
          game.result === 'loss' && styles.loss,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            game.result === 'win' && styles.winText,
            game.result === 'loss' && styles.lossText,
          ]}
        >
          {RESULT_LETTER[game.result]}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.opponent} numberOfLines={1}>
          {opponent}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {metaLine(
            champion,
            gameStyleLabel(game.gameStyle),
            bestOfLabel(game.bestOf),
            gameDate(game.playedAt)
          )}
        </Text>
      </View>

      {game.notes ? <Text style={styles.noteMark}>note</Text> : null}
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
