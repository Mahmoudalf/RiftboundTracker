import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import type { DeckSummary } from '@/db/queries/decks';
import { cardImage } from '@/lib/cdn';
import { deckGradient } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A deck in the list. Built from the design's own declarations:
 *
 *   height:104px · border-radius:14px · background:#1B1B1E
 *   art      left:0 width:210px background-position:50% 18%
 *            clip-path:polygon(0 0,100% 0,72% 100%,0 100%)
 *            mask-image:linear-gradient(100deg,#000 0 34%,rgba(0,0,0,.5) 62%,
 *                                       rgba(0,0,0,.12) 82%,transparent 96%)
 *   text     padding:14px 16px 14px 128px · align-items:flex-end
 *            justify-content:center · gap:7px · text-align:right
 *
 * **Deviation, stated:** React Native has neither `clip-path` nor
 * `mask-image`. The diagonal cut and the four-stop fade are approximated with
 * an angled `LinearGradient` laid over the art, using the design's own stops
 * and an end vector that leans the fade the way the 100° mask does. It reads
 * the same at this size; it is not the same technique. A faithful version needs
 * `@react-native-masked-view/masked-view`, which is not currently a dependency.
 */

const CARD_HEIGHT = 104;
const ART_WIDTH = 210;

interface DeckCardProps {
  summary: DeckSummary;
  onPress: () => void;
}

export function DeckCard({ summary, onPress }: DeckCardProps) {
  const { deck, version, legendImageUrl } = summary;
  const [from, to] = deckGradient(deck.domains);

  /*
   * The version, and nothing else.
   *
   * It used to carry the version's label too — which is auto-generated from the
   * last diff, so the list read as a wall of "−3 Statikk Shock and 1 more". That
   * is a change to *one* version, not a description of the deck, and a list of
   * decks is not the place to read patch notes.
   */
  const meta = version ? `v${version.versionNumber}` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${deck.name}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {legendImageUrl ? (
        <Image
          source={cardImage(legendImageUrl, 'card')}
          style={styles.art}
          contentFit="cover"
          // background-position:50% 18%
          contentPosition={{ top: '18%', left: '50%' }}
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : (
        <View style={styles.art}>
          <LinearGradient
            colors={[from, to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.plateText}>
            <Text style={styles.initials}>{initials(deck.name)}</Text>
            <Text style={styles.plateLabel}>Legend art</Text>
          </View>
        </View>
      )}

      {/* The mask's stops, as an overlay: 34% clear, .5 at 62%, .12 at 82%,
          gone by 96%. Angled down-right to lean like the 100° original. */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(27,27,30,0.5)',
          'rgba(27,27,30,0.88)',
          color.surface,
        ]}
        locations={[0.34, 0.62, 0.82, 0.96]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.32 }}
        style={styles.art}
      />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {deck.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** The plate's fallback mark when a deck has no Legend art. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  root: {
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.82 },
  art: { position: 'absolute', left: 0, top: 0, width: ART_WIDTH, height: CARD_HEIGHT },
  plateText: {
    position: 'absolute',
    left: space[4],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: space[1],
  },
  initials: {
    ...text.title,
    fontSize: 20,
    letterSpacing: -0.4,
    color: 'rgba(245,245,246,0.4)',
  },
  plateLabel: { ...text.microMeta, fontSize: 8.5, color: 'rgba(156,156,161,0.5)' },

  // padding:14px 16px 14px 128px · align-items:flex-end · justify-content:center
  body: {
    flex: 1,
    paddingTop: 14,
    paddingRight: space[4],
    paddingBottom: 14,
    paddingLeft: 128,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
  },
  name: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    lineHeight: 18,
    color: color.text,
    textAlign: 'right',
  },
  meta: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: color.textFaint,
    textAlign: 'right',
  },
});
