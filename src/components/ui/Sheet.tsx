import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * A bottom sheet — grabber, title, subtitle, scrolling body, pinned actions.
 *
 * The design raises one of these wherever a decision is being confirmed rather
 * than made: the match review before saving, and the discard prompt. Both used
 * to be an `Alert`, which cannot show what it is asking you to confirm — and
 * the whole point of the review sheet is that you read the match back before
 * committing it.
 */

interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the body, outside the scroll. */
  actions?: ReactNode;
}

export function Sheet({ visible, title, subtitle, onClose, children, actions }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={styles.scrim}
      />

      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </Modal>
  );
}

/** A read-back line: label on the left, what was recorded on the right. */
export function SheetRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.rowValueMono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(6,6,7,0.72)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: color.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: space[5],
    paddingTop: space[3],
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: radius.bar,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: space[3],
  },
  title: { ...text.subtitle, color: color.text },
  subtitle: { ...text.small, color: color.textMuted, paddingTop: space[1] },
  body: { marginTop: space[3] },
  bodyContent: { paddingBottom: space[3] },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    paddingTop: space[2],
    paddingBottom: space[6],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowLabel: { ...text.smallMedium, color: color.textFaint, width: 92 },
  rowValue: { ...text.smallMedium, color: color.text, flex: 1 },
  rowValueMono: { ...text.numeric, fontSize: 12, color: color.text, flex: 1 },
});
