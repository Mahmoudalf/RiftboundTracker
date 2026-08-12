import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { CardRow } from '../schema/cards';
import type { GameStyle, Result, GameRow } from '../schema/games';

import { hydrateGame } from './hydrate';

/**
 * Game reads and writes — one encounter between two players, Bo1 or Bo3.
 *
 * The individual matches inside a game live in `queries/matches.ts`.
 *
 * The write path is deliberately tiny. Logging has to take under ten seconds
 * from tab bar to confirmation or players stop doing it, and everything that
 * makes a game *interesting* — opponent, on the play, mulligans — is optional
 * at the schema level so the fast path stays two taps.
 *
 * `logGame()` is also what finally makes the M3 version model do anything: it
 * is the only caller of `lockVersion()`, and until it existed no version in the
 * app could ever become immutable.
 */

export interface LogGameInput {
  deckId: string;
  deckVersionId: string;
  result: Result;
  /** Defaults to now. Set explicitly when back-filling a tournament. */
  playedAt?: string;
  onPlay?: boolean | null;
  /** Format: 1, 3 or 5 matches. Null when not recorded. */
  bestOf?: number | null;
  matchesWon?: number | null;
  matchesLost?: number | null;
  oppLegendCardId?: string | null;
  oppChampionCardId?: string | null;
  /** Always write these alongside the ids — see `opponentFields()`. */
  oppLegendName?: string | null;
  oppChampionName?: string | null;
  battlefieldCardId?: string | null;
  battlefieldName?: string | null;
  oppBattlefieldCardId?: string | null;
  oppBattlefieldName?: string | null;
  oppDomains?: string[] | null;
  oppLabel?: string | null;
  eventId?: string | null;
  gameStyle?: GameStyle;
  mulligans?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;
  tags?: string[] | null;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Everything worth recording about an opponent Legend, from its card.
 *
 * Exists so a caller cannot store an id without its name. The id alone is a
 * pointer into the card mirror, and the mirror is disposable by design — a
 * printing that leaves it takes the opponent's identity with it, silently, from
 * a record that is supposed to be permanent. Spread this into `logGame` rather
 * than setting `oppLegendCardId` by hand.
 *
 * Domains come along because they are the fallback the UI renders when the card
 * is gone: a game against an unknown Fury/Chaos deck still says something.
 */
export function opponentFields(
  legend: Pick<CardRow, 'id' | 'name' | 'domains'> | null
): Pick<LogGameInput, 'oppLegendCardId' | 'oppLegendName' | 'oppDomains'> {
  if (!legend) return { oppLegendCardId: null, oppLegendName: null, oppDomains: null };
  return {
    oppLegendCardId: legend.id,
    oppLegendName: legend.name,
    oppDomains: legend.domains.length > 0 ? legend.domains : null,
  };
}

/** The opponent's Chosen Champion, id and name together for the same reason. */
export function opponentChampionFields(
  champion: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogGameInput, 'oppChampionCardId' | 'oppChampionName'> {
  if (!champion) return { oppChampionCardId: null, oppChampionName: null };
  return { oppChampionCardId: champion.id, oppChampionName: champion.name };
}

/** Your Battlefield, id and name together. */
export function battlefieldFields(
  battlefield: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogGameInput, 'battlefieldCardId' | 'battlefieldName'> {
  if (!battlefield) return { battlefieldCardId: null, battlefieldName: null };
  return { battlefieldCardId: battlefield.id, battlefieldName: battlefield.name };
}

/** Theirs. */
export function opponentBattlefieldFields(
  battlefield: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogGameInput, 'oppBattlefieldCardId' | 'oppBattlefieldName'> {
  if (!battlefield) return { oppBattlefieldCardId: null, oppBattlefieldName: null };
  return {
    oppBattlefieldCardId: battlefield.id,
    oppBattlefieldName: battlefield.name,
  };
}

/**
 * Record a game and lock the version it was played with.
 *
 * Both in one transaction, because a game that exists against an unlocked
 * version is the exact state the version model forbids: the next edit would
 * rewrite the list this result was played with, in place, and the result would
 * silently start describing cards that were never in the deck.
 */
export function logGame(input: LogGameInput): string {
  const id = newId();
  const timestamp = now();

  conn().withTransactionSync(() => {
    conn().runSync(
      `INSERT INTO games
         (id, deck_id, deck_version_id, played_at, result,
          best_of, matches_won, matches_lost, on_play,
          opp_legend_card_id, opp_champion_card_id,
          opp_legend_name, opp_champion_name, opp_domains, opp_label,
          battlefield_card_id, battlefield_name,
          opp_battlefield_card_id, opp_battlefield_name,
          event_id, game_style, mulligans, duration_seconds, notes, tags,
          created_at, updated_at, dirty)
       VALUES (?,?,?,?,?, ?,?,?,?, ?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?,?,?, ?,?,1)`,
      [
        id,
        input.deckId,
        input.deckVersionId,
        input.playedAt ?? timestamp,
        input.result,
        input.bestOf ?? null,
        input.matchesWon ?? null,
        input.matchesLost ?? null,
        input.onPlay === null || input.onPlay === undefined ? null : input.onPlay ? 1 : 0,
        input.oppLegendCardId ?? null,
        input.oppChampionCardId ?? null,
        input.oppLegendName ?? null,
        input.oppChampionName ?? null,
        input.oppDomains ? JSON.stringify(input.oppDomains) : null,
        input.oppLabel ?? null,
        input.battlefieldCardId ?? null,
        input.battlefieldName ?? null,
        input.oppBattlefieldCardId ?? null,
        input.oppBattlefieldName ?? null,
        input.eventId ?? null,
        input.gameStyle ?? 'casual',
        input.mulligans ?? null,
        input.durationSeconds ?? null,
        input.notes ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        timestamp,
        timestamp,
      ]
    );

    lockVersionRow(input.deckVersionId, timestamp);

    // The deck sorts by recency in the list, and having just played it is the
    // strongest signal that it is the deck you care about.
    conn().runSync('UPDATE decks SET updated_at = ?, dirty = 1 WHERE id = ?', [
      timestamp,
      input.deckId,
    ]);
  });

  return id;
}

/**
 * Set `locked_at` if it is not already set.
 *
 * Inlined here rather than calling `decks.ts` so the lock lands inside the same
 * transaction as the insert. Never unset: the lock records that real results
 * exist for this exact list, which does not stop being true if the games are
 * later deleted — an unlocked version would let the list be rewritten under a
 * game that had merely been undone rather than never played.
 */
function lockVersionRow(versionId: string, timestamp: string): void {
  conn().runSync(
    `UPDATE deck_versions SET locked_at = ?, updated_at = ?, dirty = 1
      WHERE id = ? AND locked_at IS NULL`,
    [timestamp, timestamp, versionId]
  );
}

export function getGame(id: string): GameRow | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM games WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return row ? hydrateGame(row) : null;
}

/** Newest first — the order every game list and the undo toast read in. */
export function listGames(
  options: { deckId?: string; eventId?: string; limit?: number } = {}
): GameRow[] {
  const where = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (options.deckId) {
    where.push('deck_id = ?');
    params.push(options.deckId);
  }
  if (options.eventId) {
    where.push('event_id = ?');
    params.push(options.eventId);
  }
  // Parameterised rather than interpolated. The floored number was never
  // injectable, but two conventions for the same thing means every future
  // reader has to re-derive which one is safe.
  let limit = '';
  if (options.limit !== undefined) {
    limit = ' LIMIT ?';
    params.push(Math.floor(options.limit));
  }

  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT * FROM games WHERE ${where.join(' AND ')}
        ORDER BY played_at DESC, created_at DESC${limit}`,
      params
    )
    .map(hydrateGame);
}

export interface DeckRecord {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

/**
 * A deck's record, optionally for one version.
 *
 * Counted in **games**, not matches — a Bo3 won 2–1 is one win, the same way a
 * player would describe it. Counted in SQL rather than by loading rows: this
 * runs on the deck list, on every timeline node, and inside the undo toast.
 */
export function deckRecord(deckId: string, versionId?: string): DeckRecord {
  const row = conn().getFirstSync<{
    wins: number;
    losses: number;
    draws: number;
    total: number;
  }>(
    `SELECT
       SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
       SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws,
       COUNT(*) AS total
     FROM games
    WHERE deck_id = ? AND deleted_at IS NULL
      ${versionId ? 'AND deck_version_id = ?' : ''}`,
    versionId ? [deckId, versionId] : [deckId]
  );

  return {
    wins: Number(row?.wins ?? 0),
    losses: Number(row?.losses ?? 0),
    draws: Number(row?.draws ?? 0),
    total: Number(row?.total ?? 0),
  };
}

/*
 * `recentOpponents()` lived here — the Legends most recently faced, for the
 * quick-select rail above the Legend field.
 *
 * Deleted with the rail, which the Hi-Fi handoff's third change removed from
 * the log form. It was correct and tested, and that is exactly why it had to go
 * rather than linger: an exported query with no consumer is what gap 15 named,
 * and a passing test cannot tell "works" from "works and is reachable". It is
 * in the history if the shortcut is ever wanted back.
 */

export function updateGame(id: string, patch: Partial<LogGameInput>): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  const put = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.result !== undefined) put('result', patch.result);
  if (patch.playedAt !== undefined) put('played_at', patch.playedAt);
  if (patch.onPlay !== undefined) {
    put('on_play', patch.onPlay === null ? null : patch.onPlay ? 1 : 0);
  }
  if (patch.bestOf !== undefined) put('best_of', patch.bestOf ?? null);
  if (patch.matchesWon !== undefined) put('matches_won', patch.matchesWon ?? null);
  if (patch.matchesLost !== undefined) put('matches_lost', patch.matchesLost ?? null);
  if (patch.oppLegendCardId !== undefined) {
    put('opp_legend_card_id', patch.oppLegendCardId ?? null);
  }
  if (patch.oppChampionCardId !== undefined) {
    put('opp_champion_card_id', patch.oppChampionCardId ?? null);
  }
  if (patch.oppLegendName !== undefined) put('opp_legend_name', patch.oppLegendName ?? null);
  if (patch.oppChampionName !== undefined) {
    put('opp_champion_name', patch.oppChampionName ?? null);
  }
  if (patch.oppDomains !== undefined) {
    put('opp_domains', patch.oppDomains ? JSON.stringify(patch.oppDomains) : null);
  }
  if (patch.oppLabel !== undefined) put('opp_label', patch.oppLabel ?? null);
  if (patch.eventId !== undefined) put('event_id', patch.eventId ?? null);
  if (patch.gameStyle !== undefined) put('game_style', patch.gameStyle);
  if (patch.mulligans !== undefined) put('mulligans', patch.mulligans ?? null);
  if (patch.durationSeconds !== undefined) {
    put('duration_seconds', patch.durationSeconds ?? null);
  }
  if (patch.notes !== undefined) put('notes', patch.notes ?? null);
  if (patch.tags !== undefined) put('tags', patch.tags ? JSON.stringify(patch.tags) : null);

  if (sets.length === 0) return;

  put('updated_at', now());
  sets.push('dirty = 1');
  params.push(id);

  conn().runSync(`UPDATE games SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * Soft delete, so sync propagates the deletion.
 *
 * The version stays locked. A game that was logged and then removed is still
 * evidence that this list was played, and unlocking would let a later edit
 * rewrite a list under the remaining results.
 */
export function deleteGame(id: string): void {
  const timestamp = now();
  conn().runSync(
    'UPDATE games SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [timestamp, timestamp, id]
  );
}

/**
 * Undo a just-logged game.
 *
 * A hard delete, unlike `deleteGame`. The undo toast is part of the same
 * gesture as the tap that created the row — the user is correcting a mis-tap,
 * not recording that a game happened and was removed, and a soft-deleted
 * tombstone would sync a phantom to every other device.
 *
 * **Releases the lock when nothing is left.** An earlier revision kept the
 * version locked unconditionally, which meant one mis-tapped result locked a
 * version permanently: the next edit forked a version the user never earned,
 * with no way back. The lock exists to protect results, so when the version has
 * no game rows at all — not even tombstones — it is protecting nothing.
 *
 * The tombstone check is what makes this safe. A game that was really played
 * and then deleted leaves a soft-deleted row behind, so the version stays
 * locked and its list stays immutable; only a version that was never
 * successfully played can be unlocked.
 */
export function undoGame(id: string): void {
  conn().withTransactionSync(() => {
    const game = conn().getFirstSync<{ deck_version_id: string }>(
      'SELECT deck_version_id FROM games WHERE id = ?',
      [id]
    );

    conn().runSync('DELETE FROM matches WHERE game_id = ?', [id]);
    conn().runSync('DELETE FROM games WHERE id = ?', [id]);

    if (!game) return;

    const remaining =
      conn().getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM games WHERE deck_version_id = ?',
        [game.deck_version_id]
      )?.n ?? 0;

    if (remaining === 0) {
      conn().runSync(
        'UPDATE deck_versions SET locked_at = NULL, updated_at = ?, dirty = 1 WHERE id = ?',
        [now(), game.deck_version_id]
      );
    }
  });
}
