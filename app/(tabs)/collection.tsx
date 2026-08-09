import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { CardGridItem } from '@/components/cards/CardGridItem';
import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { BinderRail } from '@/components/collection/BinderRail';
import { BinderSheet } from '@/components/collection/BinderSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { queryCards } from '@/db/queries/cards';
import {
  adjustCardQuantity,
  binderQuantities,
  createBinder,
  deleteBinder,
  listBinders,
  missingFromLibrary,
  ownedCounts,
  renameBinder,
  type Binder,
} from '@/db/queries/collection';
import type { CardRow } from '@/db/schema/cards';
import { useCardFilters } from '@/features/cards/useCardFilters';
import { useCardSync } from '@/features/sync/useCardSync';
import {
  FINISHES,
  displayFinish,
  finishLabel,
  finishesFor,
  supportsFinish,
  type Finish,
} from '@/lib/finishes';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Collection — the card library, and what you own of it.
 *
 * Gallery is the default view because the library is useful long before anyone
 * has catalogued a single card, and a collection tab that opens on an empty
 * state would make the reference material feel like a reward for data entry.
 *
 * The binder rail decides what a tap means. With no binder selected the grid is
 * a reference book with ownership badges; select one and every tile gains
 * quantity controls and a tap files a card into that binder. One control
 * changes the mode rather than a separate "edit collection" screen, because the
 * thing you want to add is almost always the thing you were just looking at.
 */

const COLUMNS = 3;
const GUTTER = space[3];

type View_ = 'gallery' | 'collection';

export default function CollectionScreen() {
  const { width } = useWindowDimensions();
  const { cardCount, progress, isSyncing, isEmpty, refresh } = useCardSync();

  const filters = useCardFilters();

  const [view, setView] = useState<View_>('gallery');
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selectedBinder, setSelectedBinder] = useState<string | null>(null);
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<Binder | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** What a tap files. Ignored for cards printed in only one finish. */
  const [finish, setFinish] = useState<Finish>('standard');

  const loadCollection = useCallback(() => {
    const rows = listBinders();
    setBinders(rows);
    setOwned(ownedCounts());
    // A binder deleted elsewhere must not leave the grid in "filing" mode
    // pointed at nothing.
    setSelectedBinder((id) => (id && rows.some((b) => b.id === id) ? id : null));
  }, []);

  useFocusEffect(loadCollection);

  // Search lives in the store, not component state: the filter sheet computes
  // its live "Show N cards" count from the same query, and a local copy here
  // meant that count silently ignored whatever was typed in the search field.
  //
  // It runs against local FTS5, so there is no round-trip to debounce around —
  // results land in the same frame as the keystroke.
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

  const galleryCards = useMemo(() => queryCards(query), [query]);

  /**
   * Collection view: the same filters, narrowed to what is actually owned.
   *
   * Filtered in memory rather than by a second query, so the two views cannot
   * disagree about what "Fury spells" means — one query defines the set and
   * ownership only decides which of them survive.
   */
  /**
   * Copies in the selected binder. Null when none is selected.
   *
   * `owned` is a dependency rather than a trigger: every adjustment reloads it,
   * so this rebuilds with it and the badge can never lag the tap that changed
   * it.
   */
  const inBinder = useMemo(
    () => (selectedBinder ? binderQuantities(selectedBinder) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBinder, owned]
  );

  /**
   * Cards in this binder the library cannot render.
   *
   * Keyed on the binder and the library size rather than on `owned`: you can
   * only add cards that exist, so this changes when the binder changes or the
   * mirror resyncs — never on a tap.
   */
  const missing = useMemo(
    () => (selectedBinder ? missingFromLibrary(selectedBinder) : []),
    // `cardCount` is not read in the body — it is the resync signal. A card
    // returning to the library is exactly when this answer changes, and lint
    // cannot see that a query depends on a table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBinder, cardCount]
  );

  const collectionCards = useMemo(() => {
    if (view !== 'collection') return [];
    // Membership is finish-agnostic on purpose: a binder holding only foils
    // must not look empty because the toggle says Standard.
    if (inBinder) return galleryCards.filter((c) => inBinder.has(c.id));
    return galleryCards.filter((c) => (owned.get(c.id) ?? 0) > 0);
  }, [view, inBinder, galleryCards, owned]);

  const cards = view === 'gallery' ? galleryCards : collectionCards;

  const itemWidth = (width - GUTTER * 2) / COLUMNS;
  const activeCount = filters.activeCount();
  const activeBinder = binders.find((b) => b.id === selectedBinder) ?? null;

  const totalOwned = useMemo(() => {
    let n = 0;
    for (const count of owned.values()) n += count;
    return n;
  }, [owned]);

  /* -------------------------------------------------------------- actions */

  const adjust = (card: CardRow, delta: number) => {
    // The grid already blocks this tile, so reaching here would be a bug rather
    // than a user action — and `adjustCardQuantity` would throw. Checked so a
    // future caller cannot crash the screen.
    if (!selectedBinder || !supportsFinish(card, finish)) return;
    adjustCardQuantity(selectedBinder, card, delta, finish);
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    loadCollection();
  };

  const onSaveBinder = (name: string, accent: string | null) => {
    if (editing) {
      renameBinder(editing.id, name, accent);
    } else {
      // A new binder is empty, so showing it would be a blank screen. Select it
      // and open the library instead — the next thing anyone wants is to put
      // something in it.
      setSelectedBinder(createBinder({ name, accent }));
      setView('gallery');
    }
    setSheetOpen(false);
    setEditing(null);
    loadCollection();
  };

  const onDeleteBinder = () => {
    if (!editing) return;
    deleteBinder(editing.id);
    setSheetOpen(false);
    setEditing(null);
    setSelectedBinder(null);
    loadCollection();
  };

  const openCard = (card: CardRow) => router.push(`/card/${card.id}`);

  return (
    <Screen
      title="Collection"
      meta={metaLine(
        `${cards.length.toLocaleString()} shown`,
        totalOwned > 0 ? `${totalOwned.toLocaleString()} owned` : undefined,
        cardCount > 0 ? `${cardCount.toLocaleString()} in library` : undefined,
        isSyncing ? 'syncing' : undefined
      )}
      bleed
    >
      <View style={styles.controls}>
        <BinderRail
          binders={binders}
          selectedId={selectedBinder}
          /*
           * Picking a binder shows that binder. Anything else makes selection
           * feel like it did nothing — the grid looked identical, because a
           * selected binder only changed what a *tap* meant.
           *
           * Adding is still one tap away: the left half of the toggle becomes
           * "Add cards" and opens the whole library with this binder as the
           * destination.
           */
          onSelect={(id) => {
            setSelectedBinder(id);
            if (id) setView('collection');
          }}
          onEdit={(binder) => {
            setEditing(binder);
            setSheetOpen(true);
          }}
          onCreate={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        />

        <View style={styles.searchRow}>
          <View style={styles.viewToggle}>
            {(['gallery', 'collection'] as const).map((v) => (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: view === v }}
                onPress={() => setView(v)}
                style={({ pressed }) => [
                  styles.viewOption,
                  view === v && styles.viewOptionOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.viewLabel, view === v && styles.viewLabelOn]}
                  numberOfLines={1}
                >
                  {v === 'gallery'
                    ? activeBinder
                      ? 'Add cards'
                      : 'Gallery'
                    : (activeBinder?.name ?? 'Owned')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/cards/filters')}
            accessibilityRole="button"
            accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
            style={({ pressed }) => [
              styles.filterButton,
              activeCount > 0 && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="filter" size={20} color={activeCount > 0 ? color.onAccent : color.text} />
            {activeCount > 0 ? <Text style={styles.filterCount}>{activeCount}</Text> : null}
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <Icon name="search" size={18} color={color.textFaint} />
          <TextInput
            value={filters.search}
            onChangeText={filters.setSearch}
            placeholder="Search name, rules text, artist"
            placeholderTextColor={color.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search cards"
          />
        </View>

        {/* Domain is the filter reached for most often, so it gets a permanent
            rail; everything else lives in the sheet. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.domainRail}
        >
          {PLAYABLE_DOMAINS.map((domain) => {
            const selected = filters.domains.includes(domain);
            const c = domainColor(domain);
            return (
              <Pressable
                key={domain}
                onPress={() => filters.toggle('domains', domain)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={domain}
                style={({ pressed }) => [
                  styles.domainChip,
                  { borderColor: selected ? c.base : color.border },
                  selected && { backgroundColor: c.dim },
                  pressed && styles.pressed,
                ]}
              >
                <DomainGlyph domain={domain} size={13} color={c.base} />
                <Text
                  style={[styles.domainLabel, { color: selected ? c.base : color.textSecondary }]}
                >
                  {domain}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {activeBinder ? (
          <View style={styles.filingRow}>
            <Text style={styles.filingHint} numberOfLines={2}>
              {view === 'gallery'
                ? `Tap to file into ${activeBinder.name}`
                : `${activeBinder.distinctCards} ${activeBinder.distinctCards === 1 ? 'card' : 'cards'} · ${activeBinder.totalCards} copies`}
            </Text>

            {/*
              What a tap files. Cards printed in one finish only ignore it —
              `resolveFinish` decides per card, so a Legend files as foil even
              while this says Standard, and the badge follows.
            */}
            <View style={styles.finishToggle}>
              {FINISHES.map((f) => (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  accessibilityState={{ selected: finish === f }}
                  accessibilityLabel={`File as ${finishLabel(f)}`}
                  onPress={() => setFinish(f)}
                  style={({ pressed }) => [
                    styles.finishOption,
                    finish === f && styles.finishOptionOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.finishLabel, finish === f && styles.finishLabelOn]}>
                    {finishLabel(f)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/*
          Said out loud rather than left as a gap in the grid. These are cards
          the player owns whose printing is not in the current library, so they
          count towards the totals but cannot be drawn — and a binder that says
          61 while showing 59 tiles reads as a bug in the counting.
        */}
        {missing.length > 0 ? (
          <Text style={styles.missing}>
            {missing.length} {missing.length === 1 ? 'card' : 'cards'} in this binder{' '}
            {missing.length === 1 ? 'is' : 'are'} not in the current card library:{' '}
            {missing
              .slice(0, 3)
              .map((m) => `${m.quantity}× ${m.name}`)
              .join(', ')}
            {missing.length > 3 ? ` and ${missing.length - 3} more` : ''}
          </Text>
        ) : null}
      </View>

      {isEmpty && isSyncing ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.text} />
          <Text style={styles.syncText}>
            {progress?.message ?? 'Downloading the card database'}
          </Text>
          {progress?.progress != null ? (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(progress.progress * 100)}%` }]}
              />
            </View>
          ) : null}
        </View>
      ) : isEmpty ? (
        <EmptyState
          title="No cards yet"
          body="The card library could not be downloaded. Check your connection and try again — everything works offline once it lands."
          actions={[{ label: 'Try again', onPress: () => void refresh(), primary: true }]}
        />
      ) : cards.length === 0 && view === 'collection' ? (
        <EmptyState
          title={binders.length === 0 ? 'No binders yet' : 'Nothing here yet'}
          body={
            binders.length === 0
              ? 'A binder is where you record the cards you actually own. Create one, then tap cards in the gallery to file them.'
              : activeBinder
                ? `${activeBinder.name} is empty. Switch to Gallery and tap cards to add them.`
                : 'You have not recorded any cards yet. Switch to Gallery and tap cards to add them to a binder.'
          }
          actions={[
            binders.length === 0
              ? {
                  label: 'New binder',
                  onPress: () => {
                    setEditing(null);
                    setSheetOpen(true);
                  },
                  primary: true,
                }
              : { label: 'Open Gallery', onPress: () => setView('gallery'), primary: true },
          ]}
        />
      ) : cards.length === 0 ? (
        <EmptyState
          title="No cards match"
          body="Loosen a filter or clear the search to see more."
          actions={[{ label: 'Clear filters', onPress: filters.clear, primary: true }]}
        />
      ) : (
        <FlashList
          data={cards}
          numColumns={COLUMNS}
          keyExtractor={(card) => card.id}
          extraData={inBinder ?? owned}
          renderItem={({ item }) => (
            <CardGridItem
              card={item}
              width={itemWidth}
              onPress={openCard}
              /*
               * The badge always counts whatever the buttons act on: copies in
               * the selected binder, or copies owned everywhere when none is.
               * Showing a global total beside a plus that files into one binder
               * would make the number appear not to respond to the tap.
               *
               * Undefined, not 0, before any binder exists — a column of zeroes
               * teaches nothing.
               */
              owned={
                inBinder
                  ? // A foil-only card shows its foil count even while the
                    // toggle says Standard: the number it has is more useful
                    // than a zero for a printing that does not exist.
                    (inBinder.get(item.id)?.[displayFinish(item, finish)] ?? 0)
                  : binders.length > 0
                    ? (owned.get(item.id) ?? 0)
                    : undefined
              }
              foil={selectedBinder ? displayFinish(item, finish) === 'foil' : undefined}
              blocked={
                selectedBinder && !supportsFinish(item, finish)
                  ? `${finishLabel(finishesFor(item)[0]!)} only`
                  : null
              }
              onAdd={selectedBinder ? (card) => adjust(card, 1) : undefined}
              onRemove={selectedBinder ? (card) => adjust(card, -1) : undefined}
            />
          )}
          contentContainerStyle={styles.grid}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}

      <BinderSheet
        visible={sheetOpen}
        binder={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSave={onSaveBinder}
        onDelete={editing ? onDeleteBinder : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: space[4], gap: space[3], paddingBottom: space[3] },
  searchRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  viewToggle: {
    flex: 1,
    flexDirection: 'row',
    gap: space[1],
    padding: space[0.5],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  viewOption: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  viewOptionOn: { backgroundColor: color.raised },
  viewLabel: { ...text.smallMedium, color: color.textMuted },
  viewLabelOn: { color: color.text },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  searchInput: { flex: 1, ...text.body, color: color.text, padding: 0 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: 44,
    minWidth: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    justifyContent: 'center',
  },
  filterButtonActive: { backgroundColor: color.accent, borderColor: color.text },
  filterCount: { ...text.numeric, fontSize: 13, color: color.onAccent },
  pressed: { opacity: 0.75 },

  domainRail: { gap: space[2], paddingRight: space[4] },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    height: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: color.surface,
  },
  domainLabel: { ...text.smallMedium },
  filingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  filingHint: { ...text.microMeta, color: color.textMuted, flexShrink: 1 },
  finishToggle: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[0.5],
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  finishOption: {
    minHeight: 28,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  finishOptionOn: { backgroundColor: color.raised },
  finishLabel: { ...text.microMeta, color: color.textMuted },
  finishLabelOn: { color: color.text },
  missing: { ...text.microMeta, color: color.warning },

  grid: { paddingHorizontal: GUTTER - space[1], paddingBottom: space[8] },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    padding: space[6],
  },
  syncText: { ...text.small, color: color.textSecondary, textAlign: 'center' },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: radius.full,
    backgroundColor: color.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: color.text },
});
