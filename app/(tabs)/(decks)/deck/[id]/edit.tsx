import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { Prompt } from '@/components/ui/Prompt';
import { Screen } from '@/components/ui/Screen';
import { ViewToggle, type DeckView } from '@/components/ui/ViewToggle';
import {
  listBattlefields,
  listChampionsForLegend,
  listLegends,
  listRunesForIdentity,
  queryCards,
} from '@/db/queries/cards';
import { availabilityLabel, availableForDeck } from '@/db/queries/coverage';
import {
  getDeck,
  getVersion,
  loadDeckList,
  missingCards,
  renameDeck,
  saveDeckEdit,
  versionGameCounts,
  type SaveOptions,
} from '@/db/queries/decks';
import type { CardRow } from '@/db/schema/cards';
import { saveMessage } from '@/features/decks/save-message';
import {
  markEditorLoaded,
  markEditorMounted,
  markEditorPainted,
} from '@/features/decks/timing';
import { reconcileWithStored, useDeckEditor } from '@/features/decks/useDeckEditor';
import { TOAST_CONFIRM_MS, useToast } from '@/features/games/useToast';
import { useT, type Key } from '@/i18n';
import { baseName, cardKey } from '@/lib/card-identity';
import { diffLists, type DeckDiff } from '@/lib/deck-diff';
import {
  BATTLEFIELD_COUNT,
  checkLegality,
  COPY_LIMIT,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
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

/**
 * Tile-sized wording for each reason a card cannot go in.
 *
 * **Keys, not text.** This held English literals, which a module-scope constant
 * evaluates once — so the labels froze in whatever language the bundle started
 * in and never followed the picker. Same defect the tab bar had.
 */
const BLOCK_LABELS: Record<NonNullable<ReturnType<typeof slotBlockReason>>, Key> = {
  'off-identity': 'blocked.offIdentity',
  'copy-limit': 'blocked.copyLimit',
  'foreign-signature': 'blocked.foreignSignature',
  'battlefield-duplicate': 'blocked.duplicate',
};

export default function DeckEditorScreen() {
  const t = useT();
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
  const [view, setView] = useState<DeckView>('list');
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
  /** So tapping anywhere in the name field — including the pencil — focuses it. */
  const nameField = useRef<TextInput>(null);
  const showToast = useToast((s) => s.show);

  const navigation = useNavigation();
  /**
   * Set immediately before any navigation this screen asked for, so the guard
   * below lets it through. Saving replaces this route, which is a removal like
   * any other — without this the editor would interrogate the user about the
   * save they just confirmed.
   */
  const leaving = useRef(false);
  /**
   * The navigation the guard intercepted, replayed verbatim once the user
   * confirms. Replaying `router.back()` instead would be wrong for any exit
   * that was not a back: pressing the already-focused Decks tab pops the stack
   * to its root, and answering that with one step back lands somewhere the
   * user did not ask for.
   */
  const blockedAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);

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
      matchCount: versionGameCounts(deck.id).get(version.id) ?? 0,
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

  // First thing in the first render, so "nav" measures the transition and the
  // module work rather than anything this screen then chooses to do.
  markEditorMounted();

  useEffect(() => {
    if (!deck?.currentVersionId) return;
    load({
      deckId: deck.id,
      versionId: deck.currentVersionId,
      name: deck.name,
      list: loadDeckList(deck.currentVersionId),
    });
    committing.current = false;
    markEditorLoaded();

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
   * The name as it would be written, or null if it would not be.
   *
   * Blank clears nothing — the field is the only way back to a named deck, so an
   * emptied box is someone mid-edit, not someone asking for an unnamed deck.
   */
  const pendingRename = () => {
    const trimmed = deckName.trim();
    if (!deck || !trimmed || trimmed === deck.name) return null;
    return trimmed;
  };

  /** Write a pending rename, and report what was written. */
  const applyRename = () => {
    const trimmed = pendingRename();
    if (deck && trimmed) renameDeck(deck.id, trimmed);
    return trimmed;
  };

  /**
   * Unsaved work is the card list **or** the name.
   *
   * Only the list used to count, so renaming and then swiping back lost the new
   * name without a word — the guard was asking about half the screen.
   */
  const hasUnsavedWork = () => {
    if (pendingRename()) return true;
    if (!versionId) return false;
    return !diffLists(loadDeckList(versionId), buildSaveList()).isEmpty;
  };

  /**
   * Copies free for this deck, per card.
   *
   * Read once on open, deliberately. Nothing in this screen can change what you
   * own — filing copies happens in Collection — so recomputing would put a
   * three-table join in the path of every tap for a number that cannot move.
   *
   * It is also **not** reduced by what this deck lists, which is what makes it
   * stable enough to read once: the figure answers "may I sleeve this?", and
   * the stepper beside it already says how many you have put in.
   */
  const availability = useMemo(() => (deck ? availableForDeck(deck.id) : new Map()), [deck]);

  /*
   * Silent when nothing is catalogued. The map is keyed on cards you hold, so
   * an empty collection would otherwise stamp "Not owned" on all ~900
   * candidates — which is not a finding, it is the app talking to itself.
   */
  const availabilityFor = (card: CardRow) =>
    availability.size === 0 ? null : availabilityLabel(availability.get(cardKey(card)));

  /*
   * Held in a ref, refreshed after every render, so the listener below can be
   * subscribed once and still see the current draft. Subscribing with the draft
   * in the dependency list would tear down and rebuild the listener on every
   * keystroke; capturing it once would ask the question against the deck as it
   * looked when the screen opened, and always answer "nothing to lose".
   */
  const unsaved = useRef(hasUnsavedWork);
  useEffect(() => {
    unsaved.current = hasUnsavedWork;
  });

  /**
   * Leaving with work in progress — **every** way out, not just the button.
   *
   * The prompt used to hang off `Cancel`, so the two gestures people actually
   * use to leave a screen — the hardware back and the edge swipe — walked
   * straight past it and the draft was gone. A guard attached to one control
   * only guards that control.
   *
   * `beforeRemove` fires for the removal itself, whatever caused it, and is
   * cancellable — so the question is asked once, in one place, and `Cancel` is
   * now just another way of triggering it rather than a second implementation.
   *
   * The hook comes from `expo-router`, which vendors React Navigation's core
   * and re-exports the navigation object from it. Installing
   * `@react-navigation/native` for `usePreventRemove` — the fix this gap was
   * filed with — would have been wrong on SDK 57: expo-router v7 is built on
   * `standard-navigation` and no `@react-navigation` package exists in the tree
   * at all, so the hook would have been talking to a navigator that is not the
   * one rendering this screen.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (leaving.current) return;
      if (!unsaved.current()) return;

      event.preventDefault();
      blockedAction.current = event.data.action;
      setAsking('leave');
    });
    return unsubscribe;
  }, [navigation]);

  /** Let the next removal through, then perform it. */
  const leaveNow = () => {
    leaving.current = true;
    const action = blockedAction.current;
    blockedAction.current = null;
    if (action) navigation.dispatch(action);
    else router.back();
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
      /*
       * An unchanged list is not an unchanged screen.
       *
       * The rename used to live inside `commit`, which only the version sheet
       * can reach — and the sheet only opens for a non-empty diff. So changing
       * *only* the name took this branch and navigated away without writing it:
       * the one edit that never forks was also the one edit that never saved.
       * It is applied here because it belongs to the deck rather than to the
       * version, so there is no diff for it to be part of.
       */
      // Same latch `commit` uses: this branch now writes, so a second tap
      // before the replace flushes would rename twice and toast twice.
      if (committing.current) return;
      committing.current = true;

      const renamed = applyRename();
      leaving.current = true;
      router.replace(`/deck/${id}`);
      // Same reasoning as `save-message.ts`: a save that did something and said
      // nothing reads as a save that failed.
      if (renamed) showToast(t('editor.renamedTo', { name: renamed }), { durationMs: TOAST_CONFIRM_MS });
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
    // and never forks. Same call the empty-diff path makes, so the two ways out
    // of this screen cannot disagree about whether a rename was saved.
    applyRename();

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
    // The work is on disk now, so the guard must not challenge the navigation
    // that follows — a `replace` removes this route like any other exit.
    leaving.current = true;
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

  /*
   * The paint mark, one frame after the list has data.
   *
   * `requestAnimationFrame` fires after the commit that put these rows on
   * screen, so the gap it closes is the render — the part a virtualised list
   * changes and a faster query would not. Runs once per open; the ref stops a
   * zone switch from restarting a stopwatch nobody started.
   */
  const painted = useRef(false);
  useEffect(() => {
    if (painted.current || candidates.length === 0) return;
    painted.current = true;
    const frame = requestAnimationFrame(() => markEditorPainted(candidates.length));
    return () => cancelAnimationFrame(frame);
  }, [candidates]);

  const zoneCount = (which: Pool) =>
    slots.filter((s) => s.zone === which).reduce((n, s) => n + s.quantity, 0);

  /** Why this card cannot be added. Null means it can. */
  const blockedReason = (card: CardRow) => {
    const reason = slotBlockReason(card, list);
    // `copy-limit` is the only one carrying a number; the rest ignore the
    // parameter, which is cheaper than branching on which key takes one.
    if (reason) return t(BLOCK_LABELS[reason], { max: COPY_LIMIT });
    if (zone === 'battlefield' && legality.counts.battlefield >= BATTLEFIELD_COUNT) {
      return t('blocked.deckFull');
    }
    return null;
  };

  /**
   * Cancel just leaves.
   *
   * It used to run its own copy of the unsaved check and raise its own prompt,
   * which is precisely why the back gesture had none: the guard belonged to the
   * button rather than to the screen. Now the `beforeRemove` listener above
   * intercepts this exactly as it intercepts a swipe, so there is one
   * implementation of the question and no way to reach an exit that skips it.
   */
  const onLeave = () => router.back();

  if (notFound) {
    return (
      <Screen title={t('deck.notFound.title')}>
        <EmptyState
          title={t('deck.notFound.title')}
          body={t('deck.notFound.body')}
          actions={[{ label: t('deck.goBack'), onPress: () => router.replace('/'), primary: true }]}
        />
      </Screen>
    );
  }

  /**
   * The four zones, each with what it currently holds and what it needs.
   *
   * **Main reads `legality.counts.main`, not `zoneCount('main')`.** The Chosen
   * Champion occupies one of the forty main-deck slots (rule 103.2) and lives in
   * its own zone, so the raw slot count is one short of the number the rule is
   * about — a tab reading `39/40+` beside a deck the app calls legal. The other
   * three zones have no such adjustment and the two agree.
   *
   * `target: null` is the sideboard: optional, answering to no count, so it
   * shows what it holds and claims nothing about what it should.
   */
  const zoneTabs: {
    key: Pool;
    label: string;
    count: number;
    target: number | null;
    minimum?: boolean;
  }[] = [
    // 103.2 is "at least 40" — a minimum, which is why this one prints `40+`.
    {
      key: 'main',
      label: t('zone.mainShort'),
      count: legality.counts.main,
      target: MAIN_DECK_SIZE,
      minimum: true,
    },
    { key: 'rune', label: t('zone.runes'), count: legality.counts.rune, target: RUNE_DECK_SIZE },
    {
      key: 'battlefield',
      label: t('zone.battlefieldsShort'),
      count: legality.counts.battlefield,
      target: BATTLEFIELD_COUNT,
    },
    {
      key: 'sideboard',
      label: t('zone.sideboard'),
      count: zoneCount('sideboard'),
      target: null,
    },
  ];

  /**
   * Context that belongs to the deck rather than to browsing it.
   *
   * The editor's chrome measured **61% of the screen** — about a card and a
   * half visible below it. These two blocks are why: the legality card is 98pt
   * of three stacked lines, and the Legend and Champion fields are 52pt for a
   * choice made once when the deck was created and essentially never touched
   * while building.
   *
   * So they ride at the top of the candidate list instead of above it. Scroll
   * to the top and they are there; start browsing and the cards get the screen.
   * The **zone tabs** keep the running counts, which is the one part you want
   * *while* adding cards — and being the control as well as the readout, they
   * cost no space of their own. A pinned `LegalityStrip` used to do that job and
   * was the third statement of the same four numbers on this screen.
   *
   * Passed to **both** views — `FlashList`'s `ListHeaderComponent` and
   * `CardGrid`'s `header` — so switching list ⇄ gallery does not change what
   * the screen tells you, only how the cards are drawn.
   */
  const listContext = (
    <View style={styles.listContext}>
      <LegalityCard
        legality={legality}
        unresolved={missingFromCounts}
        footnote={
          // Stated before the first edit, not at save time. Learning that a
          // change forks a version while confirming the change is too late.
          editing?.version.lockedAt
            ? t(
                editing.matchCount === 0
                  ? 'editor.lockedBanner.locked'
                  : editing.matchCount === 1
                    ? 'editor.lockedBanner.one'
                    : 'editor.lockedBanner.other',
                {
                  number: editing.version.versionNumber,
                  count: editing.matchCount,
                  next: editing.version.versionNumber + 1,
                }
              )
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
                  ? t('editor.identity.a11y', {
                      role: t(which === 'legend' ? 'zone.legend' : 'zone.champion'),
                      name: baseName(card.name),
                    })
                  : t('editor.identity.pick', {
                      role: t(which === 'legend' ? 'zone.legend' : 'zone.champion'),
                    })
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
                {t(which === 'legend' ? 'zone.legend' : 'zone.champion')}
              </Text>
              <Text style={card ? styles.identityValue : styles.identityEmpty} numberOfLines={1}>
                {card
                  ? baseName(card.name)
                  : t(which === 'legend' ? 'editor.identity.pickOne' : 'editor.identity.legendFirst')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen back={false}>
      {/*
        Cancel · Save. The design gives the editor its own header rather than the
        app's display title: this is a task you are inside, and the two ways out
        belong at the top of it.

        The **name used to sit between them** and no longer does. Centred in a
        header row it had about half the width to work with, so any deck called
        more than two words either truncated or squeezed the two controls, and it
        sat at the very top of the screen — the least reachable point on a phone
        for the one field here you actually type into.
      */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.cancel.a11y')}
          onPress={onLeave}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('editor.save.a11y')}
          onPress={onSave}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.saveLabel}>{t('action.save')}</Text>
        </Pressable>
      </View>

      {/*
        The name, as a field of its own, directly above the zones.

        Full width, so a long name reads instead of truncating, and low enough to
        reach. The pencil is the affordance: a bare line of text at the top of an
        editor reads as a title, and nobody taps a title — this is the one field
        on the screen whose editability was invisible.
      */}
      <Pressable
        accessibilityRole="none"
        onPress={() => nameField.current?.focus()}
        style={styles.nameField}
      >
        <TextInput
          ref={nameField}
          value={deckName}
          onChangeText={setDeckName}
          placeholder={t('editor.name')}
          placeholderTextColor={color.textFaint}
          style={styles.nameInput}
          returnKeyType="done"
          accessibilityLabel={t('editor.name')}
        />
        <Icon name="pencil" size={15} color={color.textMuted} />
      </Pressable>

      {/*
        The counts live on the tabs, and nowhere else.

        This screen used to state them three times: a pinned `LegalityStrip`
        here, the tabs' bare per-zone numbers, and the `LegalityCard` at the top
        of the candidate list. Three readouts of one fact, two of them costing
        permanent vertical space on a screen whose chrome was already measured
        at 61% of the display.

        The tabs win because they are the only one of the three that is *also*
        the control for the thing it describes — you are looking at the Runes tab
        precisely when "12/12" is the number you want.
      */}
      <View style={styles.zoneTabs}>
        {zoneTabs.map((tab) => {
          const on = zone === tab.key;
          const met =
            tab.target === null
              ? null
              : tab.minimum
                ? tab.count >= tab.target
                : tab.count === tab.target;
          const over = tab.target !== null && !tab.minimum && tab.count > tab.target;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              // The tab now carries a fraction, so the label has to say it too —
              // a screen reader hearing "Runes, selected" would lose the number
              // that is the whole reason to look at it.
              accessibilityLabel={
                tab.target === null
                  ? `${tab.label} ${tab.count}`
                  : `${tab.label} ${tab.count} of ${tab.target}${tab.minimum ? ' or more' : ''}`
              }
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
              {/*
                `40/40`, not `40/40+`.

                Owner's call, and the tab is the one place it holds: a legal deck
                always has a Chosen Champion filling one of the forty, so 40 is
                what you are building towards and the `+` was pedantry about a
                rule nobody is trying to exercise. The **colour** still follows
                the real rule — `minimum` keeps a 41-card deck green rather than
                red — so the notation is simpler without the readout lying.
              */}
              <Text
                style={[
                  styles.zoneTabCount,
                  met === true && styles.zoneTabCountMet,
                  met === false && !over && styles.zoneTabCountShort,
                  over && styles.zoneTabCountOver,
                  on && styles.zoneTabCountOn,
                ]}
              >
                {tab.count}
                {tab.target === null ? '' : `/${tab.target}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.listHead}>
        {/*
          This read "MAIN · 14 IN DECK · CANDIDATES BELOW", which the zone tab
          directly above already says — it is the selected tab and it carries
          the same count. The row stays because it holds the two controls, and
          the view toggle has to remain reachable without scrolling; only the
          duplicated sentence is gone.
        */}
        <View style={styles.listHeadSpacer} />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: inDeckOnly }}
          accessibilityLabel={t('editor.inDeck.a11y')}
          onPress={() => setInDeckOnly((on) => !on)}
          style={({ pressed }) => [
            styles.filterPill,
            inDeckOnly && styles.filterPillOn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.filterPillLabel, inDeckOnly && styles.filterPillLabelOn]}>
            {t('editor.inDeck')}
          </Text>
        </Pressable>

        <ViewToggle value={view} onChange={setView} large />
      </View>

      {/*
        Search and filters, **below** the controls row rather than above it.

        They used to sit directly under the zone tabs, which pushed the "In deck"
        pill and the view toggle a full filter block away from the list they act
        on — and stacked two mostly-empty rows on top of each other once the
        result count came out. This order puts every control that changes *what
        the list shows* adjacent to the list, and the search field ends up within
        thumb reach instead of near the top of the screen.

        Main and Side draw from the same ~900 cards and get the full control set.
        Battlefields are 64 and Runes are 2 — a filter row over those would cost
        more space than it saves.
      */}
      {zone === 'main' || zone === 'sideboard' ? (
        <CardPoolFilters
          value={filters}
          onChange={setFilters}
          placeholder={
            zone === 'sideboard'
              ? t('editor.searchSideboard')
              : t('build.searchIdentity', { domains: legend?.domains.join(' / ') ?? '' })
          }
          editable={!!legend}
        />
      ) : zone === 'battlefield' ? (
        <TextInput
          value={filters.search}
          onChangeText={(search) => setFilters({ ...filters, search })}
          placeholder={t('editor.searchBattlefields')}
          placeholderTextColor={color.textFaint}
          style={styles.search}
          autoCorrect={false}
          editable={!!legend}
          accessibilityLabel={t('editor.searchToAdd')}
        />
      ) : null}

      {/* The rule that separates the controls from the list. It lived on
          `listHead` while that row was the last thing above the list; the
          filters are now, so it moved with the job rather than staying put and
          drawing a line through the middle of the controls. */}
      <View style={styles.listRule} />

      <View style={styles.body}>
        {!legend ? (
          /*
           * The context renders above the empty state, and it has to.
           *
           * `listContext` carries the LEGEND field, and with no Legend there is
           * no list for it to head — so hiding it here would leave the one
           * screen that can set a Legend with no way to set one. Reachable in
           * practice rather than theoretically: `loadDeckList` returns no
           * legend slot whenever that printing leaves the card mirror, which is
           * the M2 audit's finding 6, and this is the screen you would come to
           * to fix it.
           */
          <View style={styles.emptyBody}>
            {listContext}
            <EmptyState
              title={t('editor.pickLegendFirst')}
              body={t('editor.pickLegendFirst.body')}
            />
          </View>
        ) : view === 'list' ? (
          /*
           * Virtualised, and it has to be.
           *
           * This was a `ScrollView` mapping over every candidate, so opening the
           * editor mounted the whole pool before it could draw a frame —
           * measured against the real library at **385 rows** for the widest
           * Legend identity and 377 for the median, each row a Pressable, an
           * `expo-image` and four Texts. That is roughly four thousand views and
           * several hundred image requests standing between the tap and the
           * first paint, which is the half-second the editor took to open.
           *
           * The gallery view in the same slot has always been a FlashList; only
           * the list view was eager, which is why switching to the grid felt
           * faster than the screen it was inside.
           *
           * `extraData` carries the draft: rows are re-rendered on a quantity
           * change, which a virtualised list will not notice on its own because
           * `candidates` is deliberately a stable snapshot — the order is fixed
           * when the pool is built so a tap never moves a row under your finger.
           */
          <FlashList
            data={candidates}
            keyExtractor={(card) => card.id}
            extraData={slots}
            ListHeaderComponent={listContext}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            // In the same list rather than as a sibling branch, so filtering to
            // zero cannot unmount the list and drop the scroll position.
            ListEmptyComponent={<Text style={styles.empty}>{t('editor.noCardsMatch')}</Text>}
            renderItem={({ item }) => (
              <CandidateRow
                card={item}
                quantity={quantityIn(zone)(item)}
                blocked={blockedReason(item)}
                flagged={flagged.has(item.id)}
                availability={availabilityFor(item)}
                onAdd={() => onAdd(item)}
                onRemove={() => adjust(item, zoneForPool(zone, item), -1)}
                onPress={() => router.push(`/card/${item.id}`)}
              />
            )}
          />
        ) : (
          <CardGrid
            cards={candidates}
            mode="quantity"
            columns={zone === 'battlefield' ? 2 : 3}
            tileAspect={zone === 'battlefield' ? 1 / CARD_ASPECT : CARD_ASPECT}
            header={listContext}
            quantityOf={quantityIn(zone)}
            blockedReason={blockedReason}
            availabilityOf={availabilityFor}
            onAdd={onAdd}
            onRemove={(card) => adjust(card, zoneForPool(zone, card), -1)}
            emptyMessage={t('editor.noCardsMatch')}
          />
        )}
      </View>

      <CardPickerSheet
        visible={picker !== null}
        title={t(picker === 'legend' ? 'editor.changeLegend' : 'editor.changeChampion')}
        subtitle={
          picker === 'legend'
            ? t('editor.changeLegend.body')
            : legend
              ? t('editor.championsFor', { name: baseName(legend.name) })
              : undefined
        }
        cards={pickerCards}
        selectedId={picker === 'legend' ? (legend?.id ?? null) : (champion?.id ?? null)}
        emptyMessage={
          picker === 'champion'
            ? t('editor.noChampionPartner')
            : t('editor.libraryDownloading')
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
        title={t('editor.leave.title')}
        body={t('editor.leave.body')}
        onDismiss={() => {
          blockedAction.current = null;
          setAsking(null);
        }}
        actions={[
          {
            label: t('editor.leave.save'),
            kind: 'primary',
            onPress: () => {
              setAsking(null);
              onSave();
            },
          },
          {
            label: t('editor.leave.discard'),
            kind: 'secondary',
            onPress: () => {
              setAsking(null);
              leaveNow();
            },
          },
          {
            label: t('editor.leave.stay'),
            kind: 'quiet',
            onPress: () => {
              // Drop the intercepted action too, or a later confirmed exit
              // would replay a navigation from a decision already reversed.
              blockedAction.current = null;
              setAsking(null);
            },
          },
        ]}
      />

      <Prompt
        visible={asking === 'amend'}
        title={t('editor.overwriteTitle', { version: editing?.version.versionNumber ?? 1 })}
        body={
          (editing?.matchCount ?? 0) === 0
            ? t('editor.overwriteBody.none')
            : editing?.matchCount === 1
              ? t('editor.overwriteBody.one')
              : t('editor.overwriteBody.other', { count: editing?.matchCount ?? 0 })
        }
        onDismiss={() => setAsking(null)}
        actions={[
          {
            label: t('action.overwrite'),
            kind: 'primary',
            destructive: true,
            onPress: () => {
              setAsking(null);
              commit({ amendLocked: true });
            },
          },
          { label: t('action.keepAsIs'), kind: 'quiet', onPress: () => setAsking(null) },
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
  cancelLabel: { ...text.smallMedium, fontSize: 13.5, color: color.textMuted },
  saveLabel: { ...text.smallMedium, fontSize: 13.5, color: color.accent },

  /**
   * The deck name, as a field.
   *
   * `SelectField`'s own geometry — 52 high, `radius.lg`, 6 % fill, 14 % border —
   * so it reads as the same kind of control as the Legend and Champion fields
   * further down rather than as a second header.
   */
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    marginBottom: space[3],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  // `flex: 1` so a long name uses the whole width and the pencil stays pinned
  // right — the truncation this move was meant to fix.
  nameInput: { ...text.body, color: color.text, flex: 1, padding: 0 },

  // No top padding: `listContext` owns the spacing now that this sits inside it.
  identity: { flexDirection: 'row', gap: space[2] },
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

  /**
   * The whitespace sits **above** the controls, not below them.
   *
   * `paddingBottom` is the gap between the zone tabs and the block that filters
   * the list — the In-deck pill, the view toggle, search, the three selects.
   * Widened from 12, and the space came out of the other side: the rule and the
   * list's own top padding gave theirs up so the controls hug the cards they act
   * on. Two groups reading as two groups, rather than four evenly spaced rows
   * with the list drifting away from what changes it.
   */
  zoneTabs: { flexDirection: 'row', gap: 7, paddingTop: space[3], paddingBottom: space[5] },
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
  /**
   * Met, and over.
   *
   * The same rule `LegalityBar` encodes: a **minimum** can be met but never
   * exceeded, so the main deck has no `over` state and a 41-card deck is green
   * rather than red. The exact zones — runes and battlefields — do.
   *
   * `zoneTabCountOn` comes last in the style array so the selected tab's
   * on-accent foreground wins: green on coral is unreadable, and the tab you are
   * standing in already has the label to say which zone it is.
   */
  zoneTabCountMet: { color: color.win },
  zoneTabCountOver: { color: color.danger },
  /**
   * Short of its target — amber, not the default faint grey.
   *
   * This matters more than it did before the card stopped repeating the counts.
   * A count issue is now stated **only** here, so `38/40+` has to read as a
   * problem on its own; left at `textFaint` it would look like ordinary
   * metadata and the one place naming the shortfall would be whispering it.
   */
  zoneTabCountShort: { color: color.warning },
  zoneTabCountOn: { color: color.onAccent },

  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingBottom: space[2],
  },
  /** Was `listHead`'s bottom border, before the filters moved below it. */
  // No bottom margin: the list's own `listContent` padding is the only gap
  // wanted here, and 8 + 8 was reading as a band between the controls and the
  // cards rather than as a seam.
  listRule: { height: 1, backgroundColor: color.border },
  // Pushes the two controls to the right where the label used to end.
  listHeadSpacer: { flex: 1, minWidth: 0 },
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

  /* The view toggle's styles now live in `ViewToggle` — its `large` variant is
     this row's 36 dp height. */

  body: { flex: 1 },
  // 4, not 8 — just enough that the first row does not sit on the rule.
  listContent: { paddingTop: space[1], paddingBottom: space[6] },
  // The deck-level context that rides at the top of the candidate list.
  listContext: { gap: space[3], paddingBottom: space[3] },
  emptyBody: { paddingTop: space[2] },
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
