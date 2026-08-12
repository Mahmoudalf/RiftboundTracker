import { StyleSheet, Text, View } from 'react-native';

import { WinRateBar } from '@/components/stats/WinRateBar';
import { cardNamesByIds } from '@/db/queries/cards';
import type { MatchRow, GameRow } from '@/db/schema/games';
import {
  cardHandStats,
  CLOSE_MARGIN,
  handCoverage,
  performanceByMulliganCount,
  scoreStats,
} from '@/lib/analytics/hands';
import {
  bestOfSegments,
  matchupPlayDraw,
  matchupSegments,
  playDrawSplit,
  rateOf,
  separable,
  streaks,
  styleSegments,
  type Segment,
} from '@/lib/analytics/summary';
import { gamesNeeded } from '@/lib/analytics/wilson';
import { baseName } from '@/lib/card-identity';
import { gameStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The analytics view.
 *
 * Ordered by how directly each section answers a question a player actually
 * asks: how am I doing · does going first matter · who beats me · where do I
 * play best — and then the three that come from the in-depth pass.
 *
 * A section with nothing behind it renders as an instruction rather than as an
 * empty chart. A section that shows nothing teaches the user the feature is
 * broken; one that says what to fill in teaches them how to get it.
 *
 * **Games and matches are separate props on purpose.** The first four sections
 * are per-*game* and the last three per-*match*, and the two have different
 * denominators — a Bo3 is one game and up to three matches, so pooling them
 * would silently weight long games higher in exactly the breakdowns whose
 * whole point is a trustworthy sample size.
 */

interface AnalyticsPanelProps {
  games: GameRow[];
  /** Every match inside those games. Empty until the in-depth pass is used. */
  matches: MatchRow[];
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

/** A section that cannot be computed yet, and what would make it computable. */
function NeedsData({ what }: { what: string }) {
  return <Text style={styles.needs}>{what}</Text>;
}

function SegmentList({ segments, limit = 6 }: { segments: Segment[]; limit?: number }) {
  const shown = segments.slice(0, limit);
  const hidden = segments.length - shown.length;

  return (
    <View style={styles.segments}>
      {shown.map((segment) => (
        <WinRateBar
          key={segment.key}
          rate={segment.rate}
          label={segment.label}
          sublabel={segment.sublabel}
          compact
        />
      ))}
      {hidden > 0 ? (
        <Text style={styles.caption}>
          {hidden} more with fewer games — hidden rather than ranked, since a
          single game does not place.
        </Text>
      ) : null}
    </View>
  );
}

export function AnalyticsPanel({ games, matches }: AnalyticsPanelProps) {
  const overall = rateOf(games);
  const split = playDrawSplit(games);
  const matchups = matchupSegments(games);
  const styles_ = styleSegments(games);
  const formats = bestOfSegments(games);
  const run = streaks(games);

  const hands = handCoverage(matches);
  const mulliganSegments = performanceByMulliganCount(matches);
  const cards = cardHandStats(matches);
  const scores = scoreStats(matches);

  /*
   * Only the cards actually about to be drawn.
   *
   * `cardHandStats` already drops anything seen fewer than three times, and the
   * list is capped at six below — resolving names for the whole deck to render
   * six rows is the kind of waste that measured at 88 % of a tap in the
   * collection audit.
   */
  const topCards = cards.slice(0, 6);
  const cardNames = cardNamesByIds(topCards.map((c) => c.cardId));

  const playDrawVerdict = (() => {
    if (split.coverage.recorded === 0) return null;
    if (separable(split.onPlay, split.onDraw)) {
      const better = (split.onPlay.rate ?? 0) > (split.onDraw.rate ?? 0);
      return `Going ${better ? 'first' : 'second'} is measurably better for this deck.`;
    }

    /*
     * "Not enough yet" on its own is a dead end. `gamesNeeded` turns it into
     * something the player can act on — and returns null rather than a
     * discouraging number when the honest answer is "hundreds", in which case
     * the sentence stops at the finding.
     */
    const thinner =
      split.onPlay.decided <= split.onDraw.decided ? split.onPlay : split.onDraw;
    const more = gamesNeeded(thinner.wins, thinner.decided);

    return more === null
      ? 'Not enough to tell these apart yet — the intervals still overlap.'
      : `Not enough to tell these apart yet — about ${more} more ${
          more === 1 ? 'game' : 'games'
        } would narrow this.`;
  })();

  return (
    <View style={styles.root}>
      <Section title="Record">
        <WinRateBar rate={overall} />
        {run.current !== 0 || run.longestWin > 1 || run.longestLoss > 1 ? (
          <Text style={styles.caption}>
            {run.current > 1
              ? `On a ${run.current}-game win streak. `
              : run.current < -1
                ? `On a ${-run.current}-game losing streak. `
                : ''}
            Best run {run.longestWin}W · worst {run.longestLoss}L.
          </Text>
        ) : null}
        {overall.draws > 0 ? (
          <Text style={styles.caption}>
            Draws are counted in the record but not in the rate — a draw is not half a loss.
          </Text>
        ) : null}
      </Section>

      <Section
        title="Going first or second"
        caption={
          split.coverage.recorded > 0
            ? `From ${split.coverage.recorded} of ${split.coverage.total} games where it was recorded.`
            : undefined
        }
      >
        {/*
          The empty state below said turn order was "part of the in-depth
          logging still to come". It has been on the log form since gap 13 was
          closed, so it was blaming a missing feature for an unanswered question
          — and telling the user to wait for something they already have.
        */}
        {split.coverage.recorded === 0 ? (
          <NeedsData what="Nothing recorded yet. Each match on the log form asks who went first; answer it and this fills in." />
        ) : (
          <>
            <WinRateBar rate={split.onPlay} label="On the play" compact />
            <WinRateBar rate={split.onDraw} label="On the draw" compact />
            {playDrawVerdict ? <Text style={styles.verdict}>{playDrawVerdict}</Text> : null}
          </>
        )}
      </Section>

      <Section
        title="Matchups"
        caption={matchups.length > 0 ? 'Against each Legend and their Chosen Champion.' : undefined}
      >
        {matchups.length === 0 ? (
          <NeedsData what="No opponents recorded yet. Pick the opponent’s Legend when you log a game and this fills in." />
        ) : (
          <>
            <SegmentList segments={matchups} />
            {split.coverage.recorded > 0 ? (
              <View style={styles.nested}>
                {matchups.slice(0, 3).map((segment) => {
                  const inner = matchupPlayDraw(games, segment.key);
                  if (!inner || inner.coverage.recorded === 0) return null;
                  return (
                    <Text key={segment.key} style={styles.caption}>
                      {segment.label}: on the play {inner.onPlay.wins}–{inner.onPlay.losses} ·
                      on the draw {inner.onDraw.wins}–{inner.onDraw.losses}
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </Section>

      <Section
        title="By format"
        caption={
          formats.length > 0
            ? 'Best-of is recorded per game, so this is what you actually played.'
            : undefined
        }
      >
        {formats.length === 0 ? (
          // Named the options, so it had to stop naming Bo5 the moment the log
          // form did. Only reachable now on games logged before that form
          // always recorded a format.
          <NeedsData what="No format recorded yet. Every game logged from here on records Bo1 or Bo3." />
        ) : (
          <SegmentList segments={formats} />
        )}
      </Section>

      <Section title="By game style">
        {styles_.length === 0 ? (
          <NeedsData what="No games logged yet." />
        ) : (
          <SegmentList
            segments={styles_.map((s) => ({ ...s, label: gameStyleLabel(s.label) }))}
          />
        )}
      </Section>

      <Section
        title="Opening hands and mulligans"
        caption={
          hands.recorded > 0
            ? `From ${hands.recorded} of ${hands.total} matches where the deal was recorded.`
            : undefined
        }
      >
        {hands.recorded === 0 ? (
          <NeedsData what="No opening deals recorded yet. Open a logged game, choose Add match detail, and tap the cards you were dealt — once for a card you kept, twice for one you sent back." />
        ) : (
          <>
            <SegmentList segments={mulliganSegments} />
            <Text style={styles.caption}>
              A hand you mulligan was a bad hand — the mulligan is the response, not the cause.
              This says how those hands ended up, not what the decision cost you.
            </Text>
          </>
        )}
      </Section>

      {topCards.length > 0 ? (
        <Section
          title="Cards you throw back"
          caption="Out of the matches each card was actually dealt to you."
        >
          <View style={styles.segments}>
            {topCards.map((card) => (
              <View key={card.cardId} style={styles.cardRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {(() => {
                    const name = cardNames.get(card.cardId);
                    return name ? baseName(name) : 'A card no longer in the library';
                  })()}
                </Text>
                <Text style={styles.cardStat}>
                  {Math.round(card.mulliganRate * 100)}% back · {card.mulliganed} of {card.seen}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.caption}>
            Cards seen fewer than three times are left out — one mulligan of a card drawn once
            tops any list at 100% and buries the card you have a real problem with.
          </Text>
        </Section>
      ) : null}

      <Section
        title="How close the matches were"
        caption={
          scores.coverage.recorded > 0
            ? `From ${scores.coverage.recorded} of ${scores.coverage.total} matches where the score was recorded.`
            : undefined
        }
      >
        {scores.coverage.recorded === 0 ? (
          <NeedsData what="No scores recorded yet. Riftbound scores to 8, and winning 8–7 is a different match from winning 8–0 — the result column cannot tell them apart. Add it from a logged game." />
        ) : (
          <>
            <SegmentList segments={scores.segments} />
            {scores.concededInWins !== null ? (
              <Text style={styles.caption}>
                In matches you won, they averaged {scores.concededInWins.toFixed(1)} points.
              </Text>
            ) : null}
            {scores.scoredInLosses !== null ? (
              <Text style={styles.caption}>
                In matches you lost, you averaged {scores.scoredInLosses.toFixed(1)}.
              </Text>
            ) : null}
            <Text style={styles.caption}>
              Close means decided by {CLOSE_MARGIN} points or fewer. Draws are left out of both —
              they have no margin to be close by.
            </Text>
          </>
        )}
      </Section>

      {/*
        "When your Champion lands" was here, and went with migration 19.

        It split at the deck's own median so "early" meant early *for this
        deck* — which was the right handling of the wrong number. A landing
        turn cannot say whether it was early or late without the board it
        landed on, so the average read as information without being any.
      */}

      <Text style={styles.footnote}>
        Every rate carries its 95% confidence interval. Grey means fewer than 20 decided games:
        the number is real, but the interval is too wide to act on. Differences between versions
        or matchups are correlational — the metagame shifts and pilots improve.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6], paddingBottom: space[16] },
  section: { gap: space[2] },
  sectionTitle: { ...text.meta, color: color.textSecondary },
  caption: { ...text.microMeta, color: color.textMuted },
  needs: {
    ...text.small,
    color: color.textMuted,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderSubtle,
    padding: space[3],
  },
  segments: { gap: space[3] },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  cardName: { ...text.small, color: color.text, flexShrink: 1 },
  cardStat: { ...text.numeric, fontSize: 12, color: color.textMuted },
  nested: { gap: space[1], paddingTop: space[1] },
  verdict: { ...text.small, color: color.textSecondary, paddingTop: space[1] },
  footnote: { ...text.microMeta, color: color.textFaint },
});
