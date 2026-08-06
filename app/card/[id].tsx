import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { getCard } from '@/db/queries/cards';
import { cardImage, cardImageBlur } from '@/lib/cdn';
import { CARD_ASPECT, color, radius, space, spring } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Card detail.
 *
 * The art is the content, so it opens full-bleed and pinch-zoomable; everything
 * else is set below it in the card's own metadata idiom.
 */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const card = id ? getCard(id) : null;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.05) {
        scale.value = withSpring(1, spring.default);
        savedScale.value = 1;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.05 ? 1 : 2.5;
      scale.value = withSpring(next, spring.default);
      savedScale.value = next;
    });

  const artStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!card) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState
          title="Card not found"
          body="It may have been removed from the card library. Refreshing the library in Settings usually fixes this."
          actions={[{ label: 'Go back', onPress: () => router.back(), primary: true }]}
        />
      </View>
    );
  }

  const artWidth = width;
  const artHeight =
    card.orientation === 'landscape' ? artWidth * CARD_ASPECT : artWidth / CARD_ASPECT;

  const stats = [
    card.energy !== null ? { label: 'Energy', value: card.energy } : null,
    card.might !== null ? { label: 'Might', value: card.might } : null,
    card.power !== null ? { label: 'Power', value: card.power } : null,
  ].filter((s): s is { label: string; value: number } => s !== null);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
          <View style={[styles.artFrame, { height: artHeight }]}>
            <Animated.View style={[styles.artInner, artStyle]}>
              <Image
                source={cardImage(card.imageUrl, 'full')}
                placeholder={cardImageBlur(card.imageUrl)}
                placeholderContentFit="cover"
                contentFit="contain"
                transition={180}
                cachePolicy="memory-disk"
                style={styles.art}
                accessibilityLabel={card.accessibilityText ?? card.name}
              />
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={styles.name}>{card.name}</Text>
              <Text style={styles.typeLine}>
                {metaLine(card.supertype, card.type, card.rarity)}
              </Text>
            </View>
            <DomainBadge domains={card.domains} size="md" />
          </View>

          {stats.length > 0 ? (
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {card.textPlain ? (
            <View style={styles.rulesBox}>
              <Text style={styles.rules}>{card.textPlain}</Text>
            </View>
          ) : null}

          {card.flavour ? <Text style={styles.flavour}>{card.flavour}</Text> : null}

          {card.tags.length > 0 ? (
            <View style={styles.tags}>
              {card.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* The card's own footer line, reused verbatim as the app's metadata idiom. */}
          <Text style={styles.footer}>
            {metaLine(
              card.setId,
              card.collectorNumber !== null ? String(card.collectorNumber).padStart(3, '0') : null,
              card.artist
            )}
          </Text>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + space[2] },
          pressed && styles.pressed,
        ]}
      >
        <Icon name="close" size={20} color={color.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  artFrame: { width: '100%', overflow: 'hidden', backgroundColor: color.surface },
  artInner: { flex: 1 },
  art: { flex: 1, width: '100%' },

  body: { padding: space[4], gap: space[4] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  titleText: { flex: 1, gap: space[1] },
  name: { ...text.title, color: color.text },
  typeLine: { ...text.meta, color: color.textMuted },

  stats: { flexDirection: 'row', gap: space[3] },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[3],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    gap: space[0.5],
  },
  statValue: { ...text.numeric, fontSize: 22, lineHeight: 26, color: color.text },
  statLabel: { ...text.microMeta, color: color.textMuted },

  rulesBox: {
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
  },
  rules: { ...text.body, color: color.text },
  flavour: { ...text.small, color: color.textMuted, fontStyle: 'italic' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  tag: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  tagText: { ...text.caption, color: color.textSecondary },

  footer: { ...text.microMeta, color: color.textFaint, paddingTop: space[2] },

  close: {
    position: 'absolute',
    right: space[4],
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.scrim,
  },
  pressed: { opacity: 0.7 },
});
