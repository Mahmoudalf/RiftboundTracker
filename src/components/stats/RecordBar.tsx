import { StyleSheet, Text, View } from 'react-native';

import type { Rate } from '@/lib/analytics/summary';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A record drawn as what it is made of — wins, losses and draws, in proportion.
 *
 * From the Analytics hi-fi (`1_ANALYTIC02`, drawer rows). It is **not** a
 * replacement for `WinRateBar`, which draws a rate and its confidence interval
 * as a band and a marker and still owns deck detail and version compare. The
 * two answer different questions: `WinRateBar` says *how sure are we*, this
 * says *what happened*. The drawer wants the second, because a breakdown row is
 * read as "how did these twelve games go" rather than as an estimate.
 *
 * ---
 *
 * **The widths and the percentage share a denominator**, which is what makes
 * the row readable: every segment is a share of every game, and the percentage
 * is points over those same games — a draw contributing half a point and half
 * a segment. The green block and the number move together.
 *
 * That agreement is new. Until 2026-08-14 the rate ignored draws entirely, so a
 * 6–5–1 row drew twelve games and reported a rate over eleven.
 *
 * The counts inside the segments make it unambiguous either way: `6W 5L 1D`
 * cannot be misread whatever the arithmetic underneath.
 */

interface RecordBarProps {
  rate: Rate;
  label: string;
  /** An opponent's Champion, a set name — the second line of an identity. */
  sublabel?: string;
}

export function RecordBar({ rate, label, sublabel }: RecordBarProps) {
  const { wins, losses, draws, total } = rate;

  const share = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const record = `${wins}–${losses}` + (draws > 0 ? `–${draws}` : '');
  const percent = rate.rate === null ? '—' : `${Math.round(rate.rate * 100)}%`;

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.label, rate.provisional && styles.quiet]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.sublabel} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.track}>
        {/*
          Segments render only when non-zero. A zero-width `View` with a
          background still paints a hairline at some pixel densities, which
          reads as "one loss" on a row that has none.
        */}
        {wins > 0 ? (
          <View style={[styles.segment, styles.win, { width: `${share(wins)}%` }]}>
            <Text style={[styles.count, styles.onWin]} numberOfLines={1}>
              {wins}W
            </Text>
          </View>
        ) : null}
        {losses > 0 ? (
          <View style={[styles.segment, styles.loss, { width: `${share(losses)}%` }]}>
            <Text style={[styles.count, styles.onLoss]} numberOfLines={1}>
              {losses}L
            </Text>
          </View>
        ) : null}
        {draws > 0 ? (
          <View style={[styles.segment, styles.draw, { width: `${share(draws)}%` }]}>
            <Text style={[styles.count, styles.onDraw]} numberOfLines={1}>
              {draws}D
            </Text>
          </View>
        ) : null}
      </View>

      {/*
        No `n=`.

        The record is already the denominator — `6–5–1` is twelve games, said in
        a way that needs no notation — so printing `n=12` beside it restated the
        same fact in the one register a player does not think in. Provisional is
        carried by colour alone, which is the design's rule for these rows.
      */}
      <Text style={[styles.sub, rate.provisional && styles.quiet]}>
        {record} · {percent}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  label: { ...text.smallMedium, fontSize: 12.5, color: color.text, flexShrink: 1 },
  sublabel: { ...text.microMeta, color: color.textFaint, flexShrink: 1 },
  quiet: { color: color.provisional },

  track: {
    flexDirection: 'row',
    height: 22,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.borderSubtle,
    marginTop: space[1.5],
  },
  segment: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  win: { backgroundColor: color.win },
  loss: { backgroundColor: color.loss },
  draw: { backgroundColor: color.draw },
  count: { ...text.numeric, fontSize: 9.5, lineHeight: 22 },
  onWin: { color: color.onWin },
  onLoss: { color: color.onLoss },
  onDraw: { color: color.bg },

  sub: { ...text.microMeta, fontSize: 10, color: color.textFaint, marginTop: space[1] },
});
