# Roadmap

**M0 – M5 is the complete usable product.** M6 – M8 is expansion and release.

| Milestone | Theme | Status |
| --- | --- | --- |
| [M0](#m0--foundation) | Foundation | ✅ Done |
| [M1](#m1--card-data) | Card data & gallery | ✅ Done |
| [M2](#m2--decks) | Decks & builder | ✅ Done |
| [M3](#m3--versioning) | Versioning | ✅ Done |
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
- [x] Fork-on-save for locked versions; amend-in-place for unlocked
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
the root `Stack` (there is no `_layout.tsx` under `app/deck/`). `router.replace` resolves to a React
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

- [ ] Drizzle schema for `matches`, `match_games`, `events`
- [ ] Log-match sheet: deck selector, WIN/LOSS, recent-opponent chip rail
- [ ] "Add details" expander: on play/draw, BO3 strip, event, mulligans, tags, notes
- [ ] Undo toast with live record readout
- [ ] "Log another" for consecutive rounds
- [ ] Match list, detail, and edit
- [ ] Haptics throughout
- [ ] **Call `lockVersion()` on the first match** — the whole M3 model is inert until something does
- [ ] **Remove the M3 scaffolding**: the `__DEV__` "Simulate a match (lock)" action, the Profile
      self-check (`src/features/decks/version-selfcheck.ts`), and the `[editor]` / `[compare]` logs
- [x] **Re-check `versionMatchCounts()`** against the real `matches` table — it currently returns an
      empty map by design, and every "No matches yet" in the timeline depends on that being right
- [ ] **Wire `match_games`** — migration 6 created the table and nothing reads or writes it. The BO3
      strip in the details expander is its only consumer, and shipping M4 without it leaves dead
      schema of exactly the kind the unreachable-code audit flagged

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
- [ ] **Pool versions whose diff is `cardSetIdentical`** when computing per-version stats. This is
      not an optimisation — it is the promise that justified making an art swap fork a locked
      version in M3. Two versions holding the same 40 cards under different printings must report
      one combined sample, or that decision cost the user statistical power for nothing

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

- [ ] **Deck import/export** — parse pasted decklists (via `/cards/name?fuzzy=`), export as text and share code
- [ ] **Collection tracker** — `collection` table, owned counts, "missing cards" flags in the builder
- [ ] **Goldfish** — draw sample opening hands from a version, mulligan simulation
- [ ] **Event mode** — group matches into tournaments with rounds and final placement.
      The `events` table and `matches.event_id` already exist (migration 6) and **nothing can write
      either**: M4 records only `event_type`, the enum. Creating, listing and attaching events is
      this milestone's work, and until it lands `event_id` is null on every row by design

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

## Known gaps

Found on a device, not yet fixed. Each is a real defect or a real omission — none is a
"nice to have", and none should be closed without checking it on hardware.

| # | Gap | Found | Severity |
| --- | --- | --- | --- |
| 1 | **Version compare is unreliable to invoke.** The diff itself is correct for every pair, branches included — proven by test. The *selection* is long-press-only, with no affordance, no way to cancel a pick, and a silent trap: after picking one version, tapping a second opens that version's action sheet instead of comparing, while the first stays selected | M3 device pass | High — the compare screen is what the app exists for, and it is currently reachable by accident |
| 2 | **A save that amends in place says nothing.** With no matches logged, editing a deck correctly rewrites the current version instead of forking — but nothing tells the user that, so "I edited my deck and got no version" reads as a bug. Needs a post-save line, not a redesign | M3 device pass | Medium — correct behaviour, wrong impression |
| 3 | **No route back to the tabs from a pushed screen.** A back chevron now exists, but deck detail, the editor and the build flow all cover the tab bar, so returning to Decks or Cards means walking the stack back. The fix is structural — move the deck routes inside the tabs group — not another button | M3 device pass | Medium |
| 4 | **The main-deck step has no filters.** Search only. Picking 40 cards from ~900 wants the cost and type filters the gallery already has | M3 build | Medium |
| 5 | **`versionMatchCounts()` is stubbed until M4.** Returns an empty map when the `matches` table does not exist, so every version reads "No matches yet" or "Locked". Correct today, and must be re-checked the moment matches land | M3 | Low — by design |
| 6 | **A version label can only ever be set at fork time.** `setVersionLabel()` and `setVersionNotes()` exist, are tested, and have **no caller**. So a typo in the save sheet is permanent, and v1 can never be labelled at all — it never passes through a fork sheet. `deck_versions.notes` ("why did I make this change?") is unreachable entirely | Unreachable-code audit | Medium — the timeline is meant to read as a story, and half its text cannot be written |
| 7 | **Deck rename, notes, and archive are unreachable.** `renameDeck()`, `setDeckNotes()` and `archiveDeck()` are implemented and tested with no UI caller. `listDecks(includeArchived)` takes a parameter nothing can set | Unreachable-code audit | Medium — a mistyped deck name currently means delete and rebuild |
| 8 | **The editor never mentions unresolvable cards.** Deck detail names them; the editor says nothing, so a deck whose printing left the library just looks short, in the one screen where the user might "fix" it by adding a duplicate | Unreachable-code audit | Medium |
| 9 | **Dead code:** `missingCardCount()` superseded by `missingCards()`, and `useDeckEditor.isDirty()` unused since the editor began diffing against the database | Unreachable-code audit | Low |
| 10 | **15 moderate `npm audit` advisories**, all in dev tooling (`@expo/cli`, `@expo/config*`, `@esbuild-kit/*`) — transitive, not in the app bundle. Recorded so it is a decision rather than an oversight | Post-move `npm ci` | Low |
| 11 | **`events` and `matches.event_id` are shipped but unwritable.** Migration 6 created the table; nothing can create an event, so `event_id` is null on every row. M4 records `event_type` (the enum) only — event *grouping* is M6, where it is now written into the checklist | M4 data-layer audit | Low — scoped, not forgotten |
| 12 | **`match_games` is shipped but unwritten.** Its only consumer is the BO3 strip inside M4's details expander, so it is this milestone's work rather than a deferral — added to the M4 checklist | M4 data-layer audit | Medium — dead schema if M4 ships without it |

Gap 1 has `__DEV__` instrumentation in place (`[compare]` lines in the Metro log) recording both the
long-press selection and the resolved pair, so the next device pass measures the interaction rather
than guessing at it.

Gaps 6 and 7 share a cause worth naming: the query layer was built out ahead of the screens, so
functions exist, pass tests, and are never called. Tests passing is not evidence a feature is
reachable — nothing in the suite can tell the difference between "works" and "works and is wired up".

## Backlog

Deliberately deferred — revisit after launch with real usage data.

- Meta aggregation across users (needs a user base; privacy design required first)
- Price tracking via the TCGPlayer / Cardmarket IDs the API exposes
- Web export of the Expo codebase
- Deck sharing between users
- Sideboard / tech-card tracking as a first-class concept
- Widgets and watch app for ultra-fast logging
