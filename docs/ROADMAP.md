# Roadmap

**M0 – M5 is the complete usable product.** M6 – M8 is expansion and release.

| Milestone | Theme | Status |
| --- | --- | --- |
| [M0](#m0--foundation) | Foundation | ✅ Done |
| [M1](#m1--card-data) | Card data & gallery | ✅ Done |
| [M2](#m2--decks) | Decks & builder | ✅ Done |
| [M3](#m3--versioning) | Versioning | ✅ Done |
| [M4](#m4--matches) | Match tracking | ✅ Done |
| [M5](#m5--analytics) | Analytics | ✅ Done |
| [M6](#m6--extras) | Extras | 🟡 In progress — import/export done |
| [M7](#m7--cloud) | Cloud sync | ⬜ Not started |
| [M8](#m8--ship) | Polish & ship | ⬜ Not started |

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

- [ ] **In-depth match logging** — an opt-in second tier of detail behind the fast path, for players
      who want to analyse a match rather than only record it:
      - Opening hand and mulligans
      - Match score, not just the result — *won by scoring to 8 while the opponent was on 6*
      - Which Battlefields each player brought, and which were played
      - The turn each player landed their Chosen Champion
      - On the play / on the draw

      Kept out of M4 deliberately. The two-tap flow has a ten-second budget and every field on that
      surface competes with it; these belong in a separate pass over a match already logged, not in
      the path taken while an opponent is waiting to shuffle. `match_games` (migration 6) is the
      table most of it lands in.

      **Note:** on-play/on-draw moves here from M4's sheet, and it is the one field with a
      downstream cost — `DATA-MODEL.md` §4 lists an on-play split as an M5 metric, and it will
      report n = 0 until this ships.

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
      pure, seeded and separately tested (11 probes). Rules taken from the official Core Rules:
      **4-card opening hand**, **one** mulligan recycling up to **2** to the *bottom* of the main
      deck, **2 Runes channelled per turn** (3 on turn 1 when on the draw) and 1 card drawn.

      Two decisions worth knowing. Recycled cards go to the **bottom, not out** — a simulator that
      discarded them would quietly make every deck look more consistent than it is. And the seed is
      the hand: any opener can be re-drawn by its number, which is what lets a test pin one.

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
| Match log | The matchup as two mirrored cards with a VS rule, mono section labels, 52px select fields, and **Continue → review sheet → Finalize**. Nothing saves on the result tap any more. Logging is **per game**: a card per game asking turn order, both Battlefields and who won, revealed one at a time and withdrawn once the match is settled — a Bo3 at 2–0 never shows a third. The match result is **derived, never asked** (`lib/match-progress`), and game 1's answers mirror onto the match columns so the existing splits keep working |

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

### Not done — screen layouts

Every one of these is a layout change the design specifies and the app does not have:

| Screen | What the design adds |
| --- | --- |
| Deck detail | Legend art in the header, cut at 100° with a long fade. A **Stats** tab (the app puts stats on Overview). A **List / Gallery** toggle for the decklist. Version actions as buttons — *Open this list*, *Fork from here*, *Compare* — instead of an `Alert` action sheet |
| Deck legality | A sentence, not a bar: *"Not legal — Main deck 38/39 · One card short. Everything else checks out."* |
| Deck editor | A custom *Discard and continue / Stay here* sheet where the app uses `Alert` |
| Analytics | "Findings first, then one breakdown at a time" — a different structure from the current `AnalyticsPanel` |

### Design gaps to resolve

- The design predates **event mode**: its Stats screen has *Match history · Analytics*, with no
  Events tab. The app now has three.
- No spec for the **collection coverage counter** on deck overview (`44/59 in your collection`),
  which also postdates it.
- Progress fills (`progressFill`, `progressSegmentDone`) were left white: the design does not say
  whether progress counts as "current state" and so earns the accent.

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

| 14 | ~~**The recent-opponent rail is gone**~~ — **closed.** Restored above the Legend field in step 4 of the log flow, not inside the picker: a shortcut you have to open something to reach is not a shortcut. Read once on mount, so logging four rounds of an event does not reshuffle the rail between them. Four probes were written against `recentOpponents()` when it finally got a consumer — undone matches, deleted matches, a printing leaving the library mid-event, and the limit — and **all four passed unchanged**. The query was correct; only its reachability was the defect | Post-gap-1 audit | Closed |
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
versions the fix is a `FlashList` and a restructured screen, not a query change.

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

### Known issues, parked

- **The leave prompt only fires from Cancel**, not the hardware back gesture or an edge swipe. A
  real navigation guard needs `usePreventRemove` from `@react-navigation/native`, which is **not a
  declared dependency** — importing it is the phantom-dependency bug from M0. Worth adding the
  dependency deliberately rather than smuggling it in through hoisting
- **Inline version expansion on deck detail is unverified.** Implemented during the Hi-Fi pass and
  never confirmed against a device screenshot — the only item from the original FIX FIRST list still
  unconfirmed
- **The card gallery's unowned tiles no longer dim**, which was deliberate, but nothing replaced the
  signal for the *binder* case where you are filing and want to see what is still at zero. Watch
  whether the count badge alone is enough

### Design gaps — raise with the design, do not invent

The Hi-Fi design predates several things the app now has. Each of these is a decision for the design
to make, not for the implementation to guess:

- **No Events tab.** The design's Stats screen has *Match history · Analytics*; the app has three
  segments because M6 shipped event mode. **This blocks the Stats rebuild** — there is no drawn
  answer for where events live
- **No spec for the collection coverage counter** (`44/59 in your collection`) on deck overview
- **Gallery is drawn as filable**, but ownership lives only in binders, so `/binder/gallery` is
  read-only. Either the design gains a default binder or the read-only treatment becomes the spec
- **Progress fills were left white** — the design does not say whether progress counts as "current
  state" and so earns the accent

### Opening the deck editor takes about half a second

Reported from a device, **cause not yet measured** — and deliberately not guessed at. Ruled out
already: the data reads. A query across the whole 1,451-card library measured **4.18 ms** during M1
hardening and hydration **0.79 ms**, so the five small reads the editor mount performs cannot
account for it. Caching the deck or seeding it would buy back single-digit milliseconds and add a
cache that can disagree with the database — which in this app means an editor opening on a stale
list and forking a version from it.

Two candidates worth measuring, in order of suspicion:

- **First-render cost.** The editor list view is a plain ScrollView mapping over its candidates, so
  the Main tab mounts up to ~900 rows, each with an image, before the first frame. The gallery view
  goes through FlashList and is virtualised; the list view is not. This is a regression introduced
  with the one-list-per-zone rebuild — the old editor opened on the deck own ~57 slots
- **The navigation transition.** A stack push animates for roughly 300 ms by default, which is not
  a delay before the screen arrives so much as the screen arriving slowly

The instrument already exists: `features/matches/timing.ts` produces the
`[timing] + pressed -> sheet ready: 86 ms` line. The same marks around the Edit tap would separate
tap -> mounted, mounted -> loaded, loaded -> painted in a single run.

### Deviations from the Hi-Fi design, parked rather than fixed

Both are in the match log's game cards (`src/components/matches/GameCard.tsx`), where the
same notes are recorded in the file header.

- **Their Battlefield opens the card picker instead of expanding an inline search list.** The
  design draws a search box and a short filtered list inside the game card. Its list is a mock
  with six entries; the real one is every Battlefield in the library, so the honest version is a
  scrolling list nested inside the form's own scroll. The picker sheet already has the search the
  design is asking for. Revisit if the inline list can be capped short enough not to scroll —
  a handful of results and no inner scroll view would match the design without the trap
- **Game cards are titled "Game 1 / Game 2", not the design's "Match 1 / Match 2".** Inside a
  match log, "Match 2" names the wrong thing. Worth confirming with the design which was meant
  before changing either side
