import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BinderRow } from '@/components/collection/BinderRow';
import { BinderSheet } from '@/components/collection/BinderSheet';
import { SetProgress } from '@/components/collection/SetProgress';
import { SectionLabel } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  collapsePromotional,
  createBinder,
  listBinders,
  ownedCounts,
  setCompletion,
  type Binder,
  type SetCompletion,
} from '@/db/queries/collection';
import { useCardSync } from '@/features/sync/useCardSync';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Collection — what you own, and where you keep it.
 *
 * This screen answers "how am I doing" and nothing else. It used to be the
 * library itself, with a binder rail across the top deciding what a tap meant;
 * the design splits that in two, and the split is the point. Browsing 1,451
 * cards and reviewing a collection are different activities that happened to
 * share a grid, and sharing it meant the collection had no summary at all —
 * only a filter over the library.
 *
 * The library now lives one tap away, at `/binder/gallery`, and every binder is
 * the same screen pointed at a different row.
 */

export default function CollectionScreen() {
  const { cardCount, isSyncing } = useCardSync();

  const [binders, setBinders] = useState<Binder[]>([]);
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [sets, setSets] = useState<SetCompletion[]>([]);
  const [naming, setNaming] = useState(false);

  const load = useCallback(() => {
    setBinders(listBinders());
    setOwned(ownedCounts());
    setSets(collapsePromotional(setCompletion()));
  }, []);

  useFocusEffect(load);

  const { copies, distinct } = useMemo(() => {
    let copies = 0;
    for (const n of owned.values()) copies += n;
    // Distinct is the map's size, not a second query: the two numbers must come
    // from one source or they will eventually disagree by one.
    return { copies, distinct: owned.size };
  }, [owned]);

  return (
    <Screen title="Collection" back={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/*
          A way in, not a field.

          There is nothing on this screen to search — the cards are one tap
          away, so this opens the library with the keyboard up rather than
          filtering a list of four binders.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search the card library"
          onPress={() => router.push('/binder/gallery')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Text style={styles.searchGlyph}>⌕</Text>
          <Text style={styles.searchLabel} numberOfLines={1}>
            {cardCount > 0
              ? `Search ${cardCount.toLocaleString()} cards — offline`
              : 'Search the library'}
          </Text>
        </Pressable>

        {/* The headline pair: copies held, and how much of the library that
            covers. Both are counted from what you marked owned — decks are a
            different question, answered on the deck. */}
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.total}>{copies.toLocaleString()}</Text>
            <Text style={styles.totalMeta}>
              copies · {distinct.toLocaleString()} of {cardCount.toLocaleString()} cards
            </Text>
          </View>
          <Text style={styles.summaryNote}>
            {isSyncing
              ? 'Counted from what you marked owned. The library is still downloading, so the total will grow.'
              : 'Counted from what you marked owned, not from your decks.'}
          </Text>
        </View>

        {sets.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>By set</SectionLabel>
            <SetProgress sets={sets} />
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.bindersHead}>
            <SectionLabel>Binders</SectionLabel>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New binder"
              onPress={() => setNaming(true)}
              style={({ pressed }) => [styles.newBinder, pressed && styles.pressed]}
            >
              <Text style={styles.newBinderLabel}>New binder</Text>
            </Pressable>
          </View>

          <View style={styles.binderList}>
            {/*
              Gallery is not a binder and is never in the list from the database.
              It is the library itself, offered in the same shape so the way in
              is the same gesture — and bordered rather than filled, so it reads
              as the one that was always there.
            */}
            <BinderRow
              name="Gallery"
              isDefault
              subtitle={`Every card in the library · ${copies.toLocaleString()} copies owned`}
              onPress={() => router.push('/binder/gallery')}
            />

            {binders.map((binder) => (
              <BinderRow
                key={binder.id}
                name={binder.name}
                subtitle={
                  binder.totalCards > 0
                    ? `${binder.distinctCards.toLocaleString()} cards · ${binder.totalCards.toLocaleString()} copies`
                    : 'Empty — nothing filed here yet'
                }
                onPress={() => router.push(`/binder/${binder.id}`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <BinderSheet
        visible={naming}
        binder={null}
        onClose={() => setNaming(false)}
        onSave={(name, accent) => {
          // Straight into it: a binder you just named is empty, and the next
          // thing anyone wants is to put something in it.
          const id = createBinder({ name, accent });
          setNaming(false);
          load();
          router.push(`/binder/${id}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space[16], gap: space[6] },

  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: space[3],
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchGlyph: { ...text.small, color: color.textFaint },
  searchLabel: { ...text.small, color: color.textFaint, flex: 1 },

  summary: {
    borderRadius: radius.card,
    backgroundColor: color.surface,
    padding: space[4],
  },
  summaryHead: { flexDirection: 'row', alignItems: 'baseline', gap: space[3] },
  total: { ...text.display, fontSize: 28, color: color.text },
  totalMeta: { ...text.numeric, fontSize: 13, color: color.textMuted, flexShrink: 1 },
  summaryNote: { ...text.caption, fontSize: 11, color: color.textFaint, marginTop: 6 },

  section: { gap: space[3] },
  bindersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBinder: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  newBinderLabel: { ...text.smallMedium, fontSize: 12, color: color.onAccent },
  pressed: { opacity: 0.7 },

  binderList: { gap: space[2] },
});
