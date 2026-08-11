import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceRow, OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import type { CardRow } from '@/db/schema/cards';
import type { MatchResult } from '@/db/schema/matches';
import { baseName } from '@/lib/card-identity';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * One game of a match.
 *
 * Built from the design's own declarations: card `border 1px rgba(255,255,255,.12)
 * · radius 14 · padding 14`; header baseline-aligned with a mono summary on the
 * right; turn-order row 44px/radius 10; both Battlefield fields 46px/radius 10;
 * the result row 52px, weight 700.
 *
 * Deviations, stated rather than smuggled:
 *  - The design titles these "Match 1 / Match 2". Inside a match log that names
 *    the wrong thing, so they are "Game 1 / Game 2" here.
 *  - Their Battlefield opens the card picker instead of an inline search list.
 *    The design's list is a mock with six entries; the real one is every
 *    Battlefield in the library, and a filtered scrolling list nested inside the
 *    form's own scroll view is a scroll trapped in a scroll. The picker sheet
 *    already has the search the design draws.
 */

export interface GameCardProps {
  title: string;
  /** Right-hand mono line: result and turn order, or what is still missing. */
  summary: string;
  onPlay: boolean | null;
  onChangeOnPlay: (value: boolean | null) => void;
  /** The three Battlefields this deck brought. */
  ourFields: readonly CardRow[];
  ourField: CardRow | null;
  onChangeOurField: (value: CardRow | null) => void;
  theirField: CardRow | null;
  onPickTheirField: () => void;
  result: MatchResult | null;
  onChangeResult: (value: MatchResult) => void;
}

export function GameCard({
  title,
  summary,
  onPlay,
  onChangeOnPlay,
  ourFields,
  ourField,
  onChangeOurField,
  theirField,
  onPickTheirField,
  result,
  onChangeResult,
}: GameCardProps) {
  const [fieldOpen, setFieldOpen] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>

      <View style={styles.block}>
        <SectionLabel>Who went first?</SectionLabel>
        <ChoiceRow<boolean | null>
          options={[
            { key: 'me', label: 'I did', value: true },
            { key: 'them', label: 'They did', value: false },
            { key: 'unsure', label: 'Not sure', value: null },
          ]}
          value={onPlay}
          onSelect={onChangeOnPlay}
        />
      </View>

      <View style={styles.block}>
        <SectionLabel>Your battlefield — from this deck</SectionLabel>
        {ourFields.length === 0 ? (
          /*
           * Reported as "the user's Battlefield is missing from the match log".
           *
           * It was not missing — it was invisible. This said "This deck has no
           * Battlefields yet" in `microMeta` at `textFaint`, which is 9.5px,
           * uppercase, and a value the palette documents as **below AA and
           * never to carry information**. Directly under a section label in the
           * identical style, two lines of micro-caps read as one label with no
           * control beneath it, which is exactly what a removed field looks
           * like.
           *
           * Sentence case, readable size, and it now says what to do — an empty
           * state is the one message a user genuinely has to be able to read.
           */
          <Text style={styles.empty}>
            This deck&apos;s current version has no Battlefields. Add them in the deck editor and
            they will show up here.
          </Text>
        ) : (
          <SelectField
            compact
            placeholder="Choose from this deck"
            value={ourField ? baseName(ourField.name) : null}
            open={fieldOpen}
            onToggle={() => setFieldOpen((o) => !o)}
          >
            {ourFields.map((card) => (
              <OptionRow
                key={card.id}
                label={baseName(card.name)}
                selected={ourField?.id === card.id}
                onPress={() => {
                  // Re-tapping clears it, so "not recorded" stays reachable
                  // without a separate — button.
                  onChangeOurField(ourField?.id === card.id ? null : card);
                  setFieldOpen(false);
                }}
              />
            ))}
          </SelectField>
        )}
      </View>

      <View style={styles.block}>
        <SectionLabel>Their battlefield</SectionLabel>
        <SelectField
          compact
          placeholder="Search battlefields"
          value={theirField ? baseName(theirField.name) : null}
          open={false}
          onToggle={onPickTheirField}
        />
      </View>

      <View style={styles.block}>
        <SectionLabel>Who won?</SectionLabel>
        <ChoiceRow<MatchResult | null>
          options={[
            { key: 'win', label: 'W · Win', value: 'win' },
            { key: 'loss', label: 'L · Loss', value: 'loss' },
            { key: 'draw', label: 'D · Draw', value: 'draw' },
          ]}
          value={result}
          // No option carries null — the row cannot clear an answer, only
          // change it, which is what stops a mis-tap from erasing a game.
          onSelect={(next) => next && onChangeResult(next)}
          tall
        />
      </View>
    </View>
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
  // 700 13.5px, per the design's own declaration.
  title: { ...text.subtitle, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13.5, color: color.text },
  summary: { ...text.microMeta, color: color.textFaint, flexShrink: 1, textAlign: 'right' },
  block: { gap: space[2] },
  empty: { ...text.small, color: color.textMuted },
});
