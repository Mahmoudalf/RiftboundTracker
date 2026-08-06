import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export function Screen({ children, title, meta, action, bleed = false }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[4],
    gap: space[3],
  },
  headerText: { flex: 1, gap: space[1] },
  title: { ...text.display, color: color.text },
  meta: { ...text.meta, color: color.textMuted },
  body: { flex: 1 },
  bodyPadded: { paddingHorizontal: space[4] },
});
