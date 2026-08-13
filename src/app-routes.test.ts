import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every `<Stack.Screen name="…">` must name a route that exists.
 *
 * A layout's screen names are **strings**, so nothing else in the toolchain
 * checks them: typecheck cannot, lint cannot, and an unused-export scan cannot
 * — the name is not a symbol. Expo warns at runtime and carries on rendering.
 *
 * That is how `name="match/new"` survived the game/match rename. The route file
 * had moved to `game/new`, so the options attached to it — `presentation:
 * 'modal'` and `slide_from_bottom` — silently stopped applying, and the log
 * form animated as a right-to-left push while still styling itself as a
 * presented sheet (`Screen`'s `compact` prop exists for exactly that
 * distinction). Nothing failed; it just looked wrong.
 */

const APP = join(process.cwd(), 'app');

/**
 * Route names a layout may use, relative to its own directory.
 *
 * Names resolve against the layout that declares them, not the app root —
 * `app/(tabs)/_layout.tsx` says `stats`, not `(tabs)/stats`. A directory is a
 * name in its own right whenever it holds a layout or a route, which is what
 * makes a group like `(decks)` nameable from its parent.
 */
function routeNamesFor(dir: string, prefix = ''): string[] {
  const names: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('+')) continue;

    if (entry.isDirectory()) {
      const nested = routeNamesFor(join(dir, entry.name), `${prefix}${entry.name}/`);
      if (nested.length > 0 || existsSync(join(dir, entry.name, '_layout.tsx'))) {
        names.push(`${prefix}${entry.name}`, ...nested);
      }
      continue;
    }

    if (entry.name.startsWith('_')) continue;
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;

    const base = entry.name.replace(/\.tsx?$/, '');
    // A layout may name a route with or without its `index` segment.
    if (base === 'index') names.push(`${prefix}index`, prefix.replace(/\/$/, ''));
    else names.push(`${prefix}${base}`);
  }

  return names.filter(Boolean);
}

function layoutFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...layoutFiles(path));
    else if (entry.name === '_layout.tsx') found.push(path);
  }
  return found;
}

describe('layout route names', () => {
  const layouts = layoutFiles(APP);

  it('found the layouts to check', () => {
    expect(layouts.length).toBeGreaterThan(0);
  });

  for (const layout of layouts) {
    const relative = layout.slice(process.cwd().length + 1).replace(/\\/g, '/');

    it(`${relative}: every declared screen names a real route`, () => {
      const src = readFileSync(layout, 'utf8');
      const declared = [...src.matchAll(/<(?:Stack|Tabs)\.Screen\s+name="([^"]+)"/g)].map(
        (m) => m[1]!
      );
      const known = new Set(routeNamesFor(dirname(layout)));

      const missing = declared.filter((name) => !known.has(name));
      expect({ layout: relative, namesWithNoRoute: missing }).toEqual({
        layout: relative,
        namesWithNoRoute: [],
      });
    });
  }
});
