import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { CardGridItem } from '@/components/cards/CardGridItem';
import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { queryCards } from '@/db/queries/cards';
import type { CardRow } from '@/db/schema/cards';
import { useCardFilters } from '@/features/cards/useCardFilters';
import { useCardSync } from '@/features/sync/useCardSync';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

const COLUMNS = 3;
const GUTTER = space[3];

export default function CardsScreen() {
  const { width } = useWindowDimensions();
  const { cardCount, progress, isSyncing, isEmpty, refresh } = useCardSync();

  const filters = useCardFilters();

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

  const cards = useMemo(() => queryCards(query), [query]);

  const itemWidth = (width - GUTTER * 2) / COLUMNS;
  const activeCount = filters.activeCount();

  const openCard = (card: CardRow) => router.push(`/card/${card.id}`);

  return (
    <Screen
      title="Cards"
      meta={metaLine(
        `${cards.length.toLocaleString()} shown`,
        cardCount > 0 ? `${cardCount.toLocaleString()} in library` : undefined,
        isSyncing ? 'syncing' : 'offline ready'
      )}
      bleed
    >
      <View style={styles.controls}>
        <View style={styles.searchRow}>
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

          <Pressable
            onPress={() => router.push('/cards/filters')}
            accessibilityRole="button"
            accessibilityLabel={
              activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'
            }
            style={({ pressed }) => [
              styles.filterButton,
              activeCount > 0 && styles.filterButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="filter"
              size={20}
              color={activeCount > 0 ? color.bg : color.text}
            />
            {activeCount > 0 ? (
              <Text style={styles.filterCount}>{activeCount}</Text>
            ) : null}
          </Pressable>
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
                  style={[
                    styles.domainLabel,
                    { color: selected ? c.base : color.textSecondary },
                  ]}
                >
                  {domain}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
      ) : cards.length === 0 ? (
        <EmptyState
          title="No cards match"
          body="Loosen a filter or clear the search to see more."
          actions={[
            { label: 'Clear filters', onPress: filters.clear, primary: true },
          ]}
        />
      ) : (
        <FlashList
          data={cards}
          numColumns={COLUMNS}
          keyExtractor={(card) => card.id}
          renderItem={({ item }) => (
            <CardGridItem card={item} width={itemWidth} onPress={openCard} />
          )}
          contentContainerStyle={styles.grid}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: space[4], gap: space[3], paddingBottom: space[3] },
  searchRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  searchField: {
    flex: 1,
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
  filterButtonActive: { backgroundColor: color.text, borderColor: color.text },
  filterCount: { ...text.numeric, fontSize: 13, color: color.bg },
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
  domainGlyph: { fontSize: 12, lineHeight: 15 },
  domainLabel: { ...text.smallMedium },

  grid: { paddingHorizontal: GUTTER - space[1], paddingBottom: space[8] },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] },
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
