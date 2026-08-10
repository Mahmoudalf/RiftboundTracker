import { StyleSheet, Text, View } from 'react-native';

import type { LegalityResult } from '@/lib/legality';
import {
  BATTLEFIELD_COUNT,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
} from '@/lib/legality';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Where the deck stands, as a sentence.
 *
 * The design replaces the old bar with a card: a mark, the counts in mono, and
 * underneath them **what is actually wrong**, in words. A bar could say
 * `Main 38/40` in amber and leave the reader to work out that two cards are
 * missing; the sentence says *"add 2"*.
 *
 * From the design: `padding 11px 13px · radius 12 · background #1B1B1E ·
 * border rgba(255,255,255,.08)`; an 18px ringed mark, amber `!` or green `✓`;
 * the summary at `600 11.5px` mono and the verdict at `400 11.5px`.
 */

export interface LegalityCardProps {
  legality: LegalityResult;
  sideboard: number;
  /**
   * Cards in the deck the library cannot draw. The counts below are short by
   * exactly this much, and without saying so the deck just looks wrong.
   */
  unresolved?: number;
  /** Shown under a rule, e.g. what saving will do to the version history. */
  footnote?: string | null;
}

export function LegalityCard({
  legality,
  sideboard,
  unresolved = 0,
  footnote = null,
}: LegalityCardProps) {
  const { counts, issues, legal } = legality;

  /*
   * One issue, not all of them.
   *
   * A deck mid-build fails four rules at once, and four sentences is a wall
   * that gets skipped. The first is the one to fix — they are ordered by the
   * zone you fill first.
   */
  const verdict = legal
    ? 'Legal — every zone is within its limits.'
    : (issues[0]?.message ?? 'Not legal yet.');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.mark, legal ? styles.markOk : styles.markWarn]}>
          <Text style={[styles.markGlyph, legal ? styles.markGlyphOk : styles.markGlyphWarn]}>
            {legal ? '✓' : '!'}
          </Text>
        </View>
        <Text style={styles.summary} numberOfLines={1}>
          Main {counts.main}/{MAIN_DECK_SIZE} · Runes {counts.rune}/{RUNE_DECK_SIZE} · BF{' '}
          {counts.battlefield}/{BATTLEFIELD_COUNT} · Side {sideboard}
        </Text>
      </View>

      <Text style={styles.verdict}>
        {verdict}
        {issues.length > 1 ? ` ${issues.length - 1} more to fix.` : ''}
      </Text>

      {unresolved > 0 ? (
        <Text style={styles.unresolved}>
          {unresolved} card{unresolved === 1 ? '' : 's'} in this deck are not in the library, so
          the counts above are short by that much. They are kept when you save.
        </Text>
      ) : null}

      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 11,
    paddingHorizontal: 13,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOk: { borderColor: color.win },
  markWarn: { borderColor: color.warning },
  markGlyph: { ...text.caption, fontSize: 10, lineHeight: 12 },
  markGlyphOk: { color: color.win },
  markGlyphWarn: { color: color.warning },
  summary: { ...text.numeric, fontSize: 11.5, color: color.text, flex: 1 },
  verdict: { ...text.caption, fontSize: 11.5, color: color.textSecondary, marginTop: 5 },
  unresolved: { ...text.caption, fontSize: 11.5, color: color.warning, marginTop: 5 },
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
