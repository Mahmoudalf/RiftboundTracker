import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DomainGlyph } from '@/components/cards/DomainGlyph';
import { Pressable } from '@/components/ui/Pressable';
import type { Binder } from '@/db/queries/collection';
import { domainColor, PLAYABLE_DOMAINS } from '@/theme/domains';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Create or edit a binder.
 *
 * One sheet for both, because they ask for the same two things and a separate
 * "edit" screen would only differ by its title. Delete lives here too — it is
 * the one place a binder is already the subject.
 *
 * The accent is a domain colour rather than a free palette. Binders are picked
 * out of a horizontal rail at a glance, and the app already teaches seven
 * colours with meanings attached; inventing an eighth vocabulary for storage
 * boxes would make the rail read as if it meant something about the cards.
 */

interface BinderSheetProps {
  visible: boolean;
  /** Null creates; a binder edits it. */
  binder: Binder | null;
  onClose: () => void;
  onSave: (name: string, accent: string | null) => void;
  onDelete?: () => void;
}

/**
 * Mounted only while open, and keyed on the binder.
 *
 * That is what seeds the fields: an effect syncing state to props would re-run
 * on every prop change and fight the user's typing, while a fresh mount per
 * open cannot. The form below can therefore treat its props as initial values
 * and never think about them again.
 */
export function BinderSheet({ visible, binder, onClose, onSave, onDelete }: BinderSheetProps) {
  if (!visible) return null;
  return (
    <BinderForm
      key={binder?.id ?? 'new'}
      binder={binder}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

function BinderForm({ binder, onClose, onSave, onDelete }: Omit<BinderSheetProps, 'visible'>) {
  const [name, setName] = useState(binder?.name ?? '');
  const [accent, setAccent] = useState<string | null>(binder?.accent ?? null);

  const confirmDelete = () => {
    if (!binder || !onDelete) return;
    Alert.alert(
      `Delete ${binder.name}?`,
      binder.totalCards > 0
        ? `The ${binder.totalCards} ${binder.totalCards === 1 ? 'card' : 'cards'} in it stop counting towards what you own. Your other binders are untouched.`
        : 'This binder is empty.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={styles.scrim}
      />

      <View style={styles.sheet}>
        <Text style={styles.title}>{binder ? 'Edit binder' : 'New binder'}</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trade binder, Deck box, Bulk…"
          placeholderTextColor={color.textFaint}
          style={styles.input}
          autoFocus={!binder}
          returnKeyType="done"
          onSubmitEditing={() => onSave(name, accent)}
          accessibilityLabel="Binder name"
        />

        <Text style={styles.label}>Colour</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No colour"
            accessibilityState={{ selected: accent === null }}
            onPress={() => setAccent(null)}
            style={({ pressed }) => [
              styles.swatch,
              accent === null && styles.swatchOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.swatchLabel}>None</Text>
          </Pressable>

          {PLAYABLE_DOMAINS.map((domain) => {
            const c = domainColor(domain);
            const on = accent === domain;
            return (
              <Pressable
                key={domain}
                accessibilityRole="button"
                accessibilityLabel={domain}
                accessibilityState={{ selected: on }}
                onPress={() => setAccent(domain)}
                style={({ pressed }) => [
                  styles.swatch,
                  { borderColor: on ? c.base : color.border },
                  on && { backgroundColor: c.dim },
                  pressed && styles.pressed,
                ]}
              >
                <DomainGlyph domain={domain} size={13} color={c.base} />
                <Text style={[styles.swatchLabel, { color: on ? c.base : color.textSecondary }]}>
                  {domain}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          {binder && onDelete ? (
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={name.trim().length === 0}
            onPress={() => onSave(name, accent)}
            style={({ pressed }) => [
              styles.primary,
              name.trim().length === 0 && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>{binder ? 'Save' : 'Create'}</Text>
          </Pressable>
        </View>
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
    top: '20%',
    gap: space[3],
    padding: space[5],
    borderRadius: radius.xl,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.border,
  },
  title: { ...text.subtitle, color: color.text },
  input: {
    ...text.body,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[4],
    minHeight: 48,
  },
  label: { ...text.microMeta, color: color.textMuted },
  swatches: { flexDirection: 'row', gap: space[2], paddingRight: space[4] },
  swatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    height: 34,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  swatchOn: { borderColor: color.text },
  swatchLabel: { ...text.microMeta, color: color.textSecondary },
  actions: { flexDirection: 'row', gap: space[2], paddingTop: space[1] },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
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
  deleteLabel: { ...text.bodyMedium, color: color.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
