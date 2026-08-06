import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { Pressable } from '@/components/ui/Pressable';
import type { DeckSummary } from '@/db/queries/decks';
import { deckGradient } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

interface DeckCardProps {
  summary: DeckSummary;
  onPress: () => void;
}

/**
 * A deck in the list.
 *
 * The gradient is derived from the Legend's domains, so a deck is recognisable
 * before its name is read — the thing that makes a list of six Vi decks
 * navigable. It is decoration on its own, though, so the domain badge carries
 * the same information in a form that survives colorblindness.
 */
export function DeckCard({ summary, onPress }: DeckCardProps) {
  const { deck, version, versionCount } = summary;
  const [from, to] = deckGradient(deck.domains);

  const meta = metaLine(
    version ? `v${version.versionNumber}` : null,
    versionCount > 1 ? `${versionCount} versions` : null,
    version ? `${version.mainCount}/40` : null,
    version?.isLegal ? 'Legal' : 'Incomplete'
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${deck.name}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.accent}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {deck.name}
          </Text>
          <DomainBadge domains={deck.domains} />
        </View>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: 'hidden',
    minHeight: 72,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  accent: { width: 6 },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: space[1],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  name: { ...text.subtitle, color: color.text, flex: 1 },
  meta: { ...text.meta, color: color.textMuted },
});
