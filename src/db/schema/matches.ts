import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Match history — the data every number in the app is computed from.
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

export const MATCH_RESULTS = ['win', 'loss', 'draw'] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number];

/**
 * How the match was played — "match style" in the UI.
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
 *
 * The column stays `event_type`; renaming it would be a migration for no gain.
 */
export const MATCH_STYLES = ['casual', 'online', 'tournament', 'testing'] as const;
export type MatchStyle = (typeof MATCH_STYLES)[number];

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

/** Match format. Null when it was not recorded. */
export const BEST_OF_OPTIONS = [1, 3, 5] as const;

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    format: text('format').notNull().default('constructed'),
    /** The tier: Nexus Night, Skirmish, Locals, Regional Qualifier or Final. */
    eventType: text('event_type').$type<EventStyle>().notNull().default('nexus-night'),
    startedAt: text('started_at').notNull(),
    location: text('location'),
    rounds: integer('rounds'),
    finalPlacement: integer('final_placement'),
    notes: text('notes'),
    ...syncColumns,
  },
  (t) => [index('events_deleted_idx').on(t.deletedAt)]
);

export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),

    /**
     * Denormalized alongside `deckVersionId`, deliberately.
     *
     * Deck-level aggregates are the common read and never need a join, and no
     * version-level operation can leave a match pointing at nothing.
     */
    deckId: text('deck_id').notNull(),
    /** The exact list that played this match. Locks the version on insert. */
    deckVersionId: text('deck_version_id').notNull(),

    playedAt: text('played_at').notNull(),
    result: text('result').$type<MatchResult>().notNull(),

    /**
     * The format — 1, 3 or 5 games. Known before the match starts, unlike the
     * score below, and a deck's Bo1 record is a different question from its Bo3.
     */
    bestOf: integer('best_of'),

    /** Optional game score. Deep-logging territory; see the M6 backlog. */
    gamesWon: integer('games_won'),
    gamesLost: integer('games_lost'),

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
     * unrenderable the moment that printing leaves the library, and the match
     * is a permanent record while the card mirror is disposable by design.
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
    /** Free text, e.g. "Yasuo aggro", for an opponent not in the library. */
    oppLabel: text('opp_label'),

    eventId: text('event_id'),
    eventType: text('event_type').$type<MatchStyle>().notNull().default('casual'),

    mulligans: integer('mulligans'),
    durationSeconds: integer('duration_seconds'),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).$type<string[]>(),

    ...syncColumns,
  },
  (t) => [
    index('matches_deck_idx').on(t.deckId),
    index('matches_version_idx').on(t.deckVersionId),
    index('matches_played_idx').on(t.playedAt),
    index('matches_deleted_idx').on(t.deletedAt),
    index('matches_opp_idx').on(t.oppLegendCardId),
    index('matches_event_idx').on(t.eventId),
  ]
);

export const matchGames = sqliteTable(
  'match_games',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull(),
    gameNumber: integer('game_number').notNull(),
    onPlay: integer('on_play', { mode: 'boolean' }),
    result: text('result').$type<MatchResult>().notNull(),

    /** Riftbound scores to 8. Winning 8–6 and 8–0 are different games. */
    scoreFor: integer('score_for'),
    scoreAgainst: integer('score_against'),

    /** The turn each Chosen Champion landed. */
    championTurn: integer('champion_turn'),
    oppChampionTurn: integer('opp_champion_turn'),

    /**
     * Card ids. Null means *not recorded*; an empty array would mean recorded
     * and empty — a mulligan down to nothing — which is a different claim.
     */
    openingHand: text('opening_hand', { mode: 'json' }).$type<string[]>(),
    mulliganed: text('mulliganed', { mode: 'json' }).$type<string[]>(),
    battlefields: text('battlefields', { mode: 'json' }).$type<string[]>(),

    /** This game's Battlefields, kept apart — see migration 16. */
    battlefieldCardId: text('battlefield_card_id'),
    oppBattlefieldCardId: text('opp_battlefield_card_id'),

    notes: text('notes'),
  },
  (t) => [
    index('match_games_match_idx').on(t.matchId),
    uniqueIndex('match_games_number_idx').on(t.matchId, t.gameNumber),
  ]
);

export type EventRow = typeof events.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
export type MatchGameRow = typeof matchGames.$inferSelect;
