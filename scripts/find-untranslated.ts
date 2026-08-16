import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { scanSource, type Finding } from '../src/i18n/scan';

/**
 * Report English prose that never reached the catalogue.
 *
 *     npm run i18n:scan          per-file counts
 *     npm run i18n:scan -- -v    every string, with line numbers
 *
 * The same scanner backs `untranslated.test.ts`, which fails the build rather
 * than printing. This script exists for the human half of the job: when the test
 * goes red it says how many and where, and this says *what*.
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

const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');
const files = ROOTS.flatMap((r) => walk(r));
const results: { file: string; findings: Finding[] }[] = [];

for (const file of files) {
  const findings = scanSource(readFileSync(file, 'utf8'));
  if (findings.length > 0) results.push({ file, findings });
}

results.sort((a, b) => b.findings.length - a.findings.length || a.file.localeCompare(b.file));
const total = results.reduce((n, r) => n + r.findings.length, 0);

if (total === 0) {
  console.log(`\nNo untranslated prose. ${files.length} files scanned.\n`);
  process.exit(0);
}

console.log('');
for (const { file, findings } of results) {
  console.log(`${String(findings.length).padStart(4)}  ${file.replace(/\\/g, '/')}`);
  if (verbose) {
    for (const f of findings) {
      const text = f.text.length > 88 ? `${f.text.slice(0, 88)}…` : f.text;
      console.log(`        ${String(f.line).padStart(5)}  ${text}`);
    }
  }
}
console.log(
  `\n${total} untranslated string${total === 1 ? '' : 's'} across ` +
    `${results.length} of ${files.length} files.\n` +
    (verbose ? '' : 'Run with -v to see them.\n')
);
