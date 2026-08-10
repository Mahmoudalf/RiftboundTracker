import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * The sheen on a foil you own.
 *
 * The design's `foilSweep`, reproduced from its own numbers:
 *
 *     @keyframes foilSweep { 0% { background-position: -120% -120% }
 *                          100% { background-position:  220%  220% } }
 *     background-size: 420% 420%; background-repeat: no-repeat;
 *     animation: foilSweep 8s linear infinite;
 *
 * One band, 4.2 cards wide, crossing on an 8s cycle — **not** a continuous
 * loop. Because it does not repeat, the bright section is only over the card
 * for about 2.5s of those 8, and the remaining 5.5s is empty. That gap is the
 * effect: a highlight that catches the card as it turns, then passes. A
 * seamless version reads as a permanently shimmering object instead.
 *
 * Cost scales with foils owned, not library size — an unfoiled tile renders
 * nothing, and nobody owns 1,451 foils.
 */

/** The design's stops, verbatim. */
const COLORS = [
  'rgba(150,110,255,0)',
  'rgba(150,110,255,0.40)',
  'rgba(255,170,80,0.50)',
  'rgba(46,204,113,0.65)',
  'rgba(255,170,80,0.50)',
  'rgba(110,200,255,0.40)',
  'rgba(110,200,255,0)',
] as const;
const LOCATIONS = [0.22, 0.34, 0.44, 0.5, 0.56, 0.66, 0.78] as const;

/** `background-size: 420%`. */
const BAND = 4.2;
/**
 * Where the band starts and ends, in card widths.
 *
 * CSS resolves `background-position: P%` against `(container − image)`, so with
 * an image 4.2× the container the design's −120% → 220% puts the band's left
 * edge at +3.84 and carries it to −7.04. Travel is 10.88 card widths, which is
 * what makes 8s feel unhurried without the sweep itself being slow.
 */
const FROM = 3.84;
const TO = -7.04;

const DURATION = 8000;
/** The design's 115°, as a rotation of the band itself. */
const ANGLE = '-25deg';

export function FoilSheen({ width, height }: { width: number; height: number }) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      // Parked mid-crossing, where the bright stops sit on the card. Still a
      // foil to look at, with nothing moving.
      progress.value = 0.42;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, [progress, reduced]);

  /*
   * Rotating the band rather than angling the gradient inside it keeps the
   * travel on the same axis the colour stops are measured along — otherwise the
   * sweep crosses at one angle while its stops run at another, and the bright
   * core never quite lines up with the card.
   */
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: ANGLE },
      { translateX: (FROM + (TO - FROM) * progress.value) * width },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.band,
        // Twice the tile's height, hung half a tile above it, so the rotation
        // cannot expose a corner whatever the card's aspect.
        { width: width * BAND, height: height * 2, top: -height / 2 },
        style,
      ]}
    >
      <LinearGradient
        colors={COLORS}
        locations={LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0 },
});
