import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { cardImage, cardImageBlur } from '@/lib/cdn';
import { domainColor, sortDomains } from '@/theme/domains';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

interface CardGridItemProps {
  card: CardRow;
  width: number;
  onPress: (card: CardRow) => void;
}

/**
 * One card in the gallery grid.
 *
 * Memoised and image-only by default: at 3 columns the art is the whole
 * identity of the card, and a name label under every tile turns the grid into a
 * wall of text. The domain stripe along the bottom edge is the one affordance,
 * because it is the fastest way to scan a screen for "my colors".
 */
export const CardGridItem = memo(function CardGridItem({
  card,
  width,
  onPress,
}: CardGridItemProps) {
  // `width` is the full column slot; the frame sits inside this item's padding.
  const frameWidth = width - space[1] * 2;
  const frameHeight = frameWidth / CARD_ASPECT;
  const domains = sortDomains(card.domains);
  const isLandscape = isLandscapeCard(card);

  return (
    <Pressable
      onPress={() => onPress(card)}
      accessibilityRole="imagebutton"
      accessibilityLabel={card.accessibilityText ?? card.name}
      style={({ pressed }) => [styles.root, { width }, pressed && styles.pressed]}
    >
      <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
        <Image
          source={cardImage(card.imageUrl, 'thumb')}
          placeholder={cardImageBlur(card.imageUrl)}
          placeholderContentFit="cover"
          contentFit="cover"
          transition={140}
          cachePolicy="memory-disk"
          style={isLandscape ? uprightArt(frameWidth, frameHeight) : styles.image}
          accessible={false}
        />

        {domains.length > 0 ? (
          <View style={styles.stripe}>
            {domains.map((d) => (
              <View
                key={d}
                style={[styles.stripeSegment, { backgroundColor: domainColor(d).base }]}
              />
            ))}
          </View>
        ) : null}

        {card.isNew ? (
          <View style={styles.newTag}>
            <Text style={styles.newTagText}>New</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * Stands a Battlefield upright so it fills a portrait tile.
 *
 * Battlefields are the only landscape cards (all 71 of them), and their art is
 * 1039x744 — the exact inverse of a portrait card. Left alone they letterbox
 * into a thin strip and the grid loses its rhythm, so they are turned to fill
 * the tile, the same way they are actually played: sideways on the table.
 *
 * Because the aspect is exactly inverted, the rotation crops nothing and
 * distorts nothing. And because a Battlefield prints its rules text twice, 180°
 * apart, so it reads from both sides of the table, neither direction of
 * rotation is upside down — the two are indistinguishable.
 *
 * A rotate transform paints but does not lay out, so the image gets its axes
 * swapped and is centred by hand: `left`/`top` put its centre exactly on the
 * frame's centre, which the rotation then holds fixed. Anything else leaves it
 * hanging off one corner.
 */
const styles = StyleSheet.create({
  root: { padding: space[1] },
  frame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderSubtle,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  image: { flex: 1, width: '100%' },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    flexDirection: 'row',
  },
  stripeSegment: { flex: 1 },
  newTag: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    paddingHorizontal: space[1.5],
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: color.text,
  },
  newTagText: { ...text.microMeta, color: color.bg, fontSize: 9 },
});
