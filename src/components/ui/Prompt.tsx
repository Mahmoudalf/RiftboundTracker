import { Modal, StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A decision, in the app's own voice.
 *
 * `Alert.alert` is the platform's dialog, not this one: it arrives in the OS
 * font at the OS width with the OS button order, and on Android it cannot show
 * three options without looking like an error. The places that use it are
 * exactly the places where the wording matters most — leaving unsaved work,
 * overwriting a version that matches are attached to.
 *
 * From the design: centred, `radius 18 · border 1px rgba(255,255,255,.1) ·
 * padding 20`, title `700 17/1.3`, body `400 12.5/1.5 #9C9CA1`, then full-width
 * 48px buttons stacked at `gap 9` — filled, outlined, then bare.
 */

export interface PromptAction {
  label: string;
  /** `primary` fills, `secondary` outlines, `quiet` is bare text. */
  kind?: 'primary' | 'secondary' | 'quiet';
  destructive?: boolean;
  onPress: () => void;
}

export interface PromptProps {
  visible: boolean;
  title: string;
  body?: string;
  actions: PromptAction[];
  /**
   * What a back gesture or a tap outside means. Always the safe one — dismissing
   * a dialog must never be the destructive answer.
   */
  onDismiss: () => void;
}

export function Prompt({ visible, title, body, actions, onDismiss }: PromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <View style={styles.actions}>
            {actions.map((action) => {
              const kind = action.kind ?? 'quiet';
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.action,
                    kind === 'primary' && styles.primary,
                    kind === 'primary' && action.destructive && styles.destructive,
                    kind === 'secondary' && styles.secondary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      kind === 'primary' && styles.primaryLabel,
                      kind === 'secondary' && styles.secondaryLabel,
                      kind === 'quiet' && styles.quietLabel,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(6,6,7,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  card: {
    width: '100%',
    backgroundColor: color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: space[5],
  },
  title: { ...text.title, fontSize: 17, lineHeight: 22, color: color.text },
  body: { ...text.caption, fontSize: 12.5, lineHeight: 19, color: color.textMuted, marginTop: 9 },

  actions: { gap: 9, marginTop: 18 },
  action: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: color.accent },
  destructive: { backgroundColor: color.danger },
  secondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  pressed: { opacity: 0.7 },

  label: { ...text.smallMedium, fontSize: 13.5 },
  primaryLabel: { color: color.onAccent },
  secondaryLabel: { color: color.textSecondary },
  quietLabel: { color: color.textMuted },
});
