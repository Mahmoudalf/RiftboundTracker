import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { Pressable } from '@/components/ui/Pressable';
import type { CardRow } from '@/db/schema/cards';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

interface CardPickerSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cards: CardRow[];
  selectedId?: string | null;
  emptyMessage?: string;
  onSelect: (card: CardRow) => void;
  onClose: () => void;
}

const COLUMNS = 3;

/**
 * Full-screen picker for the one-of-a-kind slots — the Legend and the Champion.
 *
 * Those two are not stepper cards, so the rail cannot set them, and without
 * this a Legend chosen by mistake could only be undone by deleting the deck and
 * starting again.
 */
export function CardPickerSheet({
  visible,
  title,
  subtitle,
  cards,
  selectedId,
  emptyMessage,
  onSelect,
  onClose,
}: CardPickerSheetProps) {
  const insets = useSafeAreaInsets();

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
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>Done</Text>
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
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === selectedId }}
                accessibilityLabel={baseName(item.name)}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <View style={[styles.art, item.id === selectedId && styles.artSelected]}>
                  <Image
                    source={cardImage(item.imageUrl, 'thumb')}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                    cachePolicy="memory-disk"
                    accessible={false}
                  />
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {baseName(item.name)}
                </Text>
                <DomainBadge domains={item.domains} />
              </Pressable>
            )}
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
  grid: { paddingBottom: space[12] },
  tile: { flex: 1, gap: space[1.5], paddingRight: space[2], paddingBottom: space[3] },
  art: {
    width: '100%',
    aspectRatio: CARD_ASPECT,
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
