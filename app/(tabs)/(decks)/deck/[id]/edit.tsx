import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CandidateRow } from '@/components/decks/CandidateRow';
import { CardGrid } from '@/components/decks/CardGrid';
import { CardPickerSheet } from '@/components/decks/CardPickerSheet';
import {
  CardPoolFilters,
  EMPTY_POOL_FILTERS,
  poolKindFilters,
  type PoolFilterState,
} from '@/components/decks/CardPoolFilters';
import { LegalityCard } from '@/components/decks/LegalityCard';
import { SaveVersionSheet } from '@/components/decks/SaveVersionSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Prompt } from '@/components/ui/Prompt';
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
  renameDeck,
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
 * **One list per zone**, not two modes. The screen has been through three
 * shapes and each fixed the last one's real problem: a decklist over a
 * horizontal card rail (the list was a strip, and finding one card among ~900
 * meant dragging sideways past hundreds); then a Deck mode and an Add-cards
 * mode, which gave each the whole screen but meant adding a third copy of
 * something required leaving the list that told you that you had two.
 *
 * The design's answer is neither: pick a zone, and its candidates *are* the
 * list — what the deck holds sorted to the top, everything addable underneath,
 * every row carrying its own quantity. There is nowhere to switch to, because
 * there is nothing the other view knew.
 *
 * Nothing here blocks a save.
 */

/** Which candidate list is on screen. Zones the deck counts, in build order. */
type Pool = 'main' | 'rune' | 'battlefield' | 'sideboard';

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
  /*
   * One list, not two.
   *
   * The editor used to have a Deck mode and an Add-cards mode, so adding a
   * third copy of something meant leaving the list that told you that you had
   * two. The design merges them: pick a zone, and its candidates are the list —
   * what is in the deck sorted to the top, everything addable underneath.
   */
  const [zone, setZone] = useState<Pool>('main');
  const [view, setView] = useState<'list' | 'gallery'>('list');
  /*
   * Show only what the deck already holds.
   *
   * Cutting a deck down is a different job from building one up: you want the
   * 44 cards you have, not the 900 you could have. Membership is taken when the
   * toggle flips, not live — otherwise a card you zero disappears from under
   * your finger before you can see the count change.
   */
  const [inDeckOnly, setInDeckOnly] = useState(false);
  /** The prompt the screen is currently asking. */
  const [asking, setAsking] = useState<'leave' | 'amend' | null>(null);
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
  const setDeckName = useDeckEditor((s) => s.setName);
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
    if (zone === 'rune') return listRunesForIdentity(legend.domains);
    if (zone === 'battlefield') {
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
  }, [legend, zone, filters]);

  const pickerCards = useMemo(() => {
    if (picker === 'legend') return listLegends();
    if (picker === 'champion' && legend) return listChampionsForLegend(legend);
    return [];
  }, [picker, legend]);

  const onAdd = (card: CardRow) => {
    const target = zoneForPool(zone, card);
    if (target === 'battlefield' && copiesOf(card, ['battlefield']) > 0) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    adjust(card, target, 1);
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

    // The name lives on the deck, not the version, so renaming is not an edit
    // and never forks. Trimmed and only written when it actually changed.
    const trimmed = deckName.trim();
    if (deck && trimmed && trimmed !== deck.name) renameDeck(deck.id, trimmed);

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
   * The zone's candidates, with what is already in the deck at the top.
   *
   * A card in the deck is always in this list, whatever the filters say —
   * otherwise filtering by set hides copies you own and leaves no way to remove
   * them.
   */
  /*
   * The order is settled when the list is built, and not again.
   *
   * Sorting held cards to the top *live* meant a card leapt there the instant
   * you added it, so adding a second copy meant scrolling back to find where it
   * had gone. This depends on the zone and the filtered pool only — never on
   * quantities — so a tap changes a number in place and moves nothing.
   *
   * The draft is read imperatively for the same reason: naming `slots` as a
   * dependency is exactly what would retake the snapshot on every tap.
   */
  const candidates = useMemo(() => {
    // The four pools are named for the zones they fill, so a pool *is* a zone
    // here. Routing through zoneForPool with a dummy card asked what zone a Unit
    // belongs to and got "main" for every tab.
    const held = useDeckEditor.getState().slots.filter((s) => s.zone === zone);

    const byId = new Map(addCards.map((c) => [c.id, c]));
    // A card in the deck belongs in this list whatever the filters say, or
    // filtering by set would hide copies you own with no way to remove them.
    for (const slot of held) if (!byId.has(slot.card.id)) byId.set(slot.card.id, slot.card);

    const heldIds = new Set(held.map((s) => s.card.id));
    const pool = inDeckOnly ? [...byId.values()].filter((c) => heldIds.has(c.id)) : [...byId.values()];

    return pool.sort((a, b) => (heldIds.has(b.id) ? 1 : 0) - (heldIds.has(a.id) ? 1 : 0));
  }, [addCards, zone, inDeckOnly]);

  const zoneCount = (which: Pool) =>
    slots.filter((s) => s.zone === which).reduce((n, s) => n + s.quantity, 0);

  /** Why this card cannot be added. Null means it can. */
  const blockedReason = (card: CardRow) => {
    const reason = slotBlockReason(card, list);
    if (reason) return BLOCK_LABELS[reason];
    if (zone === 'battlefield' && legality.counts.battlefield >= BATTLEFIELD_COUNT) {
      return 'Deck is full';
    }
    return null;
  };

  /**
   * Leaving with work in progress.
   *
   * The draft is cleared on unmount, so backing out is genuinely destructive —
   * and until now it happened silently, on a gesture nobody confirms.
   */
  const onLeave = () => {
    if (!versionId) {
      router.back();
      return;
    }
    const diff = diffLists(loadDeckList(versionId), buildSaveList());
    if (diff.isEmpty) router.back();
    else setAsking('leave');
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

  const zoneTabs: { key: Pool; label: string }[] = [
    { key: 'main', label: 'Main' },
    { key: 'rune', label: 'Runes' },
    { key: 'battlefield', label: 'Battlefields' },
    { key: 'sideboard', label: 'Sideboard' },
  ];

  return (
    <Screen back={false}>
      {/* Cancel · deck · Save. The design gives the editor its own header rather
          than the app's display title: this is a task you are inside, and the
          two ways out belong at the top of it. */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel editing"
          onPress={onLeave}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>

        {/* The name is edited where it is shown. It was previously unreachable
            from here at all — the one screen dedicated to changing the deck. */}
        <TextInput
          value={deckName}
          onChangeText={setDeckName}
          placeholder="Deck name"
          placeholderTextColor={color.textFaint}
          style={styles.headerTitle}
          returnKeyType="done"
          accessibilityLabel="Deck name"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save deck"
          onPress={onSave}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      </View>

      <LegalityCard
        legality={legality}
        sideboard={zoneCount('sideboard')}
        unresolved={missingFromCounts}
        footnote={
          // Stated before the first edit, not at save time. Learning that a
          // change forks a version while confirming the change is too late.
          editing?.version.lockedAt
            ? `v${editing.version.versionNumber} · ${
                editing.matchCount > 0
                  ? `${editing.matchCount === 1 ? '1 match' : `${editing.matchCount} matches`} tracked`
                  : 'locked'
              } — saving will create v${editing.version.versionNumber + 1}`
            : null
        }
      />

      {/* The deck's identity, above the zones it decides. Changing either
          re-flags the list rather than deleting from it. */}
      <View style={styles.identity}>
        {(['legend', 'champion'] as const).map((which) => {
          const card = which === 'legend' ? legend : champion;
          return (
            <Pressable
              key={which}
              accessibilityRole="button"
              accessibilityLabel={
                card
                  ? `${which === 'legend' ? 'Legend' : 'Champion'}: ${baseName(card.name)}`
                  : `Pick a ${which === 'legend' ? 'Legend' : 'Champion'}`
              }
              disabled={which === 'champion' && !legend}
              onPress={() => setPicker(which)}
              style={({ pressed }) => [
                styles.identityField,
                which === 'champion' && !legend && styles.identityDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.identityLabel}>
                {which === 'legend' ? 'LEGEND' : 'CHAMPION'}
              </Text>
              <Text style={card ? styles.identityValue : styles.identityEmpty} numberOfLines={1}>
                {card ? baseName(card.name) : which === 'legend' ? 'Pick one' : 'Legend first'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.zoneTabs}>
        {zoneTabs.map((tab) => {
          const on = zone === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setZone(tab.key);
                setFilters(EMPTY_POOL_FILTERS);
              }}
              style={({ pressed }) => [
                styles.zoneTab,
                on && styles.zoneTabOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.zoneTabLabel, on && styles.zoneTabLabelOn]} numberOfLines={1}>
                {tab.label}
              </Text>
              <Text style={[styles.zoneTabCount, on && styles.zoneTabCountOn]}>
                {zoneCount(tab.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Main and Side draw from the same ~900 cards and get the full control
          set. Battlefields are 64 and Runes are 2 — a filter row over those
          would cost more space than it saves. */}
      {zone === 'main' || zone === 'sideboard' ? (
        <CardPoolFilters
          value={filters}
          onChange={setFilters}
          resultCount={candidates.length}
          placeholder={
            zone === 'sideboard'
              ? 'Search cards for the sideboard'
              : `Search ${legend?.domains.join(' / ') ?? ''} cards`
          }
          editable={!!legend}
        />
      ) : zone === 'battlefield' ? (
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

      <View style={styles.listHead}>
        <Text style={styles.listHeadLabel} numberOfLines={1}>
          {zoneTabs.find((t) => t.key === zone)?.label.toUpperCase()} · {zoneCount(zone)} in deck ·
          candidates below
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: inDeckOnly }}
          accessibilityLabel="Show only cards already in the deck"
          onPress={() => setInDeckOnly((on) => !on)}
          style={({ pressed }) => [
            styles.filterPill,
            inDeckOnly && styles.filterPillOn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.filterPillLabel, inDeckOnly && styles.filterPillLabelOn]}>
            In deck
          </Text>
        </Pressable>

        <View style={styles.viewToggle}>
          {(['list', 'gallery'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
              accessibilityLabel={v === 'list' ? 'List view' : 'Gallery view'}
              onPress={() => setView(v)}
              style={[styles.viewOption, view === v && styles.viewOptionOn]}
            >
              <Text style={[styles.viewGlyph, view === v && styles.viewGlyphOn]}>
                {v === 'list' ? '☰' : '▦'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        {!legend ? (
          <EmptyState
            title="Pick a Legend first"
            body="The Legend decides which domains the deck may hold, so there is nothing to offer until it is chosen."
          />
        ) : view === 'list' ? (
          <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {candidates.length === 0 ? (
              <Text style={styles.empty}>No cards match.</Text>
            ) : (
              candidates.map((card) => (
                <CandidateRow
                  key={card.id}
                  card={card}
                  quantity={quantityIn(zone)(card)}
                  blocked={blockedReason(card)}
                  flagged={flagged.has(card.id)}
                  onAdd={() => onAdd(card)}
                  onRemove={() => adjust(card, zoneForPool(zone, card), -1)}
                  onPress={() => router.push(`/card/${card.id}`)}
                />
              ))
            )}
          </ScrollView>
        ) : (
          <CardGrid
            cards={candidates}
            mode="quantity"
            columns={zone === 'battlefield' ? 2 : 3}
            tileAspect={zone === 'battlefield' ? 1 / CARD_ASPECT : CARD_ASPECT}
            quantityOf={quantityIn(zone)}
            blockedReason={blockedReason}
            onAdd={onAdd}
            onRemove={(card) => adjust(card, zoneForPool(zone, card), -1)}
            emptyMessage="No cards match."
          />
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
          onSave={(options) => (options.amendLocked ? setAsking('amend') : commit(options))}
        />
      ) : null}

      {/*
        Leaving, and overwriting: the two decisions in this screen that cannot
        be taken back. Both were `Alert.alert`, which arrives in the OS font
        with the OS button order — and on Android cannot offer three options
        without reading as an error.
      */}
      <Prompt
        visible={asking === 'leave'}
        title="Leave without saving?"
        body="The draft is not stored anywhere. Under the version model an unsaved edit is not a lost keystroke, it is a deck that never existed."
        onDismiss={() => setAsking(null)}
        actions={[
          {
            label: 'Save and leave',
            kind: 'primary',
            onPress: () => {
              setAsking(null);
              onSave();
            },
          },
          {
            label: 'Discard and continue',
            kind: 'secondary',
            onPress: () => {
              setAsking(null);
              router.back();
            },
          },
          { label: 'Stay here', kind: 'quiet', onPress: () => setAsking(null) },
        ]}
      />

      <Prompt
        visible={asking === 'amend'}
        title={`Overwrite v${editing?.version.versionNumber ?? 1}?`}
        body={
          (editing?.matchCount ?? 0) > 0
            ? `The ${
                editing?.matchCount === 1 ? 'match' : `${editing?.matchCount} matches`
              } already logged on this version will be attributed to the edited list. This cannot be undone.`
            : 'This version will be rewritten in place.'
        }
        onDismiss={() => setAsking(null)}
        actions={[
          {
            label: 'Overwrite',
            kind: 'primary',
            destructive: true,
            onPress: () => {
              setAsking(null);
              commit({ amendLocked: true });
            },
          },
          { label: 'Keep it as it is', kind: 'quiet', onPress: () => setAsking(null) },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingBottom: space[3],
  },
  headerAction: { minHeight: 44, justifyContent: 'center' },
  headerTitle: { ...text.title, fontSize: 15, color: color.text, flex: 1, textAlign: 'center' },
  cancelLabel: { ...text.smallMedium, fontSize: 13.5, color: color.textMuted },
  saveLabel: { ...text.smallMedium, fontSize: 13.5, color: color.accent },

  identity: { flexDirection: 'row', gap: space[2], paddingTop: space[3] },
  identityField: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  identityDisabled: { opacity: 0.45 },
  identityLabel: { ...text.microMeta, fontSize: 9, color: color.textFaint },
  identityValue: { ...text.smallMedium, fontSize: 12, color: color.text },
  identityEmpty: { ...text.smallMedium, fontSize: 12, color: color.textMuted },

  zoneTabs: { flexDirection: 'row', gap: 7, paddingTop: space[3], paddingBottom: space[3] },
  zoneTab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  zoneTabOn: { backgroundColor: color.accent, borderColor: color.accent },
  zoneTabLabel: { ...text.caption, fontSize: 11.5, color: color.textSecondary },
  zoneTabLabelOn: { color: color.onAccent },
  zoneTabCount: { ...text.numeric, fontSize: 10, color: color.textFaint },
  zoneTabCountOn: { color: color.onAccent },

  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingBottom: space[2],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  listHeadLabel: { ...text.microMeta, color: color.textFaint, flex: 1, minWidth: 0 },
  filterPill: {
    height: 32,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  filterPillOn: { backgroundColor: color.accent, borderColor: color.accent },
  filterPillLabel: { ...text.caption, fontSize: 11, color: color.textSecondary },
  filterPillLabelOn: { color: color.onAccent },

  viewToggle: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  viewOption: {
    height: 36,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  viewOptionOn: { backgroundColor: color.accent },
  viewGlyph: { ...text.small, color: color.textMuted },
  viewGlyphOn: { color: color.onAccent },

  body: { flex: 1 },
  listContent: { paddingTop: space[2], paddingBottom: space[6] },
  empty: { ...text.small, color: color.textFaint, paddingVertical: space[4] },
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
