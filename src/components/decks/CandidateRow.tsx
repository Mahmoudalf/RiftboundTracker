import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { cardImage } from '@/lib/cdn';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One card the deck could hold, and how many of it the deck holds.
 *
 * The design's editor row: a 34×46 spine, the name at `500 13.5`, a mono meta
 * line, a reason underneath when the card cannot be added, and a
 * `− quantity +` group of 38px controls.
 *
 * The same row serves cards in the deck and cards merely available, which is
 * the point — the old editor split those into two modes, so adding a third copy
 * of something meant leaving the list that told you that you had two.
 */

export interface CandidateRowProps {
  card: CardRow;
  quantity: number;
  /** Why this cannot be added — shown, and disables the plus. */
  blocked?: string | null;
  /** Named by a legality issue; the row is marked rather than hidden. */
  flagged?: boolean;
  /**
   * Copies free for this deck, already worded (`availabilityLabel`). Null when
   * the collection is empty, which is the one case where saying nothing beats
   * telling someone they own none of all 900 cards.
   */
  availability?: string | null;
  onAdd: () => void;
  onRemove: () => void;
  onPress: () => void;
}

export function CandidateRow({
  card,
  quantity,
  blocked = null,
  flagged = false,
  availability = null,
  onAdd,
  onRemove,
  onPress,
}: CandidateRowProps) {
  const landscape = isLandscapeCard(card);

  return (
    <View style={[styles.row, quantity === 0 && blocked ? styles.dimmed : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={metaLine(card.name, quantity > 0 ? `${quantity} in deck` : null)}
        onPress={onPress}
        style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: cardImage(card.imageUrl) }}
          style={landscape ? uprightArt(34, 46) : styles.image}
          contentFit="cover"
          contentPosition={landscape ? 'center' : { top: '18%', left: '50%' }}
          transition={120}
        />
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.name, flagged && styles.nameFlagged]} numberOfLines={1}>
          {card.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {metaLine(
            card.setId,
            card.collectorNumber ? `#${card.collectorNumber}` : null,
            card.energy === null ? null : `${card.energy}⚡`,
            availability
          )}
        </Text>
        {blocked ? <Text style={styles.reason}>{blocked}</Text> : null}
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove a copy of ${card.name}`}
          disabled={quantity === 0}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.step,
            quantity === 0 && styles.stepOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.glyph, quantity === 0 && styles.glyphOff]}>−</Text>
        </Pressable>

        <Text style={styles.quantity}>{quantity}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add a copy of ${card.name}`}
          disabled={!!blocked}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.step,
            styles.stepAdd,
            !!blocked && styles.stepOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.glyph, !!blocked && styles.glyphOff]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: space[2] },
  // Only a blocked card you hold none of fades. A card already in the deck
  // stays legible even when no more may be added — you still have to see it.
  dimmed: { opacity: 0.55 },
  thumb: {
    width: 34,
    height: 46,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.raised,
  },
  image: { flex: 1, width: '100%' },
  pressed: { opacity: 0.7 },

  body: { flex: 1, minWidth: 0 },
  name: { ...text.smallMedium, fontSize: 13.5, color: color.text },
  nameFlagged: { color: color.warning },
  meta: { ...text.microMeta, fontSize: 10.5, color: color.textFaint },
  reason: { ...text.caption, fontSize: 10.5, color: color.textMuted },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stepAdd: { backgroundColor: 'rgba(255,255,255,0.12)' },
  stepOff: { backgroundColor: 'rgba(255,255,255,0.03)' },
  glyph: { ...text.body, fontSize: 18, color: color.text },
  glyphOff: { color: color.textFaint },
  quantity: { ...text.numeric, fontSize: 13.5, color: color.text, width: 22, textAlign: 'center' },
});
