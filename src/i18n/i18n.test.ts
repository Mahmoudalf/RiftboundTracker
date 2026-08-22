import { describe, expect, it } from 'vitest';

import { de } from './de';
import { en } from './en';
import { fr } from './fr';
import { pseudo } from './pseudo';
import type { Key, Translation } from './types';

/**
 * The gate that lets `de.ts` and `fr.ts` be `Partial`.
 *
 * A missing key falls back to English at runtime, which is the right behaviour
 * — a blank label is worse than an English one — but it is also silent, and
 * silence is how a half-translated app ships. These tests are where that stops.
 */

const KEYS = Object.keys(en) as Key[];
const LOCALES: [string, Translation][] = [
  ['de', de],
  ['fr', fr],
];

/** The `{named}` placeholders a string uses, as a set. */
const placeholders = (s: string) =>
  new Set([...s.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]));

describe('catalogue completeness', () => {
  it.each(LOCALES)('%s translates every key', (_name, catalogue) => {
    const missing = KEYS.filter((key) => catalogue[key] === undefined);
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s has no keys English does not', (_name, catalogue) => {
    const extra = Object.keys(catalogue).filter((key) => !(key in en));
    expect(extra).toEqual([]);
  });

  /*
   * The failure this catches is nastier than a missing string: a translator
   * writing `{tage}` for `{days}` produces a screen that renders the literal
   * text "{tage}" to a user, and it reads as corruption rather than as a typo.
   */
  it.each(LOCALES)('%s keeps every placeholder the English uses', (_name, catalogue) => {
    const wrong: string[] = [];
    for (const key of KEYS) {
      const translated = catalogue[key];
      if (translated === undefined) continue;
      const source = placeholders(en[key]);
      const target = placeholders(translated);
      const sameSize = source.size === target.size;
      const allPresent = [...source].every((p) => target.has(p));
      if (!sameSize || !allPresent) {
        wrong.push(`${key}: expected {${[...source]}}, got {${[...target]}}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('has no empty strings', () => {
    for (const [name, catalogue] of [['en', en] as const, ...LOCALES]) {
      const blank = Object.entries(catalogue).filter(([, v]) => !v || !String(v).trim());
      expect(blank, `${name} has blank values`).toEqual([]);
    }
  });

  /*
   * The two keys that must **not** be translated.
   *
   * Riot specifies its attribution notices as wording rather than as a topic,
   * so a German rendering of Riot's sentence is no longer Riot's sentence and
   * stops satisfying the policy (T1 §A, `docs/STORE.md` §5). Every other test
   * in this file pushes towards translating everything, which is exactly why
   * these two need one pushing back: the failure mode is a translator being
   * helpful, and it would ship silently because the result reads as correct.
   */
  const VERBATIM: Key[] = ['profile.about.riotFan', 'profile.about.riotDev'];

  it.each(LOCALES)('%s keeps Riot’s required notices in Riot’s words', (_name, catalogue) => {
    const changed = VERBATIM.filter((key) => catalogue[key] !== en[key]);
    expect(changed, 'these are legal notices, not copy — see the note in en.ts').toEqual([]);
  });

  it('checks notices that actually exist — a silent zero is not a pass', () => {
    for (const key of VERBATIM) {
      expect(en[key], `${key} missing from the catalogue`).toBeTruthy();
      expect(en[key]).toContain('Riot Games');
    }
  });
});

describe('pseudo-locale', () => {
  it('leaves placeholders exactly intact', () => {
    // The whole point: pseudo tests *layout*, so breaking interpolation would
    // turn a layout pass into a bug hunt.
    expect(pseudo('{days} days ago')).toContain('{days}');
    expect(pseudo('{a} and {b}')).toContain('{a}');
    expect(pseudo('{a} and {b}')).toContain('{b}');
  });

  it('lengthens the string, so tight containers fail visibly', () => {
    const source = 'Draw';
    expect(pseudo(source).length).toBeGreaterThan(source.length);
  });

  it('brackets the string, so truncation can be seen', () => {
    const out = pseudo('Save');
    expect(out.startsWith('⟦')).toBe(true);
    expect(out.endsWith('⟧')).toBe(true);
  });

  it('accents letters, so a missing glyph shows as tofu', () => {
    expect(pseudo('aeiou')).toContain('á');
    expect(pseudo('aeiou')).toContain('é');
  });

  it('does not pad based on placeholder names', () => {
    // Two strings with the same visible text must expand the same amount,
    // however long the placeholder happens to be named.
    const short = pseudo('Hi {a}');
    const long = pseudo('Hi {averylongplaceholdername}');
    expect(short.length - '{a}'.length).toBe(long.length - '{averylongplaceholdername}'.length);
  });

  it('survives a string with no letters at all', () => {
    expect(() => pseudo('—')).not.toThrow();
    expect(() => pseudo('{only}')).not.toThrow();
  });
});
