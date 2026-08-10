import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { BinderTile } from '@/components/collection/BinderTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { queryCards, type CardSort } from '@/db/queries/cards';
import {
  adjustCardQuantity,
  binderQuantities,
  listBinders,
  missingFromLibrary,
  ownedFinishes,
  setCompletion,
  type FinishCounts,
} from '@/db/queries/collection';
import type { CardRow } from '@/db/schema/cards';
import { useCardFilters } from '@/features/cards/useCardFilters';
import { useCardSync } from '@/features/sync/useCardSync';
import { finishLabel, finishesFor, supportsFinish, type Finish } from '@/lib/finishes';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * A binder, or the library itself.
 *
 * `/binder/gallery` is the whole card library — a reference you skim, with no
 * binder to file into. Every other id is a binder, and the difference is
 * whether a tile has a `− count +` row under it.
 *
 * Ownership lives in binders, never in the library, so the Gallery route is
 * deliberately read-only rather than filing into a hidden default. A number you
 * can change needs somewhere for the change to live.
 */

const COLUMNS = 3;
const GAP = space[3];
const BODY_PAD = space[4];

const SORTS: { value: CardSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'collector', label: 'Collector number' },
  { value: 'energy', label: 'Energy' },
  { value: 'rarity', label: 'Rarity' },
];

type Field = 'set' | 'sort' | null;

export default function BinderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  /* 'gallery' is the whole library rather than a binder, so the list can link
     to it without inventing a row in the database for it. */
  const binderId = id === 'gallery' ? null : (id ?? null);

  const { width } = useWindowDimensions();
  const { cardCount, isSyncing } = useCardSync();
  const filters = useCardFilters();

  const [held, setHeld] = useState<Map<string, FinishCounts>>(new Map());
  const [owned, setOwned] = useState<Map<string, FinishCounts>>(new Map());
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState<Field>(null);
  const [detail, setDetail] = useState<CardRow | null>(null);

  const load = useCallback(() => {
    setOwned(ownedFinishes());
    if (binderId) {
      setHeld(binderQuantities(binderId));
      setName(listBinders().find((b) => b.id === binderId)?.name ?? null);
    }
  }, [binderId]);

  useFocusEffect(load);

  // cardCount is the resync signal, not a value read here: a new set arrives
  // with new cards and nothing else tells this it changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sets = useMemo(() => setCompletion(), [cardCount]);

  const query = useMemo(
    () => filters.toQuery(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.search,
      filters.sets,
      filters.types,
      filters.domains,
      filters.rarities,
      filters.energy,
      filters.hideAlternateArt,
      filters.sort,
      cardCount,
    ]
  );

  const cards = useMemo(() => queryCards(query), [query]);

  /** Cards filed here that the library can no longer draw. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const missing = useMemo(() => (binderId ? missingFromLibrary(binderId) : []), [binderId, cardCount]);

  const cellWidth = (width - BODY_PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const adjust = (card: CardRow, delta: number, finish: Finish = 'standard') => {
    if (!binderId) return;
    // A foil-only printing takes its foil row instead — a plus that silently
    // did nothing would read as a broken button.
    const target = supportsFinish(card, finish) ? finish : finishesFor(card)[0]!;
    adjustCardQuantity(binderId, card, delta, target);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    load();
  };

  const setLabel =
    filters.sets.length === 0
      ? 'All'
      : filters.sets.length === 1
        ? (sets.find((s) => s.setId === filters.sets[0])?.label ?? filters.sets[0]!)
        : `${filters.sets.length} sets`;

  const sortLabel = SORTS.find((s) => s.value === filters.sort)?.label ?? 'Relevance';
  const detailCounts = detail ? held.get(detail.id) : undefined;

  return (
    <Screen
      title={binderId ? (name ?? 'Binder') : 'Gallery'}
      meta={metaLine(
        `${cards.length.toLocaleString()} shown`,
        binderId ? null : `${cardCount.toLocaleString()} in library`,
        isSyncing ? 'syncing' : null
      )}
    >
      <View style={styles.controls}>
        <View style={styles.search}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            value={filters.search}
            onChangeText={filters.setSearch}
            placeholder="Search name, text or keyword"
            placeholderTextColor={color.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search the card library"
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <SelectField
              compact
              placeholder="Set"
              value={`Set · ${setLabel}`}
              open={open === 'set'}
              onToggle={() => setOpen((f) => (f === 'set' ? null : 'set'))}
            >
              <OptionRow
                label="All sets"
                selected={filters.sets.length === 0}
                onPress={() => {
                  // Clearing is a toggle of everything currently on, so the
                  // store stays the single source of what is filtered.
                  filters.sets.forEach((s) => filters.toggle('sets', s));
                  setOpen(null);
                }}
              />
              {sets.map((set) => (
                <OptionRow
                  key={set.setId}
                  label={set.label}
                  meta={`${set.total}`}
                  selected={filters.sets.includes(set.setId)}
                  onPress={() => filters.toggle('sets', set.setId)}
                />
              ))}
            </SelectField>
          </View>

          <View style={styles.field}>
            <SelectField
              compact
              placeholder="Sort"
              value={`Sort · ${sortLabel}`}
              open={open === 'sort'}
              onToggle={() => setOpen((f) => (f === 'sort' ? null : 'sort'))}
            >
              {SORTS.map((sort) => (
                <OptionRow
                  key={sort.value}
                  label={sort.label}
                  selected={filters.sort === sort.value}
                  onPress={() => {
                    filters.setSort(sort.value);
                    setOpen(null);
                  }}
                />
              ))}
            </SelectField>
          </View>
        </View>

        <View style={styles.domains}>
          {PLAYABLE_DOMAINS.map((domain) => {
            const on = filters.domains.includes(domain);
            return (
              <Pressable
                key={domain}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={domain}
                onPress={() => filters.toggle('domains', domain)}
                style={({ pressed }) => [
                  styles.domain,
                  on && {
                    backgroundColor: domainColor(domain).base,
                    borderColor: domainColor(domain).base,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.domainLabel, on && styles.domainLabelOn]} numberOfLines={1}>
                  {domain}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint} numberOfLines={2}>
          {binderId
            ? 'Tap a card to add or remove copies · foils show their sheen'
            : 'The library, every card in it. File copies into a binder to track what you own.'}
        </Text>
      </View>

      <FlashList
        data={cards}
        numColumns={COLUMNS}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title={isSyncing ? 'Still downloading' : 'Nothing matches'}
            body={
              isSyncing
                ? 'The card library is still coming down. What has arrived is already searchable.'
                : 'No card in the library matches those filters.'
            }
          />
        }
        ListFooterComponent={
          missing.length > 0 ? (
            <View style={styles.missing}>
              <SectionLabel>Not in the library</SectionLabel>
              {/* Owned, counted, and unrenderable — named so the copy count
                  above cannot look wrong. */}
              {missing.map((row) => (
                <Text key={row.name} style={styles.missingRow}>
                  {row.quantity}× {row.name}
                </Text>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          // In a binder, what is filed here. In the Gallery, what you own
          // anywhere — the same question asked of a different scope.
          const counts = binderId ? held.get(item.id) : owned.get(item.id);
          return (
            <View style={[styles.cell, index % COLUMNS !== COLUMNS - 1 && styles.cellGap]}>
              <BinderTile
                card={item}
                width={cellWidth}
                count={counts?.total ?? 0}
                foiled={(counts?.foil ?? 0) > 0}
                onOpen={(card) =>
                  binderId ? setDetail(card) : router.push(`/card/${card.id}`)
                }
              />
            </View>
          );
        }}
      />

      {/*
        The split, where the two numbers can be told apart.
        *
        The tile shows one total because that is what "how many do I have" means
        at a glance. Which of them are foil is a different question, and it gets
        its own surface rather than a toggle that silently changes what every
        plus on the screen does.
      */}
      <Sheet
        visible={detail !== null}
        title={detail?.name ?? ''}
        subtitle={
          detail
            ? metaLine(detail.setId, detail.rarity, `${detailCounts?.total ?? 0} in this binder`)
            : undefined
        }
        onClose={() => setDetail(null)}
        actions={
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetail(null)}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        }
      >
        {detail
          ? (['standard', 'foil'] as Finish[]).map((finish) => {
              const printed = supportsFinish(detail, finish);
              const n = detailCounts?.[finish] ?? 0;
              return (
                <View key={finish} style={styles.finishRow}>
                  <View style={styles.finishText}>
                    <Text style={styles.finishName}>{finishLabel(finish)}</Text>
                    <Text style={styles.finishNote}>
                      {printed
                        ? finish === 'foil'
                          ? 'Counted in the same total'
                          : 'Regular printing'
                        : 'Not printed in this finish'}
                    </Text>
                  </View>

                  <View style={styles.finishStepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove a ${finishLabel(finish)} copy`}
                      disabled={!printed || n === 0}
                      onPress={() => adjust(detail, -1, finish)}
                      style={({ pressed }) => [
                        styles.finishStep,
                        (!printed || n === 0) && styles.finishStepOff,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.stepGlyph}>−</Text>
                    </Pressable>
                    <Text style={styles.finishCount}>{printed ? n : '—'}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add a ${finishLabel(finish)} copy`}
                      disabled={!printed}
                      onPress={() => adjust(detail, 1, finish)}
                      style={({ pressed }) => [
                        styles.finishStep,
                        !printed && styles.finishStepOff,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.stepGlyph}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: BODY_PAD, paddingBottom: space[3], gap: space[2] },

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
  searchInput: { ...text.small, color: color.text, flex: 1, padding: 0 },

  fieldRow: { flexDirection: 'row', gap: space[2], zIndex: 2 },
  field: { flex: 1 },

  domains: { flexDirection: 'row', gap: 4 },
  domain: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  domainLabel: { ...text.caption, fontSize: 10, color: color.textSecondary },
  domainLabelOn: { color: color.bg },
  pressed: { opacity: 0.7 },

  hint: { ...text.microMeta, fontSize: 10.5, color: color.textFaint },

  grid: { paddingHorizontal: BODY_PAD, paddingBottom: space[16] },
  cell: { paddingBottom: space[4] },
  cellGap: { paddingRight: GAP },

  missing: { gap: space[1], paddingTop: space[4] },
  missingRow: { ...text.microMeta, color: color.textMuted },

  finishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  finishText: { flex: 1 },
  finishName: { ...text.smallMedium, color: color.text },
  finishNote: { ...text.caption, fontSize: 10.5, color: color.textFaint },
  finishStepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  finishStep: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  finishStepOff: { opacity: 0.35 },
  stepGlyph: { ...text.body, fontSize: 18, color: color.text },
  finishCount: { ...text.numeric, fontSize: 14, color: color.text, width: 26, textAlign: 'center' },

  done: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { ...text.bodyMedium, color: color.onAccent },
});
