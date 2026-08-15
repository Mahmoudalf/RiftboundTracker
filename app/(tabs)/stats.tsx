import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameHistoryRow } from '@/components/games/GameHistoryRow';
import { AnalyticsPanel } from '@/components/stats/AnalyticsPanel';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listDecks, listVersions } from '@/db/queries/decks';
import { listEvents, type EventSummary } from '@/db/queries/events';
import { deckRecord, listGames, type DeckRecord } from '@/db/queries/games';
import { HISTORY_PAGE, gameHistory, type GameHistoryEntry } from '@/db/queries/history';
import { matchesForGames } from '@/db/queries/matches';
import type { MatchRow, GameRow } from '@/db/schema/games';
import { useT, type Key } from '@/i18n';
import type { VersionRef } from '@/lib/analytics/findings';
import { eventStyleLabel, gameDate, recordLine } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Stats — match history now, analytics next.
 *
 * A deck selector above two tabs, because a match history that mixes decks is
 * not a history of anything: the same opponent is a different problem for each
 * deck you bring, and pooling them averages that away.
 *
 * **Matches** is the default tab and deliberately the plain one. It shows what
 * happened, in the order it happened, using only what the log actually
 * captured — result, both sides' Legend and Champion, format, style. Nothing on
 * it is derived, so nothing on it can be wrong in a way the user cannot check
 * against their own memory.
 *
 * **Analytics** is where anything computed belongs, and it stays empty until it
 * can carry a confidence interval.
 */

type Tab = 'games' | 'analytics' | 'events';

const TABS = [
  { key: 'games', label: 'statsTab.games' },
  { key: 'analytics', label: 'statsTab.analytics' },
  { key: 'events', label: 'statsTab.events' },
] as const satisfies readonly { key: Tab; label: Key }[];

const ALL_DECKS = '__all__';

interface DeckOption {
  id: string;
  name: string;
  /** Still listed, still counted — just labelled, so the picker is honest. */
  archived: boolean;
  record: DeckRecord;
}

export default function StatsScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('games');
  /*
   * `null` means "nothing chosen yet", which is NOT the same as `ALL_DECKS`.
   *
   * They used to be the same value, and it made "All decks" unselectable: the
   * default-to-most-recent rule below read `ALL_DECKS` as "no choice made" and
   * substituted the first deck, so picking it set state, re-ran this effect,
   * and was overwritten before anything rendered. The option looked inert.
   */
  const [deckId, setDeckId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [window, setWindow] = useState(HISTORY_PAGE);
  /** Every match for the current deck, unwindowed — analytics reads all of it. */
  const [allGames, setAllGames] = useState<GameRow[]>([]);
  /** Their games, for the breakdowns that are per-game rather than per-match. */
  const [allMatches, setAllMatches] = useState<MatchRow[]>([]);
  /**
   * The selected deck's versions, newest first — empty for "All decks".
   *
   * Version numbers are per deck, so pooling them across decks would compare
   * one deck's v3 against another's. The findings layer takes an empty list as
   * "do not make a version claim" rather than guessing.
   */
  const [versions, setVersions] = useState<VersionRef[]>([]);
  const [record, setRecord] = useState<DeckRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      /*
       * Archived decks included, deliberately.
       *
       * Two things went wrong without them. Their history became unreachable —
       * the deck left the picker and took its matches with it, in the one
       * screen whose whole job is remembering results. And "All decks"
       * disagreed with itself: the headline record summed only live decks
       * while the list beneath it read every match in the database, so
       * archiving changed the total without changing a single row.
       *
       * Archiving means "not playing this now", not "erase what it did".
       */
      const summaries = listDecks(true);
      const options = summaries.map((s) => ({
        id: s.deck.id,
        name: s.deck.name,
        archived: s.deck.archivedAt !== null,
        record: deckRecord(s.deck.id),
      }));

      // Default to the deck played most recently — `listDecks` is ordered by
      // `updated_at` and logging a match touches it, so the head of the list is
      // the one you are most likely asking about. Only on the first read, or
      // when the chosen deck has since been deleted; an explicit choice of
      // "All decks" is a choice and survives.
      const active =
        deckId !== null && (deckId === ALL_DECKS || options.some((o) => o.id === deckId))
          ? deckId
          : (options[0]?.id ?? ALL_DECKS);

      const scoped = active === ALL_DECKS ? {} : { deckId: active };
      const page = gameHistory({ ...scoped, limit: window });
      // Analytics summarises every match, so it reads unwindowed. Cheap: the
      // whole layer costs under a millisecond over 2,000 rows.
      const everything = listGames(scoped);

      setEvents(listEvents());
      setVersions(
        active === ALL_DECKS
          ? []
          : listVersions(active).map((version) => ({
              id: version.id,
              number: version.versionNumber,
              label: version.label,
            }))
      );
      setDecks(options);
      setDeckId(active);
      setHistory(page.entries);
      setHistoryTotal(page.total);
      setAllGames(everything);
      // One `IN (...)` rather than a query per match. Read here beside the
      // matches so the panel stays a function of its props — the same reason
      // `allGames` is not loaded inside it.
      setAllMatches(matchesForGames(everything.map((m) => m.id)));
      setRecord(
        active === ALL_DECKS
          ? options.reduce<DeckRecord>(
              (sum, o) => ({
                wins: sum.wins + o.record.wins,
                losses: sum.losses + o.record.losses,
                draws: sum.draws + o.record.draws,
                total: sum.total + o.record.total,
              }),
              { wins: 0, losses: 0, draws: 0, total: 0 }
            )
          : (options.find((o) => o.id === active)?.record ?? null)
      );
      setLoaded(true);

      if (__DEV__) {
        console.log(
          `[stats] decks=${options.length} deck=${active} ` +
            `window=${page.entries.length}/${page.total} all=${everything.length}`
        );
      }
    }, [deckId, window])
  );

  // Nothing read yet — say nothing rather than guess.
  if (!loaded) return <Screen title={t('stats.title')}>{null}</Screen>;

  if (decks.length === 0) {
    return (
      <Screen title={t('stats.title')}>
        <EmptyState
          title={t('stats.noDecks')}
          body={t('stats.noDecks.body')}
          actions={[
            { label: t('decks.build'), onPress: () => router.push('/deck/new'), primary: true },
          ]}
        />
      </Screen>
    );
  }

  /* The effect always writes a concrete id before `loaded` flips, so past the
     guard above this is never null — say so once here rather than at each use. */
  const selected = deckId ?? ALL_DECKS;

  const deckOptions: DropdownOption<string>[] = [
    { value: ALL_DECKS, label: t('stats.allDecks') },
    ...decks.map((deck) => ({
      value: deck.id,
      label: deck.name,
      meta: metaLine(
        recordLine(deck.record.wins, deck.record.losses, deck.record.draws) ?? t('stats.noRecord'),
        deck.archived ? t('deck.archived') : null
      ),
    })),
  ];

  return (
    <Screen
      title={t('stats.title')}
      meta={metaLine(
        record ? recordLine(record.wins, record.losses, record.draws) : null,
        record
          ? t(record.total === 1 ? 'stats.gameCount.one' : 'stats.gameCount.other', {
              count: record.total,
            })
          : null
      )}
    >
      {/*
        Tabs first, deck picker underneath — they used to share one row, with
        the picker sized to its content and the tabs pushed to whatever was
        left. A deck name is user-supplied and unbounded, so "whatever was
        left" could be nothing: German "Auswertung" clipped as soon as a name
        grew. Stacked, neither control can crowd the other, and each tab is an
        equal share of the full width so the longest label in any language
        still has room.
      */}
      <View style={styles.controls}>
        <View style={styles.tabs}>
          {/* `item`, not `t` — the map parameter was named `t` and now shadows
              the translate function. */}
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key)}
              style={[styles.tab, tab === item.key && styles.tabActive]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}
              >
                {t(item.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Dropdown
          label={t('stats.deck')}
          value={selected}
          options={deckOptions}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={setDeckId}
        />
      </View>

      {tab === 'events' ? (
        events.length === 0 ? (
          <EmptyState
            title={t('stats.noEvents')}
            body={t('stats.noEvents.body')}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={t('stats.event.a11y', {
                  name: event.name,
                  rounds: event.total,
                })}
                onPress={() => router.push(`/event/${event.id}`)}
                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
              >
                <View style={styles.eventBody}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {event.name}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {metaLine(
                      // Dropped when unset, not rendered as "not recorded":
                      // this is a meta line in a list, and an event named from
                      // the log form has no tier until someone sets one.
                      event.eventType ? eventStyleLabel(event.eventType) : null,
                      gameDate(event.startedAt),
                      event.finalPlacement
                        ? t('stats.event.placed', { place: event.finalPlacement })
                        : null
                    )}
                  </Text>
                </View>
                <Text style={styles.eventRecord}>
                  {recordLine(event.wins, event.losses, event.draws) ?? '—'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : tab === 'analytics' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          /* `flexGrow`, so the panel's empty state — which centres itself with
             `flex: 1` — has a full-height box to centre inside. Without it a
             ScrollView sizes its content to the content, and the invitation to
             log a game sits jammed under the tabs. */
          contentContainerStyle={styles.analytics}
        >
          <AnalyticsPanel
            games={allGames}
            matches={allMatches}
            versions={versions}
            deckId={selected === ALL_DECKS ? null : selected}
          />
        </ScrollView>
      ) : history.length === 0 ? (
        <EmptyState
          title={t('stats.noGames')}
          body={t(selected === ALL_DECKS ? 'stats.noGames.all' : 'stats.noGames.deck')}
        />
      ) : (
        <FlashList
          data={history}
          keyExtractor={(entry) => entry.game.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <GameHistoryRow
              entry={item}
              onPress={() => router.push(`/game/${item.game.id}`)}
            />
          )}
          ListFooterComponent={
            /* The window is stated, never silent. A history that hides matches
               without saying so is worse than a slow one. */
            historyTotal > history.length ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {t('history.window', { shown: history.length, total: historyTotal })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWindow((n) => n + HISTORY_PAGE)}
                  style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}
                >
                  <Text style={styles.loadMoreLabel}>
                    {t('history.more', { count: HISTORY_PAGE })}
                  </Text>
                </Pressable>
              </View>
            ) : historyTotal > HISTORY_PAGE ? (
              <Text style={styles.footerText}>{t('history.all', { total: historyTotal })}</Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: space[2], paddingBottom: space[3] },
  tabs: { flexDirection: 'row', gap: space[1] },
  /*
   * `flex: 1` so the three share the width evenly rather than each sizing to
   * its own label. Equal thirds are the widest any one tab can be guaranteed,
   * which is what a translated label needs — and it reads as a segmented
   * control, which is what these are.
   */
  tab: {
    flex: 1,
    paddingHorizontal: space[2],
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: color.accent },
  tabLabel: { ...text.smallMedium, color: color.textMuted },
  tabLabelActive: { color: color.onAccent },
  analytics: { flexGrow: 1 },
  list: { paddingBottom: space[16] },
  separator: { height: space[2] },
  footer: { gap: space[2], paddingTop: space[4], alignItems: 'flex-start' },
  footerText: { ...text.microMeta, color: color.textMuted, paddingTop: space[4] },
  loadMore: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  loadMoreLabel: { ...text.smallMedium, color: color.text },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 60,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  eventBody: { flex: 1, gap: space[0.5] },
  eventName: { ...text.bodyMedium, color: color.text },
  eventMeta: { ...text.microMeta, color: color.textMuted },
  eventRecord: { ...text.numeric, fontSize: 14, color: color.textSecondary },
  pressed: { opacity: 0.75 },
});
