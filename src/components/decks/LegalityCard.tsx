import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import type { LegalityResult } from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * What is wrong with the deck, when something is.
 *
 * The design drew this as a card carrying the counts in mono with the problem
 * underneath, and it held that shape until the editor's zone tabs took the
 * counts over. Those tabs are a better home for a fraction than any readout:
 * they print `12/12` against the zone's own threshold *and* are the control you
 * press to go and change it.
 *
 * So what is left here is the half the tabs cannot show — a fourth copy of a
 * card, an off-identity card, a Champion that does not partner the Legend — plus
 * the unresolved-cards note and the fork warning. With none of those, the
 * component renders **nothing**: a bordered box reading "Legal" costs the same
 * space as one that says something.
 *
 * From the design, for the states that do render: `padding 11px 13px · radius 12
 * · background #1B1B1E · border rgba(255,255,255,.08)`, an 18px ringed amber `!`,
 * text at `400 11.5px`.
 */

export interface LegalityCardProps {
  legality: LegalityResult;
  /**
   * Cards in the deck the library cannot draw. The zone counts are short by
   * exactly this much, and without saying so the deck just looks wrong.
   */
  unresolved?: number;
  /** Shown under a rule, e.g. what saving will do to the version history. */
  footnote?: string | null;
}

export function LegalityCard({
  legality,
  unresolved = 0,
  footnote = null,
}: LegalityCardProps) {
  const t = useT();
  const { issues } = legality;

  /**
   * The first issue the **counts cannot state on their own**.
   *
   * The editor's zone tabs now carry `40/40+`, `12/12`, `3/3`, so a `-count`
   * issue is already on screen, in the control you would use to fix it, in a
   * colour. Repeating it here as a sentence is the third copy of one fact that
   * this card was carrying until now.
   *
   * What the tabs cannot say is everything else: a fourth copy of a card, an
   * off-identity card, a Champion that does not partner the Legend, one
   * Signature too many. Those are what this card is for.
   *
   * The same rule `LegalityBar` already applies, and for the same stated reason
   * — *"count issues are already shown as numbers, so the line adds what they
   * can't"*.
   */
  const spoken = issues.find((issue) => !issue.code.endsWith('-count')) ?? null;
  const otherSpoken = issues.filter((issue) => !issue.code.endsWith('-count')).length - 1;

  /*
   * Silent unless there is something to report.
   *
   * A card that renders "Legal" into a bordered box is a box saying nothing,
   * and it costs the same vertical space as one saying something. Nothing to
   * fix, nothing unresolved and no fork warning means no card — which is the
   * same principle the verdict line itself moved to: only speak when something
   * is wrong.
   */
  if (!spoken && unresolved === 0 && !footnote) return null;

  return (
    <View style={styles.card}>
      {spoken ? (
        <View style={styles.head}>
          <View style={[styles.mark, styles.markWarn]}>
            <Text style={[styles.markGlyph, styles.markGlyphWarn]}>!</Text>
          </View>
          <Text style={styles.verdictInline}>
            {spoken.message}
            {otherSpoken > 0 ? ` ${t('legality.moreToFix', { count: otherSpoken })}` : ''}
          </Text>
        </View>
      ) : null}

      {unresolved > 0 ? (
        <Text style={[styles.unresolved, spoken && styles.spaced]}>
          {unresolved === 1
            ? t('legality.unresolvedOne')
            : t('legality.unresolved', { count: unresolved })}
        </Text>
      ) : null}

      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}

/*
 * `LegalityStrip` lived here — the pinned one-line `Main 40/40+ · Runes 12/12 ·
 * BF 3/3 · Side 0`.
 *
 * Deleted rather than kept, because the editor was stating those counts **three
 * times**: this strip, the zone tabs' bare numbers, and the card above. The
 * tabs took the job: they now print `40/40+` and `12/12` against their own
 * thresholds, and unlike either readout they are also the control you press to
 * go and fix the number. Two of the three were pure chrome on a screen whose
 * chrome had already been measured at 61% of the display.
 *
 * Its only consumer was the deck editor, so leaving it exported with nobody
 * calling it is exactly the dead-export class the post-M6 audit exists to catch.
 */

const styles = StyleSheet.create({
  card: {
    padding: 11,
    paddingHorizontal: 13,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  // `flex-start`, not `center`: the message wraps to two lines on a narrow
  // phone, and centring would float the mark against the middle of a paragraph.
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWarn: { borderColor: color.warning },
  markGlyph: { ...text.caption, fontSize: 10, lineHeight: 12 },
  markGlyphWarn: { color: color.warning },
  // Beside the mark rather than under it — with the counts gone there is one
  // sentence here, and stacking it under an 18px dot wastes the line.
  verdictInline: {
    ...text.caption,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.textSecondary,
    flex: 1,
  },
  unresolved: { ...text.caption, fontSize: 11.5, color: color.warning },
  /** Only when something sits above it. */
  spaced: { marginTop: 5 },
  footnote: {
    ...text.caption,
    fontSize: 11.5,
    color: color.text,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
});
