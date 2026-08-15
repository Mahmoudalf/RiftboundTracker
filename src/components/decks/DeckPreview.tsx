import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { ViewToggle, type DeckView } from '@/components/ui/ViewToggle';
import { useT, type Key } from '@/i18n';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import type { DeckSlot } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The deck, read-only, in list or gallery.
 *
 * Read-only is the whole point: this is for looking at what you built before
 * committing to it. Steppers here would invite editing on a screen whose job is
 * to be the last honest look at the list.
 */

const ZONES = [
  { zone: 'legend', label: 'zone.legend' },
  { zone: 'champion', label: 'zone.champion' },
  { zone: 'main', label: 'zone.main' },
  { zone: 'rune', label: 'zone.runes' },
  { zone: 'battlefield', label: 'zone.battlefields' },
  { zone: 'sideboard', label: 'zone.sideboard' },
] as const satisfies readonly { zone: string; label: Key }[];

export function DeckPreview({ slots }: { slots: readonly DeckSlot[] }) {
  const t = useT();
  const [view, setView] = useState<DeckView>('list');

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.headLabel}>{t('deckPreview.yourDeck')}</Text>
        <ViewToggle value={view} onChange={setView} />
      </View>

      {ZONES.map(({ zone, label }) => {
        const zoneSlots = slots.filter((s) => s.zone === zone);
        if (zoneSlots.length === 0) return null;
        const count = zoneSlots.reduce((n, s) => n + s.quantity, 0);

        return (
          <View key={zone} style={styles.zone}>
            <View style={styles.zoneHead}>
              <Text style={styles.zoneLabel}>{label}</Text>
              <Text style={styles.zoneCount}>{count}</Text>
            </View>

            {view === 'list' ? (
              zoneSlots.map((slot) => (
                <DeckSlotRow
                  key={`${slot.zone}:${slot.card.id}`}
                  slot={slot}
                  fixed={zone === 'legend' || zone === 'champion'}
                  onPress={() => undefined}
                />
              ))
            ) : (
              <View style={styles.gallery}>
                {zoneSlots.map((slot) => {
                  const landscape = isLandscapeCard(slot.card);
                  return (
                    <View key={`${slot.zone}:${slot.card.id}`} style={styles.tile}>
                      <Image
                        source={{ uri: cardImage(slot.card.imageUrl) }}
                        style={landscape ? uprightArt(74, 103) : styles.art}
                        contentFit="cover"
                        contentPosition={landscape ? 'center' : { top: '18%', left: '50%' }}
                        transition={120}
                        accessibilityLabel={`${baseName(slot.card.name)}, ${slot.quantity} in deck`}
                      />
                      {slot.quantity > 1 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{slot.quantity}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLabel: { ...text.microMeta, color: color.textFaint },
  /* The toggle's own styles moved into `ViewToggle`, which now owns this
     control everywhere it appears. */

  zone: { gap: space[1] },
  zoneHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.borderSubtle,
  },
  zoneLabel: { ...text.meta, color: color.textSecondary },
  zoneCount: { ...text.numeric, fontSize: 13, color: color.textMuted },

  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingTop: space[2] },
  tile: { width: 74, height: 103, borderRadius: 6, overflow: 'hidden', backgroundColor: color.raised },
  art: { flex: 1, width: '100%' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,11,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.numeric, fontSize: 11, color: color.text },
});
