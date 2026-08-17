import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What is actually in the release bundle.
 *
 *     npm run audit:bundle                     the advisory roots
 *     npm run audit:bundle -- nanoid lodash    specific packages
 *     npm run audit:bundle -- --list expo-     every module matching a prefix
 *
 * Build the export first:
 *
 *     npx expo export --platform android --no-minify --source-maps external \
 *       --output-dir dist
 *
 * ---
 *
 * **Why a source map and not a grep.**
 *
 * The obvious method is to search the compiled bundle for a package name. It
 * does not work, in both directions, and this session proved both:
 *
 * - **False positives.** Grepping the Hermes bytecode for `esbuild` and `uuid`
 *   matched — as bare words inside unrelated code. Neither package is in the
 *   bundle. A string appearing in a binary is not a module shipping.
 * - **False negatives.** The H2 roadmap section searched a *minified* production
 *   bundle for `urlAlphabet` and `customRandom` and concluded absence. A
 *   minifier renames local identifiers, so their absence proves nothing. That
 *   check is how "none of the four is in the release bundle" became a recorded
 *   fact while `nanoid` was shipping.
 *
 * A source map's `sources` array is every file Metro compiled in, by path,
 * whether or not the output was minified. That is the question — "did this
 * module ship" — answered directly instead of inferred.
 *
 * The Backlog says to re-measure after every SDK upgrade. This exists so that
 * instruction has a tool attached rather than living in someone's memory.
 */

/** The advisory roots, as of 2026-08-16. Update alongside the Backlog entry. */
const ADVISORY_ROOTS = ['uuid', 'image-size', 'esbuild', 'nanoid'];

const args = process.argv.slice(2);
const listMode = args.includes('--list');
const queries = args.filter((a) => !a.startsWith('--'));

/** Where `expo export` was told to write. Checked in likely order. */
const CANDIDATES = ['dist', 'dist2', join('..', 'dist')];

function findSourceMap(): string | null {
  for (const root of CANDIDATES) {
    const dir = join(root, '_expo', 'static', 'js');
    if (!existsSync(dir)) continue;
    for (const platform of readdirSync(dir)) {
      const platformDir = join(dir, platform);
      const map = readdirSync(platformDir).find((f) => f.endsWith('.map'));
      if (map) return join(platformDir, map);
    }
  }
  return null;
}

const mapPath = findSourceMap();
if (!mapPath) {
  console.error(
    '\nNo source map found under ' +
      CANDIDATES.join(', ') +
      '.\n\nBuild one first:\n' +
      '  npx expo export --platform android --no-minify --source-maps external --output-dir dist\n'
  );
  process.exit(1);
}

const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { sources?: string[] };
const sources = (map.sources ?? []).map((s) => s.split('\\').join('/'));

console.log('\n' + mapPath.split('\\').join('/'));
console.log(sources.length + ' modules in the bundle\n');

if (listMode) {
  const prefix = queries[0] ?? '';
  const matching = sources.filter((s) => s.includes(prefix)).sort();
  for (const m of matching) console.log('  ' + m);
  console.log('\n' + matching.length + ' modules matching ' + JSON.stringify(prefix) + '\n');
  process.exit(0);
}

const packages = queries.length > 0 ? queries : ADVISORY_ROOTS;
let shipped = 0;

for (const pkg of packages) {
  // Anchored on `node_modules/<pkg>/` so `uuid` cannot match `uuid-parse`, and
  // a bare mention of the name in unrelated code cannot match at all.
  const hits = sources.filter((s) => s.includes('node_modules/' + pkg + '/'));
  if (hits.length > 0) shipped += 1;
  console.log('  ' + pkg.padEnd(16) + (hits.length ? 'IN BUNDLE (' + hits.length + ')' : 'not in bundle'));
  for (const h of hits.slice(0, 5)) console.log('      ' + h);
  if (hits.length > 5) console.log('      … and ' + (hits.length - 5) + ' more');
}

console.log('\n' + shipped + ' of ' + packages.length + ' present\n');

// Non-zero when something queried is shipping, so this can gate a check if it
// is ever wanted in CI. Informational today — a package being present is not by
// itself a problem, as `nanoid` was.
process.exit(shipped > 0 ? 1 : 0);
