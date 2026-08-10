import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A binder in the list.
 *
 * From the design: `padding:12 · radius:12 · background:#1B1B1E`, a 34×46 spine
 * on the left, name and subtitle in the middle, chevron on the right. Gallery
 * carries `border:1px rgba(255,255,255,.16)` and a DEFAULT tag; the rest have
 * neither, which is the whole visual difference between the one binder that is
 * always there and the ones you made.
 *
 * The spine falls back to the design's 115° stripe when there is no art —
 * approximated with three bars, since RN has no repeating-linear-gradient.
 */

export interface BinderRowProps {
  name: string;
  subtitle: string;
  /** Art for the spine. Null draws the striped placeholder. */
  imageUrl?: string | null;
  /** Marks the always-present Gallery row. */
  isDefault?: boolean;
  onPress: () => void;
}

export function BinderRow({
  name,
  subtitle,
  imageUrl = null,
  isDefault = false,
  onPress,
}: BinderRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, isDefault && styles.rowDefault, pressed && styles.pressed]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.spine}
          contentFit="cover"
          contentPosition="top center"
          transition={120}
        />
      ) : (
        <View style={styles.spine}>
          {/* The design's 115° stripe. RN has no repeating-linear-gradient, so
              this is oversized bars rotated behind a clip — vertical bars read
              as a broken image rather than as a spine. */}
          <View style={styles.stripes}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.stripe, i % 2 === 1 && styles.stripeAlt]} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isDefault ? <Text style={styles.tag}>DEFAULT</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    // Transparent rather than absent, so the default row's real border does not
    // make it 2px taller than the others.
    borderColor: 'transparent',
  },
  rowDefault: { borderColor: 'rgba(255,255,255,0.16)' },
  pressed: { opacity: 0.7 },

  spine: {
    width: 34,
    height: 46,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.raised,
  },
  stripes: {
    position: 'absolute',
    // Oversized and offset so the rotation cannot expose a corner of the box.
    width: 92,
    height: 92,
    left: -29,
    top: -23,
    flexDirection: 'row',
    transform: [{ rotate: '25deg' }],
  },
  stripe: { flex: 1, backgroundColor: color.overlay },
  stripeAlt: { backgroundColor: color.raised },

  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { ...text.smallMedium, fontSize: 13.5, color: color.text, flexShrink: 1 },
  tag: {
    ...text.microMeta,
    fontSize: 8.5,
    color: color.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  subtitle: { ...text.caption, fontSize: 11, color: color.textMuted },
  chevron: { ...text.body, color: color.textFaint },
});
