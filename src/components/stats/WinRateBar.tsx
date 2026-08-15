import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import type { Rate } from '@/lib/analytics/summary';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A win rate, drawn so the uncertainty is impossible to ignore.
 *
 * The bar has two parts. The **band** is the 95 % confidence interval; the
 * **marker** is the observed rate. A wide band is the picture of "we do not
 * really know yet", and it is drawn at the same weight as the number so it
 * cannot be skimmed past — which is the entire reason for using a bar here
 * rather than printing a percentage.
 *
 * At small samples the band is nearly the whole track. That is not a rendering
 * problem, it is the finding.
 */

interface WinRateBarProps {
  rate: Rate;
  /** Shown above the bar. */
  label?: string;
  sublabel?: string;
  compact?: boolean;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function WinRateBar({ rate, label, sublabel, compact = false }: WinRateBarProps) {
  const t = useT();
  const record =
    `${rate.wins}–${rate.losses}` + (rate.draws > 0 ? `–${rate.draws}` : '');

  return (
    <View style={styles.root}>
      {label ? (
        <View style={styles.header}>
          <View style={styles.labels}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            {sublabel ? (
              <Text style={styles.sublabel} numberOfLines={1}>
                {sublabel}
              </Text>
            ) : null}
          </View>
          <Text style={styles.record}>{record}</Text>
        </View>
      ) : null}

      {/*
        One branch, not two. `rate` is null only at zero games now — under the
        half-point rule a history of nothing but draws has a real rate of 50 %,
        so "played, none decided" describes a state that can no longer exist.
      */}
      {rate.rate === null || !rate.interval ? (
        <Text style={styles.undecided}>{t('winRate.noMatches')}</Text>
      ) : (
        <>
          <View style={[styles.track, compact && styles.trackCompact]}>
            <View
              style={[
                styles.band,
                rate.provisional && styles.bandProvisional,
                {
                  left: `${rate.interval.low * 100}%`,
                  width: `${(rate.interval.high - rate.interval.low) * 100}%`,
                },
              ]}
            />
            {/* Midpoint reference — above 50 % is winning, and the eye should
                not have to estimate where that is. */}
            <View style={styles.midpoint} />
            <View
              style={[
                styles.marker,
                rate.provisional && styles.markerProvisional,
                { left: `${rate.rate * 100}%` },
              ]}
            />
          </View>

          <Text style={[styles.readout, rate.provisional && styles.provisional]}>
            {pct(rate.rate)} · {record} · 95% CI {pct(rate.interval.low)}–
            {pct(rate.interval.high)}
            {rate.provisional ? ' · provisional' : ''}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[1.5] },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space[3] },
  labels: { flex: 1, gap: space[0.5] },
  label: { ...text.smallMedium, color: color.text },
  sublabel: { ...text.microMeta, color: color.textMuted },
  record: { ...text.numeric, fontSize: 13, color: color.textSecondary },

  track: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.borderSubtle,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackCompact: { height: 8 },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: color.win,
    opacity: 0.35,
  },
  bandProvisional: { backgroundColor: color.provisional, opacity: 0.3 },
  midpoint: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: color.border,
  },
  marker: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 2,
    marginLeft: -1,
    backgroundColor: color.win,
  },
  markerProvisional: { backgroundColor: color.textSecondary },

  readout: { ...text.microMeta, color: color.textSecondary },
  provisional: { color: color.provisional },
  undecided: { ...text.microMeta, color: color.textFaint },
});
