import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { t } from '@/i18n';
import { cardImage } from '@/lib/cdn';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * One side of the matchup, at the head of the log flow.
 *
 * Two of these with a `VS` between them replace what used to be a row of
 * labelled form fields. It costs the same taps and answers the question the
 * screen is actually about — who is playing whom — before asking anything else.
 *
 * `side` mirrors the layout: yours has art on the left and reads left-to-right,
 * theirs is the reflection. A missing opponent is not an error state, so the
 * empty side draws a hatched plate rather than a gap.
 */

const CARD_HEIGHT = 88;
const ART_WIDTH = 186;

interface MatchupCardProps {
  side: 'you' | 'them';
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** Makes the whole card a button. Omitted, it stays a display. */
  onPress?: () => void;
  /** What the button does, for a screen reader. Required when `onPress` is set. */
  actionLabel?: string;
}

export function MatchupCard({
  side,
  title,
  subtitle,
  imageUrl,
  onPress,
  actionLabel,
}: MatchupCardProps) {
  const mine = side === 'you';

  /*
   * A button only when it has somewhere to go.
   *
   * The same card renders on the saved-game screen, where it is a record of
   * what happened and nothing to press. Wrapping unconditionally would give
   * that one a pressed state and a screen-reader role it cannot honour.
   */
  const Root = onPress ? Pressable : View;
  const rootProps = onPress
    ? {
        onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel: [actionLabel, title, subtitle].filter(Boolean).join(', '),
        style: ({ pressed }: { pressed: boolean }) => [styles.root, pressed && styles.pressed],
      }
    : { style: styles.root };

  return (
    <Root {...rootProps}>
      {imageUrl ? (
        <Image
          source={cardImage(imageUrl, 'card')}
          style={[styles.art, mine ? styles.artLeft : styles.artRight]}
          contentFit="cover"
          contentPosition="top center"
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : (
        <View style={[styles.art, styles.plate, mine ? styles.artLeft : styles.artRight]} />
      )}

      <LinearGradient
        colors={
          mine
            ? ['transparent', 'rgba(27,27,30,0.6)', color.surface]
            : [color.surface, 'rgba(27,27,30,0.6)', 'transparent']
        }
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.art, mine ? styles.artLeft : styles.artRight]}
      />

      <Text style={[styles.tag, mine ? styles.tagLeft : styles.tagRight]}>
        {t(mine ? 'matchup.you' : 'matchup.them')}
      </Text>

      <View style={[styles.body, mine ? styles.bodyMine : styles.bodyTheirs]}>
        <Text
          style={[styles.title, !mine && styles.alignEnd]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, !mine && styles.alignEnd]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Root>
  );
}

/** The hairline-and-VS divider the design puts between the two sides. */
export function MatchupDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <Text style={styles.vs}>VS</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  root: {
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  art: { position: 'absolute', top: 0, width: ART_WIDTH, height: CARD_HEIGHT },
  artLeft: { left: 0 },
  artRight: { right: 0 },
  plate: { backgroundColor: color.raised },
  tag: {
    ...text.microMeta,
    position: 'absolute',
    top: space[3],
    color: color.textSecondary,
  },
  tagLeft: { left: space[3] },
  tagRight: { right: space[3] },
  body: { gap: space[1] },
  bodyMine: { paddingLeft: 130, paddingRight: space[4] },
  bodyTheirs: { paddingRight: 130, paddingLeft: space[4] },
  alignEnd: { textAlign: 'right' },
  title: { ...text.bodyMedium, fontSize: 15, color: color.text },
  subtitle: { ...text.small, color: color.textMuted },

  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  rule: { flex: 1, height: 1, backgroundColor: color.border },
  vs: { ...text.numeric, fontSize: 14, color: color.textSecondary },
});
