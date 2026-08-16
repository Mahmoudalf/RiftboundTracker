/**
 * Finds English prose that never reached the catalogue.
 *
 * ---
 *
 * **Why this exists, and why it is shaped the way it is.**
 *
 * The first migration was driven by a scanner that looked for strings in the two
 * places strings usually live: text between JSX tags, and a known list of prop
 * names (`title=`, `label=`, `placeholder=`). Everything it found was converted,
 * and its count genuinely reached zero — for those two shapes.
 *
 * It never looked at five others, and 107 strings survived in them:
 *
 * 1. **Arguments to a call.** `Alert.alert('Delete this deck?', 'Its versions…')`
 *    — two positional arguments, nothing about them looks like copy.
 * 2. **Values in an object literal** under an arbitrary key: `needs: 'No games
 *    in this scope.'`
 * 3. **Strings returned from a helper**: `return onPlay ? 'On the play' : 'On
 *    the draw'` — the text never appears in any JSX.
 * 4. **Template literals.** The old pattern matched `'quotes'`; `` `Match ${n}` ``
 *    is a different delimiter and matched nothing.
 * 5. **Module-scope constant tables** like `BLOCK_LABELS`, defined far from the
 *    component that renders them.
 *
 * Because coverage followed *shapes*, it came out uneven in a way unrelated to
 * how important a screen is: `game/[id]/index.tsx` has a fully translated delete
 * dialog, while `deck/[id]/index.tsx` next door has four dialogs and one
 * translated title. The archive dialog ended up with a German title, an English
 * body and German buttons — worse than untranslated, because it reads as broken.
 *
 * **So this scanner does not look for shapes at all.** It takes every string
 * literal in the file and decides by *content* whether a person would read it.
 * That is the only rule that cannot be out-flanked by a new way of writing a
 * string, and it is why the five shapes above are covered by construction rather
 * than by five more patterns.
 *
 * False positives are handled by naming them — `ALLOWED` below, or an inline
 * `// i18n-ignore` on the line — never by narrowing the search.
 */

export interface Finding {
  /** 1-based, matching an editor. */
  line: number;
  /** The literal as written, trimmed. */
  text: string;
}

/**
 * Vocabulary that is **data**, not copy.
 *
 * Card types, supertypes, domains and rarities are the strings Riftcodex serves
 * and the strings printed on the card in the player's hand. M7B's own rule is
 * that card data stays in the language the API returns, so a match here is
 * correct code rather than a miss.
 */
const CARD_VOCABULARY = new Set([
  'Unit', 'Spell', 'Gear', 'Legend', 'Champion', 'Rune', 'Battlefield',
  'Basic', 'Signature', 'Token',
  'Body', 'Calm', 'Chaos', 'Colorless', 'Fury', 'Mind', 'Order',
  'Common', 'Epic', 'Promo', 'Rare', 'Showcase', 'Uncommon',
  /*
   * Printing treatments, which are **parsed out of the card's own name** —
   * `variantLabel('Vi - Piltover Enforcer (Alternate Art)')` returns
   * `'Alternate Art'`, and `PICKABLE_VARIANTS` matches against exactly that.
   * These are not labels the app writes; they are substrings of what Riftcodex
   * serves, so translating them would break the picker's filter outright.
   */
  'Alternate Art', 'Overnumbered', 'Metal', 'Ultimate', 'Launch Exclusive',
  'GG EZ', 'Starter',
]);

/** Riftcodex set codes. Card data, printed on the card. */
const SET_CODES = new Set(['OGN', 'UNL', 'VEN', 'OPP', 'PR', 'JDG']);

/**
 * Names that are the same in every language.
 *
 * The endonyms are what each language calls *itself*, and translating them is
 * the one thing a language picker must never do — "German" in a German app
 * helps nobody who cannot read German, which is exactly who needs the picker.
 * The product name is a proper noun.
 */
const NEVER_TRANSLATED = new Set([
  'English', 'Deutsch', 'Français', 'Pseudo',
  'Riftbound Tracker', 'Riftbound', 'Riftcodex', 'Riot Games',
]);

/**
 * Strings that reach no user: style values, accessibility roles, RN enums,
 * font families, and the handful of identifiers that happen to be capitalised.
 */
const ALLOWED = new Set([
  // Layout and style values.
  'center', 'flex-start', 'flex-end', 'space-between', 'space-around', 'stretch',
  'row', 'column', 'row-reverse', 'column-reverse', 'wrap', 'nowrap',
  'none', 'auto', 'solid', 'dashed', 'absolute', 'relative', 'hidden', 'visible',
  'cover', 'contain', 'center-crop', 'clip', 'head', 'tail', 'middle',
  'transparent', 'padding', 'height', 'position', 'top', 'bottom', 'left', 'right',
  'tabular-nums', 'uppercase', 'lowercase', 'capitalize', 'italic', 'normal',
  'memory-disk', 'memory', 'disk',
  // Accessibility roles and keyboard/input enums.
  'button', 'link', 'search', 'image', 'text', 'header', 'summary', 'alert',
  'checkbox', 'radio', 'tab', 'tablist', 'progressbar', 'adjustable', 'spinbutton',
  'done', 'go', 'next', 'send', 'default', 'words', 'sentences', 'characters',
  'always', 'never', 'handled', 'while-editing', 'on-drag',
  'light', 'dark', 'small', 'large', 'fade', 'slide_from_right', 'slide_from_bottom',
  'modal', 'card', 'push', 'pop',
  // Font families — declared as strings, never read.
  'SpaceGrotesk_300Light', 'SpaceGrotesk_400Regular', 'SpaceGrotesk_500Medium',
  'SpaceGrotesk_600SemiBold', 'SpaceGrotesk_700Bold',
  'JetBrainsMono_400Regular', 'JetBrainsMono_500Medium', 'JetBrainsMono_700Bold',
]);

/**
 * Blank out a matched call and its whole argument list, keeping newlines so
 * every later line number still points where an editor does.
 */
function blankCalls(source: string, opener: RegExp): string {
  let s = source;
  for (;;) {
    opener.lastIndex = 0;
    const m = opener.exec(s);
    if (!m) return s;

    let depth = 1;
    let i = m.index + m[0].length;
    while (i < s.length && depth > 0) {
      if (s[i] === '(') depth += 1;
      else if (s[i] === ')') depth -= 1;
      i += 1;
    }
    const span = s.slice(m.index, i);
    s = s.slice(0, m.index) + span.replace(/[^\n]/g, ' ') + s.slice(i);
  }
}

/** Strip anything that is not code a user's eyes can reach. */
function strip(source: string): string {
  let s = source;
  // Block comments, then line comments. Order matters: a `//` inside a block
  // comment must not survive the first pass and eat a real line.
  s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
  // Imports: paths and named bindings are never copy.
  s = s.replace(/^\s*import[\s\S]*?from\s*['"][^'"]*['"];?/gm, (m) => m.replace(/[^\n]/g, ' '));
  // Developer logging, argument list and all. Renaming the call was not enough
  // — the message is the argument, which is exactly the part that had to go.
  s = blankCalls(s, /console\.[a-z]+\(/g);
  return s;
}

/**
 * The style block is everything from `StyleSheet.create` to end of file.
 *
 * Cutting at the token rather than balancing braces is deliberate: every screen
 * in this codebase puts its styles last, and a brace-counter would be a second
 * thing that can be wrong about a file it is only meant to trim.
 */
function withoutStyles(source: string): string {
  const at = source.indexOf('StyleSheet.create');
  return at === -1 ? source : source.slice(0, at);
}

/** Does a person read this? */
function isProse(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 3) return false;
  if (CARD_VOCABULARY.has(s) || ALLOWED.has(s) || NEVER_TRANSLATED.has(s)) return false;

  // Catalogue keys — `deck.preview.list`, `game.result.win`.
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(s)) return false;
  // Module paths, filenames, URLs, colours, dates, pure punctuation or digits.
  if (/^[@./]/.test(s) || /^https?:/.test(s)) return false;
  if (/\.(ts|tsx|js|json|png|jpg|svg|db|sql)$/.test(s)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgba?\(/.test(s)) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  // SQL and code fragments that happen to sit in a string.
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|PRAGMA|FROM|WHERE)\b/.test(s)) return false;
  // Identifiers: snake_case, kebab-case, camelCase with no spaces.
  if (!/\s/.test(s) && /^[a-z][a-zA-Z0-9_-]*$/.test(s)) return false;

  const words = s.split(/\s+/).filter(Boolean);
  const hasSentenceShape = words.length >= 2 && /^[A-Z]/.test(s);
  /*
   * A sentence does not have to start with a capital.
   *
   * `v${n} is measurably ahead — the intervals do not overlap.` opens with an
   * interpolated version number, so the first character is a lowercase `v` and
   * every capital-first rule above walks straight past it. Three or more words,
   * at least three of them alphabetic, is a sentence whatever it starts with.
   */
  const alphabetic = words.filter((w) => /^[A-Za-z][a-z]+$/.test(w));
  const readsAsSentence = words.length >= 3 && alphabetic.length >= 3;
  // A lone capitalised word is copy when it is long enough not to be an enum
  // and not a known identifier — `Cancel`, `Delete`, `Archived`.
  const isLoneLabel = words.length === 1 && /^[A-Z][a-z]{3,}$/.test(s);
  /*
   * ALL-CAPS is a label, not a constant.
   *
   * The design sets section headers in uppercase, and several are written that
   * way in the source rather than via `textTransform` — `LEGEND`, `CHAMPION`.
   * They read as shouting identifiers and slipped past every rule above, which
   * is how a visible English word survives a scan that reports zero.
   *
   * Set codes are the exception: `OGN` and `UNL` are card data.
   */
  const isCapsLabel = /^[A-Z][A-Z ]{3,}$/.test(s) && !SET_CODES.has(s.replace(/\s/g, ''));
  return hasSentenceShape || readsAsSentence || isLoneLabel || isCapsLabel;
}

/**
 * Every string literal in the source, with its line.
 *
 * Hand-scanned rather than regexed, because a regex cannot tell a quote inside a
 * string from one that ends it — and `'Its versions and match history go with
 * it.'` is exactly the kind of copy that contains an apostrophe.
 */
function literals(source: string): { line: number; text: string; quote: string }[] {
  const out: { line: number; text: string; quote: string }[] = [];
  let line = 1;
  let i = 0;

  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      const startLine = line;
      let text = '';
      let depth = 0;
      i += 1;
      while (i < source.length) {
        const c = source[i]!;
        if (c === '\\') {
          text += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (c === '\n') line += 1;
        // Inside a template's `${…}` the content is an expression, not copy.
        if (quote === '`' && c === '$' && source[i + 1] === '{') {
          depth += 1;
          text += '{}';
          i += 2;
          continue;
        }
        if (depth > 0) {
          if (c === '{') depth += 1;
          if (c === '}') depth -= 1;
          i += 1;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        text += c;
        i += 1;
      }
      out.push({ line: startLine, text, quote });
      continue;
    }
    i += 1;
  }
  return out;
}

/** Bare text between JSX tags — the shape the first pass *did* cover. */
function jsxText(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  source.split('\n').forEach((row, index) => {
    for (const m of row.matchAll(/>([^<>{}\n]+)</g)) {
      const text = m[1]!.trim();
      if (isProse(text)) out.push({ line: index + 1, text });
    }
  });
  return out;
}

/**
 * Scan one file's source.
 *
 * A line carrying `// i18n-ignore` is skipped whole — the escape hatch for the
 * cases the content rules cannot decide, used instead of loosening them.
 */
export function scanSource(source: string): Finding[] {
  const ignored = new Set<number>();
  source.split('\n').forEach((row, index) => {
    if (!row.includes('i18n-ignore')) return;
    ignored.add(index + 1);
    /*
     * A comment-only pragma also covers the line beneath it.
     *
     * Same shape as `eslint-disable-next-line`, and needed for the same reason:
     * a multi-line template literal has nowhere on its own first line to put a
     * trailing comment. Only when the pragma line is *nothing but* a comment,
     * so a trailing `// i18n-ignore` cannot silently swallow the next string.
     */
    if (/^\s*(\/\/|\/\*)/.test(row)) ignored.add(index + 2);
  });

  const body = withoutStyles(strip(source));
  const found = new Map<string, Finding>();

  for (const lit of literals(body)) {
    if (ignored.has(lit.line)) continue;
    // A template with nothing but an expression in it (`${a}`) is not copy.
    const stripped = lit.text.replace(/\{\}/g, '').trim();
    if (!isProse(stripped)) continue;
    found.set(`${lit.line}:${lit.text}`, { line: lit.line, text: lit.text.trim() });
  }

  for (const t of jsxText(body)) {
    if (ignored.has(t.line)) continue;
    found.set(`${t.line}:${t.text}`, t);
  }

  return [...found.values()].sort((a, b) => a.line - b.line);
}
