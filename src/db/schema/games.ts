import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Game history — the data every number in the app is computed from.
 *
 * ---
 *
 * **The vocabulary, settled 2026-08-12 and inverted from what shipped before.**
 *
 * | Term | Means |
 * | --- | --- |
 * | **Game** | One encounter between two players. Bo1 or Bo3 |
 * | **Match** | One play inside a game. Riftbound scores to 8 to win a match |
 * | **Game style** | Casual · Online · Tournament — how the game was played |
 * | **Event** | A named occasion: *the Nexus Night on the 9th*. Holds rounds and a placement |
 *
 * So a Bo3 is **one game of up to three matches**, and `games.best_of` is the
 * format while `matches.match_number` counts the plays. Until migration 18 the
 * two were the other way round — `matches` held the encounter and `match_games`
 * the plays — which is why every table and column name below moved.
 *
 * ---
 *
 * The columns are mostly nullable on purpose. Logging has to take under ten
 * seconds or it stops happening, which means the fast path records a deck, a
 * result, and nothing else. Every refinement — who you played, on the play or
 * the draw, how many mulligans — is a field someone may never fill in, and the
 * analytics layer has to degrade to a smaller sample rather than to a wrong
 * answer. A schema that made any of them `NOT NULL` would be quietly demanding
 * a slower flow.
 */

const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  userId: text('user_id'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
  updatedByDevice: text('updated_by_device'),
};

/**
 * A win, a loss or a draw.
 *
 * Shared by both levels, which is why it is named for neither. A game has one
 * and so does each match inside it; typing `games.result` as a *match* result —
 * or the reverse — is exactly the confusion this rename exists to end.
 */
export const RESULTS = ['win', 'loss', 'draw'] as const;
export type Result = (typeof RESULTS)[number];

/**
 * How the game was played — "game style" in the UI.
 *
 * This used to be a flat list of seven that mixed two different questions.
 * Skirmish, Nexus Night and Locals are not alternatives to Tournament — they
 * *are* tournaments, so listing them as siblings made the vocabulary claim
 * something false and made "how do I do in tournaments" unanswerable without
 * knowing which three of the seven counted.
 *
 * They moved to `EVENT_STYLES` below, one level down, where they describe the
 * tier of a specific event. `testing` stays here because goldfishing is not a
 * casual game against a person.
 */
export const GAME_STYLES = ['casual', 'online', 'tournament', 'testing'] as const;
export type GameStyle = (typeof GAME_STYLES)[number];

/**
 * The styles the log form offers — the design's three.
 *
 * `testing` is not among them. It is still a legal value and rows already
 * holding it are untouched and still render, exactly as `EVENT_STYLES` handles
 * a tier written before the M6 split: **narrow the picker, never rewrite
 * history.** The list above stays the vocabulary the column may contain; this
 * one is the vocabulary the form may write.
 *
 * Keeping them as one list is what would force the choice between offering a
 * style the design removed and deleting data that already exists.
 */
export const LOGGED_GAME_STYLES = ['casual', 'online', 'tournament'] as const;

/**
 * The tier of an organised event — `events.event_type`.
 *
 * Only reachable through an event, because that is the only place the question
 * has an answer: a tournament round belongs to a tournament, and the tier is a
 * property of the day rather than of the round.
 *
 * Rows written before this split may hold a value that is no longer offered.
 * Readers must tolerate that (`eventStyleLabel` does) rather than assume
 * membership — the alternative is rewriting history to fit a newer vocabulary.
 */
export const EVENT_STYLES = [
  'nexus-night',
  'skirmish',
  'locals',
  'regional-qualifier',
  'regional-final',
] as const;
export type EventStyle = (typeof EVENT_STYLES)[number];

/**
 * The formats the log form offers.
 *
 * **Bo5 is gone, and so is "not recorded".** Riftbound is played Bo1 or Bo3;
 * Bo5 was a guess at a format the game does not use, and every game logged
 * without a best-of produced a record that could not say how many matches it
 * took. The form now always writes one of these two.
 *
 * The *column* stays nullable — games logged before this hold `null` or `5`,
 * and both are true records of what was entered. Readers must keep tolerating
 * them; only the picker is narrowed.
 */
export const BEST_OF_OPTIONS = [1, 3] as const;

/** What a new game defaults to. A single match is the common case. */
export const DEFAULT_BEST_OF = 1;

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    format: text('format').notNull().default('constructed'),
    /**
     * The tier: Nexus Night, Skirmish, Locals, Regional Qualifier or Final.
     *
     * Nullable since migration 17. An event created from the log form is only
     * given a name, so "which tier" genuinely has no answer yet — and a default
     * would make one up. Set it on the event screen, where the question is
     * being asked rather than assumed.
     */
    eventType: text('event_type').$type<EventStyle>(),
    startedAt: text('started_at').notNull(),
    location: text('location'),
    rounds: integer('rounds'),
    finalPlacement: integer('final_placement'),
    notes: text('notes'),
    ...syncColumns,
  },
  (t) => [index('events_deleted_idx').on(t.deletedAt)]
);

/**
 * One encounter between two players — what a player means by "I played against
 * Vi last night". Bo1 or Bo3.
 *
 * Called `matches` until migration 18.
 */
export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),

    /**
     * Denormalized alongside `deckVersionId`, deliberately.
     *
     * Deck-level aggregates are the common read and never need a join, and no
     * version-level operation can leave a game pointing at nothing.
     */
    deckId: text('deck_id').notNull(),
    /** The exact list that played this game. Locks the version on insert. */
    deckVersionId: text('deck_version_id').notNull(),

    playedAt: text('played_at').notNull(),
    result: text('result').$type<Result>().notNull(),

    /**
     * The format — 1, 3 or 5 matches. Known before play starts, unlike the
     * score, and a deck's Bo1 record is a different question from its Bo3.
     */
    bestOf: integer('best_of'),

    /** How the matches inside this game fell. Derived from the `matches` rows. */
    matchesWon: integer('matches_won'),
    matchesLost: integer('matches_lost'),

    /**
     * Nullable, and the nullability is the point: "unknown" is a real and
     * common answer, and recording it as `false` would silently bias the
     * on-play split rather than shrink it.
     */
    onPlay: integer('on_play', { mode: 'boolean' }),

    oppLegendCardId: text('opp_legend_card_id'),
    oppChampionCardId: text('opp_champion_card_id'),
    /**
     * The opponent's name, denormalized beside the id for the same reason
     * `deck_version_cards.card_name` exists: a card id alone becomes
     * unrenderable the moment that printing leaves the library, and the game is
     * a permanent record while the card mirror is disposable by design.
     */
    oppLegendName: text('opp_legend_name'),
    oppChampionName: text('opp_champion_name'),

    /** The Battlefield each side played. Name stored for the usual reason. */
    battlefieldCardId: text('battlefield_card_id'),
    battlefieldName: text('battlefield_name'),
    oppBattlefieldCardId: text('opp_battlefield_card_id'),
    oppBattlefieldName: text('opp_battlefield_name'),
    /** Set even when the exact Legend is unknown — "I played against Fury". */
    oppDomains: text('opp_domains', { mode: 'json' }).$type<string[]>(),

    /** The named occasion this belonged to, if any. */
    eventId: text('event_id'),
    /** Casual · Online · Tournament · Testing. Called `event_type` until 18. */
    gameStyle: text('game_style').$type<GameStyle>().notNull().default('casual'),

    notes: text('notes'),

    /*
     * Four write-only columns were here and are gone as of migration 22:
     * `opp_label`, `mulligans`, `duration_seconds` and `tags`.
     *
     * All four were declared in M4 against screens that were never designed,
     * and none of them was ever written. `opp_label` was the one with teeth —
     * `GameRow.tsx` and `summary.ts` both *read* it as the fallback name for an
     * opponent outside the card library, so a live "Unknown opponent" branch
     * was being fed by a column nothing could fill. `mulligans` held a count
     * that `matches.mulliganed` supersedes by holding the actual cards.
     *
     * Removed before M7 rather than after: a column that reaches Supabase
     * acquires an RLS policy and a sync engine, and stops being free to delete.
     */

    ...syncColumns,
  },
  (t) => [
    index('games_deck_idx').on(t.deckId),
    index('games_version_idx').on(t.deckVersionId),
    index('games_played_idx').on(t.playedAt),
    index('games_deleted_idx').on(t.deletedAt),
    index('games_opp_idx').on(t.oppLegendCardId),
    index('games_event_idx').on(t.eventId),
  ]
);

/**
 * One match inside a game — a single play, scored to 8.
 *
 * Called `match_games` until migration 18, where `game_number` became
 * `match_number` and `match_id` became `game_id`. A match belongs to a game,
 * not the other way round, and the old names said the opposite.
 */
export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id').notNull(),
    matchNumber: integer('match_number').notNull(),
    onPlay: integer('on_play', { mode: 'boolean' }),
    result: text('result').$type<Result>().notNull(),

    /** Riftbound scores to 8. Winning 8–6 and 8–0 are different matches. */
    scoreFor: integer('score_for'),
    scoreAgainst: integer('score_against'),

    /*
     * `champion_turn` / `opp_champion_turn` were here, and are gone as of
     * migration 19.
     *
     * The turn a Chosen Champion landed reads like the most interesting fact
     * about a match and is the least interpretable one: turn 5 is early for a
     * deck that ramps and late for one that does not, and without the board it
     * sat on — what was contested, what was answered, what either player was
     * holding — the number cannot say which. It would have produced an average
     * that looks like information and is not, which is the same reason M6's
     * goldfish dropped Rune channelling after building it.
     */

    /**
     * The opening deal, and what happened to it.
     *
     * Riftbound deals **4** and lets you recycle **up to 2** to the bottom,
     * drawing that many back — the rule `lib/goldfish.ts` simulates.
     *
     * | Column | Holds |
     * | --- | --- |
     * | `openingHand` | **All four cards dealt**, in order |
     * | `mulliganed` | The subset of those four that went back |
     * | `replacements` | What was drawn in their place (migration 20) |
     *
     * `openingHand` used to mean only the cards *kept*, which made
     * `seen = kept + mulliganed` the right arithmetic. It now means the whole
     * deal, so `seen = openingHand.length` and the mulliganed ids are a subset
     * rather than a disjoint set. The design's `1_ML_Advance` screen draws it
     * this way — one row of four slots for the deal, a second showing which of
     * them went back — and it is the better model: the four dealt cards are a
     * single observation, and splitting them across two columns meant neither
     * one could be rendered as the hand it was.
     *
     * Null means *not recorded* throughout. An empty array is a different and
     * real claim: an empty `mulliganed` beside a filled `openingHand` says the
     * hand was kept, which is exactly what `performanceByMulliganCount` needs
     * to tell apart from a hand nobody wrote down.
     */
    openingHand: text('opening_hand', { mode: 'json' }).$type<string[]>(),
    mulliganed: text('mulliganed', { mode: 'json' }).$type<string[]>(),
    /** What you drew back after recycling. At most as many as went back. */
    replacements: text('replacements', { mode: 'json' }).$type<string[]>(),

    /*
     * `battlefields` — which Battlefields were *brought* — was here, labelled
     * dead schema, and is gone as of migration 22.
     *
     * Migration 19 dropped two unwritten columns and left this one standing as
     * "the one exception", named so nobody would rediscover it. That was the
     * wrong trade: the Battlefield each side actually *played* has had its own
     * column since migration 16, and what a deck brought is that version's own
     * Battlefield zone, which the app can read without asking. A label on dead
     * schema is better than hiding it and worse than not having it.
     */

    /** This match's Battlefields, kept apart — see migration 16. */
    battlefieldCardId: text('battlefield_card_id'),
    oppBattlefieldCardId: text('opp_battlefield_card_id'),

    notes: text('notes'),
  },
  (t) => [
    index('matches_game_idx').on(t.gameId),
    uniqueIndex('matches_number_idx').on(t.gameId, t.matchNumber),
  ]
);

export type EventRow = typeof events.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
