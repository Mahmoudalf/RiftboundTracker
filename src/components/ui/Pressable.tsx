import { useState } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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

export function Pressable({ style, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <RNPressable
      {...rest}
      style={resolved}
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
