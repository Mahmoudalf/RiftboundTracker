import { conn } from '../connection';
import type { GameRow } from '../schema/games';

import { hydrateGame } from './hydrate';

/**
 * Match history — a match plus both decks' faces, ready to render.
 *
 * The two sides come from different places for the same reason. **Ours** is
 * read from `deck_version_cards` for the version that played the match, not
 * from the deck row: the deck's current Legend is whatever it is *now*, and a
 * history that redrew old matches with the Legend you switched to last week
 * would be quietly rewriting them.
 *
 * **Theirs** comes from the denormalized `opp_*_name` columns, which is what
 * migration 7 exists for.
 *
 * Art is resolved in one batched lookup rather than per row. A history screen
 * scrolls, and four `getCard()` calls per row during render is the shape of
 * problem that only shows up once someone has three hundred matches.
 */

export interface CardFace {
  /** Null when the card is not in the library — the name still renders. */
  id: string | null;
  name: string | null;
  imageUrl: string | null;
  /**
   * Opponent's domains, denormalized onto the match. Present only on their
   * Legend, and the fallback the row draws when there is no art left.
   */
  domains?: string[] | null;
}

export interface GameHistoryEntry {
  game: GameRow;
  ours: { legend: CardFace; champion: CardFace };
  theirs: { legend: CardFace; champion: CardFace };
}

export interface GameHistoryPage {
  entries: GameHistoryEntry[];
  /** Every match that matches the filter, not just the window. */
  total: number;
}

/**
 * The default window.
 *
 * A history is read from the top — the match you are looking for is nearly
 * always recent — so the screen loads a window and extends it on request rather
 * than paying for every row up front. Chosen over true cursor pagination
 * because the data is small and local: at 2,000 matches an unbounded load costs
 * ~14 ms, so the problem is not urgency but unboundedness, and a growable
 * window fixes that without a cursor protocol the rest of the app would have to
 * learn.
 *
 * The count is returned alongside so the screen can say it is showing a window.
 * A history that hides matches without saying so is worse than a slow one.
 */
export const HISTORY_PAGE = 50;

interface RawRow extends Record<string, unknown> {
  our_legend_id: string | null;
  our_legend_name: string | null;
  our_champion_id: string | null;
  our_champion_name: string | null;
}

export function gameHistory(
  options: { deckId?: string; limit?: number } = {}
): GameHistoryPage {
  const where = ['m.deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (options.deckId) {
    where.push('m.deck_id = ?');
    params.push(options.deckId);
  }

  const total =
    conn().getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM games m WHERE ${where.join(' AND ')}`,
      params
    )?.n ?? 0;

  // Defaults to a window rather than everything. `limit: 0` means no cap, for
  // analytics, which needs every row and does not render them.
  const requested = options.limit ?? HISTORY_PAGE;
  let limit = '';
  if (requested > 0) {
    limit = ' LIMIT ?';
    params.push(Math.floor(requested));
  }

  const rows = conn().getAllSync<RawRow>(
    `SELECT m.*,
            (SELECT dvc.card_id   FROM deck_version_cards dvc
              WHERE dvc.deck_version_id = m.deck_version_id AND dvc.zone = 'legend'
              LIMIT 1) AS our_legend_id,
            (SELECT dvc.card_name FROM deck_version_cards dvc
              WHERE dvc.deck_version_id = m.deck_version_id AND dvc.zone = 'legend'
              LIMIT 1) AS our_legend_name,
            (SELECT dvc.card_id   FROM deck_version_cards dvc
              WHERE dvc.deck_version_id = m.deck_version_id AND dvc.zone = 'champion'
              LIMIT 1) AS our_champion_id,
            (SELECT dvc.card_name FROM deck_version_cards dvc
              WHERE dvc.deck_version_id = m.deck_version_id AND dvc.zone = 'champion'
              LIMIT 1) AS our_champion_name
       FROM games m
      WHERE ${where.join(' AND ')}
      ORDER BY m.played_at DESC, m.created_at DESC${limit}`,
    params
  );

  // One lookup for every card id on the page, rather than four per row.
  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of [
      row.our_legend_id,
      row.our_champion_id,
      row.opp_legend_card_id,
      row.opp_champion_card_id,
    ]) {
      if (typeof id === 'string') ids.add(id);
    }
  }

  const art = new Map<string, string | null>();
  if (ids.size > 0) {
    const placeholders = [...ids].map(() => '?').join(',');
    for (const card of conn().getAllSync<{ id: string; image_url: string | null }>(
      `SELECT id, image_url FROM cards WHERE id IN (${placeholders})`,
      [...ids]
    )) {
      art.set(card.id, card.image_url);
    }
  }

  const face = (id: unknown, name: unknown): CardFace => {
    const cardId = typeof id === 'string' ? id : null;
    return {
      id: cardId,
      name: typeof name === 'string' ? name : null,
      imageUrl: cardId ? (art.get(cardId) ?? null) : null,
    };
  };

  const entries = rows.map((row) => {
    const game = hydrateGame(row);
    return {
      game,
      ours: {
        legend: face(row.our_legend_id, row.our_legend_name),
        champion: face(row.our_champion_id, row.our_champion_name),
      },
      theirs: {
        // The opponent's domains ride along so the row has something to show
        // when the art is gone — `opp_legend_name` already survives the mirror,
        // and a domain chip makes the identity visible rather than merely
        // spelled out.
        legend: { ...face(row.opp_legend_card_id, row.opp_legend_name), domains: game.oppDomains },
        champion: face(row.opp_champion_card_id, row.opp_champion_name),
      },
    };
  });

  return { entries, total };
}
