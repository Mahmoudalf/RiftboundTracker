import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardGrid } from '@/components/decks/CardGrid';
import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import {
  listBattlefields,
  listChampionsForLegend,
  listLegends,
  listRunesForIdentity,
  queryCards,
} from '@/db/queries/cards';
import { getDeck, loadDeckList, saveDeckList, VersionLockedError } from '@/db/queries/decks';
import type { CardRow } from '@/db/schema/cards';
import { useDeckEditor } from '@/features/decks/useDeckEditor';
import { baseName, cardKey } from '@/lib/card-identity';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  COPY_LIMIT,
  defaultZoneFor,
  type DeckZone,
} from '@/lib/legality';
import { CARD_ASPECT, color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The deck editor.
 *
 * Two full-screen modes rather than a split. An earlier version put the
 * decklist on top and a horizontal card rail underneath: the list was squeezed
 * into a strip, and finding one card among ~900 meant dragging sideways past
 * hundreds of them. Both halves were unusable at once, so each now gets the
 * whole screen and the legality bar stays pinned across both.
 *
 * Nothing here blocks a save.
 */

type Mode = 'deck' | 'add';
type Pool = 'main' | 'rune' | 'battlefield';

const ZONE_ORDER: { zone: DeckZone; label: string; fixed?: boolean }[] = [
  { zone: 'legend', label: 'Legend', fixed: true },
  { zone: 'champion', label: 'Champion', fixed: true },
  { zone: 'main', label: 'Main deck' },
  { zone: 'rune', label: 'Runes' },
  { zone: 'battlefield', label: 'Battlefields' },
];

const POOLS: { key: Pool; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'rune', label: 'Runes' },
  { key: 'battlefield', label: 'Fields' },
];

const MAIN_DECK_TYPES = ['Unit', 'Spell', 'Gear'];

export default function DeckEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mode, setMode] = useState<Mode>('deck');
  const [pool, setPool] = useState<Pool>('main');
  const [search, setSearch] = useState('');
  const [picker, setPicker] = useState<'legend' | 'champion' | null>(null);

  // Derived rather than held in state: the read is synchronous, so putting it
  // in an effect would render an empty editor first and then correct itself.
  const deck = useMemo(() => getDeck(id), [id]);
  const notFound = !deck?.currentVersionId;

  const slots = useDeckEditor((s) => s.slots);
  const versionId = useDeckEditor((s) => s.versionId);
  const deckName = useDeckEditor((s) => s.name);
  const load = useDeckEditor((s) => s.load);
  const reset = useDeckEditor((s) => s.reset);
  const adjust = useDeckEditor((s) => s.adjust);
  const setLegend = useDeckEditor((s) => s.setLegend);
  const setChampion = useDeckEditor((s) => s.setChampion);

  useEffect(() => {
    if (!deck?.currentVersionId) return;
    load({
      deckId: deck.id,
      versionId: deck.currentVersionId,
      name: deck.name,
      list: loadDeckList(deck.currentVersionId),
    });
    // Clearing on unmount is what makes backing out leave no trace — under the
    // version model a stale draft is not a lost keystroke, it is a wrong deck.
    return reset;
  }, [deck, load, reset]);

  const list = useMemo(() => ({ slots }), [slots]);
  // Computed once per change here rather than by each child that needs it.
  const legality = useMemo(() => checkLegality(list), [list]);
  const legend = slots.find((s) => s.zone === 'legend')?.card ?? null;
  const champion = slots.find((s) => s.zone === 'champion')?.card ?? null;

  const flagged = useMemo(
    () => new Set(legality.issues.flatMap((i) => i.cardIds)),
    [legality]
  );

  const quantityIn = (zone: DeckZone) => (card: CardRow) =>
    slots.find((s) => s.card.id === card.id && s.zone === zone)?.quantity ?? 0;

  const copiesOf = (card: CardRow, zones: DeckZone[]) =>
    slots
      .filter((s) => zones.includes(s.zone) && cardKey(s.card) === cardKey(card))
      .reduce((n, s) => n + s.quantity, 0);

  /**
   * The add pool, filtered to the Legend's identity in SQL — every domain of a
   * card must sit inside the Legend's two, so a dual-domain card needs both.
   * Split by zone so Battlefields, which are landscape, are not interleaved
   * with portrait cards in the same grid.
   */
  const addCards = useMemo(() => {
    if (!legend) return [];
    if (pool === 'rune') return listRunesForIdentity(legend.domains);
    if (pool === 'battlefield') {
      const term = search.trim().toLowerCase();
      const all = listBattlefields();
      return term ? all.filter((c) => c.cleanName.toLowerCase().includes(term)) : all;
    }
    return queryCards({
      search: search.trim() || undefined,
      identity: legend.domains,
      sort: search.trim() ? 'relevance' : 'energy',
    }).filter((c) => MAIN_DECK_TYPES.includes(c.type));
  }, [legend, pool, search]);

  const pickerCards = useMemo(() => {
    if (picker === 'legend') return listLegends();
    if (picker === 'champion' && legend) return listChampionsForLegend(legend);
    return [];
  }, [picker, legend]);

  const onAdd = (card: CardRow) => {
    const zone = defaultZoneFor(card);
    if (zone === 'battlefield' && copiesOf(card, ['battlefield']) > 0) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    adjust(card, zone, 1);
  };

  const onSave = () => {
    if (!versionId) return;
    try {
      saveDeckList(versionId, list);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace(`/deck/${id}`);
    } catch (err) {
      // Unreachable until match logging exists — see `saveDeckList`. Surfaced
      // rather than swallowed so it cannot fail silently when M3 lands.
      Alert.alert(
        'This version is locked',
        err instanceof VersionLockedError
          ? 'Matches have been logged on this version, so it can no longer be edited in place.'
          : 'The deck could not be saved.'
      );
    }
  };

  if (notFound) {
    return (
      <Screen title="Deck not found">
        <EmptyState
          title="Deck not found"
          body="It may have been deleted."
          actions={[{ label: 'Back to decks', onPress: () => router.replace('/'), primary: true }]}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={deckName || 'Deck'}
      meta="Editing"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save deck"
          onPress={onSave}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      }
    >
      <View style={styles.modes}>
        {(['deck', 'add'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={[styles.mode, mode === m && styles.modeActive]}
          >
            <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
              {m === 'deck' ? 'Deck' : 'Add cards'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {mode === 'deck' ? (
          <ScrollView contentContainerStyle={styles.listContent}>
            {ZONE_ORDER.map(({ zone, label, fixed }) => {
              const zoneSlots = slots
                .filter((s) => s.zone === zone)
                .sort((a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99));
              const count = zoneSlots.reduce((n, s) => n + s.quantity, 0);

              return (
                <View key={zone} style={styles.zone}>
                  <View style={styles.zoneHeader}>
                    <Text style={styles.zoneLabel}>{label}</Text>
                    <Text style={styles.zoneCount}>{count}</Text>
                  </View>

                  {zoneSlots.length === 0 ? (
                    fixed ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          zone === 'legend' ? 'Pick a Legend' : 'Pick a Champion'
                        }
                        onPress={() => setPicker(zone === 'legend' ? 'legend' : 'champion')}
                        style={({ pressed }) => [styles.zonePick, pressed && styles.pressed]}
                      >
                        <Text style={styles.zonePickLabel}>
                          {zone === 'legend' ? 'Pick a Legend' : 'Pick a Champion'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.zoneEmpty}>Nothing here yet</Text>
                    )
                  ) : (
                    zoneSlots.map((slot) => (
                      <DeckSlotRow
                        key={`${slot.zone}:${slot.card.id}`}
                        slot={slot}
                        fixed={fixed}
                        flagged={flagged.has(slot.card.id)}
                        onAdjust={(delta) => adjust(slot.card, slot.zone, delta)}
                        // Tapping a Legend or Champion changes it; any other card
                        // opens its detail, since the stepper already handles
                        // quantity.
                        onPress={() =>
                          fixed
                            ? setPicker(slot.zone === 'legend' ? 'legend' : 'champion')
                            : router.push(`/card/${slot.card.id}`)
                        }
                      />
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <>
            <View style={styles.pools}>
              {POOLS.map((p) => (
                <Pressable
                  key={p.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: pool === p.key }}
                  onPress={() => {
                    setPool(p.key);
                    setSearch('');
                  }}
                  style={[styles.poolChip, pool === p.key && styles.poolChipActive]}
                >
                  <Text
                    style={[styles.poolLabel, pool === p.key && styles.poolLabelActive]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {pool !== 'rune' ? (
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  pool === 'battlefield'
                    ? 'Search Battlefields'
                    : `Search ${legend?.domains.join(' / ') ?? ''} cards`
                }
                placeholderTextColor={color.textFaint}
                style={styles.search}
                autoCorrect={false}
                editable={!!legend}
                accessibilityLabel="Search cards to add"
              />
            ) : null}

            <CardGrid
              cards={addCards}
              mode="quantity"
              columns={pool === 'battlefield' ? 2 : 3}
              tileAspect={pool === 'battlefield' ? 1 / CARD_ASPECT : CARD_ASPECT}
              quantityOf={quantityIn(pool === 'main' ? 'main' : pool)}
              blockedReason={(card) => {
                if (pool === 'battlefield') {
                  return copiesOf(card, ['battlefield']) === 0 &&
                    legality.counts.battlefield >= BATTLEFIELD_COUNT
                    ? 'Deck is full'
                    : null;
                }
                if (pool === 'rune') return null;
                return copiesOf(card, ['main', 'champion']) >= COPY_LIMIT
                  ? `Max ${COPY_LIMIT}`
                  : null;
              }}
              onAdd={onAdd}
              onRemove={(card) => adjust(card, defaultZoneFor(card), -1)}
              emptyMessage={legend ? 'No cards match.' : 'Pick a Legend first.'}
            />
          </>
        )}
      </View>

      <CardPickerSheet
        visible={picker !== null}
        title={picker === 'legend' ? 'Change Legend' : 'Change Champion'}
        subtitle={
          picker === 'legend'
            ? 'Changing it changes the deck’s domains — cards that fall outside get flagged, not deleted'
            : legend
              ? `Champions that partner ${baseName(legend.name)}`
              : undefined
        }
        cards={pickerCards}
        selectedId={picker === 'legend' ? (legend?.id ?? null) : (champion?.id ?? null)}
        emptyMessage={
          picker === 'champion'
            ? 'No Champion Unit in the library partners this Legend.'
            : 'The card library has not finished downloading.'
        }
        onSelect={(card) => (picker === 'legend' ? setLegend(card) : setChampion(card))}
        onClose={() => setPicker(null)}
      />

      <LegalityBar result={legality} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  listContent: { paddingBottom: space[4], gap: space[5] },
  modes: { flexDirection: 'row', gap: space[1], paddingBottom: space[3] },
  mode: {
    paddingHorizontal: space[4],
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  modeActive: { backgroundColor: color.raised },
  modeLabel: { ...text.smallMedium, color: color.textMuted },
  modeLabelActive: { color: color.text },
  pools: { flexDirection: 'row', gap: space[1], paddingBottom: space[2] },
  poolChip: {
    paddingHorizontal: space[3],
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  poolChipActive: { backgroundColor: color.text, borderColor: color.text },
  poolLabel: { ...text.microMeta, color: color.textSecondary },
  poolLabelActive: { color: color.bg },
  zone: { gap: space[1] },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.borderSubtle,
  },
  zoneLabel: { ...text.meta, color: color.textSecondary },
  zoneCount: { ...text.numeric, fontSize: 13, color: color.textMuted },
  zoneEmpty: { ...text.small, color: color.textFaint, paddingVertical: space[2] },
  zonePick: { minHeight: 44, justifyContent: 'center' },
  zonePickLabel: { ...text.smallMedium, color: color.info },
  save: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  saveLabel: { ...text.smallMedium, color: color.bg },
  pressed: { opacity: 0.75 },
  search: {
    ...text.small,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[3],
    minHeight: 40,
    marginBottom: space[3],
  },
});
