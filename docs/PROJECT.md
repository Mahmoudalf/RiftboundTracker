# Riftbound Tracker — Project Specification

**Status:** M0 (Foundation) · **Last updated:** 2026-08-05

---

## 1. The problem

Riftbound players iterate on their decks constantly — a two-card swap after a bad tournament, a
rune adjustment after a new set drops, a whole rebuild when the meta shifts. The existing ecosystem
serves the *building* half of this loop well:

- **Piltover Archive** — Riot's official card gallery, deckbuilder, and hand simulator
- **Riftcodex** — an open REST API over the full card database

Neither serves the *learning* half. Once a deck exists, there is nothing that answers:

> *Did that change actually make the deck better?*

A player who logs 30 games, swaps four cards, and logs 40 more has two problems. Spreadsheets
lose the link between a result and the exact list that produced it, so the history gets overwritten
the moment the deck changes. And most tracking apps treat a deck as a single mutable entity — edit
it and your old win rate silently becomes a statistic about a decklist that no longer exists.

## 2. The solution

**A deck is a living object with a version history.** Every game is permanently bound to the exact
decklist that played it. The app can therefore show, simultaneously and without contradiction:

- the deck's **total** performance across its entire life
- each **version's** individual performance
- the concrete **card diff** between any two versions
- an honest read on whether the difference between them is real or just noise

That last point is the difference between a useful tool and a misleading one. See §6.

## 3. Success criteria

The app is judged on two things, in this order:

1. **Logging a game takes under 10 seconds**, tab bar to confirmation. If it takes longer, players
   stop logging, and an app with no data is worthless. This is a hard budget, measured with a
   stopwatch on a physical device — not a nice-to-have.
2. **Navigation and editing feel effortless.** Smooth 60 fps lists, gesture-driven sheets, haptic
   feedback, shared-element transitions, and designed empty states. The version model is powerful,
   but it only earns its keep if the user never has to think about it.

Feature count is explicitly *not* a success criterion.

## 4. Scope

### In scope for v1

| Area | Delivers |
| --- | --- |
| **Card gallery** | All ~1,450 cards, offline, instant local search + filtering, full-art detail view |
| **Deck builder** | Legend → Champion → build, with live rules-legality checking |
| **Version history** | Automatic versioning on edit, version timeline, side-by-side compare with card diff |
| **Match tracking** | 2-tap quick log, optional detail (on play/draw, BO3 games, event, mulligans, notes, tags) |
| **Analytics** | Win rate with confidence intervals, per-version splits, matchup matrix, trends over time |
| **Cloud sync** | Optional Supabase account for backup and multi-device |
| **Deck import/export** | Paste a decklist to create a deck; share yours as text or a code |
| **Collection tracker** | Track owned cards; the builder flags what you're missing |
| **Goldfish** | Draw sample opening hands from a version to test consistency |
| **Event mode** | Group games into a tournament with rounds and final placement |

### Explicitly out of scope

- **Live game-state tracking / overlays.** Riftbound is a physical card game; there is no client to hook.
- **Meta aggregation across users.** Requires a user base to be meaningful, and raises privacy
  questions worth deciding deliberately rather than by default. Revisit post-launch.
- **Marketplace / price tracking.** The API exposes TCGPlayer and Cardmarket IDs, so this stays
  possible later, but it is a different product.
- **Social feed, comments, likes.** Not what this app is for.

## 5. Core concept — version locking

> **A deck version becomes immutable the moment its first game is logged.**

```
Edit a version with no games yet      →  changes save in place. No new version, no clutter.
Edit a version that has games         →  saving forks a new version.
                                         The old version keeps its games, forever, untouched.
```

Everything else in the app follows from this one rule. It is what makes every number the app shows
trustworthy: a version's win rate is always a statement about a decklist that actually existed and
actually played those games.

Three guards keep it from becoming annoying:

- **No-op guard** — opening the editor and backing out changes nothing. A save that produces an
  identical card list creates no version.
- **Escape hatch** — if you genuinely need to correct a mis-entered list rather than fork it,
  "Amend this version" is available behind a confirm that spells out the consequence.
- **Deletion rules** — a version with games can be archived but never deleted.

The user should learn this model by using the app, never by reading about it. The editor shows a
quiet banner (*"v2 · 30 games tracked — saving will create v3"*), and the save sheet leads with
the diff rather than a form. See [`DESIGN.md`](DESIGN.md) §Flow 2.

Full schema and mechanics: [`DATA-MODEL.md`](DATA-MODEL.md).

## 6. Statistical honesty

A deck tracker that announces *"v3 is better!"* off eight games is worse than no tracker at all —
it launders noise into confidence and actively makes the player's decisions worse.

Non-negotiable rules, enforced in the analytics layer rather than left to UI discretion:

- Every win rate renders with its sample size and a **Wilson 95% confidence interval**:
  `63% · 19–11 · 95% CI 45–78%`
- Below **n = 20**, a version's stats render in a muted "provisional" style.
- A version comparison **never declares a winner** when the confidence intervals overlap. It says so
  plainly, and estimates how many more games would settle it.
- Version deltas are labelled **correlational**. The metagame moves and the pilot improves; the app
  should say that rather than sell false precision.

## 7. Architecture

**Local-first.** The device's SQLite database is the source of truth for everything the user sees.
The UI never waits on a network request. Cloud sync is an optional backup layer, not a dependency.

```
┌──────────────────────────────────────────────────────────┐
│  Expo / React Native app                                 │
│                                                          │
│  UI  ──reads──▶  SQLite (Drizzle, live queries)          │
│                     ▲              ▲                     │
│                     │              │                     │
│         card mirror │              │ user data           │
│                     │              │                     │
└─────────────────────┼──────────────┼─────────────────────┘
                      │              │
            ┌─────────┴───────┐  ┌───┴──────────────────┐
            │  Riftcodex API  │  │  Supabase (optional) │
            │  read-only,     │  │  Postgres + Auth +   │
            │  no auth        │  │  RLS, 1:1 schema     │
            └─────────────────┘  └──────────────────────┘
```

**Two independent data flows, deliberately never mixed:**

- **Card mirror** — pulled from Riftcodex, disposable, identical on every device, re-syncable at any
  time. Never travels through Supabase.
- **User data** — decks, versions, games, collection. Precious, unique per user, soft-deleted,
  synced last-write-wins on `updated_at`.

Three findings from the API investigation drive this design:

1. **Riftcodex cannot filter by type, domain, rarity, or cost** — only by set. A usable gallery
   therefore *requires* a local mirror. This is a hard requirement, not an optimization.
2. **The entire card database is ~1.8 MB.** Mirroring all of it on device is trivially cheap.
3. **It's a hobby API with no cache headers.** Sync must be gentle: a bundled seed snapshot so first
   launch never blocks on the network, a 24-hour TTL guard, and sequential paging with backoff.

Details and measurements: [`API.md`](API.md).

## 8. Decisions

| Decision | Rationale |
| --- | --- |
| **Expo / React Native** over Flutter | TypeScript across app, logic, and Supabase; mature RN ecosystem for the specific libraries this app leans on (FlashList, Reanimated, Skia, bottom-sheet) |
| **Local-first SQLite** over API-backed | Meets the 10-second logging budget, works at a tournament venue with no signal, and is the only way to filter cards the API can't filter |
| **Drizzle + expo-sqlite** over WatermelonDB / Realm | Real typed migrations and reactive queries without adopting a sync framework the app doesn't need |
| **Supabase** over a custom backend | Postgres + Auth + row-level security with no servers to operate; schema mirrors the local one 1:1 |
| **Version snapshots** over stored diffs | A version is ≤57 rows. Storage is irrelevant at this scale, any version renders without replaying history, and diffs are cheaper to compute than to keep correct |
| **Last-write-wins sync** over CRDTs | Versions are immutable and games are append-mostly, so genuine conflicts are rare. A CRDT would be over-engineering |
| **iOS + Android only** for v1 | Concentrates all UI effort on native feel. The Expo codebase can export to web later |
| **Optional account** | The app must be fully usable before anyone signs up. Sign-in claims existing local data rather than replacing it |

## 9. Legal

Riftbound Tracker is an unofficial fan project, not affiliated with Riot Games. Card data comes from
Riftcodex (also unofficial); card images are served from Riot's CDN. The app ships an
attribution/disclaimer screen and stays non-commercial under Riot's Legal Jibber Jabber policy.

Image URLs pass through a single indirection (`src/lib/cdn.ts`) so the CDN can be swapped for a
proxy or self-hosted cache if hotlinking ever becomes a problem.

## 10. Related documents

- [`API.md`](API.md) — Riftcodex reference, verified endpoints and measurements
- [`DATA-MODEL.md`](DATA-MODEL.md) — schema, version locking, analytics
- [`DESIGN.md`](DESIGN.md) — design system, navigation, user flows
- [`ROADMAP.md`](ROADMAP.md) — milestones and acceptance criteria
