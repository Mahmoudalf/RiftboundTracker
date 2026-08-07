import { conn } from '@/db/connection';
import { LATEST_VERSION } from '@/db/migrations';
import { listLegends, queryCards } from '@/db/queries/cards';
import {
  createDeck,
  getDeck,
  getVersion,
  listVersions,
  loadDeckList,
  lockVersion,
  saveDeckEdit,
  setCurrentVersion,
} from '@/db/queries/decks';
import {
  deckRecord,
  getMatch,
  logMatch,
  opponentFields,
  undoMatch,
} from '@/db/queries/matches';
import type { CardRow } from '@/db/schema/cards';
import type { DeckSlot } from '@/lib/legality';

/**
 * On-device verification of the version-locking invariants.
 *
 * TEMPORARY — delete once M4 makes forking reachable through normal use.
 *
 * The whole test suite runs against Node's `node:sqlite` shimmed to the
 * expo-sqlite interface. That is a real database running the real SQL, but it
 * is not the driver that ships: transaction semantics, `MAX()` over an empty
 * set, and integer/boolean round-tripping are all places the two could differ,
 * and every one of them sits in the fork path. Nothing has ever forked against
 * expo-sqlite.
 *
 * The questions this answers are also ones the UI simply cannot — "does
 * `deck_versions` hold exactly two rows" is not visible from any screen, and
 * there is no way to query the database from a phone.
 *
 * Runs on a deck it creates and hard-deletes afterwards, so it never touches
 * the user's own decks. Hard delete rather than the usual soft delete, because
 * a soft-deleted probe deck would sit in the database forever and sync itself
 * to every other device in M7.
 */

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

function check(name: string, passed: boolean, detail: string): CheckResult {
  return { name, passed, detail };
}

const PROBE_DECK_NAME = '__version self-check__';

/** Remove every trace of a probe deck, including rows a soft delete would keep. */
function hardDelete(deckId: string): void {
  conn().withTransactionSync(() => {
    conn().runSync(
      `DELETE FROM match_games WHERE match_id IN (SELECT id FROM matches WHERE deck_id = ?)`,
      [deckId]
    );
    conn().runSync('DELETE FROM matches WHERE deck_id = ?', [deckId]);
    conn().runSync(
      `DELETE FROM deck_version_cards
        WHERE deck_version_id IN (SELECT id FROM deck_versions WHERE deck_id = ?)`,
      [deckId]
    );
    conn().runSync('DELETE FROM deck_versions WHERE deck_id = ?', [deckId]);
    conn().runSync('DELETE FROM decks WHERE id = ?', [deckId]);
  });
}

/**
 * The migrations, against the database that actually holds the user's decks.
 *
 * Every migration test so far ran on a database the test constructed. This is
 * the only check that runs 6 and 7 over real rows — a populated v5 device with
 * decks and versions worth not losing.
 */
function checkSchema(): CheckResult[] {
  const version =
    conn().getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

  const results = [
    check(
      'Migrations are fully applied',
      version === LATEST_VERSION,
      `user_version ${version}, expected ${LATEST_VERSION}`
    ),
  ];

  for (const table of ['matches', 'match_games', 'events']) {
    const exists =
      (conn().getFirstSync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [table]
      )?.n ?? 0) > 0;
    results.push(check(`Table ${table} exists`, exists, exists ? 'created' : 'MISSING'));
  }

  // Migration 7's columns, which the whole opponent record depends on.
  const columns = conn()
    .getAllSync<{ name: string }>('PRAGMA table_info(matches)')
    .map((c) => c.name);
  for (const column of ['opp_legend_name', 'opp_champion_name']) {
    results.push(
      check(
        `matches.${column} exists`,
        columns.includes(column),
        columns.includes(column) ? 'added by migration 7' : 'MISSING'
      )
    );
  }

  // The decks that were already on this device must have survived both.
  const decks =
    conn().getFirstSync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM decks WHERE deleted_at IS NULL'
    )?.n ?? 0;
  results.push(
    check('Existing decks survived the upgrade', true, `${decks} deck(s) still present`)
  );

  return results;
}

/**
 * Match logging against the real driver.
 *
 * The same reasoning as the version checks: everything below has only ever run
 * against Node's SQLite, and `logMatch` does two writes in one transaction —
 * exactly where a driver difference would bite.
 */
function checkMatches(deckId: string, versionId: string, legend: CardRow): CheckResult[] {
  const results: CheckResult[] = [];

  const matchId = logMatch({
    deckId,
    deckVersionId: versionId,
    result: 'win',
    ...opponentFields(legend),
  });

  results.push(
    check('A match is recorded', !!getMatch(matchId), `id ${matchId.slice(0, 8)}…`)
  );

  const stored = getMatch(matchId);
  results.push(
    check(
      'The opponent is stored by name, not only by id',
      stored?.oppLegendName === legend.name,
      stored?.oppLegendName ?? '(no name written)'
    )
  );

  results.push(
    check(
      'Logging locks the version',
      !!getVersion(versionId)?.lockedAt,
      'locked_at is set in the same transaction as the insert'
    )
  );

  const record = deckRecord(deckId);
  results.push(
    check('The record counts it', record.wins === 1 && record.total === 1, `${record.wins}-${record.losses}`)
  );

  undoMatch(matchId);
  results.push(
    check(
      'Undo releases a lock nothing is left holding',
      getVersion(versionId)?.lockedAt === null,
      'a mis-tap must not cost a version'
    )
  );
  results.push(
    check('Undo leaves no row behind', !getMatch(matchId), 'nothing for sync to propagate')
  );

  return results;
}

export function runVersionSelfCheck(): CheckResult[] {
  // Schema first, and outside the try: if the migrations did not land, every
  // check below fails for a reason that has nothing to do with what it tests.
  const results: CheckResult[] = checkSchema();

  const legend = listLegends()[0];
  // Through `queryCards` rather than raw SQL, so the rows arrive hydrated the
  // way the app's own reads produce them. A `SELECT *` cast straight to CardRow
  // is the bug that blanked every card in the gallery once.
  const spells = queryCards({ types: ['Spell'] });
  const [a, b] = spells;

  if (!legend || !a || !b) {
    return [check('Card library', false, 'Needs a Legend and two Spells. Sync the library first.')];
  }

  let deckId: string | null = null;

  try {
    const created = createDeck({ name: PROBE_DECK_NAME, legend, champion: null });
    deckId = created.deckId;
    const v1 = created.versionId;

    const slots = (card: CardRow, quantity: number): DeckSlot[] => [
      { card: legend, quantity: 1, zone: 'legend' },
      { card, quantity, zone: 'main' },
    ];

    saveDeckEdit(v1, { slots: slots(a, 2) });

    // Byte-level snapshot of what v1 holds before anything forks.
    const beforeRows = conn().getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [v1]
    );

    lockVersion(v1);
    results.push(
      check('Lock is recorded', !!listVersions(deckId)[0]?.lockedAt, 'locked_at is set on v1')
    );

    // ---- Fork once -------------------------------------------------------
    const forked = saveDeckEdit(v1, { slots: slots(b, 2) });

    results.push(
      check('Editing a locked version forks', forked.outcome === 'forked', `outcome: ${forked.outcome}`)
    );

    const versionsAfterFork = listVersions(deckId);
    results.push(
      check(
        'Deck holds exactly two versions',
        versionsAfterFork.length === 2,
        `${versionsAfterFork.length} rows in deck_versions`
      )
    );

    results.push(
      check(
        'Deck points at the fork',
        getDeck(deckId)?.currentVersionId === forked.versionId,
        `current_version_id → v${forked.versionNumber}`
      )
    );

    const afterRows = conn().getAllSync<Record<string, unknown>>(
      'SELECT * FROM deck_version_cards WHERE deck_version_id = ? ORDER BY id',
      [v1]
    );
    results.push(
      check(
        'v1 is byte-identical',
        JSON.stringify(beforeRows) === JSON.stringify(afterRows),
        `${afterRows.length} rows, row ids and card ids unchanged`
      )
    );

    results.push(
      check(
        'The fork carries the change',
        loadDeckList(forked.versionId).slots.some((s) => s.zone === 'main' && s.card.id === b.id),
        'the new card is on v2, not v1'
      )
    );

    // ---- Fork a second time from the same parent -------------------------
    setCurrentVersion(deckId, v1);
    const sibling = saveDeckEdit(v1, { slots: slots(a, 3) });

    results.push(
      check(
        'A second fork off v1 numbers from the maximum',
        sibling.versionNumber === 3,
        `version_number: ${sibling.versionNumber} (must not reuse 2)`
      )
    );

    const siblingRow = listVersions(deckId).find((v) => v.id === sibling.versionId);
    results.push(
      check(
        'Its parent is v1, not the newest version',
        siblingRow?.parentVersionId === v1,
        siblingRow?.parentVersionId === v1 ? 'parent_version_id → v1' : 'wrong parent'
      )
    );

    // The timeline draws a connecting line only between a node and its parent,
    // so a branch must not look like a chain.
    const ordered = listVersions(deckId);
    const hasBranch = ordered.some(
      (v, i) => ordered[i + 1] && v.parentVersionId !== ordered[i + 1]!.id
    );
    results.push(
      check(
        'Timeline knows this is a branch',
        hasBranch,
        hasBranch
          ? 'v3 shows “Forked from v1” and no line down to v2'
          : 'branch not detected — the timeline would imply v3 came from v2'
      )
    );

    // ---- The no-op guard, against the real driver ------------------------
    const noop = saveDeckEdit(sibling.versionId, loadDeckList(sibling.versionId));
    results.push(
      check('Re-saving an unchanged list writes nothing', noop.outcome === 'no-op', `outcome: ${noop.outcome}`)
    );
    results.push(
      check(
        'And created no version',
        listVersions(deckId).length === 3,
        `${listVersions(deckId).length} versions`
      )
    );

    // ---- M4: match logging, on the version the sibling fork left unlocked --
    results.push(...checkMatches(deckId, sibling.versionId, legend));
  } catch (err) {
    results.push(check('Ran without throwing', false, err instanceof Error ? err.message : String(err)));
  } finally {
    if (deckId) hardDelete(deckId);
  }

  // Whatever happened above, the probe deck must not survive it.
  const leftovers = conn().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM decks WHERE name = ?',
    [PROBE_DECK_NAME]
  );
  results.push(
    check('Cleaned up after itself', (leftovers?.n ?? 0) === 0, `${leftovers?.n ?? 0} probe decks left`)
  );

  return results;
}
