import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { t } from '@/i18n';
import { color, radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

/**
 * The last thing standing between a render error and a blank screen.
 *
 * Nothing implemented `componentDidCatch` until now, so any exception thrown
 * while rendering took the whole app down — no message, no recovery, and on a
 * release build no console to read either.
 *
 * **It deliberately does not show the exception.** The app has just finished
 * removing raw exception text from a user-facing screen — a schema drift was
 * printing Zod's English parse output into Settings — and a crash screen is the
 * same class of leak with a bigger audience: a stack trace names internal file
 * paths, and an error message can carry whatever value it was thrown about.
 * The user gets a translated sentence and a way out; the detail goes to the
 * console, which exists in development and is where a developer would look.
 *
 * A class component because that is the only way React exposes this. There is
 * no hook equivalent, and there is not expected to be one.
 */

interface Props {
  children: ReactNode;
  /** Rendered instead of the default screen. Only used by the tests. */
  fallback?: (reset: () => void) => ReactNode;
}

interface State {
  crashed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    /*
     * Development only, and by design.
     *
     * There is no crash reporter here and adding one is a T1 decision with a
     * standing constraint attached: it must collect nothing about the device.
     * Until then, silence in production beats a half-built pipeline that
     * quietly starts phoning home.
     */
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error('[crash]', error, info.componentStack);
    }
  }

  private reset = (): void => {
    this.setState({ crashed: false });
  };

  override render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);

    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('crash.title')}</Text>
          <Text style={styles.body}>{t('crash.body')}</Text>

          {/*
            Re-render, rather than a restart the app cannot perform.
            Clearing the flag remounts the tree below; if whatever threw is
            still there it will throw again and land back here, which is honest.
            Nothing is written or cleared — the database is untouched by a render
            error, and a crash screen that offered to reset data would be
            offering the one thing that could actually lose some.
          */}
          <Pressable
            accessibilityRole="button"
            onPress={this.reset}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>{t('crash.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  card: {
    gap: space[3],
    padding: space[5],
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    maxWidth: 420,
  },
  title: { ...text.title, color: color.text },
  body: { ...text.small, lineHeight: 20, color: color.textSecondary },
  button: {
    marginTop: space[2],
    height: 48,
    borderRadius: radius.card,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...text.bodyMedium, color: color.onAccent },
  pressed: { opacity: 0.75 },
});
