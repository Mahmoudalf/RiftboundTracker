import type { MatchRow, GameRow } from '@/db/schema/games';
import { t } from '@/i18n';

import { cardHandStats, scoreStats } from './hands';
import {
  matchupKey,
  matchupSegments,
  playDrawSplit,
  rateOf,
  separable,
  type Rate,
} from './summary';
import { gamesNeeded } from './wilson';

/**
 * The findings layer — what the analytics screen should actually say.
 *
 * The screen it replaces had eight sections, every one permanently present and
 * all of them at the same visual weight, so the reader had to do the ranking
 * the app should have done. This module does that ranking, and it does it by
 * refusing to speak rather than by hedging: a finding exists only when the data
 * separates, and otherwise there is no finding at all.
 *
 * ## The bar every finding has to clear
 *
 * Comparisons must be **separable** — the two Wilson intervals must not overlap
 * (`summary.separable`). That is deliberately stricter than a significance
 * test, and erring towards "we cannot tell" is the right direction for a tool
 * people use to decide what to play. Descriptive findings, which compare
 * nothing, instead need a floor on their sample.
 *
 * Nothing here computes a *new* statistic. Every number comes from `summary.ts`
 * or `hands.ts` unchanged — this decides which of them is worth a sentence.
 *
 * ## Why the ranking is by kind and not by effect size
 *
 * The obvious ordering is "biggest gap first", and it is wrong: a 22-point
 * version gap and a 30-point excess mulligan rate are not the same quantity in
 * different clothes, and sorting them against each other silently claims they
 * are comparable. Since separability is already required, everything that
 * reaches the screen is real — so the ordering question is only *which real
 * thing to read first*, and that is answered by how directly it changes a
 * decision:
 *
 *   version → what your last change did
 *   matchup → what to bring, and what to tech against
 *   card    → which card to cut, the only one that edits the decklist
 *   margin  → whether losses are structural or close
 *   order   → turn order, which you do not choose
 *
 * `strength` is still reported, and it picks the winner *within* a kind where
 * the units genuinely do match. It is not used across kinds.
 *
 * ## One finding per kind
 *
 * Three findings about three different things beat three about matchups. Only
 * the strongest of each kind survives, so a deck with six lopsided matchups
 * cannot crowd out the fact that its newest version is losing.
 */

/*
 * These three are deliberately **not** exported.
 *
 * Only `CARD_SEEN_FLOOR` has a consumer outside this file, and an export with
 * no consumer is what gap 15 named — a constant that looks like a shared
 * setting, is read by nothing, and quietly invites a second definition. The
 * tests assert the literal values instead, so changing one is a visible
 * decision rather than a silent re-tune.
 */

/** Findings shown at once. Past three, the screen is a list again. */
const MAX_FINDINGS = 3;

/** Games in a matchup before it may be a finding. */
const MATCHUP_FLOOR = 5;

/** Opening hands a card must appear in before its mulligan rate may speak. */
export const CARD_SEEN_FLOOR = 5;

/**
 * A card has to go back **more often than not** to be worth naming.
 *
 * Not a statistical threshold — a rhetorical one. "You throw this back 40 % of
 * the time" is a fact without an implication; past half, the sentence carries
 * its own advice.
 */
const MULLIGAN_FLOOR = 0.5;

export type FindingKind = 'version' | 'matchup' | 'card' | 'margin' | 'order';

/** Read first is lowest. See the note on ranking above. */
const PRIORITY: Record<FindingKind, number> = {
  version: 0,
  matchup: 1,
  card: 2,
  margin: 3,
  order: 4,
};

/**
 * Where a finding leads, as *what to open* rather than as a URL.
 *
 * A `string` href would have to be cast at the call site to satisfy typed
 * routes, and a cast is a promise the compiler stops checking — the day a route
 * is renamed, a cast keeps compiling and the tap dead-ends. Naming the
 * destination lets the screen build the real template literal, which typed
 * routes verify.
 */
export type FindingLink = { to: 'deck'; id: string } | { to: 'card'; id: string };

export interface Finding {
  kind: FindingKind;
  key: string;
  /**
   * The size of the effect, 0–1. Compares like with like **inside** a kind
   * only — see the note above on why it does not order across kinds.
   */
  strength: number;
  /** The claim. One sentence, no hedging — the bar it cleared is the hedge. */
  headline: string;
  /** The numbers behind the claim, so it can be checked rather than believed. */
  evidence: string;
  /** Where to go for the detail. Null when there is nowhere useful yet. */
  link: FindingLink | null;
}

/** A deck version, newest first, as the findings layer needs it. */
export interface VersionRef {
  id: string;
  number: number;
  label: string | null;
}

export interface FindingContext {
  /**
   * The deck's versions, newest first. Empty when the screen is showing more
   * than one deck — version numbers are per deck, so pooling them across decks
   * would compare v3 of one with v3 of another.
   */
  versions?: readonly VersionRef[];
  /** Null for a card whose printing has left the library. */
  cardName?: (cardId: string) => string | null;
  /** Deck id, for linking a version finding at its timeline. */
  deckId?: string | null;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

const record = (rate: Rate) =>
  `${rate.wins}–${rate.losses}` + (rate.draws > 0 ? `–${rate.draws}` : '');

const versionName = (version: VersionRef) => version.label ?? `v${version.number}`;

/**
 * Did the last change work?
 *
 * Compares the two most recent versions that have each been **played**, not the
 * two most recent versions. A version forked and never taken to a table has no
 * record, and skipping it is what makes the comparison mean "your last change"
 * rather than "your last save".
 */
function versionFinding(
  games: readonly GameRow[],
  context: FindingContext
): Finding | null {
  const versions = context.versions ?? [];
  if (versions.length < 2) return null;

  const played: { version: VersionRef; rate: Rate }[] = [];
  for (const version of versions) {
    const rows = games.filter((game) => game.deckVersionId === version.id);
    const rate = rateOf(rows);
    if (rate.total > 0) played.push({ version, rate });
    if (played.length === 2) break;
  }

  const [current, previous] = played;
  if (!current || !previous) return null;
  if (!separable(current.rate, previous.rate)) return null;

  const currentRate = current.rate.rate ?? 0;
  const previousRate = previous.rate.rate ?? 0;
  const better = currentRate > previousRate;
  const currentLabel = versionName(current.version);
  const previousLabel = versionName(previous.version);

  return {
    kind: 'version',
    key: `version:${current.version.id}`,
    strength: Math.abs(currentRate - previousRate),
    headline: t(better ? 'finding.version.ahead' : 'finding.version.behind', {
      current: currentLabel,
      previous: previousLabel,
    }),
    evidence: t('finding.version.evidence', {
      current: currentLabel,
      currentRate: pct(currentRate),
      currentGames: current.rate.total,
      previous: previousLabel,
      previousRate: pct(previousRate),
      previousGames: previous.rate.total,
    }),
    link: context.deckId ? { to: 'deck', id: context.deckId } : null,
  };
}

/**
 * A matchup that is measurably unlike the rest of your games.
 *
 * Tested against **the games that are not this matchup**, not against 50 % and
 * not against the deck's overall rate.
 *
 * - Against 50 % would report the deck's general strength once per opponent: a
 *   deck that wins 70 % of everything has no bad matchup at 55 %, it has a
 *   slightly worse one.
 * - Against the overall rate is the subtler error, and the one this first got
 *   wrong. The overall rate *contains* the matchup's own games, so a lopsided
 *   matchup drags the baseline towards itself and is then compared against a
 *   figure it helped produce — the worse the matchup, the more it hides itself.
 *   The complement is the only comparison where the two samples are disjoint.
 */
function matchupFinding(games: readonly GameRow[]): Finding | null {
  const candidates: { finding: Finding; worse: boolean }[] = [];

  for (const segment of matchupSegments(games)) {
    /*
     * The floor governs being the *subject* of a claim, not being counted.
     *
     * A matchup too thin to describe is still part of everyone else's
     * complement, which is right: those games happened, and dropping them from
     * the baseline would make every other matchup look different from a deck
     * you never played.
     */
    if (segment.rate.total < MATCHUP_FLOOR) continue;

    const rest = rateOf(games.filter((game) => matchupKey(game) !== segment.key));
    if (rest.total === 0) continue;
    if (!separable(segment.rate, rest)) continue;

    const rate = segment.rate.rate ?? 0;
    const worse = rate < (rest.rate ?? 0);
    const opponent = segment.sublabel
      ? `${segment.label} · ${segment.sublabel}`
      : segment.label;

    candidates.push({
      worse,
      finding: {
        kind: 'matchup',
        key: `matchup:${segment.key}`,
        strength: Math.abs(rate - (rest.rate ?? 0)),
        headline: t(worse ? 'finding.matchup.worse' : 'finding.matchup.better', {
          opponent: segment.label,
        }),
        evidence: t('finding.matchup.evidence', {
          opponent,
          record: record(segment.rate),
          rate: pct(rate),
          restRate: pct(rest.rate ?? 0),
        }),
        link: null,
      },
    });
  }

  /*
   * Ties break towards the matchup you are losing, and the tie is not a corner
   * case: with exactly two opponents each is the other's complement, so the two
   * findings are the same fact stated from either end with identical strength.
   * Left to sort order the screen would say "you beat Zed" or "Vi beats you"
   * depending on which had more games, which is not a judgement anyone made.
   *
   * A matchup you lose is the actionable half — you can tech against it. One
   * you already win tells you nothing to change.
   */
  return (
    candidates.sort(
      (a, b) =>
        b.finding.strength - a.finding.strength ||
        Number(b.worse) - Number(a.worse) ||
        a.finding.key.localeCompare(b.finding.key)
    )[0]?.finding ?? null
  );
}

/**
 * The card you keep sending back.
 *
 * The only finding here that edits a decklist, which is why it outranks
 * everything below it. `cardHandStats` already drops cards seen fewer than
 * three times; this raises that to `CARD_SEEN_FLOOR` because a *finding* is a
 * stronger claim than a row in a table.
 */
function cardFinding(matches: readonly MatchRow[], context: FindingContext): Finding | null {
  const stats = cardHandStats(matches, CARD_SEEN_FLOOR);
  const worst = stats[0];
  if (!worst || worst.mulliganRate <= MULLIGAN_FLOOR) return null;

  const name = context.cardName?.(worst.cardId) ?? null;
  if (!name) return null;

  return {
    kind: 'card',
    key: `card:${worst.cardId}`,
    strength: (worst.mulliganRate - MULLIGAN_FLOOR) * 2,
    headline: t('finding.card.headline', { card: name }),
    evidence: t('finding.card.evidence', {
      mulliganed: worst.mulliganed,
      seen: worst.seen,
    }),
    link: { to: 'card', id: worst.cardId },
  };
}

/** Whether the close matches and the clear ones go differently. */
function marginFinding(matches: readonly MatchRow[]): Finding | null {
  const scores = scoreStats(matches);
  const close = scores.segments.find((segment) => segment.key === 'close');
  const clear = scores.segments.find((segment) => segment.key === 'clear');
  if (!close || !clear) return null;
  if (!separable(close.rate, clear.rate)) return null;

  const closeRate = close.rate.rate ?? 0;
  const clearRate = clear.rate.rate ?? 0;

  return {
    kind: 'margin',
    key: 'margin',
    strength: Math.abs(closeRate - clearRate),
    headline: t(
      closeRate > clearRate ? 'finding.margin.winClose' : 'finding.margin.winClear'
    ),
    evidence: t('finding.margin.evidence', {
      close: record(close.rate),
      clear: record(clear.rate),
      recorded: scores.coverage.recorded,
      total: scores.coverage.total,
    }),
    link: null,
  };
}

/** Turn order, last because it is the one thing on this list you do not pick. */
function orderFinding(games: readonly GameRow[]): Finding | null {
  const split = playDrawSplit(games);
  if (split.coverage.recorded === 0) return null;
  if (!separable(split.onPlay, split.onDraw)) return null;

  const playRate = split.onPlay.rate ?? 0;
  const drawRate = split.onDraw.rate ?? 0;
  const first = playRate > drawRate;

  return {
    kind: 'order',
    key: 'order',
    strength: Math.abs(playRate - drawRate),
    headline: t(first ? 'finding.order.first' : 'finding.order.second'),
    evidence: t('finding.order.evidence', {
      onPlay: record(split.onPlay),
      onDraw: record(split.onDraw),
      recorded: split.coverage.recorded,
      total: split.coverage.total,
    }),
    link: null,
  };
}

/**
 * Everything the data supports, strongest kind first, capped at `MAX_FINDINGS`.
 *
 * Returns an empty array rather than a placeholder finding. A screen that says
 * nothing is honest; one that manufactures a sentence from four games is the
 * failure mode this whole layer exists to prevent.
 */
export function findings(
  games: readonly GameRow[],
  matches: readonly MatchRow[],
  context: FindingContext = {}
): Finding[] {
  const candidates = [
    versionFinding(games, context),
    matchupFinding(games),
    cardFinding(matches, context),
    marginFinding(matches),
    orderFinding(games),
  ].filter((finding): finding is Finding => finding !== null);

  return candidates
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
    .slice(0, MAX_FINDINGS);
}

/**
 * The one line to show when nothing separates yet.
 *
 * "Not enough data" is a dead end; this turns it into a target wherever the
 * arithmetic supports one. Null when there is nothing to say — an empty deck
 * has its own empty state, and repeating it here would be noise.
 */
export function nextStep(games: readonly GameRow[]): string | null {
  const overall = rateOf(games);
  if (overall.total === 0) return null;

  /*
   * There is no "none decided" branch any more.
   *
   * Under the half-point rule a game of nothing but draws has a real rate —
   * exactly 50 % — so every non-empty history produces a number, and the only
   * case left with nothing to say is the empty one handled above.
   */
  const more = gamesNeeded(overall.points, overall.total);

  /*
   * `gamesNeeded` returns null when the honest answer runs past its cap, which
   * near 50 % is hundreds of games. Printing that number is not advice, so the
   * sentence stops at the finding — the same call the play/draw verdict made.
   */
  if (more === null) return t('finding.nextStep.uncapped');

  return t('finding.nextStep', {
    more,
    /*
     * The noun is its own key rather than an inline ternary.
     *
     * German and French both inflect it, and a plural chosen by English grammar
     * would be wrong in either even with the two words translated — the
     * *decision* about which form to use has to be translatable too.
     */
    games: more === 1 ? t('finding.game') : t('finding.games'),
  });
}
