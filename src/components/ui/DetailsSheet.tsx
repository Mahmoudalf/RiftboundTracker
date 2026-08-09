import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Edit a name and a note.
 *
 * Two things in the app want exactly this — a deck's name and notes, a
 * version's label and notes — and both were unreachable for the same reason:
 * the query functions existed and no screen ever called them. One sheet with
 * two consumers rather than two near-identical screens.
 *
 * Mounted only while open, so the fields seed from props on mount and are never
 * synced afterwards — an effect syncing state to props would fight the user's
 * typing. Closing unmounts the form, which is what makes opening a *different*
 * version's sheet reseed correctly without a key.
 */

interface DetailsSheetProps {
  visible: boolean;
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  initialName: string;
  /** Blank clears it. Version labels are genuinely optional. */
  nameRequired?: boolean;
  initialNotes: string;
  notesPlaceholder: string;
  onClose: () => void;
  onSave: (name: string, notes: string) => void;
  /** An extra, non-destructive-looking action — archiving, for instance. */
  secondary?: { label: string; onPress: () => void };
}

export function DetailsSheet(props: DetailsSheetProps) {
  if (!props.visible) return null;
  return <DetailsForm {...props} />;
}

function DetailsForm({
  title,
  nameLabel,
  namePlaceholder,
  initialName,
  nameRequired = true,
  initialNotes,
  notesPlaceholder,
  onClose,
  onSave,
  secondary,
}: DetailsSheetProps) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);

  const canSave = !nameRequired || name.trim().length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={styles.scrim}
      />

      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.label}>{nameLabel}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={namePlaceholder}
          placeholderTextColor={color.textFaint}
          style={styles.input}
          autoFocus
          returnKeyType="next"
          accessibilityLabel={nameLabel}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={notesPlaceholder}
          placeholderTextColor={color.textFaint}
          style={[styles.input, styles.notes]}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Notes"
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Cancel</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => onSave(name, notes)}
            style={({ pressed }) => [
              styles.primary,
              !canSave && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>Save</Text>
          </Pressable>
        </View>

        {secondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={secondary.onPress}
            style={({ pressed }) => [styles.extra, pressed && styles.pressed]}
          >
            <Text style={styles.extraLabel}>{secondary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    top: '14%',
    gap: space[2],
    padding: space[5],
    borderRadius: radius.xl,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.border,
  },
  title: { ...text.subtitle, color: color.text, paddingBottom: space[1] },
  label: { ...text.microMeta, color: color.textMuted },
  input: {
    ...text.body,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 48,
  },
  notes: { minHeight: 96 },
  actions: { flexDirection: 'row', gap: space[2], paddingTop: space[2] },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.text,
  },
  primaryLabel: { ...text.bodyMedium, color: color.bg },
  secondary: {
    minHeight: 48,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  secondaryLabel: { ...text.bodyMedium, color: color.text },
  extra: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  extraLabel: { ...text.smallMedium, color: color.textMuted },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
