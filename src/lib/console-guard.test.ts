import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every `console.*` call site is named here, or the build fails.
 *
 * ---
 *
 * **What T1 §C actually established, and what it did not.**
 *
 * The data-at-rest audit checked that nothing sensitive reaches logs, and the
 * answer was clean: eleven call sites, all `__DEV__`-guarded, none logging user
 * content — ids, counts and millisecond timings only, no deck name, no display
 * name, no notes. That was **read, not tested**, and the residual was recorded
 * as such: the next unguarded `console.log` of a deck name would pass the gate.
 *
 * This is that residual, closed the same way `sql-injection.test.ts` closed the
 * dynamic-SQL one — with an allowlist rather than an analysis.
 *
 * **What this test checks:** that the set of call sites has not changed. That
 * is all, and it is deliberate.
 *
 * **What it does not check, and why not attempting it is the right call:**
 *
 * 1. *Whether the guard is present.* A guard can be an enclosing `if (__DEV__)`,
 *    an early `if (!__DEV__ || …) return;` at the top of the function, or the
 *    `typeof __DEV__ !== 'undefined' && __DEV__` form the modules reachable from
 *    Node tests use. Deciding which of those covers a given line needs the
 *    enclosing function, which needs a parser. A regex that guesses would be a
 *    second thing that can be wrong about the file it is checking.
 * 2. *Whether the argument is user content.* `` `[stats] deck=${active}` `` is
 *    an id and `deck.name` is a name, and nothing structural separates them.
 *    Any rule strict enough to catch the second would flag the first.
 *
 * Both are judgements a person has to make. So the test does the one thing a
 * machine does better than a person — **notice that the set changed** — and
 * hands the judgement back at exactly the moment it is needed. Adding a
 * `console.log` is a two-line diff here, and writing the line is where someone
 * has to say what they are logging and why it is safe.
 *
 * The maintenance cost is the same one the SQL allowlist already carries, and
 * it was accepted there for the same reason.
 */

/** Files a user's data can reach. `scripts/` is build tooling and excluded. */
const ROOTS = ['app', 'src'];

/**
 * Every `console.*` call in the tree, as `file:method`.
 *
 * The four in `useLocale.ts` and `ErrorBoundary.tsx` use the
 * `typeof __DEV__ !== 'undefined'` form so `lib/`'s Node tests can load them;
 * the rest use a plain `__DEV__` guard or an early return.
 *
 * **Before adding a line here, answer both questions in the note above.** The
 * point of the list is that the answers get given.
 */
const ALLOWED = new Set([
  // The crash boundary. Development only, by design — there is no crash
  // reporter and adding one carries a standing constraint (T1 §F).
  'src/components/ui/ErrorBoundary.tsx:error',

  // Instrumentation for the two timed flows. Milliseconds and row counts.
  'src/features/decks/timing.ts:log',
  'src/features/games/timing.ts:log',

  // i18n fallbacks. Three warnings, none carrying a value — the failure is
  // that a preference could not be read or written, not what it said.
  'src/i18n/useLocale.ts:warn',

  // Editor and stats diagnostics. Ids, counts and version numbers.
  'app/(tabs)/(decks)/deck/[id]/edit.tsx:log',
  'app/(tabs)/stats.tsx:log',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(full) && !full.includes('.test.')) out.push(full);
  }
  return out;
}

/** `file:method` for every `console.<method>(` outside a comment. */
function callSites(): { site: string; file: string; line: number }[] {
  const out: { site: string; file: string; line: number }[] = [];

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const rel = file.replace(/\\/g, '/');
      // Comments go first, so the prose in this file's own docblock — and in
      // every "the console.error is guarded" comment elsewhere — is not a site.
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));

      src.split('\n').forEach((row, index) => {
        for (const m of row.matchAll(/\bconsole\.([a-z]+)\s*\(/g)) {
          out.push({ site: `${rel}:${m[1]}`, file: rel, line: index + 1 });
        }
      });
    }
  }
  return out;
}

describe('no console call slips in unreviewed', () => {
  it('logs only from sites that have been looked at', () => {
    const offenders = callSites()
      .filter(({ site }) => !ALLOWED.has(site))
      .map(({ file, line, site }) => `${file}:${line}  ${site.split(':')[1]}`);

    // Named as a list so a failure points at the line rather than sending the
    // next person hunting for which of forty files grew a log call.
    expect(offenders).toEqual([]);
  });

  it('finds the calls it claims to check — a silent zero is not a pass', () => {
    // Eleven at the time of writing. The floor is deliberately below that: this
    // guards against the scanner breaking, not against someone deleting a log.
    expect(callSites().length).toBeGreaterThanOrEqual(8);
  });

  it('does not count a console call written inside a comment', () => {
    // The rule that makes the count above trustworthy. Several files discuss
    // their own logging in prose, and a scanner that read those would report
    // sites that do not exist and pass an allowlist built from them.
    const commented = callSites().filter(({ file }) => file.endsWith('console-guard.test.ts'));
    expect(commented).toEqual([]);
  });
});
