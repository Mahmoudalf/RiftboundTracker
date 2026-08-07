import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { useToast } from '@/features/matches/useToast';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The confirmation strip, rendered once above the whole navigator.
 *
 * Sits above the tab bar rather than over it, so the thing you just used is not
 * covered by the thing telling you it worked.
 *
 * **Undo is not optional here.** The log flow is built to be tapped fast and
 * without looking, which guarantees mis-taps; a fast surface with no way back is
 * a surface that punishes its own design goal. The timeout is deliberately long
 * for a toast — seven seconds — because the person who mis-tapped is usually
 * still shuffling.
 */

const DURATION_MS = 7000;
/** Clears the tab bar (64) plus its overhanging centre button. */
const ABOVE_TAB_BAR = 84;

export function Toast() {
  const insets = useSafeAreaInsets();
  const message = useToast((s) => s.message);
  const action = useToast((s) => s.action);
  const nonce = useToast((s) => s.nonce);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, DURATION_MS);
    return () => clearTimeout(timer);
    // `nonce` restarts the timer when the same message is raised again.
  }, [message, nonce, dismiss]);

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + ABOVE_TAB_BAR }]}
    >
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={10}
            onPress={() => {
              action.onPress();
              dismiss();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space[4],
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 52,
    paddingLeft: space[4],
    paddingRight: space[2],
    borderRadius: radius.full,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.border,
    ...{
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    },
  },
  message: { ...text.small, color: color.text, flex: 1 },
  action: {
    minHeight: 40,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: color.text,
  },
  actionLabel: { ...text.smallMedium, color: color.bg },
  pressed: { opacity: 0.8 },
});
