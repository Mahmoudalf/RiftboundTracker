import { StyleSheet, Text, View } from 'react-native';

import { WinRateBar } from '@/components/stats/WinRateBar';
import type { MatchRow } from '@/db/schema/matches';
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
import { matchesNeeded } from '@/lib/analytics/wilson';
import { matchStyleLabel } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The analytics view.
 *
 * Ordered by how directly each section answers a question a player actually
 * asks, and kept to four so the screen stays readable: how am I doing · does
 * going first matter · who beats me · where do I play best.
 *
 * Two of those depend on fields the log does not currently capture. Those
 * sections render as an instruction rather than as an empty chart — a section
 * that shows nothing teaches the user the feature is broken, while one that
 * says what to switch on teaches them how to get it.
 */

interface AnalyticsPanelProps {
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
          {hidden} more with fewer matches — hidden rather than ranked, since a
          single game does not place.
        </Text>
      ) : null}
    </View>
  );
}

export function AnalyticsPanel({ matches }: AnalyticsPanelProps) {
  const overall = rateOf(matches);
  const split = playDrawSplit(matches);
  const matchups = matchupSegments(matches);
  const styles_ = styleSegments(matches);
  const formats = bestOfSegments(matches);
  const run = streaks(matches);

  const playDrawVerdict = (() => {
    if (split.coverage.recorded === 0) return null;
    if (separable(split.onPlay, split.onDraw)) {
      const better = (split.onPlay.rate ?? 0) > (split.onDraw.rate ?? 0);
      return `Going ${better ? 'first' : 'second'} is measurably better for this deck.`;
    }

    /*
     * "Not enough yet" on its own is a dead end. `matchesNeeded` turns it into
     * something the player can act on — and returns null rather than a
     * discouraging number when the honest answer is "hundreds", in which case
     * the sentence stops at the finding.
     */
    const thinner =
      split.onPlay.decided <= split.onDraw.decided ? split.onPlay : split.onDraw;
    const more = matchesNeeded(thinner.wins, thinner.decided);

    return more === null
      ? 'Not enough to tell these apart yet — the intervals still overlap.'
      : `Not enough to tell these apart yet — about ${more} more ${
          more === 1 ? 'match' : 'matches'
        } would narrow this.`;
  })();

  return (
    <View style={styles.root}>
      <Section title="Record">
        <WinRateBar rate={overall} />
        {run.current !== 0 || run.longestWin > 1 || run.longestLoss > 1 ? (
          <Text style={styles.caption}>
            {run.current > 1
              ? `On a ${run.current}-match win streak. `
              : run.current < -1
                ? `On a ${-run.current}-match losing streak. `
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
            ? `From ${split.coverage.recorded} of ${split.coverage.total} matches where it was recorded.`
            : undefined
        }
      >
        {split.coverage.recorded === 0 ? (
          <NeedsData what="Nothing recorded yet. This fills in once the match log captures who went first — it is part of the in-depth logging still to come." />
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
          <NeedsData what="No opponents recorded yet. Pick the opponent’s Legend when you log a match and this fills in." />
        ) : (
          <>
            <SegmentList segments={matchups} />
            {split.coverage.recorded > 0 ? (
              <View style={styles.nested}>
                {matchups.slice(0, 3).map((segment) => {
                  const inner = matchupPlayDraw(matches, segment.key);
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
            ? 'Best-of is recorded per match, so this is what you actually played.'
            : undefined
        }
      >
        {formats.length === 0 ? (
          <NeedsData what="No format recorded yet. Pick Bo1, Bo3 or Bo5 when you log a match." />
        ) : (
          <SegmentList segments={formats} />
        )}
      </Section>

      <Section title="By match style">
        {styles_.length === 0 ? (
          <NeedsData what="No matches logged yet." />
        ) : (
          <SegmentList
            segments={styles_.map((s) => ({ ...s, label: matchStyleLabel(s.label) }))}
          />
        )}
      </Section>

      <Section title="Opening hands and mulligans">
        <NeedsData what="Not captured yet. This needs the in-depth match log — which cards were kept, what was mulliganed, and how those hands performed. It is the next thing worth building here." />
      </Section>

      <Text style={styles.footnote}>
        Every rate carries its 95% confidence interval. Grey means fewer than 20 decided matches:
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
  nested: { gap: space[1], paddingTop: space[1] },
  verdict: { ...text.small, color: color.textSecondary, paddingTop: space[1] },
  footnote: { ...text.microMeta, color: color.textFaint },
});
