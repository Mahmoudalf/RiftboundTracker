import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { CardFace, GameHistoryEntry } from '@/db/queries/history';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { bestOfLabel, gameDate, gameStyleLabel } from '@/lib/format';
import { deckGradient } from '@/theme/domains';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One game, in the shape a player expects a game history to have.
 *
 * The row is tinted by the result and carries a coloured edge, so a column of
 * them is scannable without reading a word — which is the entire job of a game
 * history. The result is still spelled out, because tint alone fails in
 * greyscale and for anyone who cannot separate the two hues.
 *
 * Both sides show Legend and Champion as actual card art. These are cards, not
 * avatars, so they keep the printed portrait ratio rather than being cropped
 * square; a square crop of a Riftbound Legend cuts the frame that makes it
 * recognisable.
 */

interface GameHistoryRowProps {
  entry: GameHistoryEntry;
  onPress?: () => void;
}

function Face({ face }: { face: CardFace }) {
  if (!face.imageUrl) {
    /*
     * No art — either never recorded, or the printing has left the library.
     *
     * When the game knows the opponent's domains, draw those instead of an
     * empty tile. This is the job `opp_domains` was denormalized for: the name
     * already survives the card mirror, and the domains make the identity
     * *visible* at a glance in a list that is otherwise scanned by colour.
     */
    if (face.domains && face.domains.length > 0) {
      const [from, to] = deckGradient(face.domains);
      return (
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.art, styles.artDomains]}
        />
      );
    }
    // A neutral tile keeps the row's rhythm instead of collapsing it.
    return <View style={[styles.art, styles.artEmpty]} />;
  }
  return (
    <View style={styles.art}>
      <Image
        source={cardImage(face.imageUrl, 'thumb')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        accessible={false}
      />
    </View>
  );
}

function Side({ legend, champion, align }: { legend: CardFace; champion: CardFace; align: 'left' | 'right' }) {
  const name = legend.name ? baseName(legend.name) : 'Unknown';
  const champ = champion.name ? baseName(champion.name) : null;

  return (
    <View style={[styles.side, align === 'right' && styles.sideRight]}>
      <View style={styles.faces}>
        <Face face={legend} />
        <Face face={champion} />
      </View>
      <View style={[styles.names, align === 'right' && styles.namesRight]}>
        <Text style={styles.legendName} numberOfLines={1}>
          {name}
        </Text>
        {champ ? (
          <Text style={styles.championName} numberOfLines={1}>
            {champ}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const RESULT_LABEL = { win: 'WIN', loss: 'LOSS', draw: 'DRAW' } as const;

export function GameHistoryRow({ entry, onPress }: GameHistoryRowProps) {
  const { game, ours, theirs } = entry;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `${RESULT_LABEL[game.result]} — ` +
        `${ours.legend.name ? baseName(ours.legend.name) : 'your deck'} versus ` +
        `${theirs.legend.name ? baseName(theirs.legend.name) : 'an unrecorded opponent'}`
      }
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        game.result === 'win' && styles.rowWin,
        game.result === 'loss' && styles.rowLoss,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View
        style={[
          styles.edge,
          game.result === 'win' && styles.edgeWin,
          game.result === 'loss' && styles.edgeLoss,
        ]}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.result,
              game.result === 'win' && styles.resultWin,
              game.result === 'loss' && styles.resultLoss,
            ]}
          >
            {RESULT_LABEL[game.result]}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(
              gameStyleLabel(game.gameStyle),
              bestOfLabel(game.bestOf),
              gameDate(game.playedAt)
            )}
          </Text>
        </View>

        <View style={styles.matchup}>
          <Side legend={ours.legend} champion={ours.champion} align="left" />
          <Text style={styles.versus}>vs</Text>
          <Side legend={theirs.legend} champion={theirs.champion} align="right" />
        </View>
      </View>
    </Pressable>
  );
}

const FACE_WIDTH = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  // Tints are deliberately shallow — the row has to read as a surface with a
  // result, not as a coloured banner that fights the card art inside it.
  rowWin: { backgroundColor: '#0E1A17', borderColor: '#17372E' },
  rowLoss: { backgroundColor: '#1B1116', borderColor: '#3A1F29' },
  edge: { width: 3, backgroundColor: color.border },
  edgeWin: { backgroundColor: color.win },
  edgeLoss: { backgroundColor: color.loss },

  content: { flex: 1, padding: space[3], gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  result: { ...text.numeric, fontSize: 13, color: color.textMuted, letterSpacing: 0.5 },
  resultWin: { color: color.win },
  resultLoss: { color: color.loss },
  meta: { ...text.microMeta, color: color.textMuted, flex: 1, textAlign: 'right' },

  matchup: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  side: { flex: 1, gap: space[1] },
  sideRight: { alignItems: 'flex-end' },
  faces: { flexDirection: 'row', gap: space[1] },
  art: {
    width: FACE_WIDTH,
    aspectRatio: CARD_ASPECT,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.raised,
  },
  artEmpty: { borderWidth: 1, borderColor: color.borderSubtle },
  artDomains: { opacity: 0.85 },
  names: { gap: space[0.5] },
  namesRight: { alignItems: 'flex-end' },
  legendName: { ...text.smallMedium, color: color.text },
  championName: { ...text.microMeta, color: color.textMuted },
  versus: { ...text.microMeta, color: color.textFaint },
  pressed: { opacity: 0.75 },
});
