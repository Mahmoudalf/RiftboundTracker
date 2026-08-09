import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CardGrid } from '@/components/decks/CardGrid';
import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import {
  CardPoolFilters,
  EMPTY_POOL_FILTERS,
  poolKindFilters,
  type PoolFilterState,
} from '@/components/decks/CardPoolFilters';
import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { SaveVersionSheet } from '@/components/decks/SaveVersionSheet';
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
import {
  getDeck,
  getVersion,
  loadDeckList,
  missingCards,
  saveDeckEdit,
  versionMatchCounts,
  type SaveOptions,
} from '@/db/queries/decks';
import type { CardRow } from '@/db/schema/cards';
import { saveMessage } from '@/features/decks/save-message';
import { reconcileWithStored, useDeckEditor } from '@/features/decks/useDeckEditor';
import { TOAST_CONFIRM_MS, useToast } from '@/features/matches/useToast';
import { baseName, cardKey } from '@/lib/card-identity';
import { diffLists, type DeckDiff } from '@/lib/deck-diff';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  COPY_LIMIT,
  defaultZoneFor,
  slotBlockReason,
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

/**
 * Which zone the Add-cards grid puts a card into.
 *
 * The pool *is* the destination — that is why `main`, `rune` and `battlefield`
 * agree with `defaultZoneFor()`. `sideboard` is the one that does not: it draws
 * from the same pool as the main deck and sends cards somewhere else, which is
 * exactly what a sideboard is.
 */
type Pool = 'main' | 'rune' | 'battlefield' | 'sideboard';

const ZONE_ORDER: { zone: DeckZone; label: string; fixed?: boolean }[] = [
  { zone: 'legend', label: 'Legend', fixed: true },
  { zone: 'champion', label: 'Champion', fixed: true },
  { zone: 'main', label: 'Main deck' },
  { zone: 'rune', label: 'Runes' },
  { zone: 'battlefield', label: 'Battlefields' },
  // Only rendered when non-empty. Nothing in the builder creates a sideboard —
  // they arrive by import — but a zone that is stored, forked and re-exported
  // while being invisible is worse than either having it or not.
  { zone: 'sideboard', label: 'Sideboard' },
];

const POOLS: { key: Pool; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'rune', label: 'Runes' },
  { key: 'battlefield', label: 'Fields' },
  { key: 'sideboard', label: 'Side' },
];

/** The pool decides the zone; only `sideboard` differs from the card's type. */
const zoneForPool = (pool: Pool, card: CardRow): DeckZone =>
  pool === 'sideboard' ? 'sideboard' : defaultZoneFor(card);

const MAIN_DECK_TYPES = ['Unit', 'Spell', 'Gear'];

/** Tile-sized wording for each reason a card cannot go in. */
const BLOCK_LABELS: Record<NonNullable<ReturnType<typeof slotBlockReason>>, string> = {
  'off-identity': 'Off identity',
  'copy-limit': `Max ${COPY_LIMIT}`,
  'foreign-signature': 'Another Champion',
  'battlefield-duplicate': 'Already in deck',
};

export default function DeckEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mode, setMode] = useState<Mode>('deck');
  const [pool, setPool] = useState<Pool>('main');
  const [filters, setFilters] = useState<PoolFilterState>(EMPTY_POOL_FILTERS);
  const [picker, setPicker] = useState<'legend' | 'champion' | null>(null);
  const [pending, setPending] = useState<DeckDiff | null>(null);
  /** Latched on the first commit, so a double tap cannot save twice. */
  const committing = useRef(false);
  const showToast = useToast((s) => s.show);

  // Derived rather than held in state: the read is synchronous, so putting it
  // in an effect would render an empty editor first and then correct itself.
  const deck = useMemo(() => getDeck(id), [id]);
  const notFound = !deck?.currentVersionId;

  /**
   * The version being edited, and how much history is riding on it.
   *
   * Read once on open rather than on every render: nothing in this screen can
   * lock a version, and re-reading on each keystroke would put a database round
   * trip inside the typing path.
   */
  const editing = useMemo(() => {
    if (!deck?.currentVersionId) return null;
    const version = getVersion(deck.currentVersionId);
    if (!version) return null;
    return {
      version,
      matchCount: versionMatchCounts(deck.id).get(version.id) ?? 0,
    };
  }, [deck]);

  /**
   * Cards in this version the library cannot currently resolve.
   *
   * Deck detail has always named these; the editor said nothing, so the deck
   * simply looked short — in the one screen where the natural fix is to add a
   * duplicate of a card that is already there. The counts in the legality bar
   * are short by exactly this much, and without the line there is no way to
   * know that from here.
   */
  const missing = useMemo(
    () => (deck?.currentVersionId ? missingCards(deck.currentVersionId) : []),
    [deck]
  );

  /*
   * Only the zones the legality bar actually counts.
   *
   * `missingCards` also returns the Legend and Champion, which do not appear in
   * any of those totals — so summing all of it would claim the main deck was
   * short by one when it was the Legend's printing that vanished.
   */
  const missingFromCounts = useMemo(
    () =>
      missing
        .filter((m) => m.zone !== 'legend' && m.zone !== 'champion')
        .reduce((n, m) => n + m.quantity, 0),
    [missing]
  );

  const slots = useDeckEditor((s) => s.slots);
  const versionId = useDeckEditor((s) => s.versionId);
  const loadedKeys = useDeckEditor((s) => s.loadedKeys);
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
    committing.current = false;

    if (__DEV__) {
      console.log(`[editor] mount · store versionId ${useDeckEditor.getState().versionId}`);
    }

    // Clearing on unmount is what makes backing out leave no trace — under the
    // version model a stale draft is not a lost keystroke, it is a wrong deck.
    return () => {
      if (__DEV__) console.log('[editor] unmount · clearing draft');
      reset();
    };
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
      const term = filters.search.trim().toLowerCase();
      const all = listBattlefields();
      return term ? all.filter((c) => c.cleanName.toLowerCase().includes(term)) : all;
    }
    const { types, supertypes } = poolKindFilters(filters.kinds);
    const term = filters.search.trim();
    return queryCards({
      search: term || undefined,
      identity: legend.domains,
      sets: filters.setIds.length ? filters.setIds : undefined,
      // No kind chosen means everything a main deck can hold, not nothing.
      types: types.length || supertypes.length ? types : MAIN_DECK_TYPES,
      supertypes: supertypes.length ? supertypes : undefined,
      sort: term ? 'relevance' : filters.sort,
    }).filter((c) => MAIN_DECK_TYPES.includes(c.type));
  }, [legend, pool, filters]);

  const pickerCards = useMemo(() => {
    if (picker === 'legend') return listLegends();
    if (picker === 'champion' && legend) return listChampionsForLegend(legend);
    return [];
  }, [picker, legend]);

  const onAdd = (card: CardRow) => {
    const zone = zoneForPool(pool, card);
    if (zone === 'battlefield' && copiesOf(card, ['battlefield']) > 0) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    adjust(card, zone, 1);
  };

  /**
   * The list to save: the draft, plus anything that appeared in the stored
   * version while the editor was open.
   *
   * Without this a card sync completing mid-session reads as the user deleting
   * a card they never saw — which forks a version nobody asked for and drops
   * the card from it.
   */
  const buildSaveList = () => {
    if (!versionId) return list;
    return reconcileWithStored(list, loadDeckList(versionId), loadedKeys);
  };

  /**
   * Saving is two steps, always: work out the change, then show it.
   *
   * The diff is computed against what is on disk rather than against the draft's
   * own baseline, so a save that turns out to change nothing writes nothing and
   * says so — the guard that keeps a deck's history from filling with versions
   * nobody made.
   */
  const onSave = () => {
    if (!versionId) return;
    const diff = diffLists(loadDeckList(versionId), buildSaveList());

    if (diff.isEmpty) {
      router.replace(`/deck/${id}`);
      return;
    }
    setPending(diff);
  };

  /**
   * Commit, exactly once.
   *
   * `router.replace` does unmount this screen — expo-router queues a React
   * Navigation `REPLACE`, the stack router swaps the top route, and the effect
   * cleanup below clears the draft. But that happens a render later, not inside
   * this function, so a second tap on the sheet's button before the queue
   * flushes would call `saveDeckEdit` again with the **pre-fork** versionId
   * still in the store. That writes the same edit into the locked version a
   * second time and forks twice — measured: v2 and v3, identical, from one
   * double-tap.
   *
   * Two guards, because they fail differently: the ref stops the re-entry, and
   * moving the store onto the new version means anything that did slip through
   * would at worst re-save the fork rather than reach back into a locked list.
   */
  const commit = (options: SaveOptions) => {
    if (!versionId || committing.current) return;
    committing.current = true;

    const result = saveDeckEdit(versionId, buildSaveList(), options);
    useDeckEditor.setState({ versionId: result.versionId });

    if (__DEV__) {
      console.log(
        `[editor] save → ${result.outcome} v${result.versionNumber} · store versionId ` +
          `${versionId} → ${useDeckEditor.getState().versionId}`
      );
    }

    setPending(null);

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace(`/deck/${id}`);
    showToast(saveMessage(result), { durationMs: TOAST_CONFIRM_MS });
  };

  /**
   * The escape hatch. Rewriting a locked version is the one operation in the
   * app that can make an existing number wrong, so it states the consequence in
   * terms of the matches it affects and defaults to Cancel.
   */
  const onAmendLocked = () => {
    const count = editing?.matchCount ?? 0;
    Alert.alert(
      `Overwrite v${editing?.version.versionNumber}?`,
      count > 0
        ? `The ${count === 1 ? 'match' : `${count} matches`} already logged on this version will be attributed to the edited list. This cannot be undone.`
        : 'This version will be rewritten in place.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overwrite',
          style: 'destructive',
          onPress: () => commit({ amendLocked: true }),
        },
      ]
    );
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
      {/* Stated before the first edit, not at save time. Learning that a change
          forks a version while confirming the change is learning it too late. */}
      {editing?.version.lockedAt ? (
        <Text style={styles.lockBanner}>
          v{editing.version.versionNumber} ·{' '}
          {editing.matchCount > 0
            ? `${editing.matchCount === 1 ? '1 match' : `${editing.matchCount} matches`} tracked`
            : 'locked'}{' '}
          — saving will create v{editing.version.versionNumber + 1}
        </Text>
      ) : null}

      {missing.length > 0 ? (
        <Text style={styles.missingBanner}>
          Not in the card library:{' '}
          {missing.map((m) => `${m.quantity}× ${m.name ?? 'an unknown card'}`).join(', ')}. Still
          in the deck and kept when you save
          {missingFromCounts > 0
            ? ` — the counts below are short by ${missingFromCounts}.`
            : '.'}
        </Text>
      ) : null}

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
                    setFilters(EMPTY_POOL_FILTERS);
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

            {/* Main and Side draw from the same ~900 cards and get the full
                control set. Battlefields are 64 and Runes are 2 — a filter row
                over those would cost more space than it saves. */}
            {pool === 'main' || pool === 'sideboard' ? (
              <CardPoolFilters
                value={filters}
                onChange={setFilters}
                resultCount={addCards.length}
                placeholder={
                  pool === 'sideboard'
                    ? 'Search cards for the sideboard'
                    : `Search ${legend?.domains.join(' / ') ?? ''} cards`
                }
                editable={!!legend}
              />
            ) : pool === 'battlefield' ? (
              <TextInput
                value={filters.search}
                onChangeText={(search) => setFilters({ ...filters, search })}
                placeholder="Search Battlefields"
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
              quantityOf={quantityIn(pool)}
              blockedReason={(card) => {
                /*
                 * The rules come from `slotBlockReason`, which is the tested
                 * implementation. This used to re-derive a subset of them
                 * inline — and silently omitted the foreign-Signature rule, so
                 * another Champion's Signature card looked addable in the rail
                 * and only failed once it was in the deck.
                 *
                 * "Deck is full" stays here: it is not a rule about the card,
                 * it is a fact about this zone being complete.
                 */
                const reason = slotBlockReason(card, list);
                if (reason) return BLOCK_LABELS[reason];

                if (
                  pool === 'battlefield' &&
                  legality.counts.battlefield >= BATTLEFIELD_COUNT
                ) {
                  return 'Deck is full';
                }
                return null;
              }}
              onAdd={onAdd}
              onRemove={(card) => adjust(card, zoneForPool(pool, card), -1)}
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

      {pending ? (
        <SaveVersionSheet
          visible
          diff={pending}
          versionNumber={editing?.version.versionNumber ?? 1}
          matchCount={editing?.matchCount ?? 0}
          locked={!!editing?.version.lockedAt}
          onCancel={() => setPending(null)}
          onSave={(options) => (options.amendLocked ? onAmendLocked() : commit(options))}
        />
      ) : null}

      <LegalityBar result={legality} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  listContent: { paddingBottom: space[4], gap: space[5] },
  lockBanner: {
    ...text.microMeta,
    color: color.warning,
    paddingBottom: space[3],
  },
  missingBanner: {
    ...text.microMeta,
    color: color.warning,
    paddingBottom: space[3],
  },
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
