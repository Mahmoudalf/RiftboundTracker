import { useState } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HIT_TARGET } from '@/theme/tokens';

/**
 * `Pressable` with a working function-valued `style`.
 *
 * React Native lets `style` be `({ pressed }) => ...`, but NativeWind's JSX
 * interop silently drops it: the function never runs and the element renders
 * with no style at all. Object and array styles are unaffected, which is what
 * makes it so easy to miss — in the same render, a sibling `<View>` with an
 * object style laid out perfectly while the `<Pressable>` next to it collapsed
 * to the height of its text.
 *
 * That failure is close to invisible by construction. A primary button loses
 * its background *and* keeps its foreground colour, so a light-on-dark label
 * becomes dark-on-dark: correctly positioned, fully interactive, and unreadable.
 * It was found by measuring a button that reported 21.33 dp tall against a
 * declared `minHeight: 48`.
 *
 * So the pressed state is tracked here and the style resolved to a plain value
 * before it reaches the underlying component. Call sites keep the standard React
 * Native signature and need no special knowledge.
 */

type PressableStyle = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

interface Props extends Omit<PressableProps, 'style'> {
  style?: PressableStyle;
}

export function Pressable({ style, hitSlop, onLayout, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  const [grow, setGrow] = useState<{ x: number; y: number } | null>(null);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;

  /*
   * `HIT_TARGET` used to be a constant whose comment claimed it was "enforced on
   * every pressable" while nothing referenced it. Rather than delete the claim,
   * it is now true — and enforced as **touch area, not layout**.
   *
   * Growing the visual box instead would have moved real controls: the remove
   * button on a card tile is 26 dp, the filter chips 34, the quantity steppers
   * smaller still, and each was sized against the art it sits on. A minimum
   * height would have shoved all of them apart. `hitSlop` leaves every pixel
   * where it is and only widens what counts as a tap, which is what the
   * accessibility guidance actually asks for.
   *
   * A caller that passes its own `hitSlop` keeps it — that is a deliberate
   * choice about a specific control, and this should not override it.
   */
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const x = Math.max(0, (HIT_TARGET - width) / 2);
    const y = Math.max(0, (HIT_TARGET - height) / 2);
    // Only re-render when it actually changes, and never for controls that are
    // already big enough.
    if (x !== (grow?.x ?? 0) || y !== (grow?.y ?? 0)) {
      setGrow(x === 0 && y === 0 ? null : { x, y });
    }
    onLayout?.(event);
  };

  return (
    <RNPressable
      {...rest}
      style={resolved}
      onLayout={measure}
      hitSlop={hitSlop ?? (grow ? { left: grow.x, right: grow.x, top: grow.y, bottom: grow.y } : undefined)}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    />
  );
}
