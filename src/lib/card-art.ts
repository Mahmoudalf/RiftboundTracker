import type { CardRow } from '@/db/schema/cards';

/**
 * Rendering card art that is not the shape of its frame.
 *
 * Riftbound prints Battlefields landscape — 1039×744, the exact inverse of the
 * portrait cards. Dropped into a portrait frame with `contentFit="cover"` they
 * are cropped to a tall strip through the middle, which reads as a broken image
 * rather than a wide card.
 *
 * The fix is to rotate rather than to letterbox, because the two ratios are
 * exact inverses: a 90° turn fills the frame completely with **no crop and no
 * distortion**. It also keeps a Battlefield the same size and shape as every
 * other card in a mixed grid, which is what makes a gallery scannable.
 *
 * Battlefield art happens to print its title twice, 180° apart, so the
 * direction of the turn does not matter — either way it reads upright.
 */

export function isLandscapeCard(card: Pick<CardRow, 'orientation'>): boolean {
  return card.orientation === 'landscape';
}

/**
 * Absolute-positioned style that turns landscape art upright inside a portrait
 * frame. Pass the frame's own dimensions; width and height are swapped so the
 * rotated image lands exactly on it.
 */
export function uprightArt(frameWidth: number, frameHeight: number) {
  return {
    position: 'absolute' as const,
    left: (frameWidth - frameHeight) / 2,
    top: (frameHeight - frameWidth) / 2,
    width: frameHeight,
    height: frameWidth,
    transform: [{ rotate: '90deg' }],
  };
}
