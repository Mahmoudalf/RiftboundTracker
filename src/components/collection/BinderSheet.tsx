import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * Name a new binder.
 *
 * One field, because a binder is one field.
 *
 * It carried an accent picker — seven domain swatches plus a "none" — for a
 * colour nothing ever rendered. The horizontal rail it was drawn for went when
 * Collection split in two, and `BinderRow` has never read `accent`. The column
 * went with it in **migration 21**.
 *
 * It also carried an edit mode and a delete action, reached by passing an
 * existing binder. Nothing ever did — the Collection tab has only ever passed
 * `null`, which is why the post-M6 audit found `renameBinder` and
 * `deleteBinder` unreachable. Both now live on the binder's own screen, where
 * the binder is already the subject and you can see what is filed in it before
 * throwing it away.
 */

interface BinderSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function BinderSheet({ visible, onClose, onSave }: BinderSheetProps) {
  const t = useT();
  const [name, setName] = useState('');

  const save = () => {
    // `createBinder` falls back to "Binder" on a blank name, so this cannot
    // write a nameless row.
    onSave(name.trim());
    setName('');
  };

  return (
    <Sheet
      visible={visible}
      title={t('binder.new')}
      subtitle={t('binder.new.subtitle')}
      onClose={onClose}
      actions={
        <>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={save}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{t('binder.create')}</Text>
          </Pressable>
        </>
      }
    >
      <Text style={styles.label}>{t('binder.name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('binder.namePlaceholder')}
        placeholderTextColor={color.textHint}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel={t('binder.name')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { ...text.fieldLabel, color: color.textFaint, paddingBottom: space[2] },
  input: {
    ...text.body,
    color: color.text,
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryLabel: { ...text.bodyMedium, color: color.textSecondary },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  primaryLabel: { ...text.bodyMedium, color: color.onAccent },
  pressed: { opacity: 0.75 },
});
