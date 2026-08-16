import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { t } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A binder in the list.
 *
 * From the design: `padding:12 · radius:12 · background:#1B1B1E`, name and
 * subtitle on the left, chevron on the right. Gallery carries
 * `border:1px rgba(255,255,255,.16)` and a DEFAULT tag; the rest have neither,
 * which is the whole visual difference between the one binder that is always
 * there and the ones you made.
 *
 * **The 34×46 spine is gone.** It was a striped plate standing in for card art
 * that nothing ever supplied — `imageUrl` was a prop no caller passed, so every
 * row in the app drew the placeholder and none ever drew the thing it stood in
 * for. A slot reserved for a feature that does not exist reads as a broken
 * image, not as a promise.
 */

export interface BinderRowProps {
  name: string;
  subtitle: string;
  /** Marks the always-present Gallery row. */
  isDefault?: boolean;
  onPress: () => void;
}

export function BinderRow({ name, subtitle, isDefault = false, onPress }: BinderRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, isDefault && styles.rowDefault, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isDefault ? <Text style={styles.tag}>{t('binder.default')}</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Icon name="chevron-right" size={16} color={color.textFaint} />
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
});
