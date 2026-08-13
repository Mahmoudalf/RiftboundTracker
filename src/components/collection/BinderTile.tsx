import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FoilSheen } from '@/components/collection/FoilSheen';
import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { cardImage } from '@/lib/cdn';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * One card in a binder.
 *
 * From the design: a 110-wide column at `gap:5`, art `110×154 radius:6` framed
 * at `50% 20%` so the face survives the crop, then the name and a mono meta
 * line.
 *
 * The whole tile is one button. Copies are a badge in the corner and foils are
 * the sheen on the art itself — a `− n +` row under every tile turned a page of
 * cards into a page of controls, and repeated a number the badge was already
 * showing. Changing the count happens where the two finishes can be told apart,
 * which is the sheet the tile opens.
 */

export interface BinderTileProps {
  card: CardRow;
  width: number;
  /** Copies held, both finishes. Undefined shows no badge. */
  count?: number;
  /** At least one copy is a foil — the art gets the sheen. */
  foiled?: boolean;
  /**
   * Held back visually because none are filed here.
   *
   * Only ever set while filing a binder. The gallery deliberately shows every
   * card at full strength — it is a reference, and dimming most of 1,451 cards
   * makes it harder to read rather than more informative.
   */
  dimmed?: boolean;
  onOpen: (card: CardRow) => void;
}

export function BinderTile({
  card,
  width,
  count,
  foiled = false,
  dimmed = false,
  onOpen,
}: BinderTileProps) {
  const height = Math.round((width * 154) / 110);
  const landscape = isLandscapeCard(card);

  return (
    <View style={[styles.tile, { width }, dimmed && styles.dimmed]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={metaLine(
          card.accessibilityText ?? card.name,
          count ? `${count} owned` : null,
          foiled ? 'includes a foil' : null
        )}
        onPress={() => onOpen(card)}
        style={({ pressed }) => [styles.art, { width, height }, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: cardImage(card.imageUrl) }}
          // Battlefields print landscape; stood upright they fill the tile the
          // same way they are played, sideways on the table.
          style={landscape ? uprightArt(width, height) : styles.image}
          contentFit="cover"
          contentPosition={landscape ? 'center' : { top: '20%', left: '50%' }}
          transition={120}
        />

        {/*
          Owned in foil, said once — on the card, where a foil is a thing you
          can see rather than a number you have to read.

        */}
        {foiled ? <FoilSheen width={width} height={height} /> : null}

        {count ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
      </Pressable>

      <Text style={styles.name} numberOfLines={1}>
        {card.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {metaLine(card.setId, card.collectorNumber ? `#${card.collectorNumber}` : null)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 5 },
  /*
   * Held back, not hidden. 0.45 is far enough to let the eye sort a page into
   * owned and not at a glance, and near enough that the art is still
   * recognisable — you have to be able to find the card you are about to file.
   * Applied to the whole tile so the name and set line fade with the art; a
   * dimmed picture under a full-strength label reads as a loading state.
   */
  dimmed: { opacity: 0.45 },
  art: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: color.raised,
  },
  image: { flex: 1, width: '100%' },
  pressed: { opacity: 0.7 },

  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.numeric, fontSize: 11, color: color.onAccent },

  name: { ...text.caption, fontSize: 10.5, color: color.textSecondary },
  meta: { ...text.microMeta, fontSize: 9.5, color: color.textFaint },
});

export const TILE_GAP = space[3];
