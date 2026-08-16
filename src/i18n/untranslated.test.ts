import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanSource } from './scan';

/**
 * No English prose outside the catalogue. Enforced, not audited.
 *
 * This test is the point of the whole exercise, and worth more than the 137
 * strings it was written to clear. The first migration reported "239 → 0" and
 * was believed for two months, because the only thing keeping the catalogue
 * honest was that somebody thought to look again. Nothing failed in between —
 * a screen simply spoke English, and the build stayed green.
 *
 * A count in a document is a claim. A red test is a fact.
 *
 * **When this fails**, run `npm run i18n:scan -- -v` for the strings and their
 * line numbers. Fix by adding a key, not by widening `scan.ts` — and if a
 * finding genuinely is not copy, name it: `ALLOWED` for a global rule, or an
 * inline `// i18n-ignore` for a one-off, so the exception is a decision
 * somebody wrote down rather than a hole in the search.
 */

const ROOTS = ['app', 'src/components'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') && !full.includes('.test.')) out.push(full);
  }
  return out;
}

describe('every user-facing string goes through the catalogue', () => {
  const files = ROOTS.flatMap((root) => walk(root));

  it('scans a plausible number of files — a silent zero is not a pass', () => {
    // If a path changes and `walk` finds nothing, every assertion below passes
    // vacuously. This is the guard on the guard.
    expect(files.length).toBeGreaterThan(40);
  });

  it('finds no untranslated prose in any screen or component', () => {
    const offenders = files
      .map((file) => ({ file, findings: scanSource(readFileSync(file, 'utf8')) }))
      .filter((r) => r.findings.length > 0)
      .map((r) => `${r.file.replace(/\\/g, '/')}:${r.findings[0]!.line}  ${r.findings[0]!.text}`);

    // Reported as a list rather than a count, so a failure names the file and
    // the line instead of asking the next person to go hunting.
    expect(offenders).toEqual([]);
  });
});
