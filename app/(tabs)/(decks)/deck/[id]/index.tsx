import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { DeckSlotRow } from '@/components/decks/DeckSlotRow';
import { VersionCompareSheet } from '@/components/decks/VersionCompareSheet';
import { VersionNodeDetail } from '@/components/decks/VersionNodeDetail';
import { VersionTimeline, type TimelineNode } from '@/components/decks/VersionTimeline';
import { MatchRow } from '@/components/matches/MatchRow';
import { WinRateBar } from '@/components/stats/WinRateBar';
import { DetailsSheet } from '@/components/ui/DetailsSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { getCard, queryCards } from '@/db/queries/cards';
import { deckCoverage, type DeckCoverage } from '@/db/queries/coverage';
import {
  archiveDeck,
  compareVersions,
  deleteDeck,
  deleteVersion,
  getDeck,
  listVersions,
  loadDeckList,
  missingCards,
  renameDeck,
  setCurrentVersion,
  setDeckNotes,
  setVersionLabel,
  setVersionNotes,
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
import { isLandscapeCard } from '@/lib/card-art';
import { baseName } from '@/lib/card-identity';
import { cardImage } from '@/lib/cdn';
import { DeckCodeError, encodeDeckList } from '@/lib/deck-code';
import type { DeckDiff } from '@/lib/deck-diff';
import { recordLine } from '@/lib/format';
import { checkLegality, type DeckList, type DeckZone } from '@/lib/legality';
import { deckGradient, domainColor, sortDomains } from '@/theme/domains';
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

type Tab = 'overview' | 'versions' | 'matches' | 'stats';

/** The decklist's two shapes on the Overview tab. */
type Preview = 'list' | 'gallery';

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
  { key: 'versions', label: 'Versions' },
  { key: 'matches', label: 'Matches' },
  { key: 'stats', label: 'Stats' },
];

/** The hero image's height, from the design. */
const HERO_HEIGHT = 206;

/** Deck-detail body padding, from the design's `padding:18px 20px 0`. */
const BODY_PAD = 20;
const GALLERY_COLUMNS = 3;
const GALLERY_GAP = 13;
/** 108/151 in the design — the printed card's proportion. */
const GALLERY_ASPECT = 108 / 151;

/**
 * Zones as the gallery groups them.
 *
 * Legend and Champion are one section there rather than two: each holds a
 * single card, and two consecutive one-card sections leave the pair stacked
 * down the left edge with two headers and a lot of nothing beside them.
 */
const GALLERY_GROUPS: { zones: DeckZone[]; label: string }[] = [
  { zones: ['legend', 'champion'], label: 'Legend & Champion' },
  { zones: ['main'], label: 'Main deck' },
  { zones: ['rune'], label: 'Runes' },
  { zones: ['battlefield'], label: 'Battlefields' },
  { zones: ['sideboard'], label: 'Sideboard' },
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

/**
 * Drawn, not typed — the same reasoning as `Screen`'s. A chevron character is a
 * font dependency for a control the user cannot proceed without.
 */
function BackChevron() {
  return (
    <Svg width={11} height={18} viewBox="0 0 11 18" fill="none">
      <Path
        d="M9.5 1.5L2 9l7.5 7.5"
        stroke={color.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function DeckDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [versions, setVersions] = useState<DeckVersionRow[]>([]);
  const [list, setList] = useState<DeckList>({ slots: [] });
  const [missing, setMissing] = useState<MissingCard[]>([]);
  const [matchCounts, setMatchCounts] = useState<Map<string, number>>(new Map());
  const [coverage, setCoverage] = useState<DeckCoverage | null>(null);
  const [legendArt, setLegendArt] = useState<string | null>(null);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>('list');
  const [compare, setCompare] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  /** Which details sheet is open — the deck's, or one version's. */
  const [editingDeck, setEditingDeck] = useState(false);
  const [editingVersion, setEditingVersion] = useState<DeckVersionRow | null>(null);
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
    setCoverage(deckCoverage(row.id));
    // The Legend's art carries the hero. Null when the deck has no Legend or its
    // printing has left the library — the header falls back to a domain plate.
    setLegendArt(row.legendCardId ? (getCard(row.legendCardId)?.imageUrl ?? null) : null);
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

    setExpandedVersion((open) => (open === node.version.id ? null : node.version.id));
  };

  const onDeleteVersion = (versionId: string) => {
    try {
      deleteVersion(versionId);
      setExpandedVersion(null);
      load();
    } catch (err) {
      Alert.alert(
        'This version cannot be deleted',
        err instanceof VersionHasMatchesError
          ? 'It has matches logged against it, and those results only mean anything attached to the list that played them.'
          : 'A deck has to keep at least one version.'
      );
    }
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

  // All four setters trim blank to null themselves, so the screen passes what
  // was typed. An unlabelled version then reads as "Untitled change", which is
  // true — where `''` would render as a version deliberately named nothing.
  const onSaveDeckDetails = (name: string, notes: string) => {
    renameDeck(id, name);
    setDeckNotes(id, notes);
    setEditingDeck(false);
    load();
  };

  const onSaveVersionDetails = (label: string, notes: string) => {
    if (!editingVersion) return;
    setVersionLabel(editingVersion.id, label);
    setVersionNotes(editingVersion.id, notes);
    setEditingVersion(null);
    load();
  };

  /**
   * Archive, not delete.
   *
   * A deck stops appearing in the list without touching a single match. The
   * confirm says so, because "archive" is the sort of word people read as
   * "delete but politer".
   */
  const onArchive = () => {
    if (deck?.archivedAt) {
      archiveDeck(id, false);
      setEditingDeck(false);
      load();
      return;
    }

    Alert.alert(
      `Archive ${deck?.name}?`,
      'It leaves the deck list. Its versions and match history are kept, and it still counts in your overall stats — "Show archived" on the Decks tab brings it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: () => {
            archiveDeck(id, true);
            setEditingDeck(false);
            router.replace('/');
          },
        },
      ]
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

  const totalCards = list.slots.reduce((n, slot) => n + slot.quantity, 0);
  const cellWidth =
    (windowWidth - BODY_PAD * 2 - GALLERY_GAP * (GALLERY_COLUMNS - 1)) / GALLERY_COLUMNS;

  return (
    <View style={styles.root}>
      {/*
        The hero runs under the status bar — the design's art bleeds to the top
        edge, so this screen draws its own chrome rather than using `Screen`,
        whose header starts below the inset.
      */}
      <View style={styles.hero}>
        {legendArt ? (
          <Image
            source={cardImage(legendArt, 'full')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={{ top: "14%", left: "50%" }}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <LinearGradient
            colors={[from, to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Top-down scrim so the controls stay legible over any art, and a
            heavier foot so the title never fights a bright frame. */}
        <LinearGradient
          colors={['rgba(15,15,16,0.82)', 'rgba(15,15,16,0.10)', 'rgba(15,15,16,0.92)', color.bg]}
          locations={[0, 0.36, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.heroControls, { top: insets.top + space[2] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.heroCircle, pressed && styles.pressed]}
          >
            <BackChevron />
          </Pressable>

          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy this deck's code to the clipboard"
              onPress={onExport}
              style={({ pressed }) => [styles.heroPill, pressed && styles.pressed]}
            >
              <Text style={styles.heroPillLabel}>Share</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit deck"
              onPress={() => router.push(`/deck/${id}/edit`)}
              style={({ pressed }) => [styles.heroPill, pressed && styles.pressed]}
            >
              <Text style={styles.heroPillLabel}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroTitle}>
          <Text style={styles.heroName} numberOfLines={2} accessibilityRole="header">
            {deck.name}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {metaLine(
              current ? `v${current.versionNumber}` : null,
              current?.label,
              deck.archivedAt ? 'Archived' : 'Current'
            )}
          </Text>
        </View>
      </View>

      {/* Identity, size and legality as chips — the design reads them as facts
          in a row rather than as a bar with a verdict. */}
      <View style={styles.chipRow}>
        {sortDomains(deck.domains).map((domain) => (
          <View key={domain} style={styles.chip}>
            <View style={[styles.chipDot, { backgroundColor: domainColor(domain).base }]} />
            <Text style={styles.chipLabel}>{domain}</Text>
          </View>
        ))}
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{totalCards} cards</Text>
        </View>
        <View style={[styles.chip, !legality.legal && styles.chipWarn]}>
          <Text style={[styles.chipLabel, !legality.legal && styles.chipWarnLabel]}>
            {legality.legal ? 'Legal' : '! Not legal'}
          </Text>
        </View>
      </View>

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
            {/*
              A sentence, not a bar. The design leads with what is wrong and
              what is fine — "one card short, everything else checks out" is
              the thing a builder acts on; a row of counters makes them derive
              it. The counts are still a tap away in the list below.
            */}
            {legality.legal ? null : (
              <View style={styles.callout}>
                <View style={styles.calloutMark}>
                  <Text style={styles.calloutMarkLabel}>!</Text>
                </View>
                <View style={styles.calloutBody}>
                  <Text style={styles.calloutTitle}>
                    Not legal{legality.issues[0] ? ` — ${legality.issues[0].message}` : ''}
                  </Text>
                  <Text style={styles.calloutNote}>
                    {legality.issues.length > 1
                      ? `${legality.issues.length - 1} more to fix.`
                      : 'Everything else checks out.'}
                  </Text>
                </View>
              </View>
            )}


            {/*
              What you own of this deck.
              *
              Copies are shared across decks the way physical cards are, so this
              is what is left for this deck after older ones have taken theirs —
              two decks each running three of a card you own three of do not
              both report a full set. Advisory only: nothing here blocks saving,
              logging, or tracking a deck you own none of, because playing
              online is a perfectly good reason to have one.
            */}
            {coverage && coverage.required > 0 ? (
              <View style={styles.coverage}>
                <Text style={styles.sectionLabel}>In your collection</Text>
                <Text
                  style={[
                    styles.coverageCount,
                    coverage.owned < coverage.required && styles.coverageShort,
                  ]}
                >
                  {coverage.owned}/{coverage.required} cards
                </Text>
                {coverage.shortfalls.length > 0 ? (
                  <Text style={styles.hint}>
                    Missing{' '}
                    {coverage.shortfalls
                      .slice(0, 4)
                      .map((s) => `${s.need - s.have}× ${s.name}`)
                      .join(', ')}
                    {coverage.shortfalls.length > 4
                      ? ` and ${coverage.shortfalls.length - 4} more`
                      : ''}
                    .
                  </Text>
                ) : null}
              </View>
            ) : null}

            {deck.notes ? <Text style={styles.notes}>{deck.notes}</Text> : null}

            {/*
              Deck preview. Rows read the list; gallery reads the deck — which
              cards you own the art of, and how the thing looks laid out. Two
              answers to different questions, so it is a toggle rather than a
              replacement.
            */}
            <View style={styles.previewHeader}>
              <Text style={styles.sectionLabel}>Deck preview</Text>
              <View style={styles.segmented}>
                {(['list', 'gallery'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected: preview === mode }}
                    onPress={() => setPreview(mode)}
                    style={({ pressed }) => [
                      styles.segment,
                      preview === mode && styles.segmentOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.segmentLabel, preview === mode && styles.segmentLabelOn]}
                    >
                      {mode === 'list' ? 'List' : 'Gallery'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {(preview === 'gallery'
              ? GALLERY_GROUPS.map((g) => ({
                  key: g.zones.join('+'),
                  label: g.label,
                  zones: g.zones,
                  fixed: false,
                }))
              : ZONE_ORDER.map((z) => ({
                  key: z.zone,
                  label: z.label,
                  zones: [z.zone],
                  fixed: z.fixed ?? false,
                }))
            ).map(({ key, label, zones, fixed }) => {
              const slots = list.slots
                .filter((s) => zones.includes(s.zone))
                .sort((a, b) => (a.card.energy ?? 99) - (b.card.energy ?? 99));
              if (slots.length === 0) return null;
              const count = slots.reduce((n, s) => n + s.quantity, 0);

              return (
                <View key={key} style={styles.zone}>
                  <View style={styles.zoneHeader}>
                    <Text style={styles.zoneLabel}>{label}</Text>
                    <Text style={styles.zoneCount}>{count}</Text>
                  </View>

                  {preview === 'list' ? (
                    slots.map((slot) => (
                      <DeckSlotRow
                        key={`${slot.zone}:${slot.card.id}`}
                        slot={slot}
                        fixed={fixed}
                        onAdjust={() => undefined}
                        onPress={() => router.push(`/card/${slot.card.id}`)}
                      />
                    ))
                  ) : (
                    <View style={styles.gallery}>
                      {slots.map((slot) => (
                        <Pressable
                          key={`${slot.zone}:${slot.card.id}`}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`${baseName(slot.card.name)}, ${slot.quantity} in deck`}
                          onPress={() => router.push(`/card/${slot.card.id}`)}
                          style={({ pressed }) => [
                            styles.galleryCell,
                            { width: cellWidth },
                            pressed && styles.pressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.galleryArt,
                              {
                                width: cellWidth,
                                height: isLandscapeCard(slot.card)
                                  ? cellWidth * GALLERY_ASPECT
                                  : cellWidth / GALLERY_ASPECT,
                              },
                            ]}
                          >
                            <Image
                              source={cardImage(slot.card.imageUrl, 'thumb')}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              accessible={false}
                            />
                            {slot.quantity > 1 ? (
                              <View style={styles.galleryCount}>
                                <Text style={styles.galleryCountLabel}>{slot.quantity}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.galleryName} numberOfLines={2}>
                            {baseName(slot.card.name)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Secondary actions, after the deck rather than in front of it. */}
            <View style={styles.footActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rename this deck or edit its notes"
                onPress={() => setEditingDeck(true)}
                style={({ pressed }) => [styles.footAction, pressed && styles.pressed]}
              >
                <Text style={styles.footActionLabel}>Deck details</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDelete}
                style={({ pressed }) => [styles.footAction, pressed && styles.pressed]}
              >
                <Text style={styles.deleteLabel}>Delete deck</Text>
              </Pressable>
            </View>
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
              expandedId={compareMode ? null : expandedVersion}
              renderDetail={(node) => (
                <VersionNodeDetail
                  diff={node.diff}
                  matchCount={node.matchCount}
                  isCurrent={node.isCurrent}
                  canDelete={
                    !node.isCurrent && !node.version.lockedAt && versions.length > 1
                  }
                  onOpen={() => {
                    setCurrentVersion(id, node.version.id);
                    setExpandedVersion(null);
                    load();
                  }}
                  onFork={() => {
                    // Editing forks from whichever version the deck points at,
                    // so making it current *is* forking from here.
                    setCurrentVersion(id, node.version.id);
                    router.push(`/deck/${id}/edit`);
                  }}
                  onRename={() => setEditingVersion(node.version)}
                  onDelete={() => onDeleteVersion(node.version.id)}
                />
              )}
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
        ) : tab === 'stats' ? (
          <View style={styles.overview}>
            {matches.length === 0 ? (
              <Text style={styles.hint}>
                Nothing to measure yet. Log a match and the record, the interval, and the
                per-version breakdown all appear here.
              </Text>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Record · all versions</Text>
                {/* The rate lives in the bar, which cannot render one without
                    its sample size and interval. */}
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
              </>
            )}
          </View>
        ) : null}
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

      <DetailsSheet
        visible={editingDeck}
        title="Deck details"
        nameLabel="Name"
        namePlaceholder="Deck name"
        initialName={deck.name}
        initialNotes={deck.notes ?? ''}
        notesPlaceholder="What is this deck trying to do? What did you last change?"
        onClose={() => setEditingDeck(false)}
        onSave={onSaveDeckDetails}
        secondary={{
          label: deck.archivedAt ? 'Restore from archive' : 'Archive this deck',
          onPress: onArchive,
        }}
      />

      <DetailsSheet
        visible={editingVersion !== null}
        title={`v${editingVersion?.versionNumber ?? ''}`}
        nameLabel="Label"
        namePlaceholder="−2 Bewitching Spirit"
        // Optional on purpose: an unlabelled version reads as "Untitled
        // change", which is true, and forcing a name would produce worse ones.
        nameRequired={false}
        initialName={editingVersion?.label ?? ''}
        initialNotes={editingVersion?.notes ?? ''}
        notesPlaceholder="Why did you make this change?"
        onClose={() => setEditingVersion(null)}
        onSave={onSaveVersionDetails}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },

  hero: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroControls: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15,15,16,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: { flexDirection: 'row', gap: space[2] },
  heroPill: {
    height: 36,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15,15,16,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPillLabel: { ...text.smallMedium, color: color.text },
  heroTitle: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    bottom: space[3],
    gap: space[1],
  },
  heroName: { ...text.title, fontSize: 23, color: color.text },
  heroMeta: { ...text.microMeta, color: color.textSecondary },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    // padding:14px 20px 16px
    paddingTop: 14,
    paddingHorizontal: space[5],
    paddingBottom: space[4],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    height: 28,
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipDot: { width: 7, height: 7, borderRadius: 2 },
  chipLabel: { ...text.microMeta, color: color.textMuted },
  chipWarn: { borderColor: 'rgba(217,147,46,0.5)' },
  chipWarnLabel: { color: color.warning },

  callout: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },
  calloutMark: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(217,147,46,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutMarkLabel: { ...text.microMeta, color: color.warning },
  calloutBody: { flex: 1, gap: space[0.5] },
  calloutTitle: { ...text.smallMedium, color: color.text },
  calloutNote: { ...text.caption, color: color.textMuted },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
  },
  segment: { height: 32, paddingHorizontal: space[4], justifyContent: 'center' },
  segmentOn: { backgroundColor: color.accent },
  segmentLabel: { ...text.smallMedium, fontSize: 11, color: color.textMuted },
  segmentLabelOn: { color: color.onAccent },

  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GALLERY_GAP,
    rowGap: space[4],
    paddingTop: 14,
  },
  galleryCell: { gap: space[1] },
  galleryArt: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  galleryCount: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    minWidth: 20,
    height: 20,
    paddingHorizontal: space[1],
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15,15,16,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryCountLabel: { ...text.numeric, fontSize: 11, color: color.text },
  galleryName: { ...text.caption, fontSize: 10.5, color: color.textMuted },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: space[5],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    // padding:13px 0 14px
    paddingTop: 13,
    paddingBottom: 14,
    alignItems: 'center',
    // The design marks the active tab with a rule under it, not a filled pill.
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: color.accent },
  tabLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    color: color.textMuted,
    textAlign: 'center',
  },
  tabLabelActive: { color: color.text },
  content: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[16],
    gap: space[5],
  },
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
  compareButtonActive: { backgroundColor: color.accent, borderColor: color.text },
  compareButtonLabel: { ...text.smallMedium, color: color.text },
  compareButtonLabelActive: { color: color.onAccent },
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
  notes: { ...text.small, color: color.textSecondary },
  coverage: { gap: space[1] },
  footActions: { flexDirection: 'row', gap: space[2], paddingTop: space[2] },
  footAction: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  footActionLabel: { ...text.smallMedium, color: color.textSecondary },
  coverageCount: { ...text.numeric, fontSize: 20, color: color.text },
  coverageShort: { color: color.warning },
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
    backgroundColor: color.accent,
  },
  editLabel: { ...text.smallMedium, color: color.onAccent },
  deleteLabel: { ...text.smallMedium, color: color.danger },
  pressed: { opacity: 0.8 },
});
