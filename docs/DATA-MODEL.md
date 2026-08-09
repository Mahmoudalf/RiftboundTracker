# Data Model

Schema, the version-locking mechanic, and the analytics engine.

The database is **SQLite on device** (expo-sqlite + Drizzle), mirrored 1:1 into **Postgres on
Supabase** for optional sync. Everything below describes the local schema; the Postgres schema is
the same tables plus a non-null `user_id` and row-level security.

Three groups of data, with very different lifecycles:

| Group | Lifecycle |
| --- | --- |
| **Card mirror** | Disposable. Identical on every device. Re-syncable from Riftcodex at any time. Never synced through Supabase |
| **User data** | Precious. Unique per user. Soft-deleted. Synced |
| **Derived** | Never stored. Always computed from user data at read time |

---

## 1. Card mirror

`src/db/schema/cards.ts`

### `cards`

Nested API objects are **flattened on write** so every filter is a plain indexed column. This is
what makes gallery filtering instant despite the API offering none (see [`API.md`](API.md) §4).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Riftcodex ID |
| `riftbound_id` | text | May contain `*`; **not unique** across alternate printings |
| `tcgplayer_id` | text? | |
| `name` | text | |
| `clean_name` | text | From `metadata.clean_name` — better for sorting and matching |
| `collector_number` | int | |
| `energy` / `might` / `power` | int? | Flattened from `attributes`, all nullable |
| `type` | text | `Battlefield` \| `Gear` \| `Legend` \| `Rune` \| `Spell` \| `Unit` |
| `supertype` | text? | `Basic` \| `Champion` \| `Signature` \| `Token` |
| `rarity` | text | |
| `domains` | json | e.g. `["Fury","Order"]` |
| `domain_key` | text | Sorted CSV, e.g. `"Fury,Order"` — **indexed** |
| `text_plain` / `text_rich` / `flavour` | text? | `rich` is HTML |
| `tags` | json | Mixed semantics — champion names, regions, unit types |
| `set_id` / `set_label` | text | |
| `image_url` | text | Raw CDN URL; transforms applied at render via `lib/cdn.ts` |
| `artist` | text | |
| `accessibility_text` | text | Screen-reader description, straight from the API |
| `orientation` | text | `portrait` \| `landscape` |
| `alternate_art` / `signature` / `overnumbered` / `is_new` | bool | |
| `updated_on` | text | ISO 8601 — the incremental-sync key |

**Indexes:** `type`, `domain_key`, `set_id`, `rarity`, `energy`, `clean_name`, and
`(type, domain_key)` for the builder's hot query.

`domain_key` is the trick that makes "cards legal in my Legend's identity" a single indexed scan
instead of a JSON scan across 1,451 rows.

### `cards_fts`

FTS5 virtual table over `(name, text_plain, tags, artist)`, synced by trigger. Powers instant local
search with no network round-trip.

### `sets`

`id` PK · `name` · `set_id` · `card_count` · `published_on` · `tcgplayer_id?` ·
`cardmarket_ids` (json — the API returns string *or* array; normalize to array).

### `sync_meta`

Single row: `last_synced_at` · `api_version` · `card_count` · `seed_version` · `last_error?`.

---

## 2. User data

`src/db/schema/user.ts`

Every user table carries these **sync columns**:

```
created_at  updated_at  deleted_at?     -- soft delete, required for sync to propagate deletions
user_id?                                -- null until the user signs in
dirty       updated_by_device
```

### `decks`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `name` | |
| `legend_card_id` → `cards.id` | Defines the deck's domain identity |
| `champion_card_id` → `cards.id` | |
| `domains` | json, derived from the Legend — denormalized for list rendering |
| `format` | `constructed` \| `limited` \| `casual` |
| `notes` | |
| `current_version_id` → `deck_versions.id` | |
| `archived_at?` | |

### `deck_versions`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `deck_id` → `decks.id` | |
| `version_number` | int, 1-based |
| `label?` | e.g. `"−2 Bewitching Spirit"` — auto-suggested from the diff, user-editable |
| `notes?` | "Why did I make this change?" |
| `parent_version_id?` | The version this was forked from |
| `locked_at?` | **Non-null once ≥1 match references it.** The heart of the model |
| `main_count` / `rune_count` / `battlefield_count` | Denormalized for fast list rendering |
| `is_legal` | Cached result of the legality check |

### `deck_version_cards`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `deck_version_id` → `deck_versions.id` | |
| `card_id` → `cards.id` | |
| `riftbound_id` | Denormalized fallback if a card ever leaves the API |
| `card_name` | Denormalized for the same reason. Nullable — see below |
| `quantity` | 1–3 |
| `zone` | `main` \| `rune` \| `battlefield` \| `legend` \| `champion` \| `sideboard` |

`UNIQUE (deck_version_id, card_id, zone)`

**Why `card_name` is stored** (migration 5): a row whose `card_id` the mirror cannot resolve was
otherwise opaque. That cost two things. The UI could only say "1 card is missing" instead of naming
it — and a save could not tell that the card it was writing was the *same card* as a row it was
preserving, so re-adding a card whose printing had left the library stored both. The deck then held
six copies by name the moment the old printing came back, with the user having done nothing wrong.
Nullable, because a row whose card was already gone when the migration ran cannot be named
retroactively, and a fabricated name would be worse than a null.

**Why full snapshots rather than stored diffs:** a version is at most 57 rows. Storage is irrelevant
at this scale, any version renders without replaying history, and a diff is far cheaper to compute
on demand than to keep correct across edits, merges, and sync conflicts.

### `matches`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `deck_id` → `decks.id` | **Denormalized deliberately** — see below |
| `deck_version_id` → `deck_versions.id` | The exact list that played this match |
| `played_at` | ISO 8601 |
| `result` | `win` \| `loss` \| `draw` |
| `games_won?` / `games_lost?` | Optional BO3 summary |
| `on_play?` | bool, nullable — nullable is the point |
| `opp_legend_card_id?` → `cards.id` | |
| `opp_champion_card_id?` → `cards.id` | |
| `opp_domains?` | json — set even when the exact Legend is unknown |
| `opp_label?` | Free text, e.g. `"Yasuo aggro"` |
| `event_id?` → `events.id` | |
| `event_type` | The **match style**: `casual` \| `online` \| `tournament` \| `testing`. Not the event tier — see `events` below |
| `mulligans?` / `duration_seconds?` / `notes?` / `tags?` | All optional detail |

`deck_id` is stored alongside `deck_version_id` on purpose: deck-level aggregates never need a join,
and no version-level operation can orphan a match.

**Every optional field is genuinely optional.** A user who only ever taps WIN/LOSS gets a fully
correct overall win rate; the on-play split simply reports a smaller sample. Analytics must never
assume a field is present.

### `match_games`

Optional per-game BO3 detail: `id` · `match_id` · `game_number` · `on_play?` · `result` · `notes?`.

### `events`

`id` · `name` · `format` · `event_type` · `started_at` · `location?` · `rounds?` ·
`final_placement?` · `notes?`, plus sync columns.

**Two vocabularies, one column name.** `matches.event_type` is the *match style* — how the game
was played: `casual`, `online`, `tournament`, `testing`. `events.event_type` is the *event style* —
the tier of a specific occasion: `nexus-night`, `skirmish`, `locals`, `regional-qualifier`,
`regional-final`. Both columns keep the name `event_type`; renaming either would be a migration for
no gain.

They were one flat list of seven until migration 15, which was a category error: Skirmish and
Nexus Night are not alternatives to Tournament, they are kinds of tournament. Splitting them makes
"how do I do in tournaments" answerable and puts the tier where the question has an answer — on the
occasion, not on each round.

A match with `event_type = tournament` **must** carry an `event_id`; every other style may not have
one. Deleting an event soft-deletes only the event: the rounds keep pointing at the tombstone, and
reads filter on `events.deleted_at IS NULL`.

### `binders` · `binder_cards` (migration 12)

`binders` — `id` · `name` · `accent?` (a domain name, for the rail) · `notes?` · `sort_order` ·
sync columns including `deleted_at`.

`binder_cards` — `id` · `binder_id` → `binders.id` `ON DELETE CASCADE` · `card_id` · `card_name?` ·
`riftbound_id?` · `quantity` · `finish` · `created_at` · `updated_at`.
`UNIQUE(binder_id, card_id, finish)`; indexed on `card_id`, which is the hot path.

### Finish (migration 13)

`finish` is `standard` or `foil` — **a row per finish, not a column per finish.** Two copies of a
card in different finishes are two different objects to a collector: they trade separately and are
stored separately. A column per finish would also need a schema change the first time a third
treatment appears, which for a game this young is a matter of time.

Existing rows default to `standard`: every card filed before the migration was recorded without the
distinction existing, and calling it foil would invent information.

**Which finishes a card comes in is not in the card data.** Verified against the live Riftcodex API,
not only our mirror — the card object has no finish, foil, or treatment field in any form. So the
rule lives in `src/lib/finishes.ts` as game knowledge, stated once:

| Rule | Cards |
| --- | --- |
| `type = 'Legend'` | 180 |
| `rarity = 'Showcase'` | 120 |
| `supertype = 'Signature'` **or** the `signature` flag | 61 / 36 — see below |
| `alternate_art` **or** `overnumbered` | varies |

380 of 1,451 cards are foil-only; the remaining 1,071 offer both. The two Signature signals
genuinely disagree upstream — 61 cards carry the supertype, 36 carry the metadata flag — so the rule
ORs them rather than trusting either alone.

The default is **permissive**: a card matching no rule offers both finishes. If a rule is missing the
cost is an unused option; if the default were "standard only", the cost would be a foil the player
physically holds and cannot record. Losing data is worse than offering a choice nobody takes.

`resolveFinish()` is applied in `adjustCardQuantity`, not only in the UI — a caller asking for a
standard Legend gets a foil rather than a printing that does not exist. A rule enforced in a screen
is a rule the next screen will not have.

`distinctCards` counts `DISTINCT card_id`, not rows: one card held in two finishes is still one card.

**Superseded the planned `collection` table**, which was to be `card_id` PK · `quantity_owned`.
That design stored the owned count *and* let binders reference cards, which is two numbers for one
fact — the moment they disagree something has to decide which is right, and nothing can.

**Owned is derived, never stored:** `SUM(quantity)` over `binder_cards` joined to live binders. The
total and its breakdown are then the same data, and deleting a binder subtracts exactly the copies
it held with nothing to reconcile. It also matches the physical object — owning three copies *is*
two in the trade binder and one in a deck box.

`quantity` reaching zero **deletes the row** rather than storing a zero. A zero row is invisible in
the UI and still occupies the unique index, so a later add would collide with something the user
cannot see.

`card_name` is denormalized for the fourth time in this schema, after migrations 5, 7 and 11, and for
the same reason: the card mirror is disposable and this is not. A printing leaving the library must
never make a card you own unrenderable — you still physically have it.

---

## 3. Version locking

> **A deck version becomes immutable the moment its first match is logged.**

### Save algorithm

```
saveDeckEdit(deckId, editedCardSet):

  current = decks.current_version_id

  if cardSetsIdentical(current.cards, editedCardSet):
      return NO_OP                      # opening the editor and backing out changes nothing

  if current.locked_at is NULL:
      replace current.cards with editedCardSet
      recompute counts + is_legal
      return AMENDED                    # no version churn before the deck has played anything

  # locked → fork
  new = insert deck_versions(
      deck_id           = deckId,
      version_number    = current.version_number + 1,
      parent_version_id = current.id,
      label             = userLabel ?? suggestLabelFromDiff(current, editedCardSet),
      locked_at         = NULL)
  copy editedCardSet into deck_version_cards(new.id)
  decks.current_version_id = new.id
  return FORKED(new)                    # current keeps its matches, forever, untouched
```

### Locking

```
logMatch(match):
    insert match
    if match.version.locked_at is NULL:
        match.version.locked_at = now()
```

### Invariants

These are worth asserting in tests and, where cheap, in the code:

1. A version with matches is **never** mutated except via the explicit amend escape hatch. Not its
   card set, not its printings, not its row ids.
2. `matches.deck_version_id` always resolves to a live (possibly archived) version. Versions with
   matches can be **archived**, never deleted.
3. `decks.current_version_id` always points at a version belonging to that deck.
4. `version_number` is unique, ascending, and 1-based within a deck. **Not contiguous** — this was
   relaxed during the M3 audit. Going back to an older version and editing it forks a *sibling*, and
   deleting an unplayed sibling leaves a gap. Renumbering to close it would rename a version the user
   already knows as v3, which is worse than a gap; and `matches` reference version *ids*, so nothing
   downstream depends on the sequence being dense.
   Forks therefore number from `MAX(version_number) + 1`, not from the parent.
5. A no-op save creates nothing. *(This is the invariant that prevents version spam — the failure
   mode most likely to make the feature feel broken.)*

### Printings, and a design decision that was reversed

The builder chooses **printings** — picking a card is also picking its art — but the diff engine
keys on `cardKey()`, the name with the printing treatment stripped. Swapping "Vi" for
"Vi (Alternate Art)" therefore reports as a *reprint* (`DeckDiff.reprinted`, and
`cardSetIdentical: true`) rather than as a card leaving and another arriving.

M3 originally used that flag to skip the fork entirely and write the swap in place, **even on a
locked version**. The reasoning: the two lists are identical to every rule and every statistic, so
forking would produce versions no comparison could separate while splitting the match sample across
both. The first half is true. The conclusion was wrong.

`deck_version_cards` is not only the rules-level definition of a list — it is the record of what was
physically in the sleeve. Three planned readers treat it that way: the match detail screen renders
the played list (M4), the collection tracker checks ownership against `card_id` (M6), and deck export
emits printings (M6). Rewriting `card_id` on a version that matches were played with makes all three
describe cards the player did not own at the time. That is not ignoring a cosmetic change; it is
falsifying a record, and unlike a lost version number it cannot be recovered.

**The rule now: a locked version always forks.** The sample-splitting problem is real, and it belongs
in the analytics layer — `compareVersions()` can pool two versions whose diff is `cardSetIdentical`,
at read time, from data that is still true. Reprints are written in place only while a version has no
matches.

### Amend escape hatch

For a genuinely mis-entered list, "Amend this version" mutates in place behind a destructive confirm
that states the consequence plainly: *"The 30 matches logged on v2 will be attributed to the edited
list."* Rare by design, but its absence would make the app feel like it's fighting the user.

### Diff engine

`src/lib/deck-diff.ts` — pure, no I/O, heavily unit-tested.

```ts
diffLists(before: DeckList, after: DeckList): DeckDiff

interface DeckDiff {
  added:     { card: Card; zone: Zone; quantity: number }[]
  removed:   { card: Card; zone: Zone; quantity: number }[]
  changed:   { card: Card; zone: Zone; from: number; to: number }[]
  reprinted: { zone: Zone; from: Card; to: Card; quantity: number }[]   // art swaps
  unchanged: number
  netCardsMoved: number      // total cards in + out — the headline "how big was this change"
  zonesTouched:  Zone[]
  isEmpty:           boolean // nothing differs at all — drives the no-op guard
  cardSetIdentical:  boolean // no card added, removed, or re-counted; art may differ
}
```

`suggestLabelFromDiff()` picks the largest single change for the default version label
(e.g. `"−2 Bewitching Spirit"`), so labelling a version costs zero taps but stays editable.

---

## 4. Analytics engine

`src/lib/analytics/` — **pure TypeScript over arrays of match rows.** No SQL aggregation, no server.
A heavy user has a few thousand matches; that's nothing to compute in memory, and pure functions are
trivially unit-testable.

### Metrics

| Metric | Notes |
| --- | --- |
| Record (W–L–D) & win rate | Deck total and per version |
| **Wilson 95% CI** | On every win rate, always |
| Rolling win rate | Window of 10, as a time series |
| Splits | By version · opponent Legend · opponent domain pair · on-play/on-draw · event type |
| Streaks | Current and longest |
| Matchup matrix | Opponent Legend × record, sorted by n, muted below n = 5 |
| Version comparison | Win-rate delta + card diff + CI overlap verdict |

### Wilson score interval

Used instead of the normal approximation because it stays sane at small n and near 0% or 100% —
exactly the regime a deck tracker lives in.

```
       p̂ + z²/2n  ±  z·√( p̂(1-p̂)/n + z²/4n² )
CI  =  ─────────────────────────────────────────       z = 1.96 for 95%
                   1 + z²/n
```

### Statistical honesty rules

Enforced in the analytics layer so no screen can accidentally opt out:

- Every win rate carries its sample size and interval: `63% · 19–11 · 95% CI 45–78%`
- Below **n = 20**, stats render in a muted "provisional" style
- `compareVersions()` returns `verdict: 'inconclusive'` whenever the intervals overlap, plus
  `matchesNeeded` — an estimate of how many more games would separate them
- Version deltas are labelled **correlational**. The meta shifts and the pilot improves; the app
  should say so rather than sell false precision

```ts
interface VersionComparison {
  a: VersionStats
  b: VersionStats
  winRateDelta: number
  verdict: 'inconclusive' | 'b-better' | 'a-better'
  matchesNeeded?: number        // set when inconclusive
  diff: DeckDiff
}
```

---

## 5. Sync

Local SQLite is the source of truth. Supabase is backup and multi-device, never a dependency.

- Postgres tables mirror the local schema 1:1, each under RLS: `auth.uid() = user_id`
- The app is **fully functional signed out**. Signing in *claims* existing local rows by stamping
  `user_id` and uploading them — it never replaces local data
- Pull-then-push, last-write-wins per row on `updated_at`; soft deletes propagate via `deleted_at`
- Versions are immutable and matches are append-mostly, so real conflicts are rare — a CRDT would be
  over-engineering
- The card mirror is **never** synced through Supabase; each device pulls it from Riftcodex

---

## 6. Test coverage

The pure logic is where correctness actually lives, so that's where the tests go (Vitest):

**`legality.ts`** — 40/12/3 zone counts · 3-copy limit · 3-Signature limit · Champion name-and-domain
match · domain identity including dual-symbol cards · colorless battlefields always legal

**`deck-diff.ts`** — add / remove / quantity change / zone move · **the no-op case must return
`isEmpty: true`** (this is the test that guards the version-spam bug) · label suggestion

**`analytics/`** — win rate · Wilson CI against known reference values · per-version splits ·
on-play split with nulls present · streaks · empty input safety · `compareVersions` returning
`inconclusive` on overlapping intervals

**Integration** (seeded fixture DB) — create deck → log 3 matches → edit → assert v2 exists, v1
still holds exactly 3 matches, `locked_at` set on v1 · edit an unlocked version twice → assert still
exactly one version.
