import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChoiceRow, SectionLabel } from '@/components/ui/Field';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { useCardSync } from '@/features/sync/useCardSync';
import { LOCALES, useLocale, useT, type RuntimeLocale } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/** What each language calls itself — never translated. */
const LANGUAGE_NAMES: Record<RuntimeLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  pseudo: 'Pseudo',
};

export default function ProfileScreen() {
  const { cardCount, isSyncing, progress, refresh } = useCardSync();
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  /*
   * The pseudo-locale is offered only in development.
   *
   * It is not a language — it is English lengthened and accented to find the
   * places a translation will break the layout. Shipping it in a picker would
   * offer a player a broken app as a choice.
   */
  const options: RuntimeLocale[] = __DEV__ ? [...LOCALES, 'pseudo'] : [...LOCALES];

  /*
   * No milestone number in the header, for the same reason the About card below
   * carries none. "Sync arrives in M7" told a player nothing except that the
   * developer has a numbering scheme — and it went stale the moment Localization
   * entered as M7 and pushed Cloud to M8. What the line has to say is that
   * nothing leaves the phone yet, which stays true until it isn't.
   */
  return (
    <Screen
      title={t('profile.title')}
      meta={metaLine(t('profile.localOnly'), t('profile.nothingLeaves'))}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/*
          Language, above the card library.

          First because it changes everything below it: a player who opened this
          screen to find their language should not have to read English past it
          to get there.
        */}
        <View style={styles.card}>
          <SectionLabel>{t('profile.language')}</SectionLabel>
          <ChoiceRow<RuntimeLocale>
            options={options.map((l) => ({ key: l, label: LANGUAGE_NAMES[l], value: l }))}
            value={locale}
            onSelect={setLocale}
          />
          <Text style={styles.cardBody}>{t('profile.languageHelp')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.library')}</Text>
          <Text style={styles.cardBody}>
            {cardCount > 0
              ? `${cardCount.toLocaleString()} cards stored on this device. Browsing, searching, and deckbuilding all work without a connection.`
              : 'No cards stored yet.'}
          </Text>
          {progress?.phase === 'failed' && progress.message ? (
            <Text style={styles.error}>{progress.message}</Text>
          ) : null}
          <Pressable
            onPress={() => void refresh()}
            disabled={isSyncing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
              isSyncing && styles.disabled,
            ]}
          >
            <Text style={styles.buttonLabel}>
              {isSyncing ? (progress?.message ?? 'Refreshing…') : 'Refresh card library'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.about')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.unofficial')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.attribution')}</Text>
          {/* No milestone here. It read "M1" for five milestones because a
              hand-written stage label has nothing keeping it true. */}
          <Text style={styles.footerMeta}>{metaLine('Riftbound Tracker', 'v0.1.0')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[3], paddingBottom: space[8] },
  card: {
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    gap: space[2],
  },
  cardTitle: { ...text.meta, color: color.textMuted },
  cardBody: { ...text.small, color: color.textSecondary },
  error: { ...text.caption, color: color.danger },
  button: {
    marginTop: space[2],
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...text.smallMedium, color: color.text },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  footerMeta: { ...text.microMeta, color: color.textFaint, paddingTop: space[2] },
});
