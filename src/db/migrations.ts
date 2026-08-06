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
