import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { loadDeckList } from '@/db/queries/decks';
import { useT } from '@/i18n';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { deal, draw, mulligan, MULLIGAN_LIMIT, type GoldfishCard } from '@/lib/goldfish';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Goldfishing — drawing sample hands with no opponent.
 *
 * The question it answers is "do my opening cards work together", so the
 * screen is the hand and almost nothing else. Turn structure and Rune
 * channelling were built here first and taken back out: without an opponent, a
 * board, or anything to spend Runes on, they produced numbers that looked like
 * information and were not.
 *
 * **Design gap, stated:** the Hi-Fi design has no goldfish screen. This is
 * assembled from the shared vocabulary — section labels, pill actions, the
 * gallery's card proportions — rather than invented in a new one.
 */

const COLUMNS = 4;
const GAP = space[2];

export default function GoldfishScreen() {
  const t = useT();
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const { width } = useWindowDimensions();

  const list = useMemo(() => (versionId ? loadDeckList(versionId) : { slots: [] }), [versionId]);
  const mainCount = list.slots
    .filter((s) => s.zone === 'main')
    .reduce((n, s) => n + s.quantity, 0);

  /*
   * The seed *is* the hand: the same number always deals the same cards, which
   * is what lets a test pin one and a player return to the opener they were
   * looking at.
   *
   * The first one is random, though. Fixing it at 1 meant every visit to this
   * screen opened on the identical four cards — reproducible, and useless, since
   * the whole question is what a *typical* opener looks like.
   */
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1_000_000));
  const [state, setState] = useState(() => deal(list, seed));
  const [picked, setPicked] = useState<string[]>([]);

  const redraw = (nextSeed: number) => {
    setSeed(nextSeed);
    setState(deal(list, nextSeed));
    setPicked([]);
  };

  const cellWidth = (width - space[4] * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  if (mainCount === 0) {
    return (
      <Screen title={t('goldfish.title')}>
        <EmptyState
          title={t('goldfish.nothing')}
          body={t('goldfish.nothing.body')}
          actions={[{ label: t('common.back'), onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const canMulligan = !state.mulliganed;

  return (
    <Screen
      title={t('goldfish.title')}
      meta={metaLine(`seed ${seed}`, `${state.hand.length} in hand`, `${state.deck.length} left`)}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionLabel>{canMulligan ? 'Opening hand' : 'Hand'}</SectionLabel>
          {canMulligan ? (
            <Text style={styles.hint}>
              Tap up to {MULLIGAN_LIMIT} to recycle. They go to the bottom of the deck and can come
              back later — they are not removed.
            </Text>
          ) : null}

          <View style={styles.grid}>
            {state.hand.map((entry) => (
              <HandCard
                key={entry.key}
                entry={entry}
                width={cellWidth}
                selected={picked.includes(entry.key)}
                selectable={canMulligan}
                onPress={() =>
                  setPicked((current) =>
                    current.includes(entry.key)
                      ? current.filter((k) => k !== entry.key)
                      : current.length >= MULLIGAN_LIMIT
                        ? current
                        : [...current, entry.key]
                  )
                }
              />
            ))}
          </View>
        </View>

        {canMulligan ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                picked.length === 0 ? 'Keep this hand' : `Recycle ${picked.length}`
              }
              onPress={() => {
                setState(mulligan(state, picked));
                setPicked([]);
              }}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>
                {picked.length === 0 ? 'Keep this hand' : `Recycle ${picked.length} and draw`}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('goldfish.draw.a11y')}
              disabled={state.deck.length === 0}
              onPress={() => setState(draw(state))}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>{t('goldfish.draw')}</Text>
            </Pressable>
          </View>
        )}

        {state.deck.length === 0 ? (
          <Text style={styles.hint}>{t('goldfish.empty')}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('goldfish.reshuffle.a11y')}
          onPress={() => redraw(seed + 1)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>{t('goldfish.reshuffle')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function HandCard({
  entry,
  width,
  selected,
  selectable,
  onPress,
}: {
  entry: GoldfishCard;
  width: number;
  selected: boolean;
  selectable: boolean;
  onPress: () => void;
}) {
  const height = Math.round((width * 154) / 110);
  const landscape = isLandscapeCard(entry.card);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={metaLine(baseName(entry.card.name), selected ? 'to recycle' : null)}
      disabled={!selectable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { width, height },
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: cardImage(entry.card.imageUrl) }}
        style={landscape ? uprightArt(width, height) : styles.art}
        contentFit="cover"
        contentPosition={landscape ? 'center' : { top: '18%', left: '50%' }}
        transition={120}
      />
      {selected ? (
        <View style={styles.mark}>
          <Text style={styles.markGlyph}>↓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[16], gap: space[5] },

  section: { gap: space[2] },
  hint: { ...text.caption, fontSize: 11, color: color.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: space[1] },

  card: { borderRadius: 6, overflow: 'hidden', backgroundColor: color.raised },
  cardSelected: { borderWidth: 2, borderColor: color.accent },
  art: { flex: 1, width: '100%' },
  mark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { ...text.caption, fontSize: 11, color: color.onAccent },

  actions: { gap: space[2] },
  primary: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
  secondary: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...text.smallMedium, color: color.textSecondary },
  pressed: { opacity: 0.75 },

});
