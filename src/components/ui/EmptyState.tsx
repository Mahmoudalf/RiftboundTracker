import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { Pressable } from './Pressable';

interface Action {
  label: string;
  onPress: () => void;
  /** The one action that should carry visual weight. */
  primary?: boolean;
}

interface EmptyStateProps {
  title: string;
  /** What to do next — never an apology, never mood-setting. */
  body: string;
  actions?: Action[];
  illustration?: ReactNode;
}

/**
 * An empty screen is an invitation to act, so every empty state names the next
 * step rather than describing the absence.
 */
export function EmptyState({ title, body, actions = [], illustration }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {illustration}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={a.onPress}
              style={({ pressed }) => [
                styles.button,
                a.primary ? styles.primary : styles.secondary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={a.primary ? styles.primaryLabel : styles.secondaryLabel}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[6],
    paddingHorizontal: space[6],
    paddingBottom: space[16],
  },
  copy: { gap: space[2], alignItems: 'center' },
  title: { ...text.title, color: color.text, textAlign: 'center' },
  body: {
    ...text.body,
    color: color.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: { gap: space[2], alignSelf: 'stretch', maxWidth: 320, width: '100%' },
  button: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  primary: { backgroundColor: color.accent },
  secondary: { borderWidth: 1, borderColor: color.border },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
  secondaryLabel: { ...text.bodyMedium, color: color.text },
});
