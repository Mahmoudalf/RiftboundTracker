import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { cardImage, cardImageBlur } from '@/lib/cdn';
import { domainColor, sortDomains } from '@/theme/domains';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The foil mark on a quantity badge.
 *
 * Drawn, not typed. The obvious characters for this — ✦ ✧ ★ — are not in Space
 * Grotesk or Inter, and M1 already removed a set of Unicode glyphs for exactly
 * that reason: they render as tofu on any device without a symbol fallback,
 * which turns "3 foils" into "3 somethings".
 */
function FoilMark({ dimmed }: { dimmed: boolean }) {
  return (
    <Svg width={8} height={8} viewBox="0 0 8 8">
      <Path d="M4 0L5 3L8 4L5 5L4 8L3 5L0 4L3 3Z" fill={dimmed ? color.textMuted : color.bg} />
    </Svg>
  );
}

interface CardGridItemProps {
  card: CardRow;
  width: number;
  onPress: (card: CardRow) => void;
  /**
   * Copies owned. Undefined means the collection is not in play on this screen
   * and no badge is drawn — distinct from `0`, which says "checked, none".
   */
  owned?: number;
  /**
   * Whether `owned` is a count of foils. Undefined means finish is not in play.
   *
   * The badge has to say which finish it counts, or a foil-only card showing
   * "1" while the toggle reads Standard looks like the toggle is broken rather
   * than like the card only comes in foil.
   */
  foil?: boolean;
  /**
   * Why this card cannot be filed right now — "Foil only" while Standard is
   * selected. Null means it can. Blocks the add, never the card itself: a long
   * press still opens it, because looking at a card is always allowed.
   */
  blocked?: string | null;
  /** Present only while a binder is selected: tap adds, the minus removes. */
  onAdd?: (card: CardRow) => void;
  onRemove?: (card: CardRow) => void;
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
  owned,
  foil,
  blocked,
  onAdd,
  onRemove,
}: CardGridItemProps) {
  // `width` is the full column slot; the frame sits inside this item's padding.
  const frameWidth = width - space[1] * 2;
  const frameHeight = frameWidth / CARD_ASPECT;
  const domains = sortDomains(card.domains);
  const isLandscape = isLandscapeCard(card);

  const ownedLabel =
    owned === undefined ? '' : `, ${owned} ${foil ? 'foil' : ''} owned`.replace('  ', ' ');
  // Blocked cards fall back to opening the card, so the tap still does the
  // thing tapping a card everywhere else in the app does.
  const canAdd = !!onAdd && !blocked;

  return (
    <Pressable
      onPress={() => (canAdd ? onAdd(card) : onPress(card))}
      onLongPress={canAdd ? () => onPress(card) : undefined}
      delayLongPress={300}
      accessibilityRole="imagebutton"
      accessibilityLabel={
        (card.accessibilityText ?? card.name) + ownedLabel + (blocked ? `, ${blocked}` : '')
      }
      accessibilityHint={canAdd ? 'Adds a copy. Long press to open the card' : undefined}
      style={({ pressed }) => [styles.root, { width }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.frame,
          { width: frameWidth, height: frameHeight },
          blocked ? styles.frameBlocked : null,
        ]}
      >
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

        {card.isNew && owned === undefined ? (
          <View style={styles.newTag}>
            <Text style={styles.newTagText}>New</Text>
          </View>
        ) : null}

        {/*
          Zero is drawn muted rather than hidden. A collection screen that shows
          a badge only on owned cards makes "not owned" and "not counted"
          identical, and the whole point is telling them apart.
        */}
        {owned !== undefined ? (
          <View
            style={[
              styles.owned,
              owned === 0 && styles.ownedNone,
              foil && owned > 0 && styles.ownedFoil,
            ]}
          >
            {foil ? <FoilMark dimmed={owned === 0} /> : null}
            <Text style={[styles.ownedText, owned === 0 && styles.ownedTextNone]}>{owned}</Text>
          </View>
        ) : null}
      </View>

      {/* Named, not just dimmed. A greyed tile with no reason reads as broken. */}
      {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}

      {/* Outside the add target, so a mis-tap cannot undo work. */}
      {onRemove && !blocked && owned !== undefined && owned > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${card.name}`}
          onPress={() => onRemove(card)}
          hitSlop={8}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
        >
          <Text style={styles.removeGlyph}>−</Text>
        </Pressable>
      ) : null}
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
  owned: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: space[1],
    borderRadius: radius.full,
    backgroundColor: color.text,
    justifyContent: 'center',
  },
  ownedNone: { backgroundColor: color.overlay },
  ownedFoil: { backgroundColor: color.info },
  frameBlocked: { opacity: 0.35 },
  blocked: { ...text.microMeta, color: color.textMuted, fontSize: 9, paddingTop: 2 },
  ownedText: { ...text.numeric, fontSize: 12, color: color.bg },
  ownedTextNone: { color: color.textMuted },
  remove: {
    position: 'absolute',
    left: space[2],
    top: space[2],
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { ...text.subtitle, color: color.text, lineHeight: 22 },
});
