import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MatchHistoryRow } from '@/components/matches/MatchHistoryRow';
import { AnalyticsPanel } from '@/components/stats/AnalyticsPanel';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { listDecks } from '@/db/queries/decks';
import { listEvents, type EventSummary } from '@/db/queries/events';
import { HISTORY_PAGE, matchHistory, type MatchHistoryEntry } from '@/db/queries/history';
import { deckRecord, listMatches, type DeckRecord } from '@/db/queries/matches';
import type { MatchRow } from '@/db/schema/matches';
import { eventStyleLabel, matchDate, recordLine } from '@/lib/format';
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

type Tab = 'matches' | 'analytics' | 'events';

const TABS: { key: Tab; label: string }[] = [
  { key: 'matches', label: 'Matches' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'events', label: 'Events' },
];

const ALL_DECKS = '__all__';

interface DeckOption {
  id: string;
  name: string;
  /** Still listed, still counted — just labelled, so the picker is honest. */
  archived: boolean;
  record: DeckRecord;
}

export default function StatsScreen() {
  const [tab, setTab] = useState<Tab>('matches');
  const [deckId, setDeckId] = useState<string>(ALL_DECKS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [window, setWindow] = useState(HISTORY_PAGE);
  /** Every match for the current deck, unwindowed — analytics reads all of it. */
  const [allMatches, setAllMatches] = useState<MatchRow[]>([]);
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
      // the one you are most likely asking about.
      const active =
        deckId !== ALL_DECKS && options.some((o) => o.id === deckId)
          ? deckId
          : (options[0]?.id ?? ALL_DECKS);

      const scoped = active === ALL_DECKS ? {} : { deckId: active };
      const page = matchHistory({ ...scoped, limit: window });
      // Analytics summarises every match, so it reads unwindowed. Cheap: the
      // whole layer costs under a millisecond over 2,000 rows.
      const everything = listMatches(scoped);

      setEvents(listEvents());
      setDecks(options);
      setDeckId(active);
      setHistory(page.entries);
      setHistoryTotal(page.total);
      setAllMatches(everything);
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
  if (!loaded) return <Screen title="Stats">{null}</Screen>;

  if (decks.length === 0) {
    return (
      <Screen title="Stats">
        <EmptyState
          title="No decks yet"
          body="Stats are built from matches, and a match is always attached to a deck. Build one first."
          actions={[
            { label: 'Build a deck', onPress: () => router.push('/deck/new'), primary: true },
          ]}
        />
      </Screen>
    );
  }

  const deckOptions: DropdownOption<string>[] = [
    { value: ALL_DECKS, label: 'All decks' },
    ...decks.map((deck) => ({
      value: deck.id,
      label: deck.name,
      meta: metaLine(
        recordLine(deck.record.wins, deck.record.losses, deck.record.draws) ?? 'No matches',
        deck.archived ? 'Archived' : null
      ),
    })),
  ];

  return (
    <Screen
      title="Stats"
      meta={metaLine(
        record ? recordLine(record.wins, record.losses, record.draws) : null,
        record ? `${record.total} ${record.total === 1 ? 'match' : 'matches'}` : null
      )}
    >
      <View style={styles.controls}>
        <Dropdown
          label="Deck"
          value={deckId}
          options={deckOptions}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={setDeckId}
        />

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'events' ? (
        events.length === 0 ? (
          <EmptyState
            title="No events yet"
            body="An event groups the rounds of one tournament or games night, so you can see how that day went rather than only how the deck does overall. Log a match, pick an organised match style, and name one."
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.name}, ${event.total} rounds`}
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
                      matchDate(event.startedAt),
                      event.finalPlacement ? `Placed ${event.finalPlacement}` : null
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <AnalyticsPanel matches={allMatches} />
        </ScrollView>
      ) : history.length === 0 ? (
        <EmptyState
          title="No matches yet"
          body={
            deckId === ALL_DECKS
              ? 'Tap the + in the tab bar after a game.'
              : 'Nothing logged for this deck yet. Tap the + in the tab bar, or pick another deck above.'
          }
        />
      ) : (
        <FlashList
          data={history}
          keyExtractor={(entry) => entry.match.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <MatchHistoryRow
              entry={item}
              onPress={() => router.push(`/match/${item.match.id}`)}
            />
          )}
          ListFooterComponent={
            /* The window is stated, never silent. A history that hides matches
               without saying so is worse than a slow one. */
            historyTotal > history.length ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Showing the {history.length} most recent of {historyTotal}.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWindow((n) => n + HISTORY_PAGE)}
                  style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}
                >
                  <Text style={styles.loadMoreLabel}>Show {HISTORY_PAGE} more</Text>
                </Pressable>
              </View>
            ) : historyTotal > HISTORY_PAGE ? (
              <Text style={styles.footerText}>All {historyTotal} shown.</Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[3],
  },
  tabs: { flexDirection: 'row', gap: space[1], marginLeft: 'auto' },
  tab: {
    paddingHorizontal: space[3],
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: color.accent },
  tabLabel: { ...text.smallMedium, color: color.textMuted },
  tabLabelActive: { color: color.onAccent },
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
