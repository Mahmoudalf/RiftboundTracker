# Roadmap

> ### Vocabulary changed on 2026-08-12 — read this before anything below
>
> | Term | Means | Table |
> | --- | --- | --- |
> | **Game** | One encounter between two players. Bo1 or Bo3 | `games` |
> | **Match** | One play inside a game. Riftbound scores to **8** to win a match | `matches` |
> | **Game style** | Casual · Online · Tournament | `games.game_style` |
> | **Event** | A named occasion — *the Nexus Night on the 9th* — with rounds and a placement | `events` |
>
> A **Bo3 is one game of up to three matches.** Before this date the app used the two words the
> other way round, so **every entry below dated earlier than 2026-08-12 says "match" where it now
> means "game"**, and "game" where it now means "match".
>
> Those entries are **not rewritten**. A roadmap is a record of decisions as they were made, and
> restating them in words nobody used at the time would be the same fabrication migration 15
> refused when it chose to lose a label rather than invent an occasion. Read them with the old
> vocabulary; the code, the schema and `DATA-MODEL.md` all use the new one.
>
> See [The vocabulary inversion](#the-vocabulary-inversion-2026-08-12) for what moved and why.

**M0 – M5 is the complete usable product.** M6 – M8 is expansion and release.

| Milestone | Theme | Status |
| --- | --- | --- |
| [M0](#m0--foundation) | Foundation | ✅ Done |
| [M1](#m1--card-data) | Card data & gallery | ✅ Done |
| [M2](#m2--decks) | Decks & builder | ✅ Done |
| [M3](#m3--versioning) | Versioning | ✅ Done |
| [M4](#m4--matches) | Match tracking | ✅ Done |
| [M5](#m5--analytics) | Analytics | ✅ Done |
| [M6](#m6--extras) | Extras | ✅ Done |
| [M7](#m7--cloud) | Cloud sync | ⬜ Not started |
| [M8](#m8--ship) | Polish & ship | ⬜ Not started |

## Where things stand — 2026-08-14

The pre-M7 polish pass is **finished**. Everything below is either shipped and device-checked, or
carried deliberately with a reason.

**Shipped since 2026-08-13**

| | |
| --- | --- |
| **A1–A8** · write-only schema dropped | Migration 22 removed six columns and the `sets` table before M7 could mirror them into Postgres |
| **B2** · available-copies label | Shows what a second deck may still claim. Needs cards filed in a binder to appear |
| **B3** · editor leave guard | Device-confirmed on the Android back gesture, the case the old prompt missed |
| **B4** · binder grid + dimming | Device-confirmed |
| **C1** · editor open time | `FlashList` plus a chrome restructure. Device-confirmed as "much faster" |
| **D1** · inline version expansion | Device-confirmed. Last item off the original FIX FIRST list |
| **Analytics rebuild** | Built to `1_ANALYTIC02`: anchor · findings · opponent-scoped drawer, four states |
| **The draw rule** | A draw is now half a win and half a loss, app-wide |

**Needs attention — nothing blocking, all owner-side**

| | |
| --- | --- |
| **H1** · rotate the Piltover Archive key | Pasted into a chat log. Never used, never committed. Two minutes on their site |
| **D2** · 60 fps and airplane mode | Cannot be tested on a dev build — Metro is the connection that airplane mode cuts. Needs a release build (`--variant release` or an EAS preview) |
| **B2 / analytics on device** | Both need real logged data before they show anything. Not defects; not yet observed either |

**Carried deliberately**

| | |
| --- | --- |
| **F1** · log form leave guard | Real, and *not* the same fix as B3 — the log flow has a ten-second budget a dialog attacks |
| **F2** · version timeline virtualisation | Measured comfortable to the low hundreds. Nobody has a deck with 300 versions |
| **H2** · 26 npm advisories | Decided, not deferred: every remedy npm proposes is a downgrade, `expo@53` against 57. `expo-doctor` passes 20/20 |
| **H3** · over-exposed internal exports | Cosmetic |
| **G2–G4** · three design gaps | Collection coverage counter · gallery filable vs read-only · progress fill colour. Decisions for the design, not the implementation |
| Two Hi-Fi deviations in the match log | Both recorded with reasons in `MatchCard.tsx` |

**Next milestone: M7 — Cloud.** Unblocked. A1–A8 existed precisely so no dead schema reaches Supabase.

---

## M0 — Foundation

Project skeleton and shared vocabulary. Nothing here is user-facing, but every later milestone
depends on the tokens and structure being right.

- [x] `README.md`, `docs/PROJECT.md`, `docs/API.md`, `docs/DATA-MODEL.md`, `docs/DESIGN.md`, `docs/ROADMAP.md`
- [x] `.gitignore`
- [x] `git init`
- [x] Expo SDK 57 + TypeScript (strict, `noUncheckedIndexedAccess`) scaffold
- [x] expo-router with the 4-tab + center-action shell (custom `TabBar`, hand-drawn SVG icons)
- [x] Nativewind v4 + `src/theme/` tokens, single-sourced from `palette.js`
- [x] **Domain hex values sampled from Riot's Basic Rune card art**, re-derived in OKLCH
      (`scripts/sample-domain-colors.ts`)
- [x] Fonts loaded (Space Grotesk + Inter — see `DESIGN.md` §3 for why not Rajdhani)
- [x] ESLint + Prettier + Vitest configured
- [x] npm scripts: `typecheck`, `lint`, `test`, `seed`, `db:generate`

**Done when:** `npx expo start` boots to the tab skeleton on a physical device, and `npm run
typecheck` + `npm run lint` pass clean. ✅ — plus `npx expo export --platform android` produces a
6.41 MB Hermes bundle.

> **Toolchain note.** `babel-preset-expo` must match the installed SDK. A mismatch targets a
> different Hermes and stops transpiling ES6 classes, which the bundled `hermesc` may not parse —
> `expo export` then fails with "invalid statement encountered" at the bytecode step. This bit once
> during M0 when the preset resolved a version ahead of the SDK. `npx expo install --fix` realigns
> it, and `npx expo-doctor` catches it before a build does.
>
> **Upgraded to SDK 57 (2026-08-06).** Originally scaffolded on 54, which was three releases behind
> by the time M1 landed. The upgrade surfaced a latent bug: `TabBar.tsx` imported
> `BottomTabBarProps` from `@react-navigation/bottom-tabs`, an *undeclared* dependency that resolved
> only because npm hoisted it out of expo-router's tree. expo-router v7 vendors its own copy of
> those types, so two incompatible definitions collided. The type is now derived from expo-router's
> own `Tabs` component, and a sweep confirmed no other phantom dependencies exist.

---

## M1 — Card data

The foundation everything else reads from. Ships the first genuinely useful screen.

- [x] Zod schemas validating every API response at the boundary (`schemas.ts`)
- [x] Riftcodex client with timeouts, capped retries, and backoff (`client.ts`)
- [x] Drizzle schema for `cards`, `sets`, `sync_meta` + FTS5 virtual table and triggers
      (`migrations.ts`, applied by `PRAGMA user_version`)
- [x] `scripts/generate-seed.ts` → `assets/seed/cards.json` (1,451 cards, 1.64 MB)
- [x] Sync engine: seed load → set-change detection → sequential paging → 24 h TTL guard
- [x] `src/lib/cdn.ts` image transform presets (`thumb` / `card` / `full`)
- [x] **Card gallery** — FlashList grid, domain rail, filter modal with live result count, FTS search
- [x] **Card detail** — pinch and double-tap zoom, rules text, card-footer metadata line
- [x] Unit tests for the API mapper (10 passing)

**Done when:** all 1,451 cards browse and filter offline in airplane mode, search returns results as
you type, and the grid scrolls at 60 fps on a mid-range Android device.

### Post-M1 audit (2026-08-06)

Traced end to end against a real SQLite database (Node 24's `node:sqlite` shimmed to the expo-sqlite
interface, running the real `migrate()` and the real query SQL). Six defects found and fixed:

| # | Defect | Impact |
| --- | --- | --- |
| 1 | `hydrate()` cast raw `SELECT *` rows straight to `CardRow`. SQLite returns snake_case; the type is camelCase | **12 of 29 fields were `undefined`, including `imageUrl` — every card rendered without art.** Also killed rules text, set code, collector number, and the screen-reader label |
| 2 | `useCardSync()` held per-component state and a per-component "started" ref, but is called from two screens | Two concurrent 15-page walks of a small fan-run API on first launch; refreshing from Profile left the gallery's count stale |
| 3 | Decks empty state linked to `/deck/new`, which did not exist | Both onboarding buttons dead-ended on the "unmatched route" screen |
| 4 | Filter sheet computed its live count from the store's `search`, but the gallery kept search in local state | "Show N cards" ignored the active search term |
| 5 | `relevance` sort mapped to the same expression as `name` | Searching "vi" ranked Vision Quest above Vi |
| 6 | `listSets()` had the same cast bug as #1 | Latent — no UI consumed it yet |

The fix for #1 removes the whole class rather than the instance: column metadata is now derived from
the Drizzle schema (`src/db/queries/hydrate.ts`) and shared by **both** the read path and the write
path, which had its own hand-written column list. `hydrate.test.ts` asserts no column resolves to
`undefined`, so a future schema addition cannot silently reintroduce it.

Verified working and unchanged by the audit: migrations and `PRAGMA user_version`, FTS5 including the
update triggers dropping stale terms, the anchored `domain_key` filter, and the sync change-detection
heuristic (`sum(set.card_count)` does equal the `/cards` total, so no needless re-downloads).

### Pre-M2 hardening (2026-08-06)

| Area | Finding |
| --- | --- |
| **Image pipeline** | CDN verified live: serves `image/webp` to Android (Coil) and iOS (SDWebImage) user agents, **no hotlink protection** (foreign `Referer` and absent UA both return 200), `Cache-Control: max-age=31536000`. 789 KB → 11.9 KB confirmed. Decoding by expo-image itself remains device-only |
| **Typing latency** | Measured over the full 1,451-card library. Hydration is **0.79 ms**; SQL dominates at 4.18 ms. Typing gets *cheaper*: `"v"` → 401 rows/1.4 ms, `"vi"` → 58 rows/0.2 ms. Worst case is the unfiltered first render, once. (V8, not Hermes; JSI bridge cost unmeasured) |
| | Fixed real waste: the filter sheet ran the whole query for a count. Now `countMatchingCards()` — a `COUNT(*)` |
| **Domain glyphs** | Unicode placeholders removed entirely. `✷ ⬢ ❋` live in Noto Sans Symbols, not Roboto, so a thin-font device would have rendered tofu — silently dropping half of "color never carries meaning alone". Replaced with drawn SVG (`components/cards/DomainGlyph.tsx`) |
| | Every remaining non-ASCII character (`•` `—` `…`) confirmed present in the bundled Space Grotesk and Inter by reading each font's cmap table |
| **Migrations** | Real upgrade-path tests added (`migrations.test.ts`), running actual DDL against `node:sqlite` |

**The migration test found a shipping bug immediately.** FTS5 triggers only fire on writes made after
they exist, so a device upgrading v1 → v2 with a populated card mirror got an **empty search index** —
and because sync skips entirely when the mirror is already complete, nothing would ever rebuild it.
Search would return nothing, silently and permanently. Migration 2 now backfills the index itself
rather than depending on a later call.

The suite is parameterised over `MIGRATIONS`, so **v3 gets a populated-database upgrade test the
moment M2 adds it**, with no new test code.

> ### ⚠️ Not yet run on a device — no emulator available
>
> Every check so far is typecheck, unit tests, Node-level traces against real SQLite, and a Metro
> bundle. **No pixel has been rendered.** This machine has the Android SDK but no JDK, no system
> image, and no AVD, so booting one would mean installing a JDK and downloading ~1.5 GB first.
>
> To run it: `npm run seed && npx expo start`, then Expo Go. What to look at first:
>
> 1. **Do card images appear?** The CDN is proven, expo-image's webp decode is not. Blank tiles here
>    would be a *different* cause than the hydration bug fixed in the audit — check the URL in a
>    browser before assuming a regression.
> 2. **Typing lag in the gallery.** Expected imperceptible; the risk is the first unfiltered render.
> 3. **The six domain glyphs** in the filter rail — all should be solid shapes, no boxes.
> 4. **The tab bar's `+` button** uses `marginTop: -22` to overhang the bar; Android sometimes clips
>    children overflowing a parent with elevation.
>
> **Still unverified:** the 60 fps target and offline behaviour need a physical device — everything
> above was checked by typecheck, unit tests, and a full Metro bundle only. First device run should
> confirm scroll performance with all 1,451 cards and that airplane mode still browses.
>
> Two deferred items: TS types are hand-written from the OpenAPI spec rather than codegen'd (the
> spec is small and stable enough that a generator earns nothing yet), and the filter panel is a
> router modal rather than a gesture sheet — the log-match flow in M4 is the one that genuinely
> needs a draggable sheet, and that is where `@gorhom/bottom-sheet` gets introduced.

---

## M2 — Decks

- [x] Drizzle schema for `decks`, `deck_versions`, `deck_version_cards` (migration 3)
- [x] `src/lib/legality.ts` — all rules from `API.md` §7, pure and unit-tested
- [x] Create flow: Legend → Champion → build
- [x] Deck editor: zone-grouped list, steppers, identity-filtered card rail
- [x] Live legality bar with specific failure reasons
- [x] Deck detail: Overview | List — Versions, Matches, and Stats deferred to M3–M5
- [x] Decks tab with accent-gradient deck cards

**Done when:** a legal 40 + 12 + 3 deck can be built end to end, illegal states report the precise
reason, and illegal decks still save.

### What shipped, and what did not

Deck detail ships **Overview** and **List** only. A Versions tab against a single version, or a
Matches tab before match logging exists, teaches the user the app is empty — they arrive with the
milestones that give them something to show. Overview carries the version list and states the fork
rule in place, so the model is visible before M3 implements it.

`saveDeckList()` **throws** on a locked version rather than writing. Nothing can lock a version
until M4, so the branch is unreachable today — which is why it is worth having now. M3 replaces the
throw with fork-on-save; until then, silently rewriting a list that matches were played on is the
one failure this model must never have.

### Rule corrections found in the card data

`docs/API.md` §7 has the detail, with the Core Rules citation for each. Two were measured against
the full mirror; the rest came out of the post-M2 audit against the official rulebook:

| Finding | Consequence if missed |
| --- | --- |
| The Signature limit means `supertype = 'Signature'` (61 cards), **not** the `signature` column (36 cards) — the sets are disjoint | Limit enforced against cards that cannot be in a deck, never against the ones it exists for |
| The copy limit counts cards, not printings — 1,451 printings are 954 cards | Six copies of one card in a "legal" deck |
| The copy limit is scoped to the **Main Deck** (103.2.b), not to non-Basic cards everywhere | Three copies of one Battlefield pass as legal |
| The Main Deck is **at least** 40 (103.2), not exactly 40 | A legal 42-card deck reported as two cards over |
| Battlefields must all have **different names** (103.4.c) | Three copies of Star Spring pass the 3/3 count check |

### Post-M2 audit

Traced end to end before starting M3. `src/features/decks/editor-flow.test.ts` now drives the exact
user sequence — real create-flow queries, real editor store, all 1,451 real cards, real SQLite — and
reads the database back.

| # | Finding | Status |
| --- | --- | --- |
| 1 | The rune exemption was inferred, not verified. Checking the Core Rules found **three** wrong rules: Main Deck is a minimum, the copy limit is Main-Deck-scoped, Battlefields must be distinct | Fixed, each check now cites its rule number |
| 2 | Cached `is_legal` written under the old rules would keep claiming the old verdict | Fixed — `RULES_VERSION` stamp (migration 4) + `refreshStaleVersions()` recomputes on read |
| 3 | `is_legal` vs. the legality bar — could they disagree? | **No.** Both call `checkLegality` on the same list object; verified end to end, including a reload from disk |
| 4 | A Champion Unit tapped in the rail lands in `main` beside the designated Champion | **Correct** per 103.2.b.1 — the Chosen Champion's copy counts toward its own 3-copy limit. The 4th copy is caught |
| 5 | No way to change a mis-picked Legend or Champion — only deleting the deck | Fixed — `CardPickerSheet`, reachable by tapping either row |
| 6 | `saveDeckList` nulled `legend_card_id` and `domains` when the list had no legend slot | Fixed — reachable whenever the Legend's printing leaves the mirror, and unrecoverable. Now preserved |
| 7 | `writeSlots` deleted rows for cards the editor could not see, so a mirror resync silently dropped them from the deck | Fixed — only rows for cards present in the mirror are rewritten |

Findings 6 and 7 are the same underlying mistake: the editor treating "what I can currently see" as
"the whole deck". The card mirror is disposable by design, so anything it cannot resolve has to
survive a save untouched rather than be written away.

### Device bug: every pressable control rendered unstyled

Reported as "there is no option to create a deck". The button was there, correctly
positioned and fully tappable — just invisible.

**NativeWind's JSX interop silently drops a function-valued `style`.** React Native allows
`style={({ pressed }) => [...]}`; under the interop the function never runs and the element gets no
style whatsoever. Object and array styles are unaffected, which is what makes it so easy to miss.

It is close to undetectable by eye because of how it fails: a primary button loses its *background*
but keeps its *foreground* colour, so `#0A0B0F` text lands on the `#0A0B0F` surface. Nothing is
missing from the layout, nothing errors, and the control still responds to taps.

Found by measuring rather than looking. An `onLayout` probe pushed to the device reported the
actions container at **21.33 dp** — exactly one `bodyMedium` line box — against a declared
`minHeight: 48`. The same log was its own control group: the sibling `<View>` with an object style
laid out correctly at 304 dp wide in the same render.

| | before | after |
| --- | --- | --- |
| measured height | 21.33 dp | 48 dp |

Fixed in `src/components/ui/Pressable.tsx`, which tracks the pressed state and resolves the style
before it reaches the native component. Drop-in, same signature, applied across all 26 call sites in
15 files. An ESLint `no-restricted-imports` rule now fails the build on `Pressable` imported from
`react-native`, so this cannot quietly come back — it caught one straggler immediately.

### Environment: the project lives inside OneDrive

Two failures in one session traced to `D:\OneDrive\` syncing the working tree:

1. **A dev-server 500.** Metro could not resolve `react-is/cjs/react-is.development.js` — a file that
   exists and Node reads fine. All 50,078 files under `node_modules` are Files On-Demand
   placeholders; OneDrive's dehydrate/rehydrate churn fires watcher events and a file caught
   mid-sync fails to resolve. Mitigated with `attrib +P -U /S` to pin them local.
2. **Metro served a stale module.** An edit to `EmptyState.tsx` produced no rebuild at all — no
   bundle event, no hot update — while an edit to `app/(tabs)/index.tsx` applied normally. Metro's
   watcher missed the change silently, so the bundle was built from a file that no longer matched
   disk. This actively corrupted debugging before it was spotted.

Pinning addressed (1) but not (2), because `src/` and `app/` were still synced.

### Moved out of OneDrive (2026-08-07)

`D:\OneDrive\06_Riftbound Tracker` → **`D:\dev\riftbound-tracker`**. All 50,433 files were verified
fully hydrated first (zero `Offline` attributes), so the move could not stall on a download.

The directory itself could not be renamed — a shell held it as its working directory — so the
contents were moved child by child, which is the same one rename per top-level entry on a single
volume. 12.3 s, zero failures, and git still recognises the repo with an unchanged working tree.

**The move broke `node_modules` in a way only Metro noticed.** `expo export` could not resolve
`@expo/metro-runtime` while Node resolved it fine from the same directory, and `--clear` did not
help — so it was not the transform cache. `npm ci` fixed it. Worth recording because the failure
looked exactly like the OneDrive resolution errors this move was meant to end, and stopping at
"`--clear` didn't help, so it's OneDrive again" would have been wrong twice over.

Full gate re-run on the reinstalled tree: typecheck, lint, 142 tests, `expo export`, and a `--clear`
Metro start with a fresh dev-bundle fetch — **0 resolution errors, 0 OneDrive paths in the bundle**,
2,366 modules. A stale module is no longer an available explanation for anything.

### Test seam added

`src/db/connection.ts` resolves the database handle through `conn()`, which a test can point at the
`node:sqlite` harness. `client.ts` opens the real database at module load, so without this seam any
test touching a query pulls in `expo-sqlite` and its native module. The user-data queries are the
part of the app most worth testing — the lock rule decides whether a player's match history stays
attached to the list that played it, and that is not something to discover on a device.

---

## M3 — Versioning

The core mechanic. Correctness here determines whether every number in the app is trustworthy.

- [x] `src/lib/deck-diff.ts` — pure diff engine + `suggestLabelFromDiff()`
- [x] `locked_at` set on first match (`lockVersion()`, called by M4's logger)
- [x] ~~Fork-on-save for locked versions; amend-in-place for unlocked~~ → **fork on every real
      change**, played or not (see below)
- [x] **No-op guard** — identical save creates nothing
- [x] Amend escape hatch behind a consequence-stating confirm
- [x] Editor banner on locked versions
- [x] Diff-led save sheet with pre-filled label
- [x] **Version timeline** with per-version records and diff chips
- [x] **Compare mode** (long-press two versions)

**Done when:** the invariants in `DATA-MODEL.md` §3 all hold under test — especially that a no-op
save creates no version, and that a version with matches is never silently mutated. ✅ — all five
asserted directly against real SQLite in `decks.test.ts`, reading the database back rather than
trusting the return value.

### The rule changed: every edit is a version (2026-08-10)

Amend-in-place for unplayed versions is gone. It was defensible — a version nobody had played
reads like a draft still being written — but a version records what the deck *was*, and swapping
ten cards makes it a different deck whether or not it has been played. Calling that still-v1 lost
the only history the app exists to keep.

What holds the line is the **no-op guard**, not the lock: a save that changes nothing still writes
nothing, so opening the editor and backing out cannot spend a version number. Amending survives
only as the escape hatch, confirmed by name.

The change broke **27 tests across six files**, every one of them encoding the old rule — most by
reading back the version they passed in, which is now deliberately untouched. They were worked
through individually rather than bulk-edited; where a test named the old behaviour outright it was
rewritten to assert the new one instead of renamed around a stale assertion.

It also emptied two members of `SaveOutcome`. `amended` and `reprinted` described an in-place write
to an unplayed version, which nothing can now produce, so both are deleted along with their toast
lines — the only write that is not a fork is the escape hatch.

### One entry point

Every edit to a deck's cards now goes through `saveDeckEdit()`, which returns what it did rather
than assuming. That matters because the outcome is not a UI detail — `forked` means a second version
now exists and the deck points at it, and a caller that could not tell would show the wrong version
number in the confirmation.

| Outcome | When |
| --- | --- |
| `no-op` | The list is unchanged. **Nothing is written at all** |
| `amended` | The version has no matches, so it is edited in place |
| `reprinted` | Same cards, different art, on a version with no matches |
| `forked` | The version is locked. A new one carries the change; the old keeps its matches |
| `amended-locked` | The escape hatch, behind a confirm that names the affected matches |

### What the timeline can and cannot say yet

Compare mode ships with the card diff and both versions' counts, and deliberately without a verdict.
A verdict needs a confidence interval behind it, matches do not exist until M4, and win rates until
M5 — so the sheet says that plainly instead of rendering an empty chart. `versionMatchCounts()`
already reads the `matches` table if it exists and returns an empty map if it does not, so the
records fill themselves in when M4 lands with no UI branch left behind to remember.

`deleteVersion()` re-parents a deleted node's children so the timeline cannot grow an orphan branch.
That path is currently unreachable — a version can only have children once it is locked, and a
locked version cannot be deleted — but it is cheap and the alternative is a broken timeline the day
that stops being true.

### Post-M3 audit

Three findings, all reproduced against real SQLite before being fixed rather than reasoned about.
The first reversed a design decision made earlier in the same milestone.

| # | Finding | Status |
| --- | --- | --- |
| 1 | Art swaps were written in place on **locked** versions, rewriting `card_id`, `riftbound_id` and the row id of a list that matches were played with | Fixed — a locked version always forks |
| 2 | Re-adding a card whose printing had left the library stored it **twice**, so the deck silently held 6 copies by name once the printing returned | Fixed — `card_name` (migration 5) + name-matched cleanup in `writeSlots` |
| 3 | Two versions forked from the same parent rendered as a linear chain, claiming the newer one contained the other's changes | Fixed — the connecting line is drawn only to a real parent; branches show "Forked from v1" |
| 4 | Invariant 4 said `version_number` is contiguous. Deleting an unplayed sibling leaves a gap | Doc corrected — unique and ascending, not dense. Renumbering would rename a version the user knows |

**Finding 1 is the one worth recording.** The original argument was that a printing swap changes
nothing the rules or the statistics can see, so forking would split a match sample for no analytical
gain. That reasoning treated `deck_version_cards` as only the rules-level definition of a list. It is
also the record of *what was physically in the sleeve* — which M4's match detail renders, M6's
collection tracker checks ownership against, and M6's export emits. Nothing reads it that way today,
which is exactly why the bug was invisible: it was a correctness debt payable in a later milestone.

The sample-splitting concern was real and got a better answer than damaging the data: analytics can
pool versions whose diff is `cardSetIdentical` at read time. A falsified record cannot be recovered;
a pooled statistic can always be computed later.

**Finding 2 predates M3.** `writeSlots` has preserved unresolvable rows since M2 — correctly, so a
library resync never deletes a card from a deck — but it had no way to know that a card being written
was the same card as a row it was preserving, because a missing card had no name stored. M3's
printing-level picker made it far easier to reach.

### Second pass — four probes that were raised but never examined

The first audit named these and moved on. Two were real, one was clean, one was half-right.

| # | Probe | Result |
| --- | --- | --- |
| 1 | Editor's stale `versionId` after a fork | **Fixed.** Double-tapping Save forked twice — measured v2 *and* v3, identical, from one gesture |
| 2 | No-op guard's mid-session sync window | **Fixed.** An untouched deck forked *and* lost a card |
| 3 | `forkVersion` copy vs. the name-matched cleanup | **Clean, and made structural.** No unique-index violation was reachable, but only by accident |
| 4 | `syncDeckIdentity` via `setCurrentVersion` / `deleteVersion` | **Split.** Legend and domains were safe; the Champion was not |

**1 — what `router.replace` actually does.** `/deck/[id]/edit` and `/deck/[id]` are both routes of
the same `Stack`. *(Written when that stack was the root one. Gap 3 moved them into the Decks tab's
own stack — the route pair still shares a stack, so the reasoning is unchanged, and the `useRef`
latch that actually prevents the double save never depended on navigation at all.)* `router.replace`
resolves to a React
Navigation `REPLACE` on that stack — `getNavigationAction` only rewrites the type for drawer and tab
navigators — so the top route is swapped, the edit screen unmounts, and the effect cleanup clears the
draft. **The unmount is real.** What is not real is its timing: `replace` goes through expo-router's
`routingQueue`, which is drained during a later render, not inside the caller. So a second tap on the
sheet's button reaches `commit` while the store still holds the pre-fork `versionId` — writing the
same edit into the locked version and forking again. Fixed with a `useRef` latch, plus pointing the
store at the new version so a slipped-through call would at worst re-save the fork. `__DEV__` logs
the store's `versionId` on mount, on unmount, and after every save, so the device pass confirms it by
measurement rather than by reading this paragraph.

**2 — the sync window.** Both sides of the diff come from `loadDeckList`, so unresolvable cards
normally cancel out. They stop cancelling if the mirror changes between opening the editor and
saving: the stored side gains a card the draft never had, the diff reads it as a deletion, and
`writeSlots` then deletes it for real. Measured: `removed: ["ghost"]`, one fork, and the card gone
from the new version — on a deck the user did not touch. Reachable on first launch, where the sync
runs while the app is already usable. Fixed with `reconcileWithStored()`, a three-way comparison
between draft, stored list, and what the editor was handed at load: a card in the stored list but not
in the draft is re-added only when the editor **never saw it**. A card the user actually removed
stays removed.

**3 — clean, and now guaranteed rather than argued.** The cleanup *can* delete a row the fork just
copied, and that is correct: it only fires on a name match in the same zone, which means the user
restated that card. Measured — the fork keeps the unrelated ghost and drops the superseded one.
`UNIQUE(deck_version_id, card_id, zone)` was also never violable, but only because the name cleanup
happened to cover the one case that could collide (a card leaving the mirror while the editor holds
it). Two independent mechanisms covering for each other is an argument, not a guarantee, so the
insert is now an upsert and the constraint is unreachable by construction.

**4 — the Legend was safe, the Champion was not.** With the Legend's printing gone, `loadDeckList`
returns no legend slot, the M2 fix takes the whole else-branch, and `domains`, `legend_card_id` and
`champion_card_id` all survive. But with the Legend present and only the *Champion's* printing gone,
the update ran with `champion?.id ?? null` — measured `championCardId: null`. Same mistake as M2
finding 6, in the branch that fix did not reach. `syncDeckIdentity` now asks
`deck_version_cards` whether a Champion row exists at all, which separates "no Champion" from
"Champion not currently resolvable".

`deleteVersion`'s fallback was `siblings[0]` — right answer, decided by nothing. It depended on
`listVersions` ordering by `version_number DESC`, in a different function. Now an explicit
highest-remaining pick. The parent is the other candidate and is worse: after a sibling fork the
parent may be v1 while v2 still exists, and deleting v3 should not drop the user two versions back.

### Verifying it on the device

`lockVersion()` has no caller until M4, so nothing in the app could reach the locked state and
**no fork had ever run outside the test suite** — and the suite runs against Node's `node:sqlite`,
not the driver that ships. Two temporary affordances close that, both `__DEV__`-only and both to be
removed with M4:

- **Versions tab → tap a version → "Simulate a match (lock)"** — sets `locked_at` by hand.
- **Profile → "Run version self-check"** — runs fork, sibling-fork, branch detection and the no-op
  guard against the real device database, on a throwaway deck it hard-deletes afterwards. It exists
  because the questions worth asking ("does `deck_versions` hold exactly two rows?", "is v1
  byte-identical?") cannot be answered from any screen, and there is no way to query SQLite from a
  phone.

---

## M4 — Matches

- [x] Drizzle schema for `matches`, `match_games`, `events` (migrations 6-9)
- [x] Log-match sheet: deck selector, WIN/LOSS, recent-opponent rail + full Legend picker
- [x] Simplified field set instead of an expander: on play/draw, opponent Legend and Chosen Champion, best-of, match style, note. Mulligans, BO3 detail and tags moved to M6 in-depth logging
- [x] Undo toast with live record readout
- [x] "Log another" for consecutive rounds (hold WIN or LOSS)
- [x] Match list, detail, and edit
- [x] Haptics throughout
- [x] **Call `lockVersion()` on the first match** — done inside `logMatch`, in the same transaction as the insert
- [x] **Remove the M3 scaffolding**: the `__DEV__` "Simulate a match (lock)" action, the Profile
      self-check (`src/features/decks/version-selfcheck.ts`), and the `[editor]` / `[compare]` logs

      ⚠️ **This tick was wrong for five milestones.** The self-check survived until the final gap
      sweep — 341 lines, still wired into Profile, still in the *production* bundle because the
      `__DEV__` guard hid the button while the top-level import kept the module in the graph. Its
      own comment said "TEMPORARY — remove with M4". Ticking a checklist is not evidence that the
      code is gone; searching the shipped bundle is
- [x] **Re-check `versionMatchCounts()`** against the real `matches` table — it currently returns an
      empty map by design, and every "No matches yet" in the timeline depends on that being right
- [x] ~~**Wire `match_games`**~~ — **rescoped out of M4.** The sheet was simplified to result,
      opponent Legend, their Chosen Champion, best-of, match style and a note; per-game detail moved
      to *In-depth match logging* in M6, which is now the table's documented owner. The audit item
      stands, only its deadline moved: if M6 ships without it, `match_games` is dead schema

      **Resolved.** M6's in-depth pass writes every column of `match_games` except
      `battlefields`, which the user dropped from scope — the per-game Battlefield each side
      *played* is already recorded in its own column, and what a deck *brought* is the deck's own
      Battlefield zone. That one column is dead schema, named here rather than left to be found

**Done when:** a stopwatch confirms **under 10 seconds** from tab bar to confirmation toast. If it's
slower, the flow gets redesigned before moving on.

---

## M5 — Analytics

M5 ships in two passes. The **matchup view** is done: who you played, how it went, and the matches
behind each row. The **statistical breakdown** — everything that needs an interval to be honest —
is the second tab and has not started.

- [x] **Matchup view** (`matchups.ts` + the Stats tab): grouped by the opposing Legend *and* its
      Chosen Champion, printings collapsed, ordered by most recently faced, expandable to the
      matches behind each row, with a per-deck filter
- [x] Counts as the headline, rates muted below `PROVISIONAL_THRESHOLD`, and opponent-less matches
      counted in the totals rather than silently dropped
- [x] `src/lib/analytics/` — win rate, Wilson CI, splits, streaks
- [x] Version comparison with an `inconclusive` verdict and `matchesNeeded`
- [x] Deck stats — record, per-version bars, and the match list on deck detail
- [x] Version comparison view — "Did it help?" inside the compare sheet
- [x] Matchup breakdown, by Legend + Chosen Champion
- [x] Win-rate bars with CI bands
- [x] Cross-deck Stats tab
- [x] Provisional styling below n = 20 applied everywhere
- [x] **Pool versions whose diff is `cardSetIdentical`** when computing per-version stats. This is
      not an optimisation — it is the promise that justified making an art swap fork a locked
      version in M3. Two versions holding the same 40 cards under different printings report one
      combined sample (`version-stats.ts`), so the decision cost nothing after all
- [ ] **Rolling win rate and sparklines** — deferred. Both are presentation, not evidence: a
      rolling series says nothing a record and an interval do not already say, and a sparkline on a
      deck card is decoration until there are enough matches for its shape to mean something.
      Neither appears in M5's "done when". Revisit once real usage shows deck lists long enough to
      need scanning by shape

**Done when:** no screen can display a win rate without its sample size and interval, and a
comparison of two small samples refuses to declare a winner.

*This completes the usable product. Everything below is expansion.*

---

## M6 — Extras

In priority order — each is independently shippable.

- [x] **In-depth match logging (2026-08-12)** — the opt-in second tier, at
      `/match/[id]/games`, reached from a logged match. Kept out of the log form exactly as
      planned: that flow has a ten-second budget and none of these answers even *exists* at the
      table — you know the score after the game, and nobody reconstructs an opening hand while an
      opponent waits to shuffle.

      | Field | Where it lands | How it is asked |
      | --- | --- | --- |
      | Opening deal and mulligans | `match_games.opening_hand` / `mulliganed` | A sheet over the deck version's own cards. One tap keeps, two sends back, three undoes |
      | Match score | `score_for` / `score_against` | Two 0–8 rows per game — Riftbound scores to 8 |
      | On the play / on the draw | `on_play` | **Already shipped** — restored to the log form when gap 13 closed, per game |

      **Battlefields brought vs. played was dropped, on the user's call.** The log form already
      asks which Battlefield each side *played*, per game, and "brought" is the deck's own
      Battlefield zone — the app can read it without asking. `match_games.battlefields` therefore
      stays unwritten; it is the only column of migration 10 with no consumer, and it is recorded
      here as such rather than left to be rediscovered.

      **The data layer was already finished, and that is the finding.** `match_games` had every
      column (migrations 10 and 16) and `src/lib/analytics/hands.ts` had four tested exported
      functions — `handCoverage`, `cardHandStats`, `performanceByMulliganCount`,
      `championTurnStats` — with **no consumer anywhere in the app**. Same shape as gaps 6 and 7:
      the query layer built ahead of the screens, passing its tests, reachable by nobody. What this
      milestone actually shipped is entry, readback and display.

      Worth recording:

      - **`saveMatchGames` replaces rows rather than patching them**, so any field the depth screen
        failed to hand back would be deleted by an edit that looks like it only *added* detail —
        turn order and both Battlefields, silently, with nothing on either screen to show it. That
        is now the first thing the test suite asserts about the pass
      - **Per-game detail was invisible on the match screen until now.** The log form has written
        game rows since M4 and nothing ever read them back, so turn order and both Battlefields
        were recorded and then unreachable. Match detail renders them as prose, and anything
        unrecorded is simply absent — four repetitions of "Not recorded" say only that the screen
        has fields
      - **The Chosen Champion is offered in the opening deal**, which `zone === 'main'` alone would
        have excluded. `DeckList` keeps it in its own zone; the rules put its copy in the Main Deck
        (103.2.b.1), which is why the 3-copy limit counts it. It can be dealt, so it can be
        recorded. The same zone/rules mismatch `lib/goldfish.ts` documents, resolved the other way
        here: goldfish must not *shuffle* a card the list does not say is in the deck, while a hand
        is a record of what was dealt and has to be able to name it
      - **Nothing is enforced.** Over 4 dealt or over 2 recycled turns the counter into a warning
        naming the rule it breaks, and still saves — the call the legality bar makes. A miscounted
        hand is a typo the user can see; a tap that silently does nothing is a bug they cannot
      - **A score that disagrees with the result is named, not corrected.** A game won with the
        opponent ahead on points is either a mis-tap or a concession and the app cannot tell which;
        rewriting it would replace a fact with a guess, and refusing to save would block a real
        outcome

      **Champion landing turn was removed the next day (migration 19).** It shipped as two 1–12
      rows per match and lasted about a day. The user's call, and the right one: a landing turn
      cannot say whether it was *early* or *late* without the board it landed on — turn 5 is on
      curve for a deck that ramps and behind for one that does not — so the average would have read
      as information without being any. The analytics side handled it as well as it could be
      handled, splitting at the deck's own median rather than at a fixed turn, which is the right
      treatment of a number that should not have been collected in the first place.

      Same call M6's goldfish made when it modelled Rune channelling faithfully and then deleted
      it: *with no opponent and no board, it produced numbers that looked like information and were
      not.* Two features now, removed for the same reason, and worth naming as a pattern — this
      app's failure mode is collecting a figure because it is easy to collect.

      **Dropped, not left as dead schema.** Both columns, plus `championTurnStats` and its four
      tests. `match_games` spent two milestones "shipped but unwritable" (gaps 11 and 12) and the
      lesson was that a column nothing writes and nothing reads is a cost every future reader pays.
      `matches.battlefields` stays the one exception and is labelled dead schema in `games.ts`
      where somebody will actually see it. Migration 19 has its own upgrade test: a game with two
      fully-populated matches driven v17 → latest, asserting every surviving value, that the drop
      shifted no column, and that it took no index with it

- [x] **Deck import/export** — built on `@piltoverarchive/riftbound-deck-codes` (Apache-2.0, zero deps,
      offline). `src/lib/deck-code.ts` owns the mapping rules; export shares and copies, import
      previews before writing. Sideboard supported both ways. Pasted *text* decklists via
      `/cards/name?fuzzy=` were dropped — the code covers sharing and needs no network
- [x] **Collection tracker — pass 1.** The Cards tab is now **Collection**: the gallery is still what
      opens, with a binder rail above it and a Gallery ⇄ Owned toggle. Binders are create / rename /
      recolour / delete (soft), and selecting one turns the grid into a filing surface — tap adds a
      copy, the minus removes one, long-press still opens the card.

      **There is no `collection` table and no owned-quantity column.** What you own of a card is
      `SUM(quantity)` across live binders (migration 12: `binders`, `binder_cards`). A flat count
      kept beside binder contents would be two numbers for one fact, and something would eventually
      have to decide which of them is right. It also matches the physical object — owning three
      copies *is* two in the trade binder and one in a deck box. `collection.test.ts` asserts the sum
      can never disagree with the rows behind it, including across a binder deletion.

      **Finishes (migration 13).** Standard and foil are separate rows, and a card is only offered
      the finishes it was printed in. The blocker worth recording: **the card API carries no finish
      data** — confirmed against the live endpoint, not just the mirror — so the rule cannot be
      derived and lives in `src/lib/finishes.ts` as stated game knowledge (Legends, Showcase,
      Signature, and alt-art/overnumbered are foil-only; 380 of 1,451 cards). `resolveFinish()` runs
      in the write path as well as the UI, so nothing can file a standard Legend.

      Deferred to pass 2: **"missing cards" in the builder** — `ownedCounts()` exists and is tested,
      and nothing outside the Collection tab calls it yet

      **Post-build audit.** Five exports created and deleted in the same pass for having no consumer
      (`hydrateBinderCard`, `binderCardColumns`, `getBinder`, `collectionSummary`, and
      `setCardQuantity`, now module-private). Two real findings:

      | # | Finding | Fix |
      | --- | --- | --- |
      | 1 | **`binderCards()` was 88% of a tap.** It joined `cards` and hydrated ~29 columns per row to produce an id → quantity map. Measured at a full-library binder: **85 ms** per tap, and superlinear — 4× the rows for 18× the time | Split into `binderQuantities()` (two columns, no join) and `missingFromLibrary()`. **10.7 ms**, linear |
      | 2 | **Cards whose printing had left the library were invisible in their own binder.** The data layer preserved them by name, the grid renders from `cards`, so a binder read "61 copies" above 59 tiles | Named on screen with quantities. Same class as gap 8 |

      Eight adversarial probes in `collection-audit.test.ts` — upserting into a soft-deleted binder,
      driving quantity negative, a 100,000-copy count, and the `ON DELETE CASCADE` that
      `deleteBinder` can never reach. All held.

      Scaling (`collection-scaling.test.ts`, 4 binders, Node in-memory SQLite):

      | Rows | Reload after a tap | Size |
      | --- | --- | --- |
      | 500 | 1.0 ms | 0.52 MB |
      | 2,000 | 2.7 ms | 1.42 MB |
      | 8,000 | 10.7 ms | 4.88 MB |

      8,000 is past what is physically reachable — the library holds 1,451 distinct cards, so no
      binder can exceed that many rows. The realistic worst case sits nearer the 2,000-row line
- [x] **Collection tracker — pass 2.** Deck overview carries an **`44/59` in your collection** count
      with the cards it is short of. Copies are **allocated across decks**, because physical cards
      are: three copies cannot be sleeved in two decks at once, so a deck reports what is left after
      older decks have taken theirs (`src/db/queries/coverage.ts`). Rules settled with the user:
      a foil satisfies a slot, a different printing satisfies a slot (matched on `cardKey()`, the
      same printing-collapsed identity the 3-copy limit uses), archived decks return their copies to
      the pool, and **nothing is ever blocked** — a deck you own none of still saves, logs and
      tracks, because playing online is a good reason to have one.

      | Finding | |
      | --- | --- |
      | **`binder_cards.card_name` stored the wrong name.** Migration 12 wrote the API's normalised search string (`Vi Piltover Enforcer Signature`) where every other table stores the display name (`Vi - Piltover Enforcer (Signature)`). Ownership could never have matched a deck — `cardKey()` derives identity from the display form — and the missing-from-library banner had been rendering the wrong form since it shipped | Fixed at the write; **migration 14** repairs existing rows from the mirror, leaving unresolvable ones alone |
      | **Allocation order was non-deterministic.** `created_at` is millisecond resolution, so two decks made in quick succession tie, and the tie-break fell to a random uuid — making the numbers a user reads arbitrary | Tie-break on `rowid`, which is insertion order and cannot tie |

      Measured: `deckCoverage` is linear in **deck count**, not version count — 0.4 ms at 5 decks,
      1.1 ms at 20, 2.5 ms at 50. Deck detail's whole focus cost went 32 → 38 ms at 200 versions.

      Still open from pass 2's original scope: **per-tile "own N" badges in the builder**. Left out
      deliberately — a tile shows a card, and coverage is a deck-level allocation, so the two want
      different numbers and that deserves its own decision
- [x] **Goldfish** — `/goldfish/[versionId]`, reached from deck overview. `src/lib/goldfish.ts` is
      pure, seeded and separately tested (10 probes). **Deal 4, recycle up to 2, then draw** — the
      two rules kept are from the official Core Rules: a 4-card opening hand, and one mulligan
      recycling up to 2 to the *bottom* of the main deck.

      **Turn structure and Rune channelling were built and then removed.** Both were modelled
      faithfully — 2 Runes a turn, 3 on turn 1 when on the draw — and both were scaffolding: with no
      opponent, no board and nothing to spend Runes on, they produced numbers that looked like
      information and were not. What is left is the question the feature exists for, which is whether
      the opening cards work together.

      Two decisions worth knowing. Recycled cards go to the **bottom, not out** — a simulator that
      discarded them would quietly make every deck look more consistent than it is. And the seed is
      the hand: any opener can be re-drawn by its number, which is what lets a test pin one. The
      *first* seed is random, though — fixing it meant every visit opened on the identical hand.

      **The Champion is deliberately not in the shuffled deck.** It occupies a main-deck slot in the
      rules but lives in its own zone in `DeckList`, so including it would shuffle a card the list
      does not say is there. Excluding it leaves the deck one short. Both are wrong; this is the
      wrong that does not change the odds of everything else. Worth revisiting if the data model
      ever folds the Champion into `main`
- [x] **Event mode.** `src/db/queries/events.ts`, an Events segment on Stats, `/event/[id]`, and an
      optional event picker in step 1 of the log flow. **This closes gap 11** — `events` and
      `matches.event_id` had shipped since migration 6 with nothing able to write either.

      The distinction the feature rests on: `matches.event_type` is a *category* ("a Nexus
      Night"); an event is the *instance* ("the Nexus Night on the 9th"), and carries the one fact
      a tournament produces that no individual round contains — where you placed.

      Decisions worth keeping:

      - **Only organised styles are offered an event.** `casual`, `online` and `testing` are things
        you do, not places you go, so the fast path stays exactly as long as it was
      - **Deleting an event leaves every match untouched.** The rounds were played; detaching them
        would rewrite history to tidy a label. The link survives on the tombstone, as a deleted
        binder keeps its cards, and reads filter on `events.deleted_at IS NULL`
      - **An event reads forwards**, round 1 first — a match list is a history you scan backwards,
        an event is a day you replay
      - **"Log another" keeps the event**, because you are still at it

      **Match style and event style split (migration 15).** The original list of seven mixed two
      questions: Skirmish, Nexus Night and Locals are not alternatives to Tournament, they *are*
      tournaments. Kept as siblings, "how do I do in tournaments" could not be answered without
      knowing which three of the seven counted.

      - **Match style** (`matches.event_type`): Casual · Online · Tournament · Testing
      - **Event style** (`events.event_type`): Nexus Night · Skirmish · Locals · Regional
        Qualifier · Regional Final
      - **A Tournament match must name an event.** The only place the app stops short of saving,
        and narrowly: the style says an organised event happened, so there is one to name. One tap
        to a different style clears it, which is why it is a missing answer rather than a judgement

      **The migration loses the finer label on existing matches, knowingly.** A match logged as
      `nexus-night` becomes `tournament`; the tier now lives on an event, and no event exists for a
      match logged before events did. The alternative was inventing one event per style spanning
      months of unrelated nights, producing a record for a day that never happened. Losing a label
      beats fabricating an occasion.

      **Events are not rewritten.** Any created before the split keep whatever style they hold, and
      `eventStyleLabel` renders an unrecognised value rather than blanking it. Only the picker is
      narrowed — nothing new is written outside the vocabulary, nothing old is rewritten to fit it.

      Cross-feature probe worth recording: deleting a *deck* soft-deletes its matches (an earlier
      audit fix), and an event holding those rounds now agrees — otherwise the same matches would
      be gone from one screen and present on another

Import lands first: it's the fastest path from install to a user who has something to track.

### The two decisions the analytics rest on

Both are load-bearing, both are invisible on screen, and both would produce plausible wrong numbers
if taken the other way.

**What the two hand arrays mean.** Riftbound deals 4 and recycles up to 2 to the bottom — the rule
`lib/goldfish.ts` already simulates. So `mulliganed` is the cards out of *that opening 4* that went
back, and `openingHand` is the ones that stayed. The two together are the deal, which makes
`seen = kept + mulliganed` count each card once per game it was genuinely offered.

The tempting alternative — `openingHand` as the final hand you played with — is wrong in a way that
only shows up in the ratios: the replacement cards drawn after a mulligan would be counted as
"kept", inflating the denominator of every card that happens to replace a thrown one. A card you
drew *because* of a mulligan was never part of the keep decision. The doc comment in `hands.ts` said
"the opening seven" before this milestone, which is Magic's number, not Riftbound's — a stale
assumption inherited from nowhere in this codebase.

**Names come from the deck version, not the card mirror.** `match_games.opening_hand` stores card
ids alone, which would normally be the migration-5 mistake again: an id stops rendering the moment
its printing leaves the mirror, and a match is a permanent record. It is safe only because an
opening hand is always drawn from one deck version, and `deck_version_cards.card_name` has carried
that name since migration 5 for exactly this reason. `versionCardNames()` reads it **without
joining `cards`**, unlike `loadDeckList`, and has a test that deletes a printing and asserts the
hand still names it. Storing a fourth copy of the name on the game row was the alternative.

### What the analytics now show

Four sections that previously rendered as "not captured yet", plus one correction:

| Section | Reads |
| --- | --- |
| Opening hands and mulligans | `performanceByMulliganCount` — 0, 1 or 2 cards back, each with its own interval, and a caption saying plainly that the mulligan is the response to a bad hand and not its cause |
| Cards you throw back | `cardHandStats`, capped at six and hiding anything seen fewer than three times — one mulligan of a card drawn once tops any list at 100 % and buries the real problem |
| How close the games were | `scoreStats`, new. Close (≤ 2 points) versus the rest, plus mean conceded in wins and mean scored in losses — read from opposite sides of the result on purpose, since pooling them folds in the 8 the winner scores by definition and measures how often you lose rather than how close it was. Draws are excluded from both: a margin of zero says nothing about a game nobody won |
| *Going first or second* | Its empty state claimed turn order was "part of the in-depth logging still to come". It has been on the log form since gap 13 closed, so it was blaming a missing feature for an unanswered question and telling the user to wait for something they already had |

`AnalyticsPanel` takes matches and games as **separate props**. The first four sections are
per-match and the last four per-game, and a Bo3 is one match and up to three games — pooling them
would weight long matches higher in precisely the breakdowns whose point is a trustworthy n.

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

## Hi-Fi design — foundation landed (2026-08-09)

From `Riftbound Hi-Fi.dc.html` in the Claude Design project, read through the DesignSync MCP.
The **visual foundation** is implemented; the **screen layouts are not**.

### Done

| Layer | Change |
| --- | --- |
| Palette | Charcoal base `#141416` / `#1B1B1E` / `#232326`, hairlines at 8% white, text ramp `#F5F5F6 → #C9C9CD → #9C9CA1 → #67676B`, win/loss/draw `#46C77E` / `#C7433D` / `#86868A`, warning `#D9932E` |
| Accent | A single coral `#FF4B4B` with `onAccent` `#1A0605`, applied to primary buttons, the active tab, current selection, and the log button — **and nothing else**, which is what the design asks for |
| Type | Space Grotesk throughout the UI; **JetBrains Mono** for numbers and metadata. Inter removed from the tree entirely |
| Radii | Cards 14, pills 22, tags 4, bars 2 — `radius.pill` and `radius.bar` are new tokens so a chip and a circle stop sharing one |
| Domains | The design set (`Fury #C25B4A`, `Calm #4C86B0`, `Mind #8A6FD1`, `Body #5DA37A`, `Chaos #B15CA0`, `Order #B69A4C`), with `bright`/`dim` **derived** so a corrected base cannot leave a stale tint behind it |

Two documented decisions were deliberately overridden and are worth knowing:

- The domain colours were **sampled from Riot’s Basic Rune card art** in M0 and re-derived in
  OKLCH. The design replaces them with a desaturated set built to sit on charcoal. Fidelity to the
  print colour loses to legibility on the surface they actually appear on.
- Body text was **Inter**, chosen in M0 because it holds up at 12–13px in a dense list. The design
  specifies one UI face. Worth looking at the deck and card lists on a device before calling it
  settled.

### Screens rebuilt

| Screen | Now |
| --- | --- |
| Deck list | 104px cards with the Legend art bleeding in from the left across a long fade. Art is joined in `listDecks` — a lookup inside the card component would be one query per frame per deck |
| Deck detail | A 206px hero with the art running under the status bar, translucent Back / Share / Edit, a chip row, and four tabs — **Overview · Versions · Matches · Stats**. The decklist moved into Overview behind a **List / Gallery** toggle; legality leads with a sentence rather than a bar |
| Match log | *(Updated 2026-08-11 by the design handoff — see below.)* The matchup as two mirrored cards with a VS rule, mono section labels, 52px select fields, and **Continue → review sheet → Finalize**. Nothing saves on the result tap any more. Logging is **per game**: a card per game asking turn order, both Battlefields and who won, revealed one at a time and withdrawn once the match is settled — a Bo3 at 2–0 never shows a third. The match result is **derived, never asked** (`lib/match-progress`), and game 1's answers mirror onto the match columns so the existing splits keep working |

### Match log — the design handoff (2026-08-11)

Read through the DesignSync MCP from the same project: the `1_Current ML` screen, which the design
built as a **pixel-for-pixel recreation of `app/match/new.tsx`**, plus the three changes in
`design_handoff_match_log_form/README.md` applied on top. The recreation is what makes the handoff
legible — the delta is the deliverable, and everything else is confirmation that what shipped was
right.

| Change | Was | Now |
| --- | --- | --- |
| **Event** | A rail of chips over existing events plus a `+` that opened a naming sheet with a tier picker | One free-text field. Typing a name creates the tournament; typing it again next round joins the same one (`eventForName`) |
| **Best of** | `—` · Bo1 · Bo3 · Bo5 | Bo1 · Bo3, defaulting to Bo1, never unset |
| **Legend** | A quick-select rail of recently-faced Legends above the field | The field alone |

**The event field is the change with consequences, and two of them reverse earlier decisions.**

- **A tournament round no longer refuses to save.** M6 made naming an event the one place the app
  stopped short of saving, on the reasoning that "Tournament" asserts an organised event exists. The
  design marks the field *optional*, and it is right: the match certainly happened, and which
  tournament it belonged to is a detail about it rather than a precondition for it.
- **An event created this way has no tier** — `events.event_type` is nullable as of **migration 17**,
  which rebuilds the table because SQLite cannot drop NOT NULL in place. The alternative was
  defaulting, which would stamp every free-text event a Nexus Night: the same fabrication migration
  15 refused when it chose to lose a label rather than invent an occasion, except applied silently to
  every row. The tier is still real and still settable — on the event screen, where somebody is being
  asked rather than assumed at.

  The rebuild is the first migration that DROPs a table holding user data, so it gets a test that
  loads a tournament, its tier, a soft-deleted sibling and **two rounds pointing at it**, then
  asserts every one survives. `matches.event_id` deliberately carries no foreign key, which is what
  makes the drop safe — asserted rather than reasoned about, because "there is no FK" stays true only
  until a migration adds one.

**Deleted, not hidden.** `recentOpponents()` went with the rail: correct, tested, and with no
consumer left, which is precisely what gap 15 named. The shipped Hermes bundle was searched for the
symbol afterwards — absent — because a checklist tick is not evidence that code is gone.

**Narrowed, never rewritten.** `BEST_OF_OPTIONS` is `[1, 3]` and `LOGGED_MATCH_STYLES` drops
`testing`, but `matches.best_of` stays nullable and `MATCH_STYLES` keeps all four: rows already
holding `5` or `testing` are true records of what was entered. The **match detail** screen therefore
offers the narrowed list *plus whatever that match already holds* (`withCurrent`), so opening an old
Bo5 does not present a control with nothing selected — which reads as unanswered and invites
correcting a fact that was never wrong. It also keeps `—`, because that screen's job is to correct
the record and "I do not actually know" is a correction someone is entitled to make.

Fidelity fixes found by reading the design's declarations against the code rather than by eye:

| | |
| --- | --- |
| `SectionLabel` carried `paddingBottom: space[2]` **and** every caller wrapped it in a container with `gap: space[2]` | 16px where the design draws 8–10, on **every** screen using one. The gap belongs to the caller; the label now only asks for air above it |
| `SheetRow` values were left-aligned | The design right-aligns them against a fixed-width label column. A read-back is scanned down its values |
| The screen used `Screen`'s 30px display title | The design gives a presented sheet a 20px title on a tight header — the difference between having navigated somewhere and having opened something. `Screen` grew a `compact` prop |
| `#ADADB2` and `#5A5A5D` were being rendered as `textSecondary` and `textFaint` | Both are their own values in the design (19 and 10 uses). An unselected segment sat at the same weight as the selected one's neighbour; helper copy sat at the same value as the label above it. Added as `textDim` and `textHint` |

**Device report: "the user's Battlefield is missing from the match log."** It was not missing — it
was unreadable. The field renders only when the deck has Battlefields, and the empty case said
*"This deck has no Battlefields yet"* in `microMeta` at `textFaint`: 9.5px, uppercase, and a value
`palette.js` documents as below AA and **never to carry information**. Sitting directly under a
section label in the identical style, two lines of micro-caps read as one label with no control
under it — indistinguishable from a field that had been deleted.

The chain behind the field was proven before touching anything, because "it renders the empty state"
and "the query broke" look the same from the screen: a new probe in `editor-flow.test.ts` drives
`listDecks() → currentVersionId → loadDeckList → battlefield slots` against the real library, then
locks the version, swaps a Battlefield, forks, and asserts the deck follows the fork. It passed
unchanged. The defect was only the empty state, which now reads at body size in sentence case and
says what to do about it. `match/[id].tsx`'s footnote had the same mistake — two sentences of prose
set as a label — and was fixed with it.

**Stated deviations.** Segmented-control labels are one size (13px) where the design uses four
between 11.5 and 14 for the same control with no rule given — raised rather than guessed at. And
metadata stays `•`-separated where the design uses `·`: the app's separator is the one printed along
the foot of a real Riftbound card, which is where the idiom came from.

**Collection**, split in two, because browsing 1,451 cards and reviewing a collection are different
activities that only happened to share a grid — and sharing it meant the collection had no summary
at all, just a filter over the library:

| Screen | Now |
| --- | --- |
| Collection (tab) | Copies held and `N of 1,451 cards`, set-completion bars (distinct cards, promo sets collapsed to one line, top three with the rest behind an expander), then the binder list — Gallery bordered with a `DEFAULT` tag, your binders plain |
| Binder / Gallery | `/binder/gallery` is the library, every other id a binder. Search, `Set · All` and `Sort · Name` fields that expand in place, six domain chips, then the grid. Copies are a badge in the tile's corner; foils are the design's animated `foilSweep` on the art. Tapping a card opens the standard/foil split, which is the only place the two are told apart. Unowned cards are **not** dimmed — the gallery is a reference you skim |

### The shared vocabulary

This is why a recolour alone left every screen still looking like the old app:
the design is assembled from shapes the app did not have. They exist once now,
and the remaining screens are assembly rather than invention.

- `ui/Field.tsx` — `SectionLabel`, `SelectField` (52px, translucent, opens **in
  place** rather than as a modal), `OptionRow`, `ChoiceRow`
- `ui/Sheet.tsx` — bottom sheet with grabber, title, subtitle and pinned
  actions, plus `SheetRow` for read-back lines
- `matches/MatchupCard.tsx` — one side of a matchup, mirrored for the opponent

### Screen layouts — three of four closed

> **Re-checked against the code 2026-08-13.** This table listed four screens as "not done" while the
> *Screens rebuilt* section above described three of them as shipped. The code settles it: they are
> built, and this table had simply never been ticked. Left visible rather than deleted, because a
> checklist that disagrees with the app is how the M4 self-check survived five milestones.

| Screen | What the design adds | State |
| --- | --- | --- |
| Deck detail | Legend art in the header. A **Stats** tab. A **List / Gallery** toggle. Version actions as buttons rather than an `Alert` action sheet | ✅ Hero, `TABS` including `stats`, the `Preview` toggle, and `VersionNodeDetail`'s inline buttons all present |
| Deck legality | A sentence, not a bar: *"Not legal — Main deck 38/39 · One card short."* | ✅ `LegalityCard` in the editor. Deck detail deliberately shows the design's **chip row** instead — a different surface of the same design, not an omission |
| Deck editor | A custom *Discard and continue / Stay here* sheet where the app uses `Alert` | ✅ `Prompt`. Both dialogs were converted; the header comment records why `Alert` could not carry three options on Android |
| Analytics | "Findings first, then one breakdown at a time" — a different structure from the old `AnalyticsPanel` | ✅ **Built 2026-08-13/14** to `1_ANALYTIC02`, the newer of the two Analytics designs in the file. Anchor · findings · scoped drawer, in all four drawn states. The Events-tab blocker below went with it — the new handoff draws three tabs |

The remaining deviations are in [Deviations from the Hi-Fi design](#deviations-from-the-hi-fi-design-parked-rather-than-fixed),
both parked with reasons.

### Design gaps to resolve

- ~~The design predates **event mode**: its Stats screen has *Match history · Analytics*, with no
  Events tab.~~ **Closed 2026-08-13.** The `1_ANALYTIC02` handoff draws *Games · Analytics · Events*,
  matching what M6 shipped. This was the blocker on the Analytics rebuild.
- No spec for the **collection coverage counter** on deck overview (`44/59 in your collection`),
  which also postdates it.
- Progress fills (`progressFill`, `progressSegmentDone`) were left white: the design does not say
  whether progress counts as "current state" and so earns the accent.

## Advanced logging, and the hand as cards (2026-08-12)

From a new section in the Hi-Fi design: **`1_ML_Advance` · advanced logging mode — mulligan /
opening-hand tracking + score.** It answers a tension the app has carried since M4 rather than
picking a side of it.

**A `LOGGING MODE` toggle at the head of the log form.** Simplified is the default and is exactly
the form that shipped; Advanced adds the opening hand, the mulligan and a per-match score inside
each match card. The ten-second budget was never a claim that nobody wants the detail — it was a
claim that the detail cannot be *mandatory*. A mode makes the trade explicit and per-game, and it
is retained across "log another", so switching to Advanced for a tournament holds for the rounds
that follow.

This supersedes the M6 reasoning that per-match detail belongs only in a pass over a game already
logged. Both entry points now exist and both write the same rows through the same control:

| Where | For |
| --- | --- |
| Log form, Advanced mode | Recording while the game is in front of you |
| `/game/[id]/matches` | Filling in a game logged in Simplified mode, or correcting the table entry |

### The hand is drawn as cards

The design draws each slot as a 60px name-only tile. **They carry art here**, which is the change
the user asked for and a stated deviation: every other place this app shows a card — the gallery,
the binder grid, the Legend and Battlefield pickers — shows the printing, and an opening hand
rendered as four lines of 10px text would be the one surface asking you to recognise your own deck
from a list of names. You recognise a card by its art long before you finish reading its name, and
an opening hand is precisely a recognition task. The cost is height: 78px of width at the printed
0.716 ratio is 109px of art against the design's flat 60. Four still fit across a 390pt screen.

`CardSlot` goes through the same `cardImage` / `isLandscapeCard` / `uprightArt` helpers as
`CardPickerSheet` and `CardGridItem`, so a Battlefield stands upright here for the same reason it
does there. A mulliganed slot keeps its art under a dimming wash rather than swapping to a card
back — the card that went back is still the card you were dealt, and hiding it would lose the one
thing the row records.

### What the columns mean now, and why it changed

| Column | Was | Is |
| --- | --- | --- |
| `opening_hand` | The cards **kept** out of the deal | **All four dealt** |
| `mulliganed` | The cards sent back — *disjoint* from the above | The subset of `opening_hand` that went back |
| `replacements` | — | What was drawn in their place (**migration 20**) |

The design's two rows force this and are right to: the four dealt cards are one observation, and
splitting them across two columns meant neither could be rendered as the hand it was.

**The arithmetic had to move with it.** `seen = kept + mulliganed` was correct while the two were
disjoint and is double-counting now — a card thrown back every single time would be seen twice per
match and report a **50 % mulligan rate**, a plausible-looking number for the most obviously wrong
card in the deck. `cardHandStats` makes one pass over the deal instead, and there is a test named
for exactly that failure.

`replacements` earns its own column rather than being appended to the hand: a card drawn *because*
of a mulligan was never part of the keep decision, and folding it in would inflate the denominator
of every card that happens to replace a thrown one. Same reasoning that separated the two arrays in
the first place.

### Rules the control enforces

- **A mulligan is chosen from the hand, never from the deck.** Offering the whole pool would let
  someone record sending back a card they were never dealt, and the two rows would stop describing
  the same hand.
- **Clearing a dealt slot clears any mulligan pointing at it.** The mulligan row stores *indexes*
  into the deal, so a slot emptied underneath one would leave it pointing at nothing — blank on
  screen while still counting as a card sent back.
- **Choosing the card already in a slot corrects it**, the design's own words and the app's re-tap
  idiom. Choosing a card already sent back from the other slot *moves* it rather than recording it
  twice.
- **A replacement survives only while there is a card for it to have replaced**, and its slot does
  not open until something has gone back.
- **Over two recycled is named, not blocked** — the counter turns to a warning and the entry saves.
  The legality bar's call.
- **Changing deck clears every drafted hand.** Keeping them would record a hand of cards the deck
  being saved has never contained.

`HandPicker` — the text-list hand editor built the day before — is deleted. It was the same feature
without the previews, and two hand editors would be two places for these rules to drift.

### A row at a time, not a slot at a time

The first cut opened the full-screen picker once **per slot**, so recording a hand was four trips
through a modal. `CardPickerSheet` grew a `multi` mode: tapping any slot in a row opens that row's
picker seeded with what is already chosen, and one visit fills the row. Up to 4 for the opening
hand, up to 2 each for the mulligan and the replacements.

**It counts copies rather than holding a set**, and that is the load-bearing part. A four-card hand
can contain two copies of the same card, and a plain toggle could not record it — the one hand a
player is most likely to remember would be the one the app refused to take. Tapping a tile adds a
copy and shows a count badge; tapping once past its cap returns it to none, so a tile at the limit
still clears rather than going inert.

Two caps bind, whichever is smaller: the total for the row, and the card's own. The mulligan's
per-card cap is **how many copies of it were dealt**, so you cannot send back two of a card you were
dealt once.

The counts-to-hand conversion lives in `OpeningHand` beside the value type, not in either screen —
`applyDealt`, `applyMulligan`, `applyReplacements`. Replacing a deal **re-derives** the mulligan by
card rather than carrying the old indexes across, which would leave them pointing at whatever now
sits in those positions and silently mark a card the user never sent back.

### Score is a dropdown, not a chip row

Caught by the user against the design and corrected. `1_ML_Advance` draws the score as **two equal
columns, each a 46px field with a `⌄` chevron** — You and Them side by side, opening in place. It
shipped as two rows of 0–8 chips, which is a different control: eighteen targets in the middle of a
form, for a question with one answer per side.

`ScoreRow` is the design's version, built on the same `SelectField` / `OptionRow` pair every other
field on the screen uses, with one open at a time so two lists of numbers never stack. The little
"You" / "Them" labels are sentence case at `textMuted` per the design, not the mono uppercase
`fieldLabel` used elsewhere on the card — they name a column inside a field, not a section.

**`NumberRow` is deleted.** Built for the Champion landing turn, inherited by the score, and
outlived by both — the turn went with migration 19 and the score is now a dropdown. An exported
component with no consumer is exactly what gap 15 named.

**And it sits after the Battlefields, not before them.** Also caught by the user. The advanced
blocks went in as a single slot ahead of the Battlefield fields, which put the score before you had
said where the match was played. `MatchCard` takes **two** slots now, and the card reads in the
order the match happened — the design's own:

```
who went first → opening hand → mulligan → your BF → their BF → score → who won
```

Both of these were caught by eye against the design after I had already called the feature landed,
which is the failure the roadmap's own rule is about: a screenshot is evidence, and my reading of a
spec I implemented from is not.

### The mulligan row reads as a before and an after

The design marks only the two cards that went back — accent border, `MULL` badge — and leaves a
filled replacement plain, drawing just its empty dashed state. A deliberate addition: the
replacements get the mirror treatment in the win green with a **`DRAW`** badge, so the strip of four
says which half is which without counting slots.

Three details make it a mirror rather than a second colour:

- **The dimming wash stays on the mulliganed card only.** What went away is dimmed; what arrived is
  at full strength. The row is a before and an after and should not read at one weight.
- **Both badges carry a word.** Red against green is the one pairing this app has banned since M1 —
  it is the most common form of colour blindness — so `MULL` and `DRAW` have to survive in
  greyscale, the same rule as the W/L/D letters on a result badge.
- **`#7BDBA6` is `win` lifted by the same amount `#FF8080` lifts `accent`**, so the two badges read
  as one idiom rather than two colours that happen to sit near each other.

One note for whoever meets it next: `deckPool` on the log form is deliberately **not** wrapped in
`useMemo`. The React Compiler could not preserve a manual memo there and responded by skipping
optimization of the entire 900-line component — a far worse trade than the memo was buying. Left
plain, the compiler memoizes it along with everything else.

## The vocabulary inversion (2026-08-12)

The two central nouns were the wrong way round, and had been since M4.

| Term | Was | Is |
| --- | --- | --- |
| The encounter — Bo1 or Bo3 | `matches` / "match" | **`games` / "game"** |
| One play inside it, scored to 8 | `match_games` / "game" | **`matches` / "match"** |
| Casual · Online · Tournament | `matches.event_type` / "match style" | **`games.game_style` / "game style"** |
| The named occasion and its tier | `events` / `events.event_type` | **unchanged** |

**I argued against this and was wrong to lean on the evidence I had.** The case for keeping the old
arrangement was the standard TCG convention, the Riftbound scoring rule (you score to 8 to win a
*game*), and the Hi-Fi design, which labels the per-play card "Game 1" and its history list "Match
history". That reading was reasonable and the user's call overrode it — it is their vocabulary, and
consistency with how they and their playgroup speak is worth more than consistency with Magic.

What the check *did* turn up is that this file and `components/matches/GameCard.tsx` both claimed
*"the design titles these Match 1 / Match 2"* and logged it as a deliberate deviation. **That was
false.** The design source contains "Game 1" twice and no "Match N" anywhere. The note was written
from memory in an earlier session and never verified. The deviation is real but runs the other way,
and it is now recorded that way in `MatchCard.tsx`.

### Migration 18

Pure renames — no table rebuilt, no row copied, no index lost. SQLite's `ALTER TABLE RENAME`
rewrites the schema entry in place and carries the data, the indexes and the row ids with it, so
this cannot lose a game, a match or an event however long the history is.

```
matches      → games          (games_won → matches_won, games_lost → matches_lost,
                               event_type → game_style)
match_games  → matches        (match_id → game_id, game_number → match_number)
```

Order is load-bearing twice: `matches` has to vacate its name before `match_games` can take it, and
the eight old indexes are dropped first so no index name is left held by a table it no longer
describes.

**`event_type` on the games table became `game_style`, and that is the rename worth the most.** It
never meant the event's tier — it held Casual / Online / Tournament — while `events.event_type`
genuinely does. One column name meaning two different things across two tables is precisely how M6's
careful split between the two vocabularies was going to be undone by accident.

### What the audit turned up

Four findings, all from running the suite rather than from reading:

| # | Finding | |
| --- | --- | --- |
| 1 | **Migration tests were writing current-schema names into historical databases.** The v14→v15 tests insert into `matches` and read `event_type` — correct at v15, and a blanket rename had quietly pointed them at `games`, which does not exist for another three migrations. A migration test that uses today's names stops testing the migration | Reverted, with the reason stated inline |
| 2 | **A migration test called a query function.** `events.test.ts` asserted through `getEvent()` against a v15 database; `getEvent` joins `games`. That test was really exercising two schemas at once and broke the moment either moved. Now reads the row with SQL | Fixed, and it is a better test for it |
| 3 | **`AnalyticsPanel`'s two props ended up named the exact inverse of what they hold** — `matches: GameRow[]` beside `games: MatchRow[]`. Typechecked perfectly, since both are just arrays of rows | Swapped |
| 4 | **The v16→v17 migration test now covers 18 as well.** It calls `migrate()`, which runs everything outstanding, so its rounds get renamed out from under it. Reading them back from `games` asserts that 17 does not drop them *and* that 18 carries every one across | Kept, deliberately |

The route tree moved with the vocabulary: `/match/new` → `/game/new`, `/match/[id]` →
`/game/[id]`, and the in-depth screen `/match/[id]/games` → `/game/[id]/matches`. Directories
followed — `src/components/matches/` → `src/components/games/`, `src/features/matches/` →
`src/features/games/`, `lib/match-progress.ts` → `lib/game-progress.ts`.

**Migrations 1–17 keep the old table names, and must.** They describe the databases they actually
ran against; rewriting them would make them stop applying to any device that has not reached 18.

## Post-M6 audit (2026-08-13)

Ran before starting M7, over the whole tree rather than the last change. Method: an exported-symbol
scan counting references across every other file, a column scan over the Drizzle schema against
production code, and a new **schema-versus-migrations** test.

### The schema and the migrations agree — now provably

`src/db/schema-audit.test.ts` builds a database from all 20 migrations and compares
`PRAGMA table_info` against `getTableColumns()` for all 11 tables, in **both directions**, plus
NOT NULL. 33 assertions, all passing.

Nothing had ever forced those two to agree. `hydrate.ts` derives its column map from the *schema*
while a device's actual columns come from the *migrations*, so a column declared in one and not the
other hydrates as `undefined` with no error anywhere — the M1 bug that blanked every card in the
gallery, where 12 of 29 fields came back undefined including `imageUrl`. The test is cheap and
parameterised, so a twelfth table is covered by adding one line.

### Removed

| | Why |
| --- | --- |
| `components/cards/CardGridItem.tsx` (264 lines) | Nothing imported it. `CardGrid` renders its own tiles; this was superseded during the Hi-Fi rebuild and left behind |
| `components/collection/BinderRail.tsx` (135 lines) | Nothing imported it. The rail was the pre-split Collection design — the tab uses `BinderRow`, the binder screen `BinderTile` |
| `__resetCardSync()` | **Was in the production bundle.** A test seam no test has ever called, exported at top level so Metro kept it. The gap-21 shape exactly |

Both components were absent from the bundle already — Metro drops unimported files — so the only
cost was maintenance. `__resetCardSync` was not.

### Found, not acted on — these need a decision

**1. Binder rename and delete are unreachable.** ✅ *Closed — see below.* `renameBinder()` and `deleteBinder()` exist, are
tested, and **no screen imports them**. The collection screens import only `createBinder`,
`listBinders`, `ownedCounts`, `setCompletion`, `collapsePromotional` — and `adjustCardQuantity`,
`binderQuantities`, `missingFromLibrary`, `ownedFinishes` on the binder screen. This file claims
*"Binders are create / rename / recolour / delete (soft)"*, and that is **false**: a binder created
by mistake cannot be renamed or removed. Same class as gaps 6 and 7 — the query layer built ahead
of the screens — and it is a functional gap, not dead code, so the fix is to wire it up.

**2. Four columns on `games` that nothing ever writes**, all M4-era:

| Column | Note |
| --- | --- |
| `mulligans` | Superseded by `matches.mulliganed`, which holds the actual cards |
| `duration_seconds` | No screen has ever asked for it |
| `tags` | Never written on a game (`cards.tags` is a different thing) |
| `opp_label` | Never written — **but `GameRow.tsx` and `summary.ts` read it**, so there is a live fallback path for data nothing can produce |

`opp_label` is the interesting one: the "Unknown opponent" branch it feeds can never fire.

**3. The `sets` table is written on every sync and never read.** `listSets()` was deleted at some
point; `hydrateSet()` and `setColumns` are its orphaned hydrator, now referenced only by their own
test. `setCompletion()` computes set progress from `cards`, so `sets` is genuinely redundant rather
than merely unread. `sets.api_version` and `sync_meta.api_version` are declared and never touched at
all.

**4. `matches.battlefields`** stays dead by design and is labelled as such in `games.ts`.
✅ *Closed by migration 22 — see below. The label was also wrong: it was not inert.*

### The write-only schema, dropped (2026-08-13) — migration 22

All eight items above resolved in one pass, on the owner's call, **before** M7 rather than after.
That timing is the whole point: a column that reaches Supabase acquires a table, an RLS policy and
a sync engine, after which removing it costs a migration on two databases plus a client that
tolerates both. This was the last cheap moment.

| Dropped | Was |
| --- | --- |
| `games.opp_label` | Free text for an opponent outside the library. **Two live readers, no writer** |
| `games.mulligans` | A count, superseded by `matches.mulliganed` holding the actual cards |
| `games.duration_seconds` | Declared in M4; no screen ever asked |
| `games.tags` | Never written |
| `matches.battlefields` | What a deck *brought* — the version's own Battlefield zone already says |
| `sync_meta.api_version` | Never read or written. The API publishes no version to put in it |
| `sets` (whole table) | Written every sync, read by nothing |
| `hydrateSet` / `setColumns` / `toSetRow` | The orphaned hydrator and mapper for that table |

**Two of the eight were not what the audit called them, and both mattered.**

`matches.battlefields` was recorded as inert dead schema. It was not: `saveMatches` accepts and
writes the column, and `/game/[id]/matches` **carried it through on every save** — because
`saveMatches` replaces the whole row, so any field the depth screen fails to hand back is deleted
rather than left alone. So there was live plumbing maintaining a value that was permanently null.
Typecheck found it the moment the column left the schema, which is the only reason it did not
survive as "labelled, therefore handled".

`sets.api_version` **does not exist.** The audit listed it beside `sync_meta.api_version`; the
schema declares it on neither, and the schema-audit test passing proves the migrations agree. One
column, not two.

The `sets` drop was the one with a real risk, and the check was worth running rather than assuming:
`syncCards` calls `GET /sets` on every sync, so it looks like the table feeds change detection. It
does not — `expectedTotal` is summed from the **live response** and compared against `COUNT(*)` on
`cards`. The function that wrote the mirror never read it. The endpoint call stays; only the mirror
of it is gone.

Migration 22 gets its own upgrade test. A drop cannot error its way to a wrong answer, but it can
shift the values in neighbouring columns if SQLite ever fell back to a rebuild — silently, across
every game in the history. So the test fills the columns on **both sides** of each drop, asserts
they still hold what they held, asserts all eight indexes on `games` and `matches` survive, and
asserts the dropped names are absent. Verified non-vacuous by removing one `DROP` and watching both
it *and* `schema-audit.test.ts` fail on `opp_label` independently.

### Binder rename and delete, wired (2026-08-13)

An **Edit** pill in the binder header opens a sheet with the name field and a destructive *Delete
this binder*. Delete confirms through an `Alert` that counts what is filed there — *"The 23 copies
filed here stop counting towards what you own. The cards themselves are not affected"* — then pops
back, since the screen it was on no longer describes anything.

**The gallery is excluded by construction, not by a flag.** `/binder/gallery` renders the card
library through this same screen and sets `binderId = null` because there is no row behind it. The
Edit control is gated on that same `binderId`, and every write already refuses when it is null — so
the guard cannot drift from the thing it guards. A second `isGallery` boolean would have been two
facts to keep in step.

A plain `Sheet` rather than the `DetailsSheet` the deck and event screens use: that one draws a
Notes field, and a binder has no notes. A box for a column the row does not have is worse than no
box.

#### A bug found in the act of closing the finding

`renameBinder(id, name, accent?)` wrote `accent = accent ?? null` **unconditionally**, so the
two-argument call — the obvious one, and the one an optional third parameter invites — silently
stripped the colour off any binder whose name was corrected. It had never fired because the
function had no consumer at all; the first screen to call it made exactly that call.

An omitted `accent` now leaves the column alone and an explicit `null` clears it, with a test naming
both. Worth recording as a general shape: **an unreachable function is not a tested function, even
with passing tests.** `renameBinder` had unit tests throughout — they simply always passed the third
argument, which is the one thing a real caller would not do.

### Checked and clean

- **Soft deletes.** Every read of a soft-deleted table filters `deleted_at IS NULL`. Three
  apparent misses are all deliberate: `undoGame` counts tombstones on purpose (that is what stops a
  mis-tap unlocking a version), it looks up the row it is about to hard-delete, and
  `MAX(version_number)` deliberately includes deleted versions so a number is never reused — which
  is the "unique and ascending, not dense" invariant.
- **The `dirty` flag.** Every write to a synced table sets it. The four apparent misses are false:
  `binder_cards` and `deck_version_cards` carry no sync columns by design — they are child rows that
  travel with their parent — and the other two set it through an interpolated clause.
- **Internal-only exports.** `toFtsQuery`, `legendOf`, `championOf`, `SIGNATURE_LIMIT`,
  `upsertCards`, `isSyncDue`, `SYNC_TTL_MS` are exported but used only inside their own module.
  Over-exposed rather than dead; left alone.

## The polish pass (2026-08-13)

Grouped and worked before M7. The data-layer group is above; this is the functional one.

| | Decision | State |
| --- | --- | --- |
| B1 | *Collection coverage in the editor* — **dropped.** The owner's call: knowing what you own is a deck-overview question, and the builder is for building | Closed, not built |
| B2 | Per-card **availability** in the builder | ✅ Built |
| B3 | The leave prompt missed every exit but `Cancel` | ✅ Fixed |
| B4 | Dimming returns while filing a binder, and the grid arithmetic fixed | ✅ Fixed |
| B5 | A trend line — **reframed**, see below | Backlog |
| C1 | The deck editor's list view mounted every candidate | ✅ Fixed |
| C2 | Version timeline not virtualised → **F2**, deferred | Backlog |

### B3 — the fix was not the one the gap was filed with

The parked note said this needed `usePreventRemove` from `@react-navigation/native`, "not a declared
dependency — worth adding deliberately". **Installing it would have been a real mistake.**

expo-router v7 is not built on React Navigation any more. There is no `@react-navigation` package in
the tree at all; the dependency is `standard-navigation`, and React Navigation's core is *vendored*
inside expo-router. Adding the public package would have installed a second navigation library that
is not the one rendering these screens, and the hook would have been talking to a navigator with no
relationship to the editor. The note was written when it was true and quietly stopped being true at
the SDK 57 upgrade.

What it actually needed is already there: `useNavigation()` is publicly exported, returns the
vendored navigation object, and `beforeRemove` is in `EventMapCore` with `canPreventDefault: true`.
expo-router's own doc comment says it outright — *"The full navigation API is available directly
from `expo-router` — no `@react-navigation/*` install required."* **No new dependency.**

The structural change matters more than the hook. `Cancel` used to run its own copy of the unsaved
check and raise its own prompt, which is precisely *why* the back gesture had none — the guard
belonged to a button rather than to the screen. `Cancel` is now `router.back()` and nothing else;
one `beforeRemove` listener asks the question however you leave. There is no exit left that can skip
it, because there is only one implementation.

Two details worth keeping: the intercepted action is **replayed verbatim** rather than answered with
`router.back()`, since pressing the already-focused Decks tab pops the stack to its root and one
step back would land somewhere nobody asked for; and a `leaving` latch lets through the navigation
the screen itself performs, or saving would interrogate the user about the save they just confirmed.

**Still unverified on hardware.** Whether `beforeRemove` fires for the Android back gesture and the
iOS edge swipe under expo-router v7 is a device question, and no test here can answer it.

**Found, not fixed:** the **log form has no leave guard at all**. In Advanced mode its draft holds
opening hands, mulligans and scores for up to three matches — real work, lost to a stray swipe. Left
alone because B3 was scoped to the editor and dismissing a modal is a more deliberate gesture than
an edge swipe, but it is the same shape and it is a decision, not an oversight.

### B2 — the number is *available*, not *owned*

The owner's rule: three copies, two sleeved in an older deck, so the next deck sees **one
available**. `availableForDeck()` is the same allocation walk `deckCoverage` already performs,
stopped one step earlier — the pool as it stands when this deck's turn comes. Reusing the walk is
the point: two answers to "do I own this?" that could disagree is exactly what the collection
tracker avoided when it refused to keep a flat owned-quantity column beside binder contents, and
there is a test asserting the tile and the deck-level shortfall are the same fact read two ways.

Three decisions inside it:

- **A deck's own copies are not deducted.** Listing all three does not make them unavailable to the
  deck listing them, or the badge would fall as you built and read as though your own cards had been
  taken. The stepper beside it already says how many you have put in.
- **Both numbers are shown** — `1 of 3 free`, not `1 available`. A bare zero cannot distinguish "buy
  one" from "unsleeve the other deck", and those are opposite actions. This is an addition to what
  was asked for, made because the ambiguity is real.
- **Silent when nothing is catalogued.** The map is keyed on cards you hold, so an empty collection
  would otherwise stamp "Not owned" across all ~900 candidates — not a finding, the app talking to
  itself.

It reads on the tile as a line under the name rather than a second corner badge: that corner already
means *copies in this deck*, and two numbers in one circle is a puzzle.

### B4 — the grid was arithmetically wrong, not just tight

Reported as cards "slightly too big and squeezed together", with a screenshot where adjacent card
names run into one another as a single string. The cause is in the code rather than in the taste:
**two independent width calculations that had to agree and did not.**

FlashList hands each column `(W − 2·BODY_PAD) / COLUMNS`. The cell then took `paddingRight: GAP` off
all but the last. But the tile was sized from a different formula,
`(W − 2·BODY_PAD − GAP·(COLUMNS−1)) / COLUMNS` — which is `GAP/3` **wider than the box holding it**.
Every tile but the last in a row overflowed into the gutter, while the last column carried `2·GAP/3`
of dead space it never used.

Now every cell carries a uniform half-gutter and the grid's own padding is pulled in by the same
half, so the outer edges still land on `BODY_PAD` and every column is identical by construction.
There is no "last column" case left to keep in step with `COLUMNS`. On a 393pt screen the tile lands
at 109.7pt — the design's own stated 110pt column, arrived at rather than hard-coded.

**Dimming returns, scoped to filing.** Unowned cards are dimmed in a binder and left at full
strength in the Gallery. The two are different jobs: browsing 1,451 cards is a reference you skim,
and greying out most of it makes it harder to read — which is why the dimming was removed in the
first place. Filing is the opposite, where *what is still at zero* is the entire question and an
absent badge is not something you can scan a page for. The whole tile fades, name included; a dimmed
picture under a full-strength label reads as a loading state.

### B5 — a trend line has nothing behind it

Reframed rather than deferred again, on the owner's reasoning: **without a ladder or an Elo there is
nothing for a trend to be a trend of.** A rising win rate over time is as likely to be a softer week
of opponents as a better deck, and the app has no way to tell those apart — which makes the line
exactly the kind of figure that looks like information and is not. The same objection that removed
Rune channelling and the Champion landing turn.

What the data can honestly support instead: **deck versus specific opposing decks, once the sample
is there.** The matchup view already groups by opposing Legend and Chosen Champion; the missing
piece is comparing *your* decks against a given opponent archetype, which is a real question with a
real denominator. Parked in the backlog until there are enough matches for it to say anything.

## Analytics, rebuilt around findings (2026-08-13)

Reported as *"bars and a lot of text"*. The statistics were not the problem and none of the maths
changed — **the screen had no opinion.** Eight sections, every one permanently present, all at
identical visual weight, each a bar plus one to three sentences of methodology: roughly fifteen
sentences of hedging on a screen whose job is to tell you something. The reader was left doing the
ranking the app should have done.

Three specific faults, each fixed by a different move:

| Fault | Fix |
| --- | --- |
| Bars used as **readouts**, not comparisons — a bar's job is "this one is longer than that one", and a single overall rate has nothing beside it to be longer than | The anchor is numerals. Bars survive only where two or more things sit side by side, which is every remaining use |
| **Empty sections cost as much space as full ones** — five of the eight could render as `NeedsData`, so a new deck's Analytics tab was mostly a list of things you had not done | Findings appear only when the data supports them. Nought findings renders **one** line, not eight boxes |
| The honesty rule implemented as **prose, repeated** — draws, the seen-three-times floor, the close margin, plus a footnote | Stated once, in the drawer, beside the sections that use it |

### The filter that decided what stays

**"What would I do differently if this number were different?"** If nothing, it is trivia, and trivia
was crowding out the findings. Running the eight through it produced one promotion, one addition and
five folds:

- **Promoted to a control:** *By game style*. A 68 % win rate that is entirely casual games is not a
  68 % deck, so this was never a breakdown — it is the thing that makes every other number honest. It
  is now a chip, and it renders **only when it would change something** (there must be casual games
  to remove and something left afterwards); a toggle that filters nothing teaches the reader it is
  broken.
- **Added:** *version delta*. The premise of the app is "did my change make the deck better?", and
  that question was answered only on the version timeline behind a Compare mode you had to know
  existed — the tab literally named Analytics never mentioned versions.
- **Folded:** going first/second, format, mulligan counts, score margin, and streaks.

Streaks were listed for deletion in the proposal and were **folded instead**. Deleting a working
feature to satisfy a table is a worse trade than demoting it, and the drawer is where the things that
do not change a decision belong. Recorded because it is a deviation from what was agreed.

### `lib/analytics/findings.ts` — the editorial layer

Nothing here computes a new statistic; every number comes from `summary.ts` or `hands.ts` unchanged.
It decides which of them is worth a sentence. A comparison must be **separable** — Wilson intervals
that do not overlap — and a descriptive claim must clear a floor on its own sample.

**Ranking is by kind, not by effect size,** and that is deliberate. A 22-point version gap and a
30-point excess mulligan rate are not the same quantity in different clothes, and sorting them
against each other silently claims they are comparable. Since separability is already required,
everything that reaches the screen is real — so the only question left is which real thing to read
first, and that is answered by how directly it changes a decision: version → matchup → card → margin
→ order. `strength` still picks the winner *within* a kind, where the units genuinely match.

**One finding per kind**, so six lopsided matchups cannot crowd out the fact that the newest version
is losing. Capped at three.

### Two errors found by auditing the new code, not the old

**1 · The matchup baseline was wrong, and wrong in the direction that hides problems.** The first
draft compared each matchup against the deck's *overall* rate — but the overall rate **contains that
matchup's own games**, so a lopsided matchup drags the baseline towards itself. The bigger the
problem, the better it hid. The comparison is now against the complement, the only version where the
two samples are disjoint.

`findings.test.ts` carries the case that separates the two: Vi is two thirds of every game played,
pulling the overall rate to 47 % — close enough to Vi's own 30 % that the intervals overlap and the
old comparison found **nothing**. Against the other games (80 %) it is unmissable. Verified
non-vacuous by reverting the baseline and watching two tests fail.

**2 · With exactly two opponents the finding was arbitrary.** Each is the other's complement, so
"Vi beats you" and "you beat Zed" are the same fact from either end with *identical* strength, and
which one appeared depended on sort order — a judgement nobody made. Ties now break towards the
matchup you are **losing**, because that is the actionable half: you can tech against a bad matchup,
and one you already win tells you nothing to change.

### Three smaller things the audit changed

- **`matchupKey()` extracted** in `summary.ts`. The opposing-deck identity was derived inline in two
  places, which is two definitions of "the same opponent" that could drift with nothing failing. The
  findings layer needed a third, so it became one exported function.
- **The typed-route cast removed.** `Finding` carries a `link` naming *what to open* rather than an
  href string, because a `string` needs a cast at `router.push` — and a cast keeps compiling after a
  route is renamed, leaving a card that presses and goes nowhere. Nothing in the suite could catch
  that. It was the only `as never` in app code.
- **Three constants un-exported.** `MAX_FINDINGS`, `MATCHUP_FLOOR` and `MULLIGAN_FLOOR` had no
  consumer outside the module — the gap-15 class. Only `CARD_SEEN_FLOOR` is genuinely shared, and it
  has to be: the panel resolves the finding's card name in advance, so if the two floors disagreed
  the lookup would miss and the finding would vanish silently. Tests assert the literal cap, since
  asserting against the exported constant would pass whatever that constant became.

**Gate:** typecheck clean, lint clean, **502 tests / 29 files** (up from 481). Bundle 200 / 13.11 MB,
with `More breakdowns`, `in your other games`, `Nothing separates yet`, `Casual games` and the three
finding sentences all present — tests passing is not evidence a feature is reachable.

**Not yet verified on a device.** The findings need real logged games to fire; a deck with a handful
of matches will correctly show the anchor and one line and nothing else, which is the design and will
look like an empty screen until there is data behind it.

### Built to the Hi-Fi handoff — `1_ANALYTIC02` (2026-08-13)

Imported from the Claude Design project through the design MCP. Four states are drawn and all four
are implemented: **rich** (anchor · up to three findings · drawer collapsed), **sparse** (anchor plus
one honest line), **empty** (no games at all), and the **expanded drawer**.

What the design added on top of the arrangement already built:

- The **anchor is a card**, not bare text. One rate at 46 px with its record and interval underneath.
  Under 20 decided games the whole card drops to the provisional greys *and the interval line says so
  in words* — the only place the design spends words on uncertainty. Everywhere else it is colour.
- **Findings carry a rank numeral** (`01`/`02`/`03`) and a chevron only when they lead somewhere. One
  treatment for all five kinds, so they read as a ranked list of conclusions rather than five gadgets.
- The drawer is two forms, not one: **`RecordBar`** rows for anything with a record, and paired
  **stat tiles** for anything that is a bare figure.

**`RecordBar` is a new component, and does not replace `WinRateBar`.** They answer different
questions — `WinRateBar` draws a rate *and its confidence interval* as a band and a marker and still
owns deck detail and version compare; `RecordBar` draws what a record is made of, in proportion, with
the counts written inside the segments. A drawer row is read as "how did these twelve games go", not
as an estimate.

**Eight paragraphs of methodology became one.** The per-section captions are gone; the footnote at
the foot of the drawer states coverage, the draw rule, the provisional rule, the close margin and the
seen-three-times floor once each.

**New tokens.** The design introduced values with no home in the palette, and hex literals in a
component are what `palette.js` exists to prevent: `borderStrong` (.12) and `borderControl` (.14) —
the design draws *three* hairline weights, for a division, for a surface that is itself an object, and
for something you can press; `onWin`/`onLoss` for counts inside a filled segment; `accentSoft` /
`accentBorder` / `accentBright` for the accent as a *state* rather than a fill; `textGhost` for the
rank numeral; and `space[2.5]` = 10, which the design leans on. All added to `palette.js`, its
`.d.ts`, and documented where they live.

**`matchupPlayDraw()` deleted.** It answered "does going first matter in *this* matchup" and the old
panel printed it as three dense lines under the matchup list. The drawer has no row for it, so it lost
its only consumer — gap 15, the export nothing calls. Removed rather than left, for the same reason
`championTurnStats` went. It is five lines over `matchupKey` and `playDrawSplit`, both still present,
so it returns the moment the design asks for it.

#### Four places the design and the app disagreed — all four now settled

None was resolved by inventing; each was implemented the way the codebase already worked and put to
the owner. Answers came 2026-08-14.

1. **The win rate's denominator — changed, and neither side of the original disagreement won.** The
   design's numbers counted a draw as a **loss** (`Went second · 6–5–1 · 50%` is 6/12); the app
   **ignored** draws entirely (6/11 = 54.5 %). The owner's rule is a third thing: *"count them to
   each side win and loss, 6–6–1 is equal to a 50% winrate, not screwed to either side."* A draw is
   now **half a win and half a loss** — a point per game, ½ for a draw, over games played. See
   [DATA-MODEL](DATA-MODEL.md#what-a-draw-is-worth-settled-2026-08-14) for the comparison table.

   Worth recording why the example settled it rather than the argument: `6–6–1` reads 50 % under both
   the old app rule and the new one, so it does not distinguish them — but it reads **46 %** under
   the design's, which is the reading being rejected. The instruction to *count* them, rather than
   ignore them, is what picks the half-point rule over the status quo.

   This overturned a rule the code called non-negotiable, so it was changed everywhere at once:
   `rateOf` gained a `points` field and now divides by `total`; `provisional` counts games rather
   than decided games; `Rate.decided` survives as a reported fact with no denominators left to be.
   Five call sites moved off `.decided`, and `WinRateBar`'s "*N* played, none decided" branch was
   deleted — under the new rule an all-draws history is a real 50 %, so that state cannot occur.
   **The suite caught exactly three tests and nothing else**, which is the right blast radius for a
   rule this central. `6–6–1 → 50%` is now pinned as a test in its own right.

   A side effect worth having: `RecordBar`'s segment widths and its percentage finally share a
   denominator. The row that drew twelve games and reported a rate over eleven is gone.
2. **The interval disappears from breakdown rows** — *confirmed, keep as drawn.* "Only big row at the
   top is fine." The design's rows carry `n` but no CI, where the
   old `WinRateBar` drew the interval as a band. Provisional is carried by colour instead, per the
   design's own footnote. Note this narrows the M5 rule "every rate carries its sample size and
   interval" to "every rate carries its sample size, and the headline carries its interval" — the
   rows still print `n`, so no figure appears without a denominator.
3. **The picker and the tabs are in a different order than `1_Stats`** — *left as it is.* "Deck picker
   is fine as it is." `1_ANALYTIC02` puts the deck picker above the three tabs; `1_Stats` puts the
   tabs above the picker under a `YOUR DECK` label. The shell is shared with the Games and Events
   tabs, and picking one would have restyled two screens outside this brief.
4. **The casual chip scrolls where the design pins it** — *accepted as built.* Pinning it would mean
   lifting the filter state out of the panel and into `stats.tsx`.

Two smaller deviations: the design's `⌄ ⌃ › ✓` are drawn from the shared `Icon` set instead of typed,
because M1 banned literal glyphs after they rendered as tofu on a device; and the sparse message uses
`textMuted` rather than the design's `#8B8B8F`, one step brighter, rather than adding a near-duplicate
token.

**Two competing Analytics designs are in the file, and `1_ANALYTIC02` is the one to build** —
confirmed by the owner. `1_Analytics` is a different take: *What stands out* over a `BREAK DOWN BY`
picker showing **one** breakdown at a time instead of a drawer holding all of them. Recorded rather
than deleted, since it is a coherent alternative someone may want to revisit.

### The drawer became a question about an opponent (2026-08-14)

Second pass, from the owner: *"what we need is track against whom have I played with my deck?"*

- **The matchup list became a scope selector.** `AGAINST` offers *Overall* plus each Legend with games
  behind it, and everything below answers for that scope — turn order against Ahri, formats against
  Ahri, the hands you kept against Ahri. The list is built from games played, never from the card
  library: a menu of every Legend in the game would be a hundred entries, ninety-seven of them
  answering "no games".
- **Findings stay unscoped, deliberately.** They are the screen's claims about the *deck*; silently
  re-deriving them from twelve games against one opponent would turn a ranked conclusion into a
  coincidence.
- **Empty rows are gone.** Turn order used to draw `Went second · 0–0 · n=0` for a deck that had
  always gone first. An empty row reads as a result, and there was no result to read.
- **Streaks moved to the top, under the win rate.** It is the one figure on the screen that is about
  *right now* — the anchor is a lifetime average and cannot say you have lost the last four.
- **The Wilson footnote is gone**, as asked.

**A correction found while removing that footnote.** Folding the coverage figures into it and then
deleting it took the *denominators* with them — the drawer stopped saying that a mulligan breakdown
came from 12 of 40 matches. That is not flavour text, it is the sample size, and `Coverage`'s own
docstring says exactly why: a split drawn from 3 of 40 games "is not wrong, but presenting it without
saying so invites a conclusion drawn from 7 % of the data". Coverage is back as a one-line note under
the three groups that have partial coverage — turn order, opening hands, score margin — where it is
also now *scoped*, so it reports against the selected opponent rather than the whole deck.

The tell was `handCoverage()` going quiet: an export whose only remaining callers were tests, which
is the gap-15 signal this project treats as a defect. Here it was pointing at a lost feature rather
than at dead code.

#### Two corrections on the same pass

**1 · The scope selector had a list under it that was the selector again.** Under *Overall* the first
group drew **every opponent** as its own bar. Wrong on the owner's reading, and wrong on inspection:
the drawer's question is "how does my deck do, broken down", and the per-opponent spread already
lives in the `AGAINST` menu — where each entry now carries its own record and rate, so the open menu
*is* the matchup table. Listing it again underneath was the same table twice with the selected scope
buried inside it.

The group is now `RECORD`: one bar for whatever is selected, Overall or one Legend, followed by the
breakdowns. Same shape either way, which is what makes switching scope legible — only the numbers
move, never the layout.

**2 · `n=` is gone from every row.** Raised as "I can see n=1 on the analytics, this doesn't need to
show". It was redundant as well as jargon: `6–5–1` **is** twelve games, stated in the register a
player already thinks in, so `n=12` beside it restated the same fact in a worse one. Every other
denominator on the screen was audited in the same pass and all of them are already in words —
`31 games`, `From 12 of 40 games where it was recorded`, `6 of 8 opening hands it was dealt in`. The
one exception, a version finding reading `41% over 22`, gained its unit.

Note this settles the loose end from decision 2 above: with the interval gone from the rows and now
`n` too, what carries the sample size on a breakdown row is the **record itself**, which is the most
readable denominator available and was on every row the whole time.

**Gate:** typecheck clean, lint clean, **506 tests / 29 files**. Bundle 200 / 13.12 MB with `AGAINST`,
`RECORD`, `Current streak` and `where it was recorded` present; `Rates use a Wilson`,
`EVERY OPPONENT` and `THIS MATCHUP` all confirmed gone from the shipped bundle.

---

**Previous gate,** before the opponent scope: typecheck clean, lint clean, **506 tests / 29 files**.
Bundle 200 / 13.12 MB, carrying
`a draw as half`, `under 20 games`, `More breakdowns`, `MATCHUPS`, `CARDS YOU THROW BACK`,
`No games logged yet` and `Nothing separates yet` — and no longer carrying `not half a loss`, which
is how the old rule was confirmed gone from the shipped code rather than only from the source.

## Known gaps

Found on a device, not yet fixed. Each is a real defect or a real omission — none is a
"nice to have", and none should be closed without checking it on hardware.

| # | Gap | Found | Severity |
| --- | --- | --- | --- |
| 1 | ~~**Version compare is unreliable to invoke**~~ — **closed.** Replaced the long-press-only selection with an explicit mode: a **Compare** button above the timeline, tap-to-pick while it is on, a live "Tap one more · v2 selected" status, and Cancel. Long-press is kept as a shortcut *into* the mode. The trap is gone by construction — in compare mode a tap can only pick, and out of it a tap can only open the version's actions | M3 device pass | Closed |
| 2 | ~~**A save that amends in place says nothing**~~ — **closed.** Every outcome now returns a line through the toast (`src/features/decks/save-message.ts`), and the amend case states the rule: *"v2 updated · no matches on it yet, so no new version"*. Reported again from a device as "editing no longer creates a version" — see below | M3 device pass | Closed |
| 3 | ~~**No route back to the tabs from a pushed screen**~~ — **closed.** The Decks tab owns a stack (`app/(tabs)/(decks)/`), so deck detail, the editor, the build flow and import push *inside* it and the bar stays put. Because `(decks)` is a group, **no URL changed** — verified against the generated route manifest, and every `router.push` in the app is untouched. What stays on the root stack is what should genuinely cover everything: logging a match, a full-bleed card, the filter sheet | M3 device pass | Closed |
| 19 | ~~**Pressing the active tab did nothing**~~ — **closed.** Introduced by the fix for gap 3 and caught before the device saw it: with the Decks tab holding a stack, opening a deck and then reaching for the Decks tab to get back to the list was a no-op, because the tab was already focused. A second press now pops that tab to its root. The action is written out rather than imported from `@react-navigation/native`, which is **not a declared dependency** — importing it is the phantom-dependency bug from M0 | Gap 3 audit | Closed |
| 20 | ~~`.expo/types/router.d.ts` had accumulated bogus routes~~ — **investigated, not a defect.** Typed-routes generation had registered `src/` modules — test files included — as routes, which reads like test code shipping in the app. Measured instead of assumed: the Hermes bundle contains no `vitest`, no `describe(`, no test module. It is a stale dev-server artifact, gitignored, regenerated on the next `expo start`, and deleting it leaves typecheck passing. Recorded so the next person who sees it does not go hunting | Gap 3 audit | Closed |
| 4 | ~~**The main-deck step has no filters**~~ — **closed (first draft).** `CardPoolFilters` gives the main and sideboard pools search, sort (Name / Energy cost) and multi-select Type and Set. Two structural notes: the controls are a *fixed-height* row because they live in a FlashList header and any height change made the grid jump under a tap; and empty results now render via `ListEmptyComponent` so filtering to zero no longer unmounts the header. Type and supertype are OR'd in `queryCards` — Champion is a supertype, so AND-ing "Spell + Champion" would have returned nothing | M3 build | Closed |
| 5 | ~~`versionMatchCounts()` stubbed~~ — **closed.** M4 shipped the `matches` table and the post-M4 audit removed the `sqlite_master` guard, which could no longer fire | M3 | Closed |
| 6 | ~~**A version label can only ever be set at fork time**~~ — **closed.** Tapping any version in the timeline now offers *Add a label* / *Edit label & notes*, v1 included. Notes render on the timeline node, or the field would have been write-only — which is how half this screen's text became unreachable in the first place | Unreachable-code audit | Closed |
| 7 | ~~**Deck rename, notes, and archive are unreachable**~~ — **closed.** *Deck details* on the deck overview edits name and notes and archives; the Decks tab grew a **Show N archived** toggle that doubles as the divider, and deck detail carries an "Archived" chip. `archiveDeck` already took a boolean, so restoring came free | Unreachable-code audit | Closed |
| 8 | ~~**The editor never mentions unresolvable cards**~~ — **closed.** The editor carries the same banner deck detail has, naming each card and its count. It reports the shortfall from **countable zones only** — `missingCards` also returns the Legend and Champion, which appear in no total, so summing everything would have claimed the main deck was a card short when it was the Legend's printing that vanished | Unreachable-code audit | Closed |
| 9 | ~~**Dead code:** `useDeckEditor.isDirty()`~~ — **closed.** It dragged two more with it: `baseline` existed only to feed it, and `fingerprint()` only to compute `baseline`. The editor diffs against the database at save time, so a second answer to "has this changed" was one more thing that could disagree | Unreachable-code audit | Closed |
| 10 | ~~**15 moderate `npm audit` advisories, all dev tooling**~~ — **re-measured; the entry was stale and understated.** It is **26 (12 moderate, 14 high)** and no longer "all dev tooling" by name — `react-native`, `expo` and `react-native-reanimated` are listed. But only **four root advisories** exist; the other 22 are transitive echoes: `esbuild` (dev-server request forgery), `image-size` ×2 (DoS parsing ICNS/JXL/HEIF), `uuid` (buffer bounds). **None reaches the app** — verified by searching the full dev bundle's module graph for `node_modules/uuid`, `node_modules/image-size` and `node_modules/esbuild`: zero references each. **Still not fixed, and now for a stated reason:** every remedy npm proposes is a *downgrade* — `expo@53` (on 57), `react-native@0.72.17` (on 0.86.2), `drizzle-kit@0.18.1`. `npm audit fix --force` would roll the project back three SDK majors. `npx expo-doctor` passes 20/20, which is the check that actually describes this tree's health | Post-move `npm ci`; re-measured in the final gap sweep | Low — decided, not deferred |
| 21 | ~~**M3 dev scaffolding was still shipping**~~ — **closed.** `version-selfcheck.ts` (341 lines, creates and hard-deletes a deck in the user's real database) plus its Profile block survived the M4 cleanup that ticked it off as done, and its own comment read "TEMPORARY — remove with M4". The `__DEV__` guard hid the button but the module was imported at top level, so it was in the **production Hermes bundle** — confirmed by finding its button string there. It also used `✓`/`✗`, the Unicode glyphs M1 banned for rendering as tofu. Deleted | Final gap sweep | Closed — a checklist tick is not evidence |
| 11 | ~~**`events` and `matches.event_id` are shipped but unwritable**~~ — **closed.** M6 event mode writes both: an event is created from the log flow, rounds attach to it, and the taxonomy was corrected on the way — match style (Casual / Online / Tournament / Testing) is a separate question from event style (Nexus Night / Skirmish / Locals / Regional Qualifier / Regional Final), which only opens under Tournament | M4 data-layer audit | Closed |
| 12 | ~~**`match_games` is shipped but unwritten**~~ — **closed.** Per-game logging writes it: a card per game asking turn order, both Battlefields and who won, revealed one at a time and withdrawn once the match is settled. Migration 16 added `battlefield_card_id` / `opp_battlefield_card_id` so the two sides can be told apart, and the match result became **derived** from the games rather than asked for | M4 data-layer audit | Closed |
| 13 | ~~On-play / on-draw not captured~~ — **closed.** Restored to the log sheet as a single three-option row during the post-M5 audit; the analytics split fills in as matches are logged | M4 sheet simplification | Closed |

| 14 | ~~**The recent-opponent rail is gone**~~ — **closed, then removed by the design.** It was restored above the Legend field, read once on mount so logging four rounds did not reshuffle it between them, and four probes written against `recentOpponents()` when it finally got a consumer all passed unchanged. The Hi-Fi handoff's third change then deleted the rail, and the query went with it — an export with no consumer is gap 15. Recorded rather than quietly reversed: the shortcut was real, and if logging a tournament's rounds turns out to want it back, this is the entry that says what it did and why it was correct | Post-gap-1 audit | Closed — then removed by design |
| 15 | ~~`countDecks()` dead~~ — **closed.** No consumer anywhere, tests included. Deleted | Post-gap-1 audit | Closed |
| 17 | ~~**Archiving a deck erased it from Stats**~~ — **closed.** Found while auditing gaps 6-7, and the reason archiving could not have shipped as written. `stats.tsx` called `listDecks()`, which excludes archived, so an archived deck left the picker and took its match history with it. Worse, **"All decks" disagreed with itself**: the headline record summed only live decks while the history list beneath it read every match in the database, so archiving changed the total without changing a row. Stats now reads `listDecks(true)` and labels archived entries | Post-gap-6/7 audit | Closed |
| 18 | ~~`setDeckNotes` stored `''` instead of clearing~~ — **closed.** Its two siblings trim blank to null; this one stored the raw string, so an emptied field left an empty note behind — which renders as a note someone deliberately wrote nothing in. Invisible until a screen could call it | Post-gap-6/7 audit | Closed |
| 16 | ~~`deck-diff.ts` held a literal NUL byte~~ — **closed.** A raw `NUL` in the source, used as a key separator, made the file *binary* to every text tool — `grep` refused to search it, which is how it was found. Replaced with the escape sequence; behaviour identical, 17 diff tests unchanged | Post-gap-1 audit | Closed |

### The "no new version" report, measured

Reported from a device as a regression. It is not one. A fork is created **unlocked**, so the *next*
edit amends it in place — no v3 — until a match is logged on it. `decks.test.ts` now walks that exact
sequence and asserts every step, including that a match on the fork restores forking. The rule is
"a version that has been played is immutable", not "the first edit is special".

The defect was gap 2, not the version machinery: four of the five save outcomes said nothing at all,
so the most common one looked exactly like a save that failed.

### Version-history scaling, measured

`version-scaling.test.ts` builds a real 49-slot deck and forks it, timing what deck detail actually
reads. Node's `node:sqlite` in memory — a phone is slower, so treat these as a lower bound and the
shape, not the absolute.

| Versions | Every focus | + Versions tab | Compare | Rows | Size |
| --- | --- | --- | --- | --- | --- |
| 10 | 3 ms | 3 ms | 0.4 ms | 490 | 0.39 MB |
| 50 | 16 ms | 17 ms | 0.4 ms | 2,450 | 0.95 MB |
| 200 | 32 ms | 69 ms | 0.3 ms | 9,800 | 2.95 MB |
| 400 | 65 ms | 137 ms | 0.3 ms | 19,600 | 5.68 MB |
| 800 | 133 ms | 353 ms | 0.6 ms | 39,200 | 11.12 MB |

Linear throughout, ~14 KB and ~0.5 ms per version. **Comparing is flat** — it reads two lists however
long the history is, which is the property that had to hold.

Two things changed because of the measurement:

- **Timeline diffs are now computed only while the Versions tab is open.** `versionDiff` loads two
  decklists per node, two thirds of the screen's cost, and it was paid on every focus regardless of
  tab. Deck detail re-focuses after logging a match, so a long history was making the *match* flow
  slow for a screen nobody had opened.
- **The timeline draws 30 versions and folds the rest behind a tap.** It is a plain column, not a
  virtualised list, because it shares the screen's scroll view — so every node it is given is mounted,
  each with a diff view of up to six chips.

**The practical ceiling is the render, not the database.** Storage and query time stay comfortable
into the thousands; an un-virtualised column does not. If a real deck ever passes a few hundred
versions the fix is a `FlashList` and a restructured screen, not a query change. Carried as **F2**
in the backlog — the same change C1 made to the editor, on a screen that has not yet earned it.

Gaps 6 and 7 share a cause worth naming: the query layer was built out ahead of the screens, so
functions exist, pass tests, and are never called. Tests passing is not evidence a feature is
reachable — nothing in the suite can tell the difference between "works" and "works and is wired up".

## Backlog

Deliberately deferred — revisit after launch with real usage data.

- Meta aggregation across users (needs a user base; privacy design required first)
- Price tracking via the TCGPlayer / Cardmarket IDs the API exposes
- **Import a public decklist from a piltoverarchive.com URL**, using their API key. Layered *on top
  of* the offline deck-code path, never replacing it: the app works in airplane mode by design, and
  import/export is exactly the feature you would reach for at a venue with bad signal. Deferred
  because the deck code already covers sharing, and this only adds "paste a link" convenience
- Web export of the Expo codebase
- Deck sharing between users
- Sideboard / tech-card tracking as a first-class concept
- Widgets and watch app for ultra-fast logging
- **Deck-versus-deck comparison** once samples allow — how one of your decks does against a specific
  opposing archetype, rather than the rolling trend line M5 deferred. A trend needs a ladder or an
  Elo behind it to mean anything; a matchup has a real denominator. See B5 in
  [the polish pass](#the-polish-pass-2026-08-13)

### F — Future updates

Raised during the polish pass, deliberately not built with it. Each is real and each is scoped
beyond the gap it was found beside.

- **F1 · The log form has no leave guard.** `/game/new` holds a draft — deck, result, opponent, and
  in Advanced mode the opening hand, mulligan and score for up to three matches — and nothing asks
  before it is thrown away. Found while closing B3, which fixed exactly this class in the deck
  editor.

  Not simply the same fix again, which is why it is here rather than done. The log form is a
  presented modal, so a downward swipe is a more deliberate act than an edge swipe on a pushed
  screen, and the flow has a **ten-second budget** that a confirmation dialog directly attacks — a
  two-tap log must never become a three-tap log. The honest version probably guards only when the
  draft holds more than the fast path collects, which is a rule that needs stating before it can be
  written. The machinery is already proven: `useNavigation()` + `beforeRemove`, no new dependency.

- **F2 · The version timeline is not virtualised.** It is a plain column sharing deck detail's
  scroll view, so every node it is given is mounted, each with a diff view of up to six chips. It
  draws 30 and folds the rest behind a tap, which is the mitigation rather than the fix.

  Measured and comfortable for now: storage and query time stay linear into the thousands
  (~14 KB and ~0.5 ms per version), and **the practical ceiling is the render, not the database**.
  If a real deck ever passes a few hundred versions the answer is a `FlashList` and a restructured
  screen — the same change C1 made to the editor's candidate list, on a screen that has not yet
  earned it. Deferred deliberately: nobody has a deck with 300 versions.

### Known issues, parked

- ~~**The leave prompt only fires from Cancel**~~ — **closed 2026-08-13**, and the fix this entry
  proposed would have been wrong. There is no `@react-navigation` package in the tree on SDK 57;
  expo-router v7 vendors React Navigation's core and exposes it through `useNavigation()`, so the
  guard needed no new dependency at all. See [the polish pass](#the-polish-pass-2026-08-13)
- ~~**Inline version expansion on deck detail is unverified.**~~ **Closed 2026-08-13** — confirmed
  working on a device. It was the last unconfirmed item from the original FIX FIRST list
- ~~**The card gallery's unowned tiles no longer dim**~~ — **closed 2026-08-13.** The count badge
  alone was not enough, and the answer was to scope the treatment rather than choose between the two
  screens: dimmed while filing a binder, full strength in the Gallery

### Design gaps — raise with the design, do not invent

The Hi-Fi design predates several things the app now has. Each of these is a decision for the design
to make, not for the implementation to guess:

- ~~**No Events tab.**~~ **Closed 2026-08-13.** `1_ANALYTIC02` draws *Games · Analytics · Events*.
  The Stats rebuild is unblocked and done
- **No spec for the collection coverage counter** (`44/59 in your collection`) on deck overview
- **Gallery is drawn as filable**, but ownership lives only in binders, so `/binder/gallery` is
  read-only. Either the design gains a default binder or the read-only treatment becomes the spec
- **Progress fills were left white** — the design does not say whether progress counts as "current
  state" and so earns the accent

### Opening the deck editor took about half a second — C1, fixed 2026-08-13

Reported from a device. The data reads were ruled out early: a query across the whole 1,451-card
library measured **4.18 ms** during M1 hardening and hydration **0.79 ms**, so the five small reads
the editor mount performs could not account for it. Two candidates were left, wanting opposite
fixes — the first render, or the navigation transition.

**The list view was mounting the entire candidate pool before it could draw a frame.** It was a
plain `ScrollView` mapping over `candidates`, so every row existed at mount: a Pressable, an
`expo-image` and four Texts, several hundred times over. The gallery view in the same slot has
always been a `FlashList`, which is why switching to the grid felt faster than the screen it was
inside. The regression came in with the one-list-per-zone rebuild; the editor before it opened on
the deck's own ~57 slots.

**The "~900 rows" in the previous version of this entry was an estimate, and it was wrong.**
Counted against the real bundled library, the widest Legend identity offers **385** main-deck
candidates and the median **377** — Mind/Order is the worst case, and the pool is far flatter across
identities than the guess implied. Runes cap at 30 and Battlefields at 71, which is why neither zone
was ever reported as slow. Under half the claimed figure, still several thousand views and several
hundred image requests standing between the tap and the first paint.

The list view is now a `FlashList`, matching the gallery. `extraData` carries the draft, because
`candidates` is deliberately a stable snapshot — the order is fixed when the pool is built so a tap
never moves a row under your finger, which means a virtualised list cannot see a quantity change on
its own.

**The measurement is now standing rather than one-off.** `features/decks/timing.ts` marks the Edit
tap, the first render, the load, and the frame after the list has data, and prints the three gaps
separately:

```
[timing] Edit pressed → editor painted: N ms (nav N · queries N · render N) — 385 candidate rows
```

Modelled on `features/games/timing.ts`, `__DEV__` only. It stays because one number could never
have separated the two suspects, and the transition is still the other half of whatever remains:
a stack push animates for ~300 ms by default, which is not a delay before the screen arrives so
much as the screen arriving slowly. **The before/after number is a device reading and has not been
taken yet** — the fix is structural and correct on its own terms, but this entry does not get to
claim a figure it has not measured.

Confirmed smoother from a device. Which surfaced the next thing.

### The editor's chrome was 61% of the screen

Reported straight after C1: the fixed region above the cards "takes nearly 50% of the screen".
Measured off the screenshot against a known dimension — `identityField`'s 52pt `minHeight` fixes the
scale — it was **worse than reported, about 61%**, leaving roughly a card and a half visible.

| Band | Cost |
| --- | --- |
| Cancel · name · Save | 33pt |
| Legality card | **98pt** |
| Legend / Champion | 52pt |
| Zone tabs | 46pt |
| Search + Type/Set/Energy + count | 74pt |
| `MAIN · 14 IN DECK · CANDIDATES BELOW` + In deck + view toggle | 33pt |

Two of those were **duplicates of something already on screen**: the strip above the list read
`MAIN · 14 IN DECK`, which is what the selected zone tab immediately above it says, count included.

The chosen fix — **context scrolls, controls stay.** The legality card and the Legend/Champion
fields ride at the top of the candidate list rather than above it: scroll up and they are there,
start browsing and the cards get the screen. What stays pinned is what you use *while* browsing —
the header, the zone tabs, search and filters, and the view toggle.

Three things worth recording:

- **A one-line `LegalityStrip` stays pinned**, because the running counts are the part you want
  while adding cards and the zone tabs only give the per-zone number, not the target. It is
  co-located with `LegalityCard` rather than given its own file: the two render the same fact, and
  the mark, the counts and the thresholds have to keep meaning the same thing in both.
- **It deliberately carries no verdict sentence and no footnote.** The sentence is the part whose
  length changes, and a pinned row that grows and shrinks pushes the list under the reader's
  finger — the same reasoning that made `CardPoolFilters`' meta row a fixed height.
- **The context renders in both views**, through `FlashList`'s `ListHeaderComponent` and
  `CardGrid`'s existing `header` prop, so switching list ⇄ gallery changes how cards are drawn and
  nothing about what the screen tells you.

**A regression caught in the writing, not by the tests.** `listContext` carries the LEGEND field, and
the no-Legend branch renders an empty state *instead of* the list — so moving the field into the
list would have left the one screen that can set a Legend with no way to set one. Not theoretical:
`loadDeckList` returns no legend slot whenever that printing leaves the card mirror (M2 audit,
finding 6), and this is the screen you would come to in order to fix it. The context now renders
above the empty state too. Nothing in the suite could have caught this — there are no component
tests, and the branch is a layout decision.

### Deviations from the Hi-Fi design, parked rather than fixed

Both are in the match log's per-match cards (`src/components/games/MatchCard.tsx`), where the
same notes are recorded in the file header.

- **Their Battlefield opens the card picker instead of expanding an inline search list.** The
  design draws a search box and a short filtered list inside the card. Its list is a mock
  with six entries; the real one is every Battlefield in the library, so the honest version is a
  scrolling list nested inside the form's own scroll. The picker sheet already has the search the
  design is asking for. Revisit if the inline list can be capped short enough not to scroll —
  a handful of results and no inner scroll view would match the design without the trap
- **The cards are titled "Match 1 / Match 2", where the design says "Game 1".** The deviation is
  real and runs the **opposite** way to what this entry claimed until 2026-08-13, when it read
  *"titled Game 1 / Game 2, not the design's Match 1 / Match 2"*. That was written from memory and
  is false — the design source contains "Game 1" twice and no "Match N" anywhere. The vocabulary
  inversion settled which word is right for this app and the design predates that decision, so the
  deviation is deliberate rather than open. See
  [The vocabulary inversion](#the-vocabulary-inversion-2026-08-12)
