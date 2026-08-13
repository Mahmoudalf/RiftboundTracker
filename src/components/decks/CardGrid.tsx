import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { baseName, variantLabel } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The card-choosing surface, shared by every step of the build flow.
 *
 * Vertical and paged, never a horizontal rail. A deck is chosen from a pool of
 * ~900 cards, and side-scrolling through that is a filmstrip you have to drag
 * hundreds of times to see what you already own. A vertical grid shows ~9 cards
 * at once, scrolls the way every other list on the phone scrolls, and leaves the
 * decklist room to breathe above it.
 *
 * Printings are shown individually rather than collapsed, because choosing a
 * card here is also choosing its art. `variantLabel` names the treatment so two
 * tiles of the same card are distinguishable.
 */

export type CardGridMode = 'single' | 'quantity';

interface CardGridProps {
  cards: CardRow[];
  mode: CardGridMode;
  /** `single` mode: the currently chosen printing. */
  selectedId?: string | null;
  /** `quantity` mode: copies currently in the deck. */
  quantityOf?: (card: CardRow) => number;
  /** Why this card cannot be added, shown on the tile. Null means it can. */
  blockedReason?: (card: CardRow) => string | null;
  /**
   * Copies free for this deck, already worded (`availabilityLabel`).
   *
   * A line under the name rather than a second corner badge: the corner already
   * means "copies in this deck", and two numbers in one circle would be a
   * puzzle. Null when the collection is empty.
   */
  availabilityOf?: (card: CardRow) => string | null;
  onSelect?: (card: CardRow) => void;
  onAdd?: (card: CardRow) => void;
  onRemove?: (card: CardRow) => void;
  columns?: number;
  /** Width/height. Battlefields are landscape and want the inverse. */
  tileAspect?: number;
  header?: ReactElement;
  emptyMessage?: string;
}

export function CardGrid({
  cards,
  mode,
  selectedId,
  quantityOf,
  blockedReason,
  availabilityOf,
  onSelect,
  onAdd,
  onRemove,
  columns = 3,
  tileAspect = CARD_ASPECT,
  header,
  emptyMessage = 'No cards match.',
}: CardGridProps) {
  return (
    <FlashList
      data={cards}
      numColumns={columns}
      keyExtractor={(card) => card.id}
      ListHeaderComponent={header}
      /*
       * Empty renders inside the same list rather than as a separate branch, so
       * filtering down to nothing does not unmount the header — which would
       * shut an open filter menu the moment it emptied the grid.
       */
      ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
      contentContainerStyle={styles.list}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const quantity = quantityOf?.(item) ?? 0;
        const blocked = blockedReason?.(item) ?? null;
        const selected = mode === 'single' && item.id === selectedId;
        const variant = variantLabel(item.name);
        const availability = availabilityOf?.(item) ?? null;

        return (
          <View style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !!blocked && quantity === 0 }}
              accessibilityLabel={
                `${baseName(item.name)}${variant ? `, ${variant}` : ''}` +
                (quantity ? `, ${quantity} in deck` : '') +
                (blocked ? `, ${blocked}` : '')
              }
              disabled={!!blocked && mode === 'quantity'}
              onPress={() => (mode === 'single' ? onSelect?.(item) : onAdd?.(item))}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.art,
                  { aspectRatio: tileAspect },
                  selected && styles.artSelected,
                  blocked && quantity === 0 && styles.artBlocked,
                ]}
              >
                <Image
                  source={cardImage(item.imageUrl, 'thumb')}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                  cachePolicy="memory-disk"
                  accessible={false}
                />

                {quantity > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{quantity}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.name} numberOfLines={2}>
                {baseName(item.name)}
              </Text>
              {variant ? <Text style={styles.variant}>{variant}</Text> : null}
              {availability ? (
                <Text style={styles.availability} numberOfLines={1}>
                  {availability}
                </Text>
              ) : null}
              {blocked && quantity === 0 ? (
                <Text style={styles.blocked}>{blocked}</Text>
              ) : null}
            </Pressable>

            {/* Remove sits outside the add target so a mis-tap cannot undo work. */}
            {mode === 'quantity' && quantity > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${baseName(item.name)}`}
                onPress={() => onRemove?.(item)}
                hitSlop={8}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Text style={styles.removeGlyph}>−</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: space[12] },
  emptyText: { ...text.body, color: color.textMuted, paddingTop: space[4] },
  cell: { flex: 1, paddingRight: space[2], paddingBottom: space[3] },
  tile: { gap: space[1] },
  pressed: { opacity: 0.7 },
  art: {
    width: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  artSelected: { borderColor: color.text },
  artBlocked: { opacity: 0.3 },
  badge: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    minWidth: 22,
    height: 22,
    paddingHorizontal: space[1],
    borderRadius: radius.full,
    backgroundColor: color.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.numeric, fontSize: 12, color: color.bg },
  remove: {
    position: 'absolute',
    left: space[1],
    top: space[1],
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { ...text.subtitle, color: color.text, lineHeight: 22 },
  name: { ...text.microMeta, color: color.textSecondary },
  variant: { ...text.microMeta, color: color.textFaint, fontSize: 9 },
  // `textDim`, not `textFaint`: this one carries information, and `palette.js`
  // documents faint as below AA and never to be relied on to say anything.
  availability: { ...text.microMeta, color: color.textDim, fontSize: 9 },
  blocked: { ...text.microMeta, color: color.warning, fontSize: 9 },
});
