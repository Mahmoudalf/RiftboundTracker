import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Schema migrations, applied by `PRAGMA user_version`.
 *
 * Raw SQL rather than drizzle-kit codegen because the card search depends on an
 * FTS5 virtual table and its sync triggers, neither of which Drizzle's schema
 * DSL can express. Drizzle still owns the typed query layer — this file only
 * owns DDL.
 *
 * Rules: migrations are append-only, and each one is idempotent so a partially
 * applied migration can be re-run safely.
 */

export type Migration = { readonly version: number; readonly up: string };

/**
 * Exported so `migrations.test.ts` can build a database at an *older* version,
 * populate it, and migrate it forward. Testing only against a fresh database
 * proves almost nothing — by the time v3 ships, real devices hold a populated
 * v2 with decks worth not losing.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: /* sql */ `
      CREATE TABLE IF NOT EXISTS cards (
        id                 TEXT PRIMARY KEY NOT NULL,
        riftbound_id       TEXT NOT NULL,
        tcgplayer_id       TEXT,
        name               TEXT NOT NULL,
        clean_name         TEXT NOT NULL,
        collector_number   INTEGER,
        energy             INTEGER,
        might              INTEGER,
        power              INTEGER,
        type               TEXT NOT NULL,
        supertype          TEXT,
        rarity             TEXT NOT NULL,
        domains            TEXT NOT NULL,
        domain_key         TEXT NOT NULL,
        text_plain         TEXT,
        text_rich          TEXT,
        flavour            TEXT,
        tags               TEXT NOT NULL,
        set_id             TEXT NOT NULL,
        set_label          TEXT NOT NULL,
        image_url          TEXT,
        artist             TEXT,
        accessibility_text TEXT,
        orientation        TEXT NOT NULL DEFAULT 'portrait',
        alternate_art      INTEGER NOT NULL DEFAULT 0,
        signature          INTEGER NOT NULL DEFAULT 0,
        overnumbered       INTEGER NOT NULL DEFAULT 0,
        is_new             INTEGER NOT NULL DEFAULT 0,
        updated_on         TEXT
      );

      CREATE INDEX IF NOT EXISTS cards_type_idx         ON cards(type);
      CREATE INDEX IF NOT EXISTS cards_domain_key_idx   ON cards(domain_key);
      CREATE INDEX IF NOT EXISTS cards_set_idx          ON cards(set_id);
      CREATE INDEX IF NOT EXISTS cards_rarity_idx       ON cards(rarity);
      CREATE INDEX IF NOT EXISTS cards_energy_idx       ON cards(energy);
      CREATE INDEX IF NOT EXISTS cards_clean_name_idx   ON cards(clean_name);
      CREATE INDEX IF NOT EXISTS cards_type_domain_idx  ON cards(type, domain_key);

      CREATE TABLE IF NOT EXISTS sets (
        id             TEXT PRIMARY KEY NOT NULL,
        name           TEXT NOT NULL,
        set_id         TEXT NOT NULL,
        card_count     INTEGER NOT NULL,
        tcgplayer_id   TEXT,
        cardmarket_ids TEXT NOT NULL,
        published_on   TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_meta (
        id             INTEGER PRIMARY KEY NOT NULL,
        last_synced_at TEXT,
        api_version    TEXT,
        card_count     INTEGER NOT NULL DEFAULT 0,
        seed_version   TEXT,
        last_error     TEXT
      );

      INSERT OR IGNORE INTO sync_meta (id, card_count) VALUES (1, 0);
    `,
  },
  {
    version: 2,
    up: /* sql */ `
      -- External-content FTS: the index stores no copy of the text, it points
      -- back into the cards table by rowid. Keeps the database small, and the
      -- triggers below mean it cannot drift out of sync.
      CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
        name,
        text_plain,
        tags,
        artist,
        content='cards',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, name, text_plain, tags, artist)
        VALUES (new.rowid, new.name, new.text_plain, new.tags, new.artist);
      END;

      CREATE TRIGGER IF NOT EXISTS cards_fts_ad AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, name, text_plain, tags, artist)
        VALUES ('delete', old.rowid, old.name, old.text_plain, old.tags, old.artist);
      END;

      CREATE TRIGGER IF NOT EXISTS cards_fts_au AFTER UPDATE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, name, text_plain, tags, artist)
        VALUES ('delete', old.rowid, old.name, old.text_plain, old.tags, old.artist);
        INSERT INTO cards_fts(rowid, name, text_plain, tags, artist)
        VALUES (new.rowid, new.name, new.text_plain, new.tags, new.artist);
      END;

      -- Index any rows that already existed. The triggers above only fire on
      -- writes made after they exist, so without this an upgrading device with
      -- a full card mirror gets an empty index — and because sync skips when
      -- the mirror is already complete, nothing would ever rebuild it. Search
      -- would return nothing, silently, forever.
      INSERT INTO cards_fts(cards_fts) VALUES ('rebuild');
    `,
  },
  {
    version: 3,
    up: /* sql */ `
      CREATE TABLE IF NOT EXISTS decks (
        id                 TEXT PRIMARY KEY NOT NULL,
        name               TEXT NOT NULL,
        legend_card_id     TEXT,
        champion_card_id   TEXT,
        domains            TEXT NOT NULL,
        format             TEXT NOT NULL DEFAULT 'constructed',
        notes              TEXT,
        current_version_id TEXT,
        archived_at        TEXT,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        deleted_at         TEXT,
        user_id            TEXT,
        dirty              INTEGER NOT NULL DEFAULT 1,
        updated_by_device  TEXT
      );

      CREATE INDEX IF NOT EXISTS decks_archived_idx ON decks(archived_at);
      CREATE INDEX IF NOT EXISTS decks_deleted_idx  ON decks(deleted_at);

      CREATE TABLE IF NOT EXISTS deck_versions (
        id                 TEXT PRIMARY KEY NOT NULL,
        deck_id            TEXT NOT NULL,
        version_number     INTEGER NOT NULL,
        label              TEXT,
        notes              TEXT,
        parent_version_id  TEXT,
        locked_at          TEXT,
        main_count         INTEGER NOT NULL DEFAULT 0,
        rune_count         INTEGER NOT NULL DEFAULT 0,
        battlefield_count  INTEGER NOT NULL DEFAULT 0,
        is_legal           INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        deleted_at         TEXT,
        user_id            TEXT,
        dirty              INTEGER NOT NULL DEFAULT 1,
        updated_by_device  TEXT,
        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS deck_versions_deck_idx ON deck_versions(deck_id);
      CREATE UNIQUE INDEX IF NOT EXISTS deck_versions_number_idx
        ON deck_versions(deck_id, version_number);

      CREATE TABLE IF NOT EXISTS deck_version_cards (
        id              TEXT PRIMARY KEY NOT NULL,
        deck_version_id TEXT NOT NULL,
        card_id         TEXT NOT NULL,
        riftbound_id    TEXT NOT NULL,
        quantity        INTEGER NOT NULL,
        zone            TEXT NOT NULL,
        FOREIGN KEY (deck_version_id) REFERENCES deck_versions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS dvc_version_idx ON deck_version_cards(deck_version_id);
      CREATE UNIQUE INDEX IF NOT EXISTS dvc_unique_idx
        ON deck_version_cards(deck_version_id, card_id, zone);
    `,
  },
  {
    version: 4,
    up: /* sql */ `
      -- Which revision of the legality rules produced is_legal / the counts on
      -- this row. Those columns are a cache of a pure function, so when the
      -- function changes the cache is wrong -- and it changed once already,
      -- when the rules were checked against the official Core Rules and three
      -- of them turned out to be wrong.
      --
      -- Defaulting to 0 marks every existing row stale, and the query layer
      -- recomputes stale rows the next time decks are listed. No data is lost
      -- and no launch-time scan is needed.
      ALTER TABLE deck_versions ADD COLUMN rules_version INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 5,
    up: /* sql */ `
      -- The card's name, denormalized alongside riftbound_id.
      --
      -- A deck row for a card the mirror cannot resolve was previously opaque:
      -- an id, a quantity, and nothing to identify it by. That had two costs.
      -- The UI could only say "1 card is missing" rather than which one, and --
      -- worse -- a save could not tell that a card being written was the same
      -- card as a preserved row it could not read, so re-adding a card whose
      -- printing had left the library stored it twice. The deck then held six
      -- copies by name the moment the old printing came back.
      --
      -- Nullable: rows whose card was already gone when this ran cannot be
      -- named retroactively, and inventing a name would be worse than a null.
      ALTER TABLE deck_version_cards ADD COLUMN card_name TEXT;

      UPDATE deck_version_cards
         SET card_name = (SELECT c.name FROM cards c WHERE c.id = deck_version_cards.card_id)
       WHERE card_name IS NULL;
    `,
  },
  {
    version: 6,
    up: /* sql */ `
      CREATE TABLE IF NOT EXISTS events (
        id                TEXT PRIMARY KEY NOT NULL,
        name              TEXT NOT NULL,
        format            TEXT NOT NULL DEFAULT 'constructed',
        event_type        TEXT NOT NULL DEFAULT 'tournament',
        started_at        TEXT NOT NULL,
        location          TEXT,
        rounds            INTEGER,
        final_placement   INTEGER,
        notes             TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        deleted_at        TEXT,
        user_id           TEXT,
        dirty             INTEGER NOT NULL DEFAULT 1,
        updated_by_device TEXT
      );

      -- deck_id sits alongside deck_version_id deliberately: deck-level
      -- aggregates never need a join, and no version-level operation can orphan
      -- a match.
      --
      -- Every optional column is genuinely optional. Someone who only ever taps
      -- WIN or LOSS still gets a correct win rate; the on-play split just
      -- reports a smaller sample. Analytics must never assume a field is there.
      CREATE TABLE IF NOT EXISTS matches (
        id                    TEXT PRIMARY KEY NOT NULL,
        deck_id               TEXT NOT NULL,
        deck_version_id       TEXT NOT NULL,
        played_at             TEXT NOT NULL,
        result                TEXT NOT NULL,
        games_won             INTEGER,
        games_lost            INTEGER,
        on_play               INTEGER,
        opp_legend_card_id    TEXT,
        opp_champion_card_id  TEXT,
        opp_domains           TEXT,
        opp_label             TEXT,
        event_id              TEXT,
        event_type            TEXT NOT NULL DEFAULT 'casual',
        mulligans             INTEGER,
        duration_seconds      INTEGER,
        notes                 TEXT,
        tags                  TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL,
        deleted_at            TEXT,
        user_id               TEXT,
        dirty                 INTEGER NOT NULL DEFAULT 1,
        updated_by_device     TEXT,
        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS matches_deck_idx    ON matches(deck_id);
      CREATE INDEX IF NOT EXISTS matches_version_idx ON matches(deck_version_id);
      CREATE INDEX IF NOT EXISTS matches_played_idx  ON matches(played_at);
      CREATE INDEX IF NOT EXISTS matches_deleted_idx ON matches(deleted_at);
      CREATE INDEX IF NOT EXISTS matches_opp_idx     ON matches(opp_legend_card_id);
      CREATE INDEX IF NOT EXISTS matches_event_idx   ON matches(event_id);

      -- Optional per-game detail for a best-of-three. A match is complete with
      -- none of these rows; they are a refinement, never a requirement.
      CREATE TABLE IF NOT EXISTS match_games (
        id          TEXT PRIMARY KEY NOT NULL,
        match_id    TEXT NOT NULL,
        game_number INTEGER NOT NULL,
        on_play     INTEGER,
        result      TEXT NOT NULL,
        notes       TEXT,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS match_games_match_idx ON match_games(match_id);
      CREATE UNIQUE INDEX IF NOT EXISTS match_games_number_idx
        ON match_games(match_id, game_number);
    `,
  },
  {
    version: 7,
    up: /* sql */ `
      -- The opponent's name, denormalized beside the card id.
      --
      -- Exactly the gap migration 5 closed for deck_version_cards, repeated on
      -- matches and caught before any device wrote a row. An opponent stored
      -- only as a card id becomes unrenderable the moment that printing leaves
      -- the card library: the recent-opponents rail inner-joins to cards so it
      -- silently drops, and a match detail screen has an id and nothing to
      -- print. opp_label does not cover it -- that field is free text for an
      -- opponent typed by hand, and the two-tap path never sets it.
      --
      -- Nullable, because most matches have no opponent recorded at all.
      ALTER TABLE matches ADD COLUMN opp_legend_name   TEXT;
      ALTER TABLE matches ADD COLUMN opp_champion_name TEXT;

      UPDATE matches
         SET opp_legend_name = (
               SELECT c.name FROM cards c WHERE c.id = matches.opp_legend_card_id)
       WHERE opp_legend_name IS NULL AND opp_legend_card_id IS NOT NULL;

      UPDATE matches
         SET opp_champion_name = (
               SELECT c.name FROM cards c WHERE c.id = matches.opp_champion_card_id)
       WHERE opp_champion_name IS NULL AND opp_champion_card_id IS NOT NULL;
    `,
  },
  {
    version: 8,
    up: /* sql */ `
      -- The match format: 1, 3 or 5 games.
      --
      -- Distinct from games_won/games_lost, which record what actually
      -- happened. "Best of three" is a property of how the match was played and
      -- is known before a single game is; a deck's record in Bo1 and Bo3 are
      -- different questions, and deriving the format from a 2-0 would guess.
      --
      -- Nullable: the two-tap path does not ask.
      ALTER TABLE matches ADD COLUMN best_of INTEGER;
    `,
  },
  {
    version: 9,
    up: /* sql */ `
      -- Every match list is "this deck, newest first".
      --
      -- The separate deck_id and played_at indexes could serve the filter or
      -- the order, never both: SQLite picked deck_id, then sorted every row it
      -- found before taking the first 50. Measured at 10,000 matches that was
      -- 37 ms to return a 50-row window -- the LIMIT bounded how much was
      -- hydrated but not how much was sorted.
      --
      -- A composite in the query's own order lets it walk the index and stop.
      CREATE INDEX IF NOT EXISTS matches_deck_played_idx
        ON matches(deck_id, played_at DESC);
    `,
  },
  {
    version: 10,
    up: /* sql */ `
      -- Per-game detail, the opt-in second tier.
      --
      -- match_games has existed since migration 6 with nothing writing to it;
      -- this is the milestone that gives it a consumer. Everything here is
      -- nullable because a player may record a score and no opening hand, or an
      -- opening hand and no champion turn, and half-filled detail is still
      -- worth more than none.
      --
      -- Riftbound is scored to 8 points, so the score is per game and both
      -- sides matter: winning 8-6 and winning 8-0 are different games, and only
      -- the result column can currently tell them apart, which it cannot.
      ALTER TABLE match_games ADD COLUMN score_for          INTEGER;
      ALTER TABLE match_games ADD COLUMN score_against      INTEGER;

      -- The turn each Chosen Champion landed. The single most asked question
      -- about a Riftbound game after who won.
      ALTER TABLE match_games ADD COLUMN champion_turn      INTEGER;
      ALTER TABLE match_games ADD COLUMN opp_champion_turn  INTEGER;

      -- Card ids, as JSON arrays. Kept as ids rather than a join table because
      -- these are read whole, per game, and never queried across matches by
      -- card -- the analytics load the games and group in TypeScript, the same
      -- way every other statistic in this app is computed.
      --
      -- Nullable, and null means "not recorded". An empty array would mean
      -- "recorded, and there was nothing" -- a mulligan to zero cards.
      ALTER TABLE match_games ADD COLUMN opening_hand       TEXT;
      ALTER TABLE match_games ADD COLUMN mulliganed         TEXT;
      ALTER TABLE match_games ADD COLUMN battlefields       TEXT;
    `,
  },
  {
    version: 11,
    up: /* sql */ `
      -- The Battlefield each side played, at match level.
      --
      -- Distinct from match_games.battlefields, which is per-game and still
      -- unwritten: this is the one a player can answer while logging, without
      -- reconstructing three games. Whether the deeper per-game record is worth
      -- its taps is a separate question.
      --
      -- Names alongside ids for the third time, and for the third reason:
      -- migration 5 for deck cards, 7 for opponents, and now this. A match is a
      -- permanent record and the card mirror is disposable, so an id on its own
      -- becomes unrenderable the moment a printing leaves the library.
      ALTER TABLE matches ADD COLUMN battlefield_card_id      TEXT;
      ALTER TABLE matches ADD COLUMN battlefield_name         TEXT;
      ALTER TABLE matches ADD COLUMN opp_battlefield_card_id  TEXT;
      ALTER TABLE matches ADD COLUMN opp_battlefield_name     TEXT;
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/**
 * Apply any migrations newer than the database's `user_version`.
 *
 * Each migration runs in its own transaction so a failure part-way through a
 * sequence leaves the database at the last fully applied version rather than in
 * an indeterminate state.
 */
export function migrate(db: SQLiteDatabase): { from: number; to: number } {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.withTransactionSync(() => {
      db.execSync(migration.up);
      db.execSync(`PRAGMA user_version = ${migration.version};`);
    });
  }

  return { from: current, to: LATEST_VERSION };
}

/** Rebuild the FTS index from `cards`. Used after a bulk seed load. */
export function rebuildSearchIndex(db: SQLiteDatabase): void {
  db.execSync(`INSERT INTO cards_fts(cards_fts) VALUES ('rebuild');`);
}
