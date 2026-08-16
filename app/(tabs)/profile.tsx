import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChoiceRow, OptionRow, SectionLabel, SelectField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { DISPLAY_NAME_MAX, displayName, setDisplayName } from '@/db/queries/settings';
import { TOAST_CONFIRM_MS, useToast } from '@/features/games/useToast';
import { useCardSync } from '@/features/sync/useCardSync';
import { LOCALES, useLocale, useT, type Key, type RuntimeLocale } from '@/i18n';
import { localeNumber } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';
import { metaLine, text } from '@/theme/typography';

/**
 * Settings.
 *
 * Four things a player can change or read about the app, and nothing else. It
 * was "You" — a name that promised an account the app does not have — and the
 * screen has never been about a person. It is where the app is configured.
 *
 * Order is by how often it is wanted: the name and the language are settings,
 * the card library is a maintenance action, and the last two cards are about
 * the app rather than the player's use of it.
 */

/** What each language calls itself — never translated. */
const LANGUAGE_NAMES: Record<RuntimeLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  pseudo: 'Pseudo',
};

/**
 * The version, read rather than typed.
 *
 * The About card carried a hand-written `v0.1.0`, which is the same shape of
 * mistake as the `M1` label that sat there for five milestones: a fact about
 * the build, written by hand, with nothing keeping it true. `app.json` is the
 * one place a version is actually set.
 */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** What a report is. Keys, translated at render. */
const REPORT_KINDS = [
  { key: 'bug', label: 'profile.report.kind.bug' },
  { key: 'feature', label: 'profile.report.kind.feature' },
] as const satisfies readonly { key: string; label: Key }[];

type ReportKind = (typeof REPORT_KINDS)[number]['key'];

export default function SettingsScreen() {
  const { cardCount, isSyncing, progress, refresh } = useCardSync();
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const showToast = useToast((s) => s.show);

  const [name, setName] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const [kind, setKind] = useState<ReportKind>('bug');
  const [kindOpen, setKindOpen] = useState(false);

  /** So tapping anywhere in the name field — including the pencil — focuses it. */
  const nameField = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      setName(displayName());
    }, [])
  );

  /*
   * The pseudo-locale is offered only in development.
   *
   * It is not a language — it is English lengthened and accented to find the
   * places a translation will break the layout. Shipping it in a picker would
   * offer a player a broken app as a choice.
   */
  const options: RuntimeLocale[] = __DEV__ ? [...LOCALES, 'pseudo'] : [...LOCALES];

  const kindLabel = REPORT_KINDS.find((r) => r.key === kind)!.label;

  /**
   * The single seam for sending a report.
   *
   * There is no backend yet, so the honest whole of "send" is putting the text
   * where the user can paste it. When one exists this function is what changes;
   * the form above it does not.
   *
   * **Nothing is gathered here, and nothing may be added later.** An earlier
   * draft attached the app version, the platform and OS version, the language,
   * and row counts for cards, decks and games. Device and OS details are
   * personal data under the GDPR, so collecting them would oblige the project
   * to run a data protection impact assessment — for a fan app that otherwise
   * has nothing to assess. The report is what the user typed and the category
   * they chose. That is the whole of it, by decision rather than by omission.
   */
  const onCopyReport = () => {
    const body = report.trim();
    if (body.length === 0) return;
    void Clipboard.setStringAsync(`[${t(kindLabel)}] ${body}`);
    showToast(t('profile.report.copied'), { durationMs: TOAST_CONFIRM_MS });
  };

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
          The name, first.

          Not because it is the most useful — it does nothing yet — but because
          it is the one field on this screen that is *about* the player, and
          burying a personal field under maintenance actions reads as an
          afterthought.
        */}
        <View style={styles.card}>
          <SectionLabel>{t('profile.name')}</SectionLabel>
          <Pressable
            accessibilityRole="none"
            onPress={() => nameField.current?.focus()}
            style={styles.nameField}
          >
            <TextInput
              ref={nameField}
              value={name ?? ''}
              onChangeText={setName}
              // Written on blur rather than per keystroke, as everywhere else a
              // name is edited: one write per rename instead of one per letter.
              onBlur={() => {
                setDisplayName(name);
                // Read back rather than trusting the draft — the store trims and
                // caps, and the field should show what was actually kept.
                setName(displayName());
              }}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={color.textFaint}
              style={styles.nameInput}
              returnKeyType="done"
              accessibilityLabel={t('profile.name.a11y')}
            />
            <Icon name="pencil" size={15} color={color.textMuted} />
          </Pressable>
          <Text style={styles.cardBody}>{t('profile.nameHelp')}</Text>
        </View>

        {/*
          Language, above everything that is only prose.

          A player who opened this screen to find their language should not have
          to read past English paragraphs to reach it.
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
            {/* These four strings have had German and French since the
                translation pass; the screen was still rendering the English
                literals it was written with. */}
            {cardCount > 0
              ? t('profile.library.stored', { count: localeNumber(cardCount) })
              : t('profile.library.empty')}
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
              {isSyncing
                ? (progress?.message ?? t('profile.library.refreshing'))
                : t('profile.library.refresh')}
            </Text>
          </Pressable>
        </View>

        {/*
          Feedback: a category and a text field. Nothing else.

          The destination is not built yet, so the button copies rather than
          sends and the card says so in as many words. A Send button that
          quietly did nothing would be the one dishonest control in the app.
        */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.report')}</Text>
          <Text style={styles.cardBody}>{t('profile.report.body')}</Text>

          {/* Before the field, so the category frames what the user writes
              rather than reclassifying it afterwards. */}
          <SelectField
            placeholder={t('profile.report.kind')}
            value={t(kindLabel)}
            open={kindOpen}
            onToggle={() => setKindOpen((open) => !open)}
            compact
          >
            {REPORT_KINDS.map((option) => (
              <OptionRow
                key={option.key}
                label={t(option.label)}
                selected={option.key === kind}
                onPress={() => {
                  setKind(option.key);
                  setKindOpen(false);
                }}
              />
            ))}
          </SelectField>

          <TextInput
            value={report}
            onChangeText={setReport}
            placeholder={t('profile.report.placeholder')}
            placeholderTextColor={color.textFaint}
            style={styles.reportInput}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('profile.report.a11y')}
          />

          <Pressable
            onPress={onCopyReport}
            // Nothing to copy is not an error worth explaining — the button
            // simply is not available until there is something to send.
            disabled={report.trim().length === 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
              report.trim().length === 0 && styles.disabled,
            ]}
          >
            <Text style={styles.buttonLabel}>{t('profile.report.copy')}</Text>
          </Pressable>

          <Text style={styles.footerMeta}>{t('profile.report.noBackend')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.about')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.unofficial')}</Text>
          <Text style={styles.cardBody}>{t('profile.about.attribution')}</Text>
          {/* No milestone here. It read "M1" for five milestones because a
              hand-written stage label has nothing keeping it true. */}
          <Text style={styles.footerMeta}>
            {metaLine('Riftbound Tracker', `v${APP_VERSION}`)}
          </Text>
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

  /*
   * `SelectField`'s geometry — 52 high, `radius.lg`, 6 % fill, 14 % border — so
   * the name is asked for here exactly as it is in the deck editor and in a
   * binder. The **field** draws the box; `nameInput` is bare text inside it.
   */
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  nameInput: { ...text.body, color: color.text, flex: 1, padding: 0 },

  /** Taller than a name field, because a bug report is prose. */
  reportInput: {
    ...text.small,
    color: color.text,
    minHeight: 88,
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  /*
   * `diagnostics` lived here — a mono block listing the app version, platform,
   * OS version, language and row counts, copied along with every report.
   *
   * Removed on the owner's call. Device and OS details are personal data under
   * the GDPR; attaching them to a report would put a data protection impact
   * assessment in front of shipping, for a fan app with nothing else to assess.
   * The report carries what the user typed and nothing more.
   */

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
