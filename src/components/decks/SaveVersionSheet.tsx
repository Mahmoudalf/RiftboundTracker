import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { useT } from '@/i18n';
import { suggestLabelFromDiff, type DeckDiff } from '@/lib/deck-diff';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { DeckDiffView, diffHeadline } from './DeckDiffView';

/**
 * The save sheet — where the version model is taught, by using it.
 *
 * It leads with the **diff**, not a form. The user already knows what they
 * changed; what they need to see is that the change is about to become a new
 * version, that the old one keeps its matches, and what it will be called. The
 * label field is pre-filled from the largest change, so naming a version costs
 * zero taps and stays editable.
 *
 * On an unlocked version this is a plain confirm — there is no fork, no history
 * to protect, and nothing to explain. Explaining it anyway, before the deck has
 * played a single game, is how the feature starts feeling like paperwork.
 */

interface SaveVersionSheetProps {
  visible: boolean;
  diff: DeckDiff;
  /** The version being edited. */
  versionNumber: number;
  /** Matches already logged against it. Zero means it is unlocked. */
  matchCount: number;
  locked: boolean;
  onCancel: () => void;
  onSave: (options: { label?: string; amendLocked?: boolean }) => void;
}

export function SaveVersionSheet({
  visible,
  diff,
  versionNumber,
  matchCount,
  locked,
  onCancel,
  onSave,
}: SaveVersionSheetProps) {
  const t = useT();
  const insets = useSafeAreaInsets();

  // Suggested once, at mount. The caller mounts this sheet only when there is a
  // change to confirm and unmounts it afterwards, so the suggestion is always
  // for the diff on screen — and an effect that re-suggested would fight the
  // user for the field the moment they typed in it.
  const [label, setLabel] = useState(() => suggestLabelFromDiff(diff) ?? '');

  // A locked version always forks, art-only changes included: its card rows are
  // the record of what was physically played, not just a rules-level list.
  const willFork = locked;

  const onAmendInstead = () => onSave({ amendLocked: true });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.dismiss')}
        onPress={onCancel}
        style={styles.scrim}
      />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
        <View style={styles.grabber} />

        <Text style={styles.title} accessibilityRole="header">
          {willFork
            ? t('version.saveAs', { number: versionNumber + 1 })
            : t('version.saveChanges')}
        </Text>
        <Text style={styles.headline}>{diffHeadline(diff)}</Text>

        <ScrollView style={styles.diffScroll} contentContainerStyle={styles.diffContent}>
          <DeckDiffView diff={diff} />
        </ScrollView>

        {willFork ? (
          <>
            <Text style={styles.explain}>
              {matchCount === 0
                ? t('version.forkExplain.locked', {
                    number: versionNumber,
                    next: versionNumber + 1,
                  })
                : t(
                    matchCount === 1
                      ? 'version.forkExplain.one'
                      : 'version.forkExplain.other',
                    { number: versionNumber, count: matchCount, next: versionNumber + 1 }
                  )}
            </Text>

            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={t('version.nameThis')}
              placeholderTextColor={color.textFaint}
              style={styles.input}
              accessibilityLabel={t('version.label')}
              returnKeyType="done"
            />
          </>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSave({ label: label.trim() || undefined })}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>
              {willFork ? t('version.saveAs', { number: versionNumber + 1 }) : t('version.save')}
            </Text>
          </Pressable>

          {willFork ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t(
                matchCount === 1 ? 'version.amendMeta.one' : 'version.amendMeta.other',
                { number: versionNumber, count: matchCount }
              )}
              onPress={onAmendInstead}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Amend v{versionNumber} instead</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>{t('version.keepEditing')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: space[5],
    paddingTop: space[2],
    gap: space[3],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.border,
    marginBottom: space[2],
  },
  title: { ...text.title, color: color.text },
  headline: { ...text.small, color: color.textMuted },
  diffScroll: { maxHeight: 220 },
  diffContent: { paddingBottom: space[1] },
  explain: { ...text.small, color: color.textSecondary },
  input: {
    ...text.body,
    color: color.text,
    backgroundColor: color.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[3],
    minHeight: 46,
  },
  actions: { gap: space[2], paddingTop: space[1] },
  primary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: color.accent,
  },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { ...text.smallMedium, color: color.warning },
  cancelLabel: { ...text.smallMedium, color: color.textMuted },
  pressed: { opacity: 0.8 },
});
