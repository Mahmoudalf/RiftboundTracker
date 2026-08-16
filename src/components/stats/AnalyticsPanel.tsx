import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RecordBar } from '@/components/stats/RecordBar';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { cardNamesByIds } from '@/db/queries/cards';
import type { MatchRow, GameRow } from '@/db/schema/games';
import { useT } from '@/i18n';
import {
  findings as computeFindings,
  nextStep,
  CARD_SEEN_FLOOR,
  type Finding,
  type VersionRef,
} from '@/lib/analytics/findings';
import {
  cardHandStats,
  CLOSE_MARGIN,
  handCoverage,
  performanceByMulliganCount,
  scoreStats,
} from '@/lib/analytics/hands';
import {
  bestOfSegments,
  matchupKey,
  matchupSegments,
  playDrawSplit,
  rateOf,
  streaks,
  styleSegments,
  type Segment,
} from '@/lib/analytics/summary';
import { baseName } from '@/lib/card-identity';
import { gameStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The analytics view — built to the Hi-Fi `1_ANALYTIC02` handoff.
 *
 * Four states are drawn and all four are implemented: **rich** (anchor,
 * streaks, up to three findings, drawer collapsed), **sparse** (anchor plus one
 * honest line), **empty** (no games at all), and the **expanded drawer**.
 *
 * ---
 *
 * **The drawer is scoped by opponent.** Its first control picks *Overall* or
 * one Legend you have actually played against, and everything beneath answers
 * for that scope — turn order against Ahri, formats against Ahri, the hands you
 * kept against Ahri. The list offers only opponents with games behind them,
 * because an opponent you have never faced has nothing to say and a menu full
 * of them is a menu you stop reading.
 *
 * Findings deliberately stay **unscoped**. They are the screen's claims about
 * the deck, and silently re-deriving them from twelve games against one
 * opponent would turn a ranked conclusion into a coincidence.
 *
 * ---
 *
 * **Games and matches are separate props on purpose.** The per-*game* splits
 * and the per-*match* ones have different denominators — a Bo3 is one game and
 * up to three matches — so pooling them would silently weight long games higher
 * in exactly the breakdowns whose point is a trustworthy sample size.
 */

interface AnalyticsPanelProps {
  games: GameRow[];
  /** Every match inside those games. Empty until the in-depth pass is used. */
  matches: MatchRow[];
  /**
   * The deck's versions, newest first. Omitted when more than one deck is in
   * scope — version numbers are per deck, so pooling them would compare one
   * deck's v3 against another's.
   */
  versions?: VersionRef[];
  deckId?: string | null;
}

/** A drawer block of `RecordBar` rows, or the instruction to fill it in. */
interface BarGroup {
  title: string;
  rows: Segment[];
  /**
   * How much of the field was filled in.
   *
   * Not commentary — a denominator. Turn order and opening hands are optional
   * on the log form, so their breakdowns are computed from a subset, and a
   * split drawn from 3 of 40 games is not wrong but presenting it without
   * saying so invites a conclusion drawn from 7 % of the data.
   */
  note?: string;
  /** Shown instead of the rows when there are none. */
  needs: string;
}

/** A drawer block of bare figures, two to a row. */
interface StatGroup {
  title: string;
  pairs: { key: string; label: string; value: string }[];
}

/** Every game, whoever it was against. */
const ALL_OPPONENTS = '__all__';

function GroupTitle({ children }: { children: string }) {
  return <Text style={styles.groupTitle}>{children}</Text>;
}

function Tiles({ pairs }: { pairs: StatGroup['pairs'] }) {
  return (
    <View style={styles.tiles}>
      {pairs.map((pair) => (
        <View key={pair.key} style={styles.tile}>
          <Text style={styles.tileLabel} numberOfLines={1}>
            {pair.label}
          </Text>
          <Text style={styles.tileValue}>{pair.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * One finding: rank, claim, evidence, and a chevron when it leads somewhere.
 *
 * Only pressable when it has a destination — a card with a press state and
 * nowhere to go is worse than a card without one.
 */
function FindingCard({ finding, rank }: { finding: Finding; rank: number }) {
  const body = (
    <>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <View style={styles.findingBody}>
        <Text style={styles.findingClaim}>{finding.headline}</Text>
        <Text style={styles.findingEvidence}>{finding.evidence}</Text>
      </View>
    </>
  );

  const { link } = finding;
  if (!link) return <View style={styles.finding}>{body}</View>;

  /*
   * The route is built here rather than carried as a string on the finding, so
   * typed routes actually check it. A `string` href would need a cast at this
   * call, and a cast keeps compiling after a route is renamed — leaving a card
   * that presses and goes nowhere, which nothing in the suite could catch.
   */
  const open = () =>
    link.to === 'deck' ? router.push(`/deck/${link.id}`) : router.push(`/card/${link.id}`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${finding.headline} ${finding.evidence}`}
      onPress={open}
      style={({ pressed }) => [styles.finding, pressed && styles.pressed]}
    >
      {body}
      <View style={styles.chevron}>
        <Icon name="chevron-right" size={14} color={color.textFaint} />
      </View>
    </Pressable>
  );
}

export function AnalyticsPanel({
  games: allGames,
  matches: allMatches,
  versions,
  deckId = null,
}: AnalyticsPanelProps) {
  const t = useT();
  const [includeCasual, setIncludeCasual] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [opponent, setOpponent] = useState<string>(ALL_OPPONENTS);
  const [opponentOpen, setOpponentOpen] = useState(false);

  const casualCount = allGames.filter((game) => game.gameStyle === 'casual').length;
  /*
   * The chip appears only when it would change something.
   *
   * A filter that filters nothing is a control that teaches the reader it does
   * not work. It needs casual games to remove *and* something left afterwards.
   */
  const canFilter = casualCount > 0 && casualCount < allGames.length;
  const excluding = canFilter && !includeCasual;

  /*
   * `testing` is deliberately left in by both states.
   *
   * Goldfishing is not a game against a person and arguably belongs in neither
   * number, but the chip says *casual* — quietly dropping a second style under
   * a label that does not mention it is the dishonest option. The style has not
   * been offered by the log form since the M6 vocabulary split, so what remains
   * is a handful of legacy rows.
   */
  const games = excluding
    ? allGames.filter((game) => game.gameStyle !== 'casual')
    : allGames;
  const keptGameIds = new Set(games.map((game) => game.id));
  const matches = excluding
    ? allMatches.filter((match) => keptGameIds.has(match.gameId))
    : allMatches;

  const overall = rateOf(games);
  const run = streaks(games);
  const matchups = matchupSegments(games);

  const topCards = cardHandStats(matches).slice(0, 6);
  const findingCard = cardHandStats(matches, CARD_SEEN_FLOOR)[0];
  /*
   * One name lookup for both consumers.
   *
   * The drawer lists the top six at `cardHandStats`' own floor of three; the
   * finding names one card at the stricter `CARD_SEEN_FLOOR`, which is a subset
   * by definition but not necessarily inside that six. Resolving the union in a
   * single query keeps this to one read — resolving names for the whole deck to
   * render six rows is the waste that measured at 88 % of a tap in the
   * collection audit.
   */
  const cardNames = cardNamesByIds([
    ...topCards.map((card) => card.cardId),
    ...(findingCard ? [findingCard.cardId] : []),
  ]);
  const nameOf = (id: string) => {
    const name = cardNames.get(id);
    return name ? baseName(name) : null;
  };

  const found = computeFindings(games, matches, { versions, deckId, cardName: nameOf });
  const step = found.length === 0 ? nextStep(games) : null;

  /*
   * Nothing logged at all is its own screen in the design, not an anchor
   * reading "—". A rate of nothing is not a small rate.
   */
  if (allGames.length === 0) {
    return (
      <EmptyState
        title={t('analytics.empty')}
        body={t('analytics.empty.body')}
        actions={[
          { label: t('ui.logGame'), onPress: () => router.push('/game/new'), primary: true },
        ]}
      />
    );
  }

  /*
   * Only opponents with games behind them, and `Overall` first.
   *
   * Held to what was actually played rather than to the card library: a list of
   * every Legend in the game would be a menu of a hundred entries, ninety-seven
   * of which answer "no games".
   */
  const opponentOptions: DropdownOption<string>[] = [
    { value: ALL_OPPONENTS, label: t('analytics.overall'), meta: t('analytics.gamesCount', { count: games.length }) },
    ...matchups.map((segment) => ({
      value: segment.key,
      label: segment.sublabel ? `${segment.label} · ${segment.sublabel}` : segment.label,
      /*
       * The record and the rate, so the open menu *is* the matchup table.
       * There is no separate list of every opponent any more — this answers
       * "who have I played, and how did it go" in the one place you go to ask.
       */
      meta:
        `${segment.rate.wins}–${segment.rate.losses}` +
        (segment.rate.draws > 0 ? `–${segment.rate.draws}` : '') +
        (segment.rate.rate === null ? '' : ` · ${Math.round(segment.rate.rate * 100)}%`),
    })),
  ];

  /*
   * A deck switch can leave the selection pointing at an opponent this deck has
   * never faced. Falling back to Overall keeps the drawer showing something
   * true; leaving it would show an empty breakdown under a live-looking label.
   */
  const scope = opponentOptions.some((option) => option.value === opponent)
    ? opponent
    : ALL_OPPONENTS;
  const scoped = scope === ALL_OPPONENTS;

  const scopedGames = scoped ? games : games.filter((game) => matchupKey(game) === scope);
  const scopedGameIds = new Set(scopedGames.map((game) => game.id));
  const scopedMatches = scoped
    ? matches
    : matches.filter((match) => scopedGameIds.has(match.gameId));

  const split = playDrawSplit(scopedGames);
  const scopedHands = handCoverage(scopedMatches);
  const scopedScores = scoreStats(scopedMatches);
  const scopedCards = cardHandStats(scopedMatches).slice(0, 6);
  const scopeLabel = opponentOptions.find((option) => option.value === scope)?.label ?? t('analytics.overall');

  const barGroups: BarGroup[] = [
    {
      /*
       * The record for whatever is selected — one row, never a list.
       *
       * This first drew every opponent as its own bar under *Overall*, which
       * was wrong: the question the drawer answers is "how does my deck do",
       * broken down. The per-opponent spread lives in the `AGAINST` menu, where
       * each entry carries its own record, so listing it again underneath was
       * the same table twice with the selected scope buried in it.
       */
      title: t('analytics.record'),
      rows: [{ key: 'scope', label: scopeLabel, rate: rateOf(scopedGames) }],
      needs: t('analytics.needs.scope'),
    },
    {
      title: t('analytics.turnOrder'),
      /*
       * Each side appears only if it happened. A deck that has always gone
       * first should not carry a "Went second · 0–0 · n=0" row: an empty row
       * reads as a result, and there is no result to read.
       */
      rows: [
        { key: 'play', label: t('analytics.wentFirst'), rate: split.onPlay },
        { key: 'draw', label: t('analytics.wentSecond'), rate: split.onDraw },
      ].filter((row) => row.rate.total > 0),
      note: t('analytics.from.games', {
        recorded: split.coverage.recorded,
        total: split.coverage.total,
      }),
      needs: t('analytics.needs.turnOrder'),
    },
    {
      title: t('analytics.format'),
      rows: bestOfSegments(scopedGames),
      // Named the options, so it had to stop naming Bo5 the moment the log form
      // did. Only reachable now on games logged before that form always
      // recorded a format.
      needs: t('analytics.needs.format'),
    },
    {
      title: t('analytics.gameStyle'),
      rows: styleSegments(scopedGames).map((s) => ({ ...s, label: gameStyleLabel(s.label) })),
      needs: t('analytics.needs.style'),
    },
    {
      title: t('analytics.openingHands'),
      rows: performanceByMulliganCount(scopedMatches),
      note: t('analytics.from.deals', {
        recorded: scopedHands.recorded,
        total: scopedHands.total,
      }),
      needs: t('analytics.needs.hands'),
    },
    {
      title: t('analytics.howClose'),
      rows: scopedScores.segments,
      note: t('analytics.from.scores', {
        recorded: scopedScores.coverage.recorded,
        total: scopedScores.coverage.total,
        margin: CLOSE_MARGIN,
      }),
      needs: t('analytics.needs.scores'),
    },
  ];

  const statGroups: StatGroup[] = [];

  if (scopedCards.length > 0) {
    statGroups.push({
      title: t('analytics.cardsThrownBack'),
      pairs: scopedCards.map((card) => ({
        key: card.cardId,
        label: nameOf(card.cardId) ?? t('analytics.cardGone'),
        value: `${Math.round(card.mulliganRate * 100)}% back · ${card.mulliganed} of ${card.seen}`,
      })),
    });
  }

  if (scopedScores.concededInWins !== null || scopedScores.scoredInLosses !== null) {
    statGroups.push({
      title: t('analytics.scoreMargin'),
      pairs: [
        {
          key: 'wins',
          label: t('analytics.theyScoredInWins'),
          value:
            scopedScores.concededInWins === null
              ? '—'
              : `${scopedScores.concededInWins.toFixed(1)} pts`,
        },
        {
          key: 'losses',
          label: t('analytics.youScoredInLosses'),
          value:
            scopedScores.scoredInLosses === null
              ? '—'
              : `${scopedScores.scoredInLosses.toFixed(1)} pts`,
        },
      ],
    });
  }

  const provisional = overall.provisional;
  const recordLine =
    `${overall.wins}–${overall.losses}` + (overall.draws > 0 ? `–${overall.draws}` : '');

  return (
    <View style={styles.root}>
      {canFilter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: includeCasual }}
          accessibilityLabel={t(
            includeCasual ? 'analytics.casual.a11y.on' : 'analytics.casual.a11y.off'
          )}
          onPress={() => setIncludeCasual((on) => !on)}
          style={({ pressed }) => [
            styles.chip,
            includeCasual ? styles.chipOn : styles.chipOff,
            pressed && styles.pressed,
          ]}
        >
          {includeCasual ? <Icon name="check" size={12} color={color.accentBright} /> : null}
          <Text style={[styles.chipLabel, includeCasual && styles.chipLabelOn]}>{t('analytics.casualGames')}</Text>
        </Pressable>
      ) : null}

      {/*
        The anchor. Numerals, not a bar: a bar's job is "this one is longer than
        that one", and a single overall rate has nothing beside it to be longer
        than. Under 20 games the whole card recedes — the design's one
        deliberate use of words for uncertainty, everywhere else it is colour.
      */}
      <View style={[styles.anchor, provisional && styles.anchorProvisional]}>
        <View style={styles.anchorHead}>
          <Text style={[styles.anchorRate, provisional && styles.anchorRateQuiet]}>
            {overall.rate === null ? '—' : `${Math.round(overall.rate * 100)}%`}
          </Text>
          <Text style={[styles.anchorUnit, provisional && styles.anchorUnitQuiet]}>{t('analytics.winRate')}</Text>
        </View>
        <Text style={[styles.anchorRecord, provisional && styles.anchorRecordQuiet]}>
          {recordLine}
          <Text style={[styles.anchorGames, provisional && styles.anchorCiQuiet]}>
            {' '}
            · {overall.total} {overall.total === 1 ? 'game' : 'games'}
          </Text>
        </Text>
        <Text style={[styles.anchorCi, provisional && styles.anchorCiQuiet]}>
          {overall.interval === null
            ? t('analytics.noGamesYet')
            : t(provisional ? 'analytics.ci.provisional' : 'analytics.ci', {
                low: Math.round(overall.interval.low * 100),
                high: Math.round(overall.interval.high * 100),
              })}
        </Text>
      </View>

      {/*
        Streaks sit directly under the rate rather than at the foot of the
        drawer. They are the one figure here that is *about right now* — the
        anchor is a lifetime average and cannot say you have lost the last four.
      */}
      {run.current !== 0 || run.longestWin > 0 || run.longestLoss > 0 ? (
        <Tiles
          pairs={[
            {
              key: 'current',
              label: t('analytics.currentStreak'),
              value:
                run.current === 0
                  ? t('analytics.streak.none')
                  : `${run.current > 0 ? 'W' : 'L'}${Math.abs(run.current)}`,
            },
            {
              key: 'longest',
              label: t('analytics.longestRun'),
              value: `W${run.longestWin} · L${run.longestLoss}`,
            },
          ]}
        />
      ) : null}

      {found.length > 0 ? (
        <View>
          <GroupTitle>{t('analytics.findings')}</GroupTitle>
          <View style={styles.findings}>
            {found.map((finding, index) => (
              <FindingCard key={finding.key} finding={finding} rank={index + 1} />
            ))}
          </View>
        </View>
      ) : step ? (
        <View style={styles.sparse}>
          <Text style={styles.sparseText}>{step}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: drawerOpen }}
        onPress={() => setDrawerOpen((open) => !open)}
        style={({ pressed }) => [
          styles.drawerToggle,
          drawerOpen && styles.drawerToggleOpen,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.drawerLabel, drawerOpen && styles.drawerLabelOpen]}>{t('analytics.moreBreakdowns')}</Text>
        {/* Drawn, not typed: `⌄` is exactly the kind of character a font
            fallback renders as tofu, which M1 banned after it happened. */}
        <View style={drawerOpen ? styles.caretUp : styles.caretDown}>
          <Icon
            name="chevron-right"
            size={14}
            color={drawerOpen ? color.accentBright : color.textMuted}
          />
        </View>
      </Pressable>

      {drawerOpen ? (
        <View style={styles.drawer}>
          <View>
            <GroupTitle>{t('analytics.against')}</GroupTitle>
            <Dropdown
              label={t('analytics.opponent')}
              value={scope}
              options={opponentOptions}
              open={opponentOpen}
              onOpenChange={setOpponentOpen}
              onSelect={setOpponent}
            />
            {!scoped ? (
              <Text style={styles.scopeNote}>
                Everything below is {scopeLabel} only — {scopedGames.length}{' '}
                {scopedGames.length === 1 ? 'game' : 'games'}.
              </Text>
            ) : null}
          </View>

          {barGroups.map((group) => (
            <View key={group.title}>
              <GroupTitle>{group.title}</GroupTitle>
              {group.rows.length === 0 ? (
                <Text style={styles.needs}>{group.needs}</Text>
              ) : (
                <View style={styles.barRows}>
                  {group.note ? <Text style={styles.groupNote}>{group.note}</Text> : null}
                  {group.rows.map((row) => (
                    <RecordBar
                      key={row.key}
                      rate={row.rate}
                      label={row.label}
                      sublabel={row.sublabel}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}

          {statGroups.map((group) => (
            <View key={group.title}>
              <GroupTitle>{group.title}</GroupTitle>
              <Tiles pairs={group.pairs} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[5], paddingBottom: space[16] },

  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    height: 30,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accentBorder },
  chipOff: { backgroundColor: 'transparent', borderColor: color.borderControl },
  chipLabel: { ...text.small, fontSize: 11.5, color: color.textMuted },
  chipLabelOn: { color: color.accentBright },

  anchor: {
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    padding: space[5],
  },
  anchorProvisional: { borderWidth: 1, borderColor: color.borderSubtle },
  anchorHead: { flexDirection: 'row', alignItems: 'baseline', gap: space[2.5] },
  anchorRate: { ...text.stat, fontSize: 46, lineHeight: 50, color: color.text },
  anchorRateQuiet: { color: color.provisional },
  anchorUnit: { ...text.microMeta, fontSize: 12, color: color.textFaint },
  anchorUnitQuiet: { color: color.textHint },
  anchorRecord: {
    ...text.numeric,
    fontSize: 16,
    color: color.textSecondary,
    marginTop: space[2.5],
  },
  anchorRecordQuiet: { color: color.provisional },
  anchorGames: { color: color.textFaint },
  anchorCi: { ...text.microMeta, fontSize: 11.5, color: color.textFaint, marginTop: space[1.5] },
  anchorCiQuiet: { color: color.textHint },

  groupTitle: { ...text.meta, fontSize: 10, color: color.textFaint, marginBottom: space[3] },

  findings: { gap: space[3] },
  finding: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  rank: { ...text.numeric, fontSize: 10, color: color.textGhost, paddingTop: 2 },
  findingBody: { flex: 1, minWidth: 0 },
  findingClaim: { ...text.bodyMedium, fontSize: 14.5, lineHeight: 20, color: color.text },
  findingEvidence: {
    ...text.numeric,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.textDim,
    marginTop: space[2],
  },
  chevron: { paddingTop: 3 },

  sparse: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space[5],
    alignItems: 'center',
  },
  sparseText: {
    ...text.small,
    lineHeight: 20,
    color: color.textMuted,
    textAlign: 'center',
  },

  divider: { height: 1, backgroundColor: color.border },

  drawerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderControl,
  },
  drawerToggleOpen: {
    borderColor: color.accentBorder,
    backgroundColor: color.accentSoft,
  },
  drawerLabel: { ...text.smallMedium, color: color.text },
  drawerLabelOpen: { color: color.accentBright },
  caretDown: { transform: [{ rotate: '90deg' }] },
  caretUp: { transform: [{ rotate: '-90deg' }] },

  drawer: { gap: space[6] },
  scopeNote: { ...text.microMeta, color: color.textFaint, marginTop: space[2] },
  groupNote: { ...text.microMeta, fontSize: 10, lineHeight: 15, color: color.textHint },
  barRows: { gap: space[4] },
  needs: {
    ...text.small,
    color: color.textMuted,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderSubtle,
    padding: space[3],
  },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2.5] },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.md,
    backgroundColor: color.borderSubtle,
    padding: space[3],
  },
  tileLabel: { ...text.small, fontSize: 10, color: color.textMuted, marginBottom: space[1] },
  tileValue: { ...text.numeric, fontSize: 13.5, color: color.text },

  pressed: { opacity: 0.75 },
});
