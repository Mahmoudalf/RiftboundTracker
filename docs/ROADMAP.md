# Roadmap

**M0 – M5 is the complete usable product.** M6 – M8 is expansion and release.

| Milestone | Theme | Status |
| --- | --- | --- |
| [M0](#m0--foundation) | Foundation | 🟡 In progress |
| [M1](#m1--card-data) | Card data & gallery | ⬜ Not started |
| [M2](#m2--decks) | Decks & builder | ⬜ Not started |
| [M3](#m3--versioning) | Versioning | ⬜ Not started |
| [M4](#m4--matches) | Match tracking | ⬜ Not started |
| [M5](#m5--analytics) | Analytics | ⬜ Not started |
| [M6](#m6--extras) | Extras | ⬜ Not started |
| [M7](#m7--cloud) | Cloud sync | ⬜ Not started |
| [M8](#m8--ship) | Polish & ship | ⬜ Not started |

---

## M0 — Foundation

Project skeleton and shared vocabulary. Nothing here is user-facing, but every later milestone
depends on the tokens and structure being right.

- [x] `README.md`, `docs/PROJECT.md`, `docs/API.md`, `docs/DATA-MODEL.md`, `docs/DESIGN.md`, `docs/ROADMAP.md`
- [x] `.gitignore`
- [ ] `git init` + initial commit
- [ ] Expo SDK 54 + TypeScript (strict) scaffold
- [ ] expo-router with the 4-tab + center-action shell
- [ ] Nativewind v4 + `src/theme/` tokens
- [ ] **Sample exact domain hex values from the official card symbols** (see `DESIGN.md` §2)
- [ ] Fonts loaded (Chakra Petch / Rajdhani + Inter)
- [ ] ESLint + Prettier + Vitest configured
- [ ] npm scripts: `typecheck`, `lint`, `test`, `seed`, `db:generate`

**Done when:** `npx expo start` boots to the tab skeleton on a physical device, and `npm run
typecheck` + `npm run lint` pass clean.

---

## M1 — Card data

The foundation everything else reads from. Ships the first genuinely useful screen.

- [ ] Generate TS types from `openapi.json` → `src/api/riftcodex/types.ts`
- [ ] Zod schemas validating every API response at the boundary
- [ ] Riftcodex client with backoff and error handling
- [ ] Drizzle schema for `cards`, `sets`, `sync_meta` + FTS5 virtual table and triggers
- [ ] `scripts/generate-seed.ts` → `assets/seed/cards.json`
- [ ] Sync engine: seed load → set-change detection → incremental paging → 24 h TTL guard
- [ ] `src/lib/cdn.ts` image transform presets (`thumb` / `card` / `full`)
- [ ] **Card gallery** — FlashList grid, sticky filter chips, filter sheet, FTS search
- [ ] **Card detail** — shared-element transition, pinch-zoom, full text

**Done when:** all 1,451 cards browse and filter offline in airplane mode, search returns results as
you type, and the grid scrolls at 60 fps on a mid-range Android device.

---

## M2 — Decks

- [ ] Drizzle schema for `decks`, `deck_versions`, `deck_version_cards`
- [ ] `src/lib/legality.ts` — all rules from `API.md` §7, pure and unit-tested
- [ ] Create flow: Legend → Champion → build
- [ ] Deck editor: zone-grouped list, steppers, identity-filtered card rail
- [ ] Live legality bar with specific failure reasons
- [ ] Deck detail: Overview | List | Versions | Matches | Stats
- [ ] Decks tab with accent-gradient deck cards

**Done when:** a legal 40 + 12 + 3 deck can be built end to end, illegal states report the precise
reason, and illegal decks still save.

---

## M3 — Versioning

The core mechanic. Correctness here determines whether every number in the app is trustworthy.

- [ ] `src/lib/deck-diff.ts` — pure diff engine + `suggestLabelFromDiff()`
- [ ] `locked_at` set on first match
- [ ] Fork-on-save for locked versions; amend-in-place for unlocked
- [ ] **No-op guard** — identical save creates nothing
- [ ] Amend escape hatch behind a consequence-stating confirm
- [ ] Editor banner on locked versions
- [ ] Diff-led save sheet with pre-filled label
- [ ] **Version timeline** with per-version records and diff chips
- [ ] **Compare mode** (long-press two versions)

**Done when:** the invariants in `DATA-MODEL.md` §3 all hold under test — especially that a no-op
save creates no version, and that a version with matches is never silently mutated.

---

## M4 — Matches

- [ ] Drizzle schema for `matches`, `match_games`, `events`
- [ ] Log-match sheet: deck selector, WIN/LOSS, recent-opponent chip rail
- [ ] "Add details" expander: on play/draw, BO3 strip, event, mulligans, tags, notes
- [ ] Undo toast with live record readout
- [ ] "Log another" for consecutive rounds
- [ ] Match list, detail, and edit
- [ ] Haptics throughout

**Done when:** a stopwatch confirms **under 10 seconds** from tab bar to confirmation toast. If it's
slower, the flow gets redesigned before moving on.

---

## M5 — Analytics

- [ ] `src/lib/analytics/` — win rate, Wilson CI, splits, streaks, rolling series
- [ ] `compareVersions()` with `inconclusive` verdict and `matchesNeeded`
- [ ] Deck stats screen
- [ ] Version comparison view
- [ ] Matchup matrix
- [ ] Charts: rolling win rate, win-rate bars with CI whiskers, sparklines
- [ ] Cross-deck Stats tab
- [ ] Provisional styling below n = 20 applied everywhere

**Done when:** no screen can display a win rate without its sample size and interval, and a
comparison of two small samples refuses to declare a winner.

*This completes the usable product. Everything below is expansion.*

---

## M6 — Extras

In priority order — each is independently shippable.

- [ ] **Deck import/export** — parse pasted decklists (via `/cards/name?fuzzy=`), export as text and share code
- [ ] **Collection tracker** — `collection` table, owned counts, "missing cards" flags in the builder
- [ ] **Goldfish** — draw sample opening hands from a version, mulligan simulation
- [ ] **Event mode** — group matches into tournaments with rounds and final placement

Import lands first: it's the fastest path from install to a user who has something to track.

---

## M7 — Cloud

- [ ] Supabase project, schema migrations mirroring the local tables
- [ ] RLS policies (`auth.uid() = user_id`) on every table
- [ ] Auth: email, Sign in with Apple, Google
- [ ] Sync engine: pull-then-push, last-write-wins on `updated_at`, soft-delete propagation
- [ ] Sign-in **claims** existing local data rather than replacing it
- [ ] Sync status and manual trigger in Profile
- [ ] Conflict and offline-queue handling

**Done when:** two devices converge to the same state after concurrent offline edits, and a
signed-out user who signs in keeps every deck and match they already had.

---

## M8 — Ship

- [ ] Motion and haptics polish pass
- [ ] All empty states designed and implemented
- [ ] First-run onboarding
- [ ] Accessibility pass — contrast, 44pt targets, screen reader labels (use `accessibility_text`
      from the API for cards), Dynamic Type, reduce-motion
- [ ] Attribution / disclaimer screen
- [ ] Error boundaries and crash reporting
- [ ] EAS Build + EAS Update pipeline
- [ ] App icon, splash, store screenshots and copy
- [ ] Privacy policy
- [ ] TestFlight / Play internal testing

---

## Backlog

Deliberately deferred — revisit after launch with real usage data.

- Meta aggregation across users (needs a user base; privacy design required first)
- Price tracking via the TCGPlayer / Cardmarket IDs the API exposes
- Web export of the Expo codebase
- Deck sharing between users
- Sideboard / tech-card tracking as a first-class concept
- Widgets and watch app for ultra-fast logging
