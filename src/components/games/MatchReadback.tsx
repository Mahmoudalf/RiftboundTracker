import { StyleSheet, Text, View } from 'react-native';

import { HandReadback } from '@/components/games/HandReadback';
import type { CardRow } from '@/db/schema/cards';
import type { MatchRow } from '@/db/schema/games';
import { useT, type Key } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * One recorded match, read back as a card.
 *
 * The log form builds a match inside a `MatchCard` — result, turn order,
 * Battlefields, hand, score — and until now the screen that read it back drew
 * two lines of grey prose. Same facts, no relation to the surface that captured
 * them, and the parts that took the longest to enter were the parts hardest to
 * find again.
 *
 * So this is the log form's card with the controls taken out rather than a
 * second design: the same order (who started → what was dealt → how it
 * finished), the same tiles, the same score columns.
 *
 * Anything unrecorded is **absent**, never drawn as an empty control. A row of
 * "Not recorded" repeated four times says only that the screen has fields.
 */

export interface MatchReadbackProps {
  match: MatchRow;
  /** Title for this match — "Match 2", or "The game" in a Bo1. */
  title: string;
  /** Resolved printings for every id in the hand — see `cardsByIds`. */
  cards: Map<string, CardRow>;
  /** Names from the deck version, for printings the library has lost. */
  names: Map<string, string>;
}

const OUTCOME: Record<MatchRow['result'], { word: Key; color: string }> = {
  win: { word: 'match.outcome.won', color: color.win },
  loss: { word: 'match.outcome.lost', color: color.loss },
  draw: { word: 'match.outcome.drew', color: color.draw },
};

export function MatchReadback({ match, title, cards, names }: MatchReadbackProps) {
  const t = useT();
  const outcome = OUTCOME[match.result];

  const hasScore = match.scoreFor !== null && match.scoreAgainst !== null;
  const dealt = match.openingHand ?? [];
  const hasHand = dealt.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {/*
          A word, not just a colour. Win-green against loss-red is the pairing
          this app has banned since M1 — it is the most common form of colour
          blindness — so the badge carries WON/LOST/DREW and survives greyscale
          on its own. Same rule as the MULL/DRAW badges on the tiles below.
        */}
        <View style={[styles.badge, { borderColor: outcome.color }]}>
          <Text style={[styles.badgeLabel, { color: outcome.color }]}>{t(outcome.word)}</Text>
        </View>
      </View>

      {match.onPlay !== null ? (
        <Text style={styles.turnOrder}>
          {match.onPlay ? t('match.youWentFirst') : t('match.theyWentFirst')}
        </Text>
      ) : null}

      {/*
        The score, as a scoreline.

        It was `7–8 points` inside a run of uppercase 9px metadata, sharing a
        line with the result and the turn order — the one number in advanced
        logging that says *how close it was*, set smaller than the label above
        it. Riftbound plays to 8, so 8–7 and 8–0 are different matches and the
        difference is the whole reason the field exists.
      */}
      {hasScore ? (
        <View style={styles.score}>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreLabel}>{t('match.score.you')}</Text>
            <Text
              style={[
                styles.scoreValue,
                match.scoreFor! > match.scoreAgainst! && styles.scoreValueLead,
              ]}
            >
              {match.scoreFor}
            </Text>
          </View>
          <Text style={styles.scoreDash}>–</Text>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreLabel}>{t('match.score.them')}</Text>
            <Text
              style={[
                styles.scoreValue,
                match.scoreAgainst! > match.scoreFor! && styles.scoreValueLead,
              ]}
            >
              {match.scoreAgainst}
            </Text>
          </View>
        </View>
      ) : null}

      {hasHand ? (
        <HandReadback
          dealt={dealt}
          mulliganed={match.mulliganed ?? []}
          replacements={match.replacements ?? []}
          cards={cards}
          names={names}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { ...text.bodyMedium, fontSize: 15, color: color.text },
  badge: {
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeLabel: { ...text.microMeta },
  turnOrder: { ...text.small, color: color.textMuted, marginTop: -space[1] },

  score: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scoreSide: { alignItems: 'center', gap: 2, minWidth: 56 },
  scoreLabel: { ...text.caption, fontSize: 9.5, lineHeight: 13, color: color.textMuted },
  scoreValue: { ...text.numeric, fontSize: 26, lineHeight: 30, color: color.textSecondary },
  // The winning side only. Both at full strength would be a scoreboard; one
  // lifted is a result.
  scoreValueLead: { color: color.text },
  scoreDash: { ...text.numeric, fontSize: 18, lineHeight: 30, color: color.textFaint },
});
