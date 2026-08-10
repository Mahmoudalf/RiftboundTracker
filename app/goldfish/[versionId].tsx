import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { loadDeckList } from '@/db/queries/decks';
import { isLandscapeCard, uprightArt } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import {
  deal,
  mulligan,
  MULLIGAN_LIMIT,
  runesForTurn,
  takeTurn,
  type GoldfishCard,
} from '@/lib/goldfish';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Goldfishing — drawing sample hands with no opponent.
 *
 * The question it answers is "does this deck function", which is a question
 * about openers: how often the four cards you start with let you do anything.
 * So the screen leads with the hand and keeps everything else to a line of
 * numbers.
 *
 * **Design gap, stated:** the Hi-Fi design has no goldfish screen. This is
 * assembled from the shared vocabulary — section labels, pill actions, the
 * gallery's card proportions — rather than invented in a new one.
 */

const COLUMNS = 4;
const GAP = space[2];

export default function GoldfishScreen() {
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const { width } = useWindowDimensions();

  const list = useMemo(() => (versionId ? loadDeckList(versionId) : { slots: [] }), [versionId]);
  const mainCount = list.slots
    .filter((s) => s.zone === 'main')
    .reduce((n, s) => n + s.quantity, 0);

  /* The seed *is* the hand. Bumping it is what "draw again" means, and it keeps
     any hand reproducible — you can go back to the one you were looking at. */
  const [seed, setSeed] = useState(1);
  const [onDraw, setOnDraw] = useState(false);
  const [state, setState] = useState(() => deal(list, 1, false));
  const [picked, setPicked] = useState<string[]>([]);

  const redraw = (nextSeed: number, nextOnDraw = onDraw) => {
    setSeed(nextSeed);
    setState(deal(list, nextSeed, nextOnDraw));
    setPicked([]);
  };

  const cellWidth = (width - space[4] * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  if (mainCount === 0) {
    return (
      <Screen title="Test hand">
        <EmptyState
          title="Nothing to draw"
          body="This version has no main deck yet, so there is no hand to open on. Add cards and come back."
          actions={[{ label: 'Back', onPress: () => router.back(), primary: true }]}
        />
      </Screen>
    );
  }

  const canMulligan = !state.mulliganed;

  return (
    <Screen
      title="Test hand"
      meta={metaLine(
        `seed ${seed}`,
        state.turn === 0 ? 'opening hand' : `turn ${state.turn}`,
        onDraw ? 'on the draw' : 'on the play'
      )}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Who is on the play changes the first channel, so it is a setting of
            the simulation rather than a control inside it. */}
        <View style={styles.turnOrder}>
          {[false, true].map((draw) => (
            <Pressable
              key={String(draw)}
              accessibilityRole="button"
              accessibilityState={{ selected: onDraw === draw }}
              onPress={() => {
                setOnDraw(draw);
                redraw(seed, draw);
              }}
              style={({ pressed }) => [
                styles.turnOption,
                onDraw === draw && styles.turnOptionOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.turnLabel, onDraw === draw && styles.turnLabelOn]}>
                {draw ? 'On the draw' : 'On the play'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <SectionLabel>
            {state.turn === 0 ? 'Opening hand' : `Hand · ${state.hand.length}`}
          </SectionLabel>
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
              accessibilityLabel="Take the next turn"
              onPress={() => setState(takeTurn(state))}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>
                Turn {state.turn + 1} · channel {runesForTurn(state.turn + 1, onDraw)}, draw 1
              </Text>
            </Pressable>
          </View>
        )}

        {/* The board, as numbers. Runes are a resource count, not a thing you
            need to look at the art of. */}
        <View style={styles.section}>
          <SectionLabel>Board</SectionLabel>
          <View style={styles.counts}>
            <Count label="Runes channelled" value={state.runes.length} />
            <Count label="Rune deck" value={state.runeDeck.length} />
            <Count label="Main deck" value={state.deck.length} />
          </View>
          {state.deck.length === 0 ? (
            <Text style={styles.hint}>The main deck is empty — every card is in hand.</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shuffle up and deal a new hand"
          onPress={() => redraw(seed + 1)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Shuffle up and deal again</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
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

  turnOrder: { flexDirection: 'row', gap: space[2] },
  turnOption: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  turnOptionOn: { backgroundColor: color.accent, borderColor: color.accent },
  turnLabel: { ...text.smallMedium, fontSize: 12, color: color.textSecondary },
  turnLabelOn: { color: color.onAccent },

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

  counts: { flexDirection: 'row', gap: space[2] },
  count: {
    flex: 1,
    gap: 2,
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  countValue: { ...text.stat, color: color.text },
  countLabel: { ...text.microMeta, fontSize: 9, color: color.textFaint },
});
