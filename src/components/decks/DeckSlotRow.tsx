import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { Pressable } from '@/components/ui/Pressable';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import type { DeckSlot } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

interface DeckSlotRowProps {
  slot: DeckSlot;
  onAdjust: (delta: number) => void;
  onPress: () => void;
  /** Highlights the row when this card is the reason a deck is illegal. */
  flagged?: boolean;
  /** Legend and Champion are single cards — no stepper. */
  fixed?: boolean;
}

function Stepper({
  quantity,
  onAdjust,
  label,
}: {
  quantity: number;
  onAdjust: (delta: number) => void;
  label: string;
}) {
  const tap = (delta: number) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAdjust(delta);
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${label}`}
        onPress={() => tap(-1)}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>

      <Text style={styles.quantity}>{quantity}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${label}`}
        onPress={() => tap(1)}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

/** One card in the decklist, with its quantity stepper. */
export const DeckSlotRow = memo(function DeckSlotRow({
  slot,
  onAdjust,
  onPress,
  flagged = false,
  fixed = false,
}: DeckSlotRowProps) {
  const { card, quantity } = slot;
  const name = baseName(card.name);

  return (
    <View style={[styles.root, flagged && styles.flagged]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${quantity} ${quantity === 1 ? 'copy' : 'copies'}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Image
          source={cardImage(card.imageUrl, 'thumb')}
          contentFit="cover"
          style={[styles.art, card.orientation === 'landscape' && styles.artLandscape]}
          cachePolicy="memory-disk"
          accessible={false}
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine(
              card.energy !== null ? `${card.energy} energy` : null,
              card.supertype,
              card.type
            )}
          </Text>
        </View>
        <DomainBadge domains={card.domains} />
      </Pressable>

      {fixed ? (
        <Text style={styles.fixedMark}>1</Text>
      ) : (
        <Stepper quantity={quantity} onAdjust={onAdjust} label={name} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingRight: space[2],
    borderRadius: radius.md,
  },
  flagged: { backgroundColor: color.overlay },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[1.5],
    minHeight: 52,
  },
  pressed: { opacity: 0.7 },
  art: {
    width: 34,
    height: 47,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  // Battlefields are landscape; a portrait crop of one is unrecognisable.
  artLandscape: { width: 47, height: 34 },
  info: { flex: 1, gap: 1 },
  name: { ...text.smallMedium, color: color.text },
  meta: { ...text.microMeta, color: color.textMuted },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: color.surface,
    borderRadius: radius.full,
    paddingHorizontal: space[1],
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...text.subtitle, color: color.textSecondary, lineHeight: 22 },
  quantity: { ...text.numeric, fontSize: 14, color: color.text, minWidth: 16, textAlign: 'center' },
  fixedMark: {
    ...text.numeric,
    fontSize: 14,
    color: color.textFaint,
    paddingHorizontal: space[3],
  },
});
