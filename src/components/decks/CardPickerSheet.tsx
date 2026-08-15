import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { useT } from '@/i18n';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Choose several cards in one visit, counting copies.
 *
 * **Counts, not a set.** A four-card opening hand can hold two copies of the
 * same card, and a plain toggle could not record that — the one hand a player
 * is most likely to remember would be the one the app refused to take. Tapping
 * a tile adds a copy; tapping it once past its cap returns it to none, which is
 * the same re-tap-to-clear idiom as everywhere else.
 */
export interface MultiSelect {
  /** Card id → copies chosen. Absent means none. */
  counts: Record<string, number>;
  /** Total copies that may be chosen across all cards. */
  limit: number;
  /** Cap for one card. Defaults to `limit`; the mulligan passes what was dealt. */
  maxPerCard?: (card: CardRow) => number;
  onChange: (counts: Record<string, number>) => void;
}

interface CardPickerSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cards: CardRow[];
  selectedId?: string | null;
  emptyMessage?: string;
  /** Single-select. Ignored — and not required — when `multi` is set. */
  onSelect?: (card: CardRow) => void;
  /** Present for the opening hand, the mulligan and the replacements. */
  multi?: MultiSelect;
  onClose: () => void;
}

const COLUMNS = 3;

/**
 * Full-screen picker for the one-of-a-kind slots.
 *
 * Originally the Legend and the Champion — neither is a stepper card, so the
 * rail cannot set them, and without this a Legend chosen by mistake could only
 * be undone by deleting the deck and starting again. Match logging now uses it
 * for the opponent's Legend, Champion and Battlefield too.
 *
 * With `multi` it fills a whole row of slots in one visit instead of one slot
 * per trip through a full-screen modal, which is four round trips for a hand.
 *
 * Landscape cards are rotated upright rather than cropped, so a Battlefield
 * reads as a card here and not as a strip of one.
 */
export function CardPickerSheet({
  visible,
  title,
  subtitle,
  cards,
  selectedId,
  emptyMessage,
  onSelect,
  multi,
  onClose,
}: CardPickerSheetProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  /*
   * The frame's real pixel size, needed because rotating art means swapping
   * width and height — which `aspectRatio` alone cannot express.
   *
   * Derived from the screen rather than measured with `onLayout`: this grid is
   * a fixed three columns inside known padding, so the arithmetic is exact and
   * costs no extra layout pass.
   */
  const frameWidth = (screenWidth - space[4] * 2) / COLUMNS - space[2];
  const frameHeight = frameWidth / CARD_ASPECT;

  const chosen = multi
    ? Object.values(multi.counts).reduce((sum, n) => sum + n, 0)
    : 0;

  /**
   * One tap: add a copy, or wrap to none.
   *
   * It wraps at whichever cap binds first — the card's own (how many the deck
   * holds, or how many of it were dealt) or the room left under the total. So
   * a tile at the limit still clears on the next tap rather than becoming
   * inert, which is what makes the control undoable without a second gesture
   * nobody would discover.
   */
  const bump = (card: CardRow) => {
    if (!multi) return;
    const current = multi.counts[card.id] ?? 0;
    const perCard = multi.maxPerCard?.(card) ?? multi.limit;
    const room = multi.limit - (chosen - current);
    const cap = Math.max(0, Math.min(perCard, room));

    const next = current >= cap ? 0 : current + 1;
    const counts = { ...multi.counts };
    if (next === 0) delete counts[card.id];
    else counts[card.id] = next;
    multi.onChange(counts);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {multi ? (
              <Text style={[styles.counter, chosen > multi.limit && styles.counterOver]}>
                {chosen} of {multi.limit} chosen
                {chosen > 0 ? ' · tap again to add a copy, once more to clear' : ''}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={multi ? t('action.done') : t('ui.close')}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{t('action.done')}</Text>
          </Pressable>
        </View>

        {cards.length === 0 ? (
          <Text style={styles.empty}>{emptyMessage ?? 'Nothing to choose from.'}</Text>
        ) : (
          <FlashList
            data={cards}
            numColumns={COLUMNS}
            keyExtractor={(card) => card.id}
            contentContainerStyle={styles.grid}
            /*
             * Re-render the grid when the counts change.
             *
             * FlashList memoises rows against `data`, which never changes here —
             * the card list is the same on every tap. Without this the badge
             * would only appear when something else happened to force a pass.
             */
            extraData={multi?.counts}
            renderItem={({ item }) => {
              const count = multi?.counts[item.id] ?? 0;
              const marked = multi ? count > 0 : item.id === selectedId;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: marked }}
                  accessibilityLabel={
                    multi
                      ? `${baseName(item.name)}${count > 0 ? `, ${count} chosen` : ''}`
                      : baseName(item.name)
                  }
                  accessibilityHint={
                    multi ? 'Tap to add a copy, tap past the limit to clear' : undefined
                  }
                  onPress={() => {
                    if (multi) {
                      bump(item);
                      return;
                    }
                    onSelect?.(item);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.art,
                      { width: frameWidth, height: frameHeight },
                      marked && styles.artSelected,
                    ]}
                  >
                    <Image
                      source={cardImage(item.imageUrl, 'thumb')}
                      contentFit="cover"
                      /*
                       * Battlefields print landscape. Cropped into a portrait
                       * frame they become a strip through the middle — the
                       * "trimmed" look. Rotated, they fill it exactly, because
                       * the two ratios are inverses.
                       */
                      style={
                        isLandscapeCard(item)
                          ? uprightArt(frameWidth, frameHeight)
                          : StyleSheet.absoluteFill
                      }
                      cachePolicy="memory-disk"
                      accessible={false}
                    />
                    {count > 0 ? (
                      <View style={styles.count}>
                        <Text style={styles.countLabel}>{count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.name} numberOfLines={2}>
                    {baseName(item.name)}
                  </Text>
                  <DomainBadge domains={item.domains} />
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
    paddingBottom: space[4],
  },
  headerText: { flex: 1, gap: space[1] },
  title: { ...text.title, color: color.text },
  subtitle: { ...text.meta, color: color.textMuted },
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.raised,
  },
  closeLabel: { ...text.smallMedium, color: color.text },
  counter: { ...text.caption, color: color.textMuted, paddingTop: space[0.5] },
  counterOver: { color: color.warning },
  count: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
    borderRadius: radius.full,
    backgroundColor: color.accent,
  },
  countLabel: { ...text.numeric, fontSize: 11, lineHeight: 14, color: color.onAccent },
  grid: { paddingBottom: space[12] },
  tile: { flex: 1, gap: space[1.5], paddingRight: space[2], paddingBottom: space[3] },
  art: {
    // Width and height are set inline — rotation needs real pixels, and an
    // `aspectRatio` here as well would be a second source of truth for the
    // same box.
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  artSelected: { borderColor: color.text },
  name: { ...text.microMeta, color: color.textSecondary },
  empty: { ...text.body, color: color.textMuted, paddingTop: space[6] },
  pressed: { opacity: 0.75 },
});
