import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BinderRow } from '@/components/collection/BinderRow';
import { BinderSheet } from '@/components/collection/BinderSheet';
import { SetProgress } from '@/components/collection/SetProgress';
import { SectionLabel } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
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
import { useT } from '@/i18n';
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
  const t = useT();
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
    <Screen title={t('collection.title')} back={false}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/*
          A way in, not a field.

          There is nothing on this screen to search — the cards are one tap
          away, so this opens the library with the keyboard up rather than
          filtering a list of four binders.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('collection.searchLibrary')}
          onPress={() => router.push('/binder/gallery')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Icon name="search" size={15} color={color.textFaint} />
          <Text style={styles.searchLabel} numberOfLines={1}>
            {cardCount > 0
              ? t('collection.searchCount', { count: cardCount.toLocaleString() })
              : t('collection.searchPlain')}
          </Text>
        </Pressable>

        {/*
          Copies held, how much of the library that covers, and where those
          copies sit — one card, because they are one thought.

          The per-set bars used to be their own `By set` section below this. They
          are the breakdown *of this number*: the headline says you hold 214
          copies and the bars say which sets they came out of. Split across two
          blocks with a heading between them, the reader had to work out that
          relationship; together, the card answers "how am I doing" from the top
          down.

          The line under the total is gone with it. It read *"Counted from what
          you marked owned, not from your decks."* — a caveat about provenance,
          on a screen called Collection, where there is nothing else the number
          could have been counted from.
        */}
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.total}>{copies.toLocaleString()}</Text>
            <Text style={styles.totalMeta}>
              {t('collection.copies')} ·{' '}
              {t('collection.distinctOf', {
                distinct: distinct.toLocaleString(),
                total: cardCount.toLocaleString(),
              })}
            </Text>
          </View>

          {/* The one caveat that survives, and only while it is true: a total
              counted against a library still arriving is a moving target. */}
          {isSyncing ? (
            <Text style={styles.summaryNote}>{t('collection.stillDownloading')}</Text>
          ) : null}

          {sets.length > 0 ? (
            <View style={styles.summarySets}>
              <SetProgress sets={sets} />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.bindersHead}>
            <SectionLabel>{t('collection.binders')}</SectionLabel>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('binder.new')}
              onPress={() => setNaming(true)}
              style={({ pressed }) => [styles.newBinder, pressed && styles.pressed]}
            >
              <Text style={styles.newBinderLabel}>{t('collection.newBinder')}</Text>
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
              name={t('collection.gallery')}
              isDefault
              subtitle={t('collection.galleryRow', { copies: copies.toLocaleString() })}
              onPress={() => router.push('/binder/gallery')}
            />

            {binders.map((binder) => (
              <BinderRow
                key={binder.id}
                name={binder.name}
                subtitle={
                  binder.totalCards > 0
                    ? t('collection.binderRow', {
                        distinct: binder.distinctCards.toLocaleString(),
                        copies: binder.totalCards.toLocaleString(),
                      })
                    : t('collection.binderEmpty')
                }
                onPress={() => router.push(`/binder/${binder.id}`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <BinderSheet
        visible={naming}
        onClose={() => setNaming(false)}
        onSave={(name) => {
          // Straight into it: a binder you just named is empty, and the next
          // thing anyone wants is to put something in it.
          const id = createBinder({ name });
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
  /**
   * The set bars, inside the card that owns the number they break down.
   *
   * A hairline above them rather than a heading: they are the same thought
   * continued, and a `By set` label here would put back the seam this move was
   * meant to close.
   */
  summarySets: {
    marginTop: space[4],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },

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
