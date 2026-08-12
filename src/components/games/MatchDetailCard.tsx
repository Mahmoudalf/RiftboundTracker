import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScoreRow } from '@/components/games/ScoreRow';
import type { Result } from '@/db/schema/games';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The second tier of detail for one match, filled in after the fact.
 *
 * The after-the-fact pass. The log form's **Advanced** mode asks the same two
 * questions while the game is still in front of you; this is the same card,
 * reached from a game that was logged in Simplified mode.
 *
 * Two questions, in the order they resolve during a match: what the opening
 * deal was, and how it finished.
 *
 * A third — the turn each Chosen Champion landed — was built and removed the
 * next day (migration 19). Without the board it landed on, the turn number
 * cannot say whether it was early or late, so an average over it would look
 * like information without being any.
 *
 * Every field is independently optional. Someone who records scores and never
 * opening hands still gets score analytics — which is why `handCoverage` and
 * `scoreStats` each carry their own denominator rather than sharing one.
 */

export interface MatchDetailValue {
  scoreFor: number | null;
  scoreAgainst: number | null;
}

export interface MatchDetailCardProps {
  title: string;
  result: Result;
  /** Right-hand mono line — turn order and the Battlefields, from the log. */
  summary: string;
  value: MatchDetailValue;
  onChange: (next: Partial<MatchDetailValue>) => void;
  /**
   * The opening-hand block, passed in.
   *
   * The log form's advanced mode and this after-the-fact screen record exactly
   * the same thing, so they render exactly the same control — `OpeningHand`,
   * with its card previews. Two hand editors would be two places for the deal /
   * mulligan / replacement rules to drift apart, and the rules are the part
   * that has to stay right.
   */
  hand: ReactNode;
}

const RESULT_NOUN: Record<Result, string> = {
  win: 'win',
  loss: 'loss',
  draw: 'draw',
};

export function MatchDetailCard({
  title,
  result,
  summary,
  value,
  onChange,
  hand,
}: MatchDetailCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      </View>

      {hand}

      <View style={styles.block}>
        <ScoreRow
          scoreFor={value.scoreFor}
          scoreAgainst={value.scoreAgainst}
          onChange={onChange}
        />
        <ScoreNote result={result} for_={value.scoreFor} against={value.scoreAgainst} />
      </View>
    </View>
  );
}

/**
 * Says so when the score disagrees with the result — and changes neither.
 *
 * A match recorded as won with the opponent on more points is either a mis-tap
 * or a concession, and the app cannot tell which. Correcting it silently would
 * overwrite a fact with a guess; refusing to save would block a legitimate
 * oddity. Naming it leaves the judgement where it belongs.
 */
function ScoreNote({
  result,
  for_,
  against,
}: {
  result: Result;
  for_: number | null;
  against: number | null;
}) {
  if (for_ === null || against === null) return null;

  const leader = for_ > against ? 'win' : for_ < against ? 'loss' : 'draw';
  if (leader === result) return null;

  return (
    <Text style={styles.note}>
      Recorded as a {RESULT_NOUN[result]}, but the score reads the other way. Kept exactly as
      entered — a conceded match really does end behind.
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.card,
    padding: space[4],
    gap: space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: { ...text.subtitle, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13.5, color: color.text },
  summary: { ...text.microMeta, color: color.textFaint, flexShrink: 1, textAlign: 'right' },
  block: { gap: space[2] },
  note: { ...text.caption, color: color.warning },
});
