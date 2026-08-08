import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { DomainBadge } from '@/components/cards/DomainBadge';
import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { LegalityBar } from '@/components/decks/LegalityBar';
import { VersionCompareSheet } from '@/components/decks/VersionCompareSheet';
import { VersionTimeline, type TimelineNode } from '@/components/decks/VersionTimeline';
import { MatchRow } from '@/components/matches/MatchRow';
import { WinRateBar } from '@/components/stats/WinRateBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { queryCards } from '@/db/queries/cards';
import {
  compareVersions,
  deleteDeck,
  deleteVersion,
  getDeck,
  listVersions,
  loadDeckList,
  missingCards,
  setCurrentVersion,
  versionDiff,
  versionMatchCounts,
  VersionHasMatchesError,
  type MissingCard,
} from '@/db/queries/decks';
import { deckRecord, listMatches, type DeckRecord } from '@/db/queries/matches';
import {
  versionStatLabel,
  versionStats,
  type VersionStat,
} from '@/db/queries/version-stats';
import type { DeckRow, DeckVersionRow } from '@/db/schema/decks';
import type { MatchRow as MatchRowType } from '@/db/schema/matches';
import {
  TOAST_CONFIRM_MS,
  TOAST_UNDOABLE_MS,
  useToast,
} from '@/features/matches/useToast';
import { rateOf } from '@/lib/analytics/summary';
import { DeckCodeError, encodeDeckList } from '@/lib/deck-code';
import type { DeckDiff } from '@/lib/deck-diff';
import { recordLine } from '@/lib/format';
import { checkLegality, type DeckList, type DeckZone } from '@/lib/legality';
import { deckGradient } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Deck detail.
 *
 * Overview, List, Versions (M3) and Matches (M4). Stats arrives with M5, for
 * the same reason the others waited: a tab that opens on nothing teaches the
 * user the app is empty, and a win rate without an interval behind it teaches
 * them something worse.
 */

type Tab = 'overview' | 'list' | 'versions' | 'matches';

/**
 * Versions drawn before the tail is folded behind a tap.
 *
 * Measured: the timeline mounts every node it is given, and each carries a
 * diff view of up to six chips. 30 is well past what a normal deck reaches and
 * well short of where an un-virtualised column starts costing frames.
 */
const VERSIONS_SHOWN = 30;

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'list', label: 'List' },
  { key: 'versions', label: 'Versions' },
  { key: 'matches', label: 'Matches' },
];

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

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [versions, setVersions] = useState<DeckVersionRow[]>([]);
  const [list, setList] = useState<DeckList>({ slots: [] });
  const [missing, setMissing] = useState<MissingCard[]>([]);
  const [matchCounts, setMatchCounts] = useState<Map<string, number>>(new Map());
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [matches, setMatches] = useState<MatchRowType[]>([]);
  const [record, setRecord] = useState<DeckRecord>({ wins: 0, losses: 0, draws: 0, total: 0 });
  const [versionPerformance, setVersionPerformance] = useState<VersionStat[]>([]);
  const [matchesByVersion, setMatchesByVersion] = useState<Map<string, MatchRowType[]>>(
    new Map()
  );
  const showToast = useToast((s) => s.show);

  const load = useCallback(() => {
    const row = getDeck(id);
    setDeck(row);
    if (!row?.currentVersionId) return;

    const rows = listVersions(row.id);
    const counts = versionMatchCounts(row.id);
    setVersions(rows);
    setList(loadDeckList(row.currentVersionId));
    setMissing(missingCards(row.currentVersionId));
    const deckMatches = listMatches({ deckId: row.id });
    setMatches(deckMatches);
    setRecord(deckRecord(row.id));
    setVersionPerformance(versionStats(row.id));

    const byVersion = new Map<string, MatchRowType[]>();
    for (const match of deckMatches) {
      const bucket = byVersion.get(match.deckVersionId) ?? [];
      bucket.push(match);
      byVersion.set(match.deckVersionId, bucket);
    }
    setMatchesByVersion(byVersion);

    setMatchCounts(counts);
  }, [id]);

  useFocusEffect(load);

  /**
   * Timeline nodes are built only while the Versions tab is open.
   *
   * `versionDiff` loads two decklists per node, so this is ~2N database reads
   * for N versions — measured at two thirds of the whole screen's load cost, and
   * it was being paid on every focus regardless of which tab you were looking
   * at. Returning from logging a match re-focuses deck detail, so a deck with a
   * long history made the *match* flow feel slow for a screen nobody opened.
   */
  const nodes = useMemo<TimelineNode[]>(() => {
    if (tab !== 'versions') return [];
    const numberById = new Map(versions.map((v) => [v.id, v.versionNumber]));
    return versions.map((version) => ({
      version,
      // Read here rather than in the timeline: a component that queries during
      // render re-queries on every scroll frame.
      diff: versionDiff(version.id),
      matchCount: matchCounts.get(version.id) ?? 0,
      isCurrent: version.id === deck?.currentVersionId,
      parentNumber: version.parentVersionId
        ? (numberById.get(version.parentVersionId) ?? null)
        : null,
    }));
  }, [tab, versions, matchCounts, deck?.currentVersionId]);

  const legality = useMemo(() => checkLegality(list), [list]);
  const current = versions.find((v) => v.id === deck?.currentVersionId) ?? null;

  const comparing = useMemo(() => {
    if (compare.length !== 2) return null;
    const [firstId, secondId] = compare as [string, string];
    const first = versions.find((v) => v.id === firstId);
    const second = versions.find((v) => v.id === secondId);
    if (!first || !second) return null;
    // Always oldest-first, so the diff reads as "what happened next" regardless
    // of which node was picked first.
    const [older, newer] =
      first.versionNumber <= second.versionNumber ? [first, second] : [second, first];
    return { a: older, b: newer, diff: compareVersions(older.id, newer.id) as DeckDiff };
  }, [compare, versions]);

  /*
   * The timeline mounts every node at once — it is a plain column, not a
   * virtualised list, because it lives inside the screen's scroll view along
   * with the other tabs' content. That is fine for the histories decks actually
   * have and not fine without a limit, so the tail is behind a tap.
   */
  const visibleNodes = useMemo(
    () => (showAllVersions ? nodes : nodes.slice(0, VERSIONS_SHOWN)),
    [nodes, showAllVersions]
  );

  /**
   * Tapping a version that is not current offers to switch to it. Editing then
   * forks from *that* node, which is how a player backs out of a change that
   * did not work while keeping the record of having tried it.
   */
  const onVersionPress = (node: TimelineNode) => {
    // In compare mode a tap means "pick this one" and nothing else. The old
    // behaviour — tap opens an action sheet, long-press selects — meant that
    // after picking one version the obvious next gesture did the wrong thing
    // while the first pick sat there looking selected.
    if (compareMode) {
      setCompare((picked) =>
        picked.includes(node.version.id)
          ? picked.filter((v) => v !== node.version.id)
          : picked.length >= 2
            ? [node.version.id]
            : [...picked, node.version.id]
      );
      return;
    }

    const options: Parameters<typeof Alert.alert>[2] = [{ text: 'Cancel', style: 'cancel' }];

    if (!node.isCurrent) {
      options.push({
        text: `Make v${node.version.versionNumber} current`,
        onPress: () => {
          setCurrentVersion(id, node.version.id);
          load();
        },
      });
    }

    if (!node.isCurrent && !node.version.lockedAt && versions.length > 1) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteVersion(node.version.id);
            load();
          } catch (err) {
            Alert.alert(
              'This version cannot be deleted',
              err instanceof VersionHasMatchesError
                ? 'It has matches logged against it, and those results only mean anything attached to the list that played them.'
                : 'A deck has to keep at least one version.'
            );
          }
        },
      });
    }

    // Only Cancel left — nothing to offer, so say nothing.
    if (options.length === 1) return;

    Alert.alert(
      `v${node.version.versionNumber}`,
      node.version.label ??
        (node.isCurrent
          ? 'The version this deck currently points at.'
          : 'This version is not the one the deck currently points at.'),
      options
    );
  };

  /** Long-press is a shortcut into compare mode with this node already picked. */
  const onVersionLongPress = (node: TimelineNode) => {
    if (versions.length < 2) return;
    setCompareMode(true);
    setCompare([node.version.id]);
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompare([]);
  };

  /**
   * The catalogue is read here rather than inside the wrapper so the encoding
   * stays a pure function over cards — testable against the real seed without a
   * database.
   */
  /**
   * Export in one tap: build the code, put it on the clipboard, confirm.
   *
   * There used to be a sheet in the middle showing the code and offering Copy
   * and Share. It was a step between wanting the code and having it, for a
   * string nobody reads — the clipboard is the destination in almost every
   * case.
   *
   * What the sheet did carry, and what a bare "Copied" would lose, is the
   * disclosure: cards a code cannot hold, and promo printings that come back as
   * their standard version. Those move into the message rather than
   * disappearing — the whole point of naming them was that the person pasting
   * the code should not be the one to discover it.
   */
  const onExport = () => {
    let result;
    try {
      // `missing` is passed in because `loadDeckList` already dropped those
      // cards from `list` — without it the code would be quietly short.
      result = encodeDeckList(
        list,
        queryCards({}),
        missing.map((m) => ({ name: m.name, quantity: m.quantity }))
      );
    } catch (err) {
      Alert.alert(
        'Could not build a code',
        err instanceof DeckCodeError
          ? err.message
          : 'Something went wrong building the deck code.'
      );
      return;
    }

    void Clipboard.setStringAsync(result.code);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const caveats: string[] = [];
    if (result.omitted.length > 0) {
      caveats.push(
        `${result.omitted.length} ${result.omitted.length === 1 ? 'card' : 'cards'} left out`
      );
    }
    if (result.reprinted.length > 0) {
      caveats.push(
        `${result.reprinted.length} promo ${result.reprinted.length === 1 ? 'printing' : 'printings'} sent as standard`
      );
    }

    showToast(
      caveats.length > 0
        ? `Copied to clipboard · ${caveats.join(' · ')}`
        : 'Copied to clipboard',
      {
        // Sharing is a second intent, not a second step. Offered here so it
        // costs one more tap rather than making everyone take it.
        action: {
          label: 'Share',
          onPress: () => {
            void Share.share({ message: `${deck?.name ?? 'Deck'}\n\n${result.code}` });
          },
        },
        durationMs: caveats.length > 0 ? TOAST_UNDOABLE_MS : TOAST_CONFIRM_MS,
      }
    );
  };

  const onDelete = () => {
    Alert.alert('Delete this deck?', 'Its versions and match history go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteDeck(id);
          router.replace('/');
        },
      },
    ]);
  };

  if (!deck) {
    return (
      <Screen title="Deck">
        <EmptyState
          title="Deck not found"
          body="It may have been deleted."
          actions={[{ label: 'Back to decks', onPress: () => router.replace('/'), primary: true }]}
        />
      </Screen>
    );
  }

  const [from, to] = deckGradient(deck.domains);

  return (
    <Screen
      title={deck.name}
      meta={metaLine(
        current ? `v${current.versionNumber}` : null,
        versions.length > 1 ? `${versions.length} versions` : null,
        legality.legal ? 'Legal' : 'Incomplete'
      )}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit deck"
          onPress={() => router.push(`/deck/${id}/edit`)}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      }
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accent}
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {missing.length > 0 ? (
          <Text style={styles.warning}>
            {/* Named, not counted — the card is still in the deck, it is the
                library that lost it, and only the name makes that actionable. */}
            Not in the card library:{' '}
            {missing.map((m) => m.name ?? 'an unknown card').join(', ')}. They are still part of
            this deck, but the counts below are short. Refreshing the library in Settings usually
            fixes it.
          </Text>
        ) : null}

        {tab === 'overview' ? (
          <View style={styles.overview}>
            <View style={styles.identity}>
              <DomainBadge domains={deck.domains} size="md" showLabel />
            </View>

            <LegalityBar result={legality} />

            {legality.issues.length > 0 ? (
              <View style={styles.issues}>
                {legality.issues.map((issue) => (
                  <Text key={`${issue.code}:${issue.message}`} style={styles.issue}>
                    {issue.message}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.versionBlock}>
              <Text style={styles.sectionLabel}>Current version</Text>
              <Text style={styles.versionMeta}>
                {metaLine(
                  current ? `v${current.versionNumber}` : null,
                  current?.label,
                  current?.lockedAt ? 'Locked — editing forks' : 'Editable in place',
                  versions.length > 1 ? `${versions.length} versions` : null
                )}
              </Text>
              <Text style={styles.hint}>
                Editing a version that has matches logged against it creates a new one, so past
                results always stay attached to the list that played them.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy this deck's code to the clipboard"
              onPress={onExport}
              style={({ pressed }) => [styles.export, pressed && styles.pressed]}
            >
              {/* Named for what one tap does. Sharing is offered in the toast
                  that follows, so the label is not promising the wrong thing. */}
              <Text style={styles.exportLabel}>Copy deck code</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onDelete}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLabel}>Delete deck</Text>
            </Pressable>
          </View>
        ) : tab === 'matches' ? (
          <View style={styles.overview}>
            {matches.length === 0 ? (
              <Text style={styles.hint}>
                No matches yet. Tap the + in the tab bar to log one — it attaches to whichever
                version this deck currently points at.
              </Text>
            ) : (
              <>
                {/* The rate lives in the bar, which cannot render one without
                    its sample size and interval. The line above is a record —
                    a fact, not an estimate. */}
                <WinRateBar rate={rateOf(matches)} />

                {versionPerformance.length > 1 ? (
                  <View style={styles.versionBlock}>
                    <Text style={styles.sectionLabel}>By version</Text>
                    {versionPerformance.map((stat) => (
                      <WinRateBar
                        key={stat.versionIds.join('+')}
                        rate={stat.rate}
                        label={versionStatLabel(stat)}
                        sublabel={
                          stat.pooled
                            ? 'Same cards, different printings — pooled'
                            : (stat.label ?? undefined)
                        }
                        compact
                      />
                    ))}
                    <Text style={styles.hint}>
                      Use Compare in the Versions tab to see the cards behind the difference.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.sectionLabel}>
                  {metaLine(
                    recordLine(record.wins, record.losses, record.draws),
                    `${record.total} ${record.total === 1 ? 'match' : 'matches'}`
                  )}
                </Text>
                {matches.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    onPress={() => router.push(`/match/${match.id}`)}
                  />
                ))}
              </>
            )}
          </View>
        ) : tab === 'versions' ? (
          <View style={styles.overview}>
            {/*
              Comparing is the thing this app exists for, so it gets a control
              that says so. It used to be long-press only: no affordance, no way
              to cancel a pick, and a tap on the second version opened an action
              sheet instead of comparing.
            */}
            {versions.length > 1 ? (
              <View style={styles.compareBar}>
                <Text style={styles.compareStatus}>
                  {compareMode
                    ? compare.length === 0
                      ? 'Tap two versions to compare'
                      : `Tap one more · v${
                          versions.find((v) => v.id === compare[0])?.versionNumber ?? ''
                        } selected`
                    : 'Compare two versions'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (compareMode ? exitCompare() : setCompareMode(true))}
                  style={({ pressed }) => [
                    styles.compareButton,
                    compareMode && styles.compareButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.compareButtonLabel,
                      compareMode && styles.compareButtonLabelActive,
                    ]}
                  >
                    {compareMode ? 'Cancel' : 'Compare'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <VersionTimeline
              nodes={visibleNodes}
              selectedIds={compare}
              selecting={compareMode}
              onPress={onVersionPress}
              onLongPress={onVersionLongPress}
            />

            {nodes.length > visibleNodes.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllVersions(true)}
                style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
              >
                <Text style={styles.showAllLabel}>
                  Show {nodes.length - visibleNodes.length} older{' '}
                  {nodes.length - visibleNodes.length === 1 ? 'version' : 'versions'}
                </Text>
              </Pressable>
            ) : null}

            {versions.length > 1 ? null : (
              <Text style={styles.hint}>
                Every edit after your first match creates a new version here, with the exact
                cards that changed.
              </Text>
            )}
          </View>
        ) : (
          ZONE_ORDER.map(({ zone, label, fixed }) => {
            const slots = list.slots
              .filter((s) => s.zone === zone)
              .sort((a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99));
            if (slots.length === 0) return null;
            const count = slots.reduce((n, s) => n + s.quantity, 0);

            return (
              <View key={zone} style={styles.zone}>
                <View style={styles.zoneHeader}>
                  <Text style={styles.zoneLabel}>{label}</Text>
                  <Text style={styles.zoneCount}>{count}</Text>
                </View>
                {slots.map((slot) => (
                  <DeckSlotRow
                    key={`${slot.zone}:${slot.card.id}`}
                    slot={slot}
                    fixed={fixed}
                    onAdjust={() => undefined}
                    onPress={() => router.push(`/card/${slot.card.id}`)}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <VersionCompareSheet
        visible={comparing !== null}
        a={comparing?.a ?? null}
        b={comparing?.b ?? null}
        diff={comparing?.diff ?? null}
        matchCounts={matchCounts}
        matchesByVersion={matchesByVersion}
        onClose={exitCompare}
      />

    </Screen>
  );
}

const styles = StyleSheet.create({
  accent: { height: 3, borderRadius: radius.full, marginBottom: space[4] },
  tabs: { flexDirection: 'row', gap: space[1], marginBottom: space[4] },
  tab: {
    paddingHorizontal: space[4],
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: color.raised },
  tabLabel: { ...text.smallMedium, color: color.textMuted },
  tabLabelActive: { color: color.text },
  content: { paddingBottom: space[16], gap: space[5] },
  overview: { gap: space[5] },
  compareBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  compareStatus: { ...text.small, color: color.textMuted, flexShrink: 1 },
  compareButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  compareButtonActive: { backgroundColor: color.text, borderColor: color.text },
  compareButtonLabel: { ...text.smallMedium, color: color.text },
  compareButtonLabelActive: { color: color.bg },
  showAll: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  showAllLabel: { ...text.smallMedium, color: color.text },
  identity: { flexDirection: 'row' },
  issues: { gap: space[1] },
  issue: { ...text.small, color: color.warning },
  warning: { ...text.small, color: color.warning },
  sectionLabel: { ...text.meta, color: color.textSecondary },
  versionBlock: { gap: space[2] },
  versionMeta: { ...text.meta, color: color.textMuted, flex: 1 },
  hint: { ...text.small, color: color.textFaint, paddingTop: space[1] },
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
  edit: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  editLabel: { ...text.smallMedium, color: color.bg },
  export: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
  },
  exportLabel: { ...text.smallMedium, color: color.text },
  delete: { minHeight: 44, justifyContent: 'center' },
  deleteLabel: { ...text.bodyMedium, color: color.danger },
  pressed: { opacity: 0.8 },
});
