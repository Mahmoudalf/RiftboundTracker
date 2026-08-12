import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * One slot in an opening deal — a card, shown as a card.
 *
 * The design draws these as 60px name-only tiles. They carry **art** here,
 * which is a deliberate deviation and the point of the change: every other
 * place this app shows a card — the gallery, the binder grid, the Legend and
 * Battlefield pickers — shows the printing, and a hand rendered as four lines
 * of 10px text is the one surface where you would be asked to recognise your
 * own deck from a list of names. You recognise a card by its art long before
 * you finish reading its name, and an opening hand is precisely a recognition
 * task.
 *
 * Art loading, cropping and the landscape rotation all go through the same
 * helpers as `CardPickerSheet` and `CardGridItem`, so a Battlefield stands
 * upright here for the same reason it does there.
 *
 * **The width is measured, not assumed.** It shipped as a hardcoded 78, sized
 * against a 390pt screen — but the usable width inside a match card is 326
 * (16pt of screen padding and 16 of card padding on each side), so four slots
 * and three gaps came to 330. Four points over, and the row silently became two
 * rows with one card stranded on the second. `slotWidthFor()` below divides the
 * width the screen actually reports.
 */

export type SlotState =
  /** Chosen, and staying. */
  | 'kept'
  /** Chosen, and sent back — accent border, dimmed art, MULL badge. */
  | 'mulliganed'
  /**
   * A replacement slot. Empty it is dashed; filled it is the mirror of
   * mulliganed — win-green border, full-strength art, DRAW badge.
   */
  | 'replacement'
  /** Nothing chosen yet. */
  | 'empty';

export interface CardSlotProps {
  card: CardRow | null;
  state: SlotState;
  /** Shown when there is no card: the design uses a search glyph for these. */
  placeholder?: string;
  /** Measured by the parent — see `slotWidthFor`. */
  width: number;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Gap between slots. Small, so the four read as one hand rather than four tiles. */
export const SLOT_GAP = 6;
/**
 * A ceiling, so the slots do not become posters on a tablet or a foldable.
 *
 * Below the ~115pt the card gallery gives a tile, deliberately: this is a
 * thumbnail with a name under it inside a form, not a browsing surface, and
 * four of them across a phone is the shape the design asks for.
 */
const MAX_SLOT_WIDTH = 72;

/**
 * How wide each of four slots can be, given the screen.
 *
 * `chrome` is everything horizontal between the window edge and the row: the
 * screen's own padding plus the match card's, on both sides.
 */
export function slotWidthFor(windowWidth: number, chrome = 64): number {
  const available = windowWidth - chrome - SLOT_GAP * 3;
  return Math.max(52, Math.min(MAX_SLOT_WIDTH, Math.floor(available / 4)));
}

/** The printed card ratio, so a thumbnail is not a squashed card. */
const CARD_RATIO = 0.716;

export function CardSlot({
  card,
  state,
  width,
  placeholder = 'Tap to choose',
  onPress,
  accessibilityLabel,
}: CardSlotProps) {
  const mulliganed = state === 'mulliganed';
  /** A replacement that has been chosen — the card that came *back*. */
  const drew = state === 'replacement' && card !== null;
  const dashed = state === 'replacement' && !card;
  const artHeight = Math.round(width / CARD_RATIO);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (card
          ? `${baseName(card.name)}${mulliganed ? ', sent back' : drew ? ', drawn back' : ''}`
          : placeholder)
      }
      onPress={onPress}
      style={({ pressed }) => [styles.slot, { width }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.frame,
          // Width and height inline, not in the stylesheet: the rotation below
          // needs real pixels, and `aspectRatio` here would be a second source
          // of truth for the same shape.
          { width, height: artHeight },
          mulliganed && styles.frameMulliganed,
          drew && styles.frameDrew,
          dashed && styles.frameDashed,
        ]}
      >
        {card ? (
          <>
            <Image
              source={cardImage(card.imageUrl, 'thumb')}
              contentFit="cover"
              style={
                isLandscapeCard(card)
                  ? uprightArt(width, artHeight)
                  : StyleSheet.absoluteFill
              }
              cachePolicy="memory-disk"
              accessible={false}
            />
            {/*
              A dimming wash rather than a swap to a "back of card" graphic.
              The card that went back is still the card you were dealt, and
              hiding it would lose the only thing this row is recording.

              A drawn card gets **no** wash, deliberately: the row is a before
              and after, and the two states should not read as the same weight.
              What went away is dimmed; what arrived is at full strength.
            */}
            {mulliganed ? <View style={styles.wash} /> : null}
          </>
        ) : (
          <Text style={styles.glyph}>{state === 'replacement' ? '⌕' : '+'}</Text>
        )}

        {/*
          The badge carries a word as well as a colour.

          Red-versus-green is the one pairing the app has banned since M1 for
          exactly this reason — it is the most common form of colour blindness,
          and MULL against DRAW has to survive in greyscale. Same rule as the
          W/L/D letters on a result badge.
        */}
        {mulliganed || drew ? (
          <View style={styles.badge}>
            <Text style={[styles.badgeLabel, drew && styles.badgeLabelDrew]}>
              {drew ? 'DRAW' : 'MULL'}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.name, !card && styles.namePlaceholder]}
        numberOfLines={2}
      >
        {card ? baseName(card.name) : placeholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { gap: space[1] },
  frame: {
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  // The design's own values for a mulliganed slot.
  frameMulliganed: { borderColor: color.accent, backgroundColor: 'rgba(255,75,75,0.10)' },
  /*
   * The same treatment in the win green, for the card that came back.
   *
   * The design leaves a filled replacement plain — it only draws the empty,
   * dashed state. Giving it a counterpart to MULL is a deliberate addition: the
   * mulligan row is a before and an after sitting in one strip of four, and
   * with only one of them marked you have to count slots to tell which half you
   * are looking at.
   */
  frameDrew: { borderColor: color.win, backgroundColor: 'rgba(70,199,126,0.10)' },
  frameDashed: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  wash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,20,22,0.45)' },
  glyph: { ...text.body, color: color.textMuted },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(20,20,22,0.72)',
  },
  // 7px mono, per the design. Small, but it labels art rather than carrying
  // information on its own — the border and the wash say it too.
  badgeLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.2,
    // The design's `#FF8080`: `accent` lifted so it reads on the badge's own
    // dark plate rather than fighting the border it sits inside.
    color: '#FF8080',
  },
  // `win` lifted the same way and by the same amount, so the pair reads as one
  // idiom rather than two colours that happen to be nearby.
  badgeLabelDrew: { color: '#7BDBA6' },
  name: { ...text.caption, fontSize: 10, lineHeight: 12, color: color.text, textAlign: 'center' },
  namePlaceholder: { color: color.textMuted },
  pressed: { opacity: 0.75 },
});
