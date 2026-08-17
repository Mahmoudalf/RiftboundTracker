import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The crash screen, checked at the source.
 *
 * The suite runs in Node with no renderer — `vitest.config.ts` sets
 * `environment: 'node'` and every React Native component in this project is
 * tested through its logic rather than by mounting it. So this asserts the two
 * properties that can be read off the file, and they happen to be the two that
 * matter:
 *
 * 1. **It is wired in.** A boundary that exists and is never mounted is worse
 *    than none, because it looks handled.
 * 2. **It does not render the exception.** The app has just finished removing
 *    raw exception text from a user-facing screen; a crash screen showing a
 *    stack trace is the same leak with a bigger audience.
 */

const BOUNDARY = readFileSync('src/components/ui/ErrorBoundary.tsx', 'utf8');
const LAYOUT = readFileSync('app/_layout.tsx', 'utf8');

describe('the boundary exists and is mounted', () => {
  it('implements the only API React gives for this', () => {
    expect(BOUNDARY).toContain('static getDerivedStateFromError');
    expect(BOUNDARY).toContain('componentDidCatch');
  });

  it('wraps the navigator in the root layout', () => {
    expect(LAYOUT).toContain('<ErrorBoundary>');
    expect(LAYOUT).toContain('</ErrorBoundary>');

    // Order matters: outside the navigator, or a screen that throws takes the
    // tree with it; inside the providers, or the fallback has no theme.
    const providerAt = LAYOUT.indexOf('<QueryClientProvider');
    const boundaryAt = LAYOUT.indexOf('<ErrorBoundary>');
    const stackAt = LAYOUT.indexOf('<Stack');
    expect(providerAt).toBeLessThan(boundaryAt);
    expect(boundaryAt).toBeLessThan(stackAt);
  });
});

describe('it never shows the user an exception', () => {
  /** Everything from `render()` down — what a user can actually see. */
  const rendered = BOUNDARY.slice(BOUNDARY.indexOf('override render()'));

  it('renders no error, message, or stack', () => {
    const LEAKS = [
      'error.message',
      'error.stack',
      'this.state.error',
      '{error',
      'componentStack',
      'String(error',
      'JSON.stringify(error',
    ];
    for (const leak of LEAKS) {
      expect(rendered).not.toContain(leak);
    }
  });

  it('does not keep the error in state, so it cannot be rendered by accident', () => {
    // `getDerivedStateFromError` receives the error and deliberately drops it.
    // Storing it would put a stack trace one careless `{this.state.error}` away.
    expect(BOUNDARY).toContain('static getDerivedStateFromError(): State');
    expect(BOUNDARY).toMatch(/interface State \{\s*crashed: boolean;\s*\}/);
  });

  it('says something translated instead', () => {
    for (const key of ['crash.title', 'crash.body', 'crash.retry']) {
      expect(rendered).toContain(`t('${key}')`);
    }
  });

  it('logs the detail only in development', () => {
    // A console.error in a release build is invisible anyway; the guard is
    // there so the intent is explicit rather than incidental.
    expect(BOUNDARY).toMatch(/typeof __DEV__ !== 'undefined' && __DEV__/);
  });
});
