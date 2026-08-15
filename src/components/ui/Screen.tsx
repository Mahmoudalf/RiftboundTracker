import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import { useT } from '@/i18n';
import { color, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

interface ScreenProps {
  children: ReactNode;
  /** Large screen title, set in the display face. */
  title?: string;
  /** Card-footer style metadata line under the title. */
  meta?: string;
  /** Rendered at the trailing edge of the header row. */
  action?: ReactNode;
  /** Disable horizontal padding for full-bleed content such as the card grid. */
  bleed?: boolean;
  /**
   * Force the back control on or off. Defaults to showing it whenever the
   * navigator has somewhere to go back to.
   */
  back?: boolean;
  /**
   * A modal's header rather than a screen's.
   *
   * The design gives a presented sheet a 20px title on a tight two-line header,
   * against the 30px display title a tab root gets. The difference is what tells
   * you whether you are somewhere or *over* somewhere — a full display title on
   * a modal reads as having navigated away rather than having opened something.
   */
  compact?: boolean;
}

/**
 * Drawn rather than typed. A chevron character would be a font dependency for a
 * control the user cannot proceed without — the same reasoning that removed the
 * Unicode domain glyphs in M1.
 */
function BackChevron() {
  return (
    <Svg width={11} height={18} viewBox="0 0 11 18" fill="none">
      <Path
        d="M9.5 1.5L2 9l7.5 7.5"
        stroke={color.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Screen({
  children,
  title,
  meta,
  action,
  bleed = false,
  back,
  compact = false,
}: ScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();

  /*
   * The stack runs with `headerShown: false`, so a pushed screen has no back
   * control of its own — this component was written for the tab roots, which
   * need none, and then reused for every pushed route. On Android that left
   * only the system back gesture; on iOS it would leave the edge swipe and
   * nothing visible at all.
   */
  const showBack = back ?? router.canGoBack();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {title ? (
        <View style={[styles.header, compact && styles.headerCompact]}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('ui.goBack')}
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
            >
              <BackChevron />
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <Text
              style={[styles.title, compact && styles.titleCompact]}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={[styles.body, !bleed && styles.bodyPadded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    /*
     * Top-aligned, not bottom.
     *
     * `flex-end` lined the back control up with the *last* line of the header
     * text, so on any screen with a meta line the chevron sat beside the
     * metadata rather than beside the title — visibly adrift, and pointing at
     * the wrong thing.
     */
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[4],
    gap: space[3],
  },
  // The design's modal header: `padding: 2px 16px 10px`, and the trailing
  // action centred against the title rather than hung from its cap height.
  headerCompact: {
    alignItems: 'center',
    paddingTop: space[0.5],
    paddingBottom: 10,
  },
  back: {
    width: 32,
    // The title's own line height, so the chevron centres on the title whether
    // or not a meta line follows it.
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backPressed: { opacity: 0.6 },
  headerText: { flex: 1, gap: space[1] },
  title: { ...text.display, color: color.text },
  titleCompact: { ...text.title, color: color.text },
  meta: { ...text.meta, color: color.textMuted },
  body: { flex: 1 },
  bodyPadded: { paddingHorizontal: space[4] },
});
