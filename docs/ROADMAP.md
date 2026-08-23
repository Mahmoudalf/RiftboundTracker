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

**M0 – M5 is the complete usable product.** Everything after it is expansion and release.

> ### The order changed on 2026-08-20 — read this before the milestones below
>
> **Owner's call, and it inverts what came before it.** The plan used to end at a store release with
> cloud sync somewhere in the middle. It now ends at the store, and the backend comes first:
>
> **stable app → OWASP hardening → backend → web platform → Riot → release**
>
> Three things drove it. The product is **two clients sharing one account**, not a phone app with
> optional sync, so the server is a foundation rather than a feature. The backend is **self-hosted
> to begin with** — on hardware already paid for, moving to rented hardware when there is money to
> rent it with — which makes portability an architectural constraint rather than a preference. And
> **Riot moves to the end**, so registration happens with something finished to show rather than a
> plan to describe.
>
> Entries written before this date describe the old order. They are **not rewritten** — see the
> vocabulary note above for why. [M8](#m8--cloud-and-the-web-platform) is the one that matters:
> it planned the backend and the web platform together on managed Supabase, and it is superseded by
> [B1](#b1--backend) and [W1](#w1--web-platform).

**T1 is lettered, not numbered, on purpose.** Inserting Localization as M7 already pushed Cloud from
M7 to M8 once, and every roadmap entry written before that now needs reading with the old numbers.
A letter slots a milestone into the sequence without renumbering the ones after it, so nothing
written today can be made wrong by tomorrow.

**That convention paid for itself on 2026-08-20.** The plan was reordered around a backend and a
self-hosted web platform, with the store release moved to the end — four milestones inserted and one
split in two, and **not one existing number changed.** S1, B1, W1 and R1 slot in; M8 is superseded
rather than renumbered; M9 is still M9.

| Milestone | Theme | Status |
| --- | --- | --- |
| [M0](#m0--foundation) | Foundation | ✅ Done |
| [M1](#m1--card-data) | Card data & gallery | ✅ Done |
| [M2](#m2--decks) | Decks & builder | ✅ Done |
| [M3](#m3--versioning) | Versioning | ✅ Done |
| [M4](#m4--matches) | Match tracking | ✅ Done |
| [M5](#m5--analytics) | Analytics | ✅ Done |
| [M6](#m6--extras) | Extras | ✅ Done |
| [M7](#m7--localization) | Onboarding & languages | ✅ Done |
| [T1](#t1--security-hardening) | Security hardening | ✅ Done |
| [S1](#s1--stability-on-real-devices) | Stability on real devices | ⬜ **Next** |
| [T2](#t2--owasp-hardening) | OWASP hardening — three lists, three surfaces | ⬜ Not started |
| [B1](#b1--backend) | Backend — accounts, sync, self-hosted | ⬜ Not started |
| [W1](#w1--web-platform) | Web platform | ⬜ Not started |
| [R1](#r1--riot-api-and-compliance) | Riot API and compliance | ⬜ Not started |
| ~~[M8](#m8--cloud-and-the-web-platform)~~ | ~~Cloud + web platform~~ | ↳ **split into B1 + W1, 2026-08-20** |
| [M9](#m9--ship) | Release | ⬜ Last |

> **Renumbered 2026-08-14.** Localization entered as a new M7, moving Cloud to M8 and Ship to M9.
> Historical notes below that say *"before M7"* meant the **Cloud** milestone and now name it, so a
> future renumber cannot make them wrong again.

## Where things stand — 2026-08-16

**M7 is done.** Onboarding, German and French, and the machinery that keeps the translation honest.
~~M8 — Cloud is next and unblocked.~~ **Corrected 2026-08-19: T1 — Security hardening was inserted
between M7 and M8 on 2026-08-16 and is next.** ~~M8 is still unblocked and still follows.~~
**Corrected again 2026-08-20: T1 is done, and M8 no longer exists as one milestone** — the plan was
reordered around a self-hosted backend and M8 split into [B1](#b1--backend) and
[W1](#w1--web-platform). ~~The order is now **[S1](#s1--stability-on-real-devices) →
[T2](#t2--owasp-hardening) → B1 → W1 → [R1](#r1--riot-api-and-compliance) → [M9](#m9--ship)**.~~
**Corrected 2026-08-22: iOS moved to the end**, behind both the Android and the web releases, by
the owner. The order is now **[S1](#s1--stability-on-real-devices) → [T2](#t2--owasp-hardening) →
B1 → W1 → [R1](#r1--riot-api-and-compliance) → [M9](#m9--ship) →
[iOS](#ios-was-asked-for-and-not-built-2026-08-20)**.

**S1 is in progress.** The [first device pass](#s1--the-device-pass--2026-08-22) ran 2026-08-22:
60 fps and airplane mode both hold, the onboarding hand-off does not flash, and two configuration
bugs were found and fixed — the app did not uninstall its own data, and it installed under the
working title instead of **Rifthall**. On 2026-08-23 the package id followed the name to
`com.rifthall.app`, spending the one window in which that is free.

**Shipped since 2026-08-14**

| | |
| --- | --- |
| **S1** · the first device pass | 60 fps and airplane mode confirmed on hardware, no flash on the onboarding hand-off, Android Auto Backup turned off so an uninstall is a real uninstall, and the app renamed to **Rifthall** — package id included. [Detail](#s1--the-device-pass--2026-08-22) |
| **M7A** · onboarding | Welcome + progressive setup, a development disclaimer on the first screen, library progress that never blocks, replayable from Settings. [Detail](#m7a--what-shipped-2026-08-16) |
| **M7B** · finished and enforced | The last 137 strings, locale-aware number formatting, and a test that fails the build on untranslated prose. [Detail](#m7b--finished-and-enforced-2026-08-16) |
| **The gate's roots gap** | The scanner had never looked at `src/features`, `src/lib` or `src/api` — 32 more strings, and a leak that showed German users Zod's English output. [Detail](#the-gates-own-roots-gap-2026-08-16) |
| **Settings panel** | The You tab became Settings. Migration 23, a display name, ~~a feedback form that collects nothing~~ — **the feedback card was removed 2026-08-19**, see the note in [Detail](#the-settings-panel-2026-08-16) |
| **Language persists** | The last open M7B item. Applied at module load, before the navigator's first render |
| **Icon system** | Five "icons" were Unicode characters absent from every bundled font. One `ViewToggle` replaces three drawings of one control. [Detail](#the-icon-system-2026-08-16) |
| **Version-lock rule** | Taught at the moment it happens rather than in advance. [Detail](#the-version-lock-rule-taught-where-it-happens-2026-08-16) |
| **Stats** | "All decks" was unselectable — the sentinel doubled as "nothing chosen yet", so the tap was overwritten before it rendered. Tabs moved above the deck picker, which a long deck name used to push off the row |
| **H1** · key audited | Repo verified clean across all 17 commits. Revocation still owner-side. [Detail](#h1--the-key-audited-2026-08-16) |
| **T1** · security hardening | Four batches. §D, §E and §F were code; §B and §C were recorded decisions with tripwires; §A became [`docs/STORE.md`](STORE.md). [Detail](#t1--security-hardening) |
| **The first release build** | An Android APK reached a real phone on 2026-08-20 and two navigation bugs surfaced within minutes, both one line, both invisible to a renderer-less suite. [Detail](#two-navigation-bugs-from-the-first-release-build-2026-08-20). iOS was asked for and [could not be built here](#ios-was-asked-for-and-not-built-2026-08-20) |
| **The plan reordered** | Backend before release, Riot last. M8 split into [B1](#b1--backend) + [W1](#w1--web-platform); [S1](#s1--stability-on-real-devices) and [T2](#t2--owasp-hardening) inserted. No existing number changed |

**Numbers**, remeasured 2026-08-21: 23 migrations · ~~592 tests / 37 files~~ ~~761~~ **766 tests /
43 files** · ~~712 keys~~ **749 keys** in each of three languages · scanner reporting 0 across
~~97~~ **99** files. The key count went *down* — the feedback card took ten strings with it. Each figure
here is counted, not carried forward: an earlier draft of this line stated a test count that had
never been run.

<details>
<summary><strong>Shipped 2026-08-13 → 08-14</strong> (the pre-Cloud polish pass)</summary>


| | |
| --- | --- |
| **A1–A8** · write-only schema dropped | Migration 22 removed six columns and the `sets` table before the Cloud milestone (M8) could mirror them into Postgres |
| **B2** · available-copies label | Shows what a second deck may still claim. Needs cards filed in a binder to appear |
| **B3** · editor leave guard | Device-confirmed on the Android back gesture, the case the old prompt missed |
| **B4** · binder grid + dimming | Device-confirmed |
| **C1** · editor open time | `FlashList` plus a chrome restructure. Device-confirmed as "much faster" |
| **D1** · inline version expansion | Device-confirmed. Last item off the original FIX FIRST list |
| **Analytics rebuild** | Built to `1_ANALYTIC02`: anchor · findings · opponent-scoped drawer, four states |
| **The draw rule** | A draw is now half a win and half a loss, app-wide |
| **Domain marks + hue correction** | Device-confirmed. The design's set had the right colours on the wrong names |
| **Deck rename** | Renaming with no card change saved nothing — the write lived behind the version sheet. Device-confirmed |
| **Main-deck notation** | `41/40` read as "one over" beside a verdict saying legal. Now `40+`, and minima never colour as over |
| **Match view rebuilt** | Brought onto the Hi-Fi vocabulary: matchup cards, `ChoiceRow`, hand tiles, a real scoreline. Device-confirmed |
| **F1** · log form leave guard | Closed by owner decision. Guards on *answers*, never on the pre-filled defaults, so the ten-second path never sees it |
| **G2** · collection coverage counter | Closed by owner decision — passed as drawn |
| **G4** · progress fill colour | Closed by owner decision — the Create-Deck step bar stays white |

</details>

**Needs attention — nothing blocking, all owner-side**

| | |
| --- | --- |
| **H1** · **delete** the Piltover Archive key | **Repo side verified clean 2026-08-16 — the revocation itself is still open and only the owner can do it.** See [the audit](#h1--the-key-audited-2026-08-16). The feature that would have used it is dropped (see Backlog), so there is nothing to rotate *to*. Still worth doing: it was pasted into a chat log, and an unused key is not a safe key, only an unmonitored one |
| **D2** · 60 fps and airplane mode | ~~**Postponed by owner, 2026-08-14.**~~ **Unblocked 2026-08-20 — a release APK exists.** Metro was the connection airplane mode cut, and a release build has no Metro. Now an [S1](#s1--stability-on-real-devices) item rather than a blocked one |
| **B2 / analytics on device** | Both need real logged data before they show anything. Not defects; not yet observed either |

**Carried deliberately**

| | |
| --- | --- |
| ~~**G3**~~ · gallery filable vs read-only | **Closed 2026-08-14** — read-only *is* the spec. The design drew the library with a binder's `− count +` row; ownership lives only in binders, and `/binder/gallery` has no row behind it (`binderId` is null by construction). A default "Unsorted" binder was the alternative and was declined: every install would carry a binder nobody asked for, to preserve a control the library has no use for. "Your collection is the binders you made" stays one rule |
| ~~**H2**~~ · npm advisories | **Moved to Backlog 2026-08-14.** Measured clear of the release bundle — see below |
| ~~**H3**~~ · over-exposed exports | **Moved to Backlog 2026-08-14.** No observable effect on the app |
| Two Hi-Fi deviations in the match log | Both recorded with reasons in `MatchCard.tsx` |

**The gap list is empty of anything that blocks a release.** The only items left against the app are
D2 (postponed, needs a release build to test) and H1 (owner-side, and not a code change).

**T1 — Security hardening is done (2026-08-20).** Three batches, on 2026-08-16 and 08-19. §D
untrusted input, §E supply chain and §F failure behaviour were the code half; §B secrets and
transport and §C data at rest were the decisions half; §A is the store-facing documents, now written
in [`docs/STORE.md`](STORE.md). ~~Then **M8 — Cloud and the web platform**, which is unblocked.~~
**The successor is [B1](#b1--backend), and the point survives the rename:** A1–A8 existed precisely so no dead schema
reaches Postgres, and T1 has set the rules the backend has to be built to —
[what replaced RLS](#what-replaces-rls),
[auth](#auth-constraints-set-by-t1-2026-08-16) and [four more](STORE.md#7--what-m8-inherits).
[T2](#t2--owasp-hardening) adds the API list to that set.

**§A was scoped as paperwork and is not.** Reading Riot's actual policy rather than a paraphrase of
it turned up a **registration requirement the project has not met**, a clause restricting card
assets to *"provided by the Riot API"* when the app's data path is a community API, and an
unapproved use case — published win rates and matchup percentages — that the phone app is clear of
and **the M8 web platform would walk into**. All owner-side or M8-side; none blocks the work in
front of us. [Detail](#t1-batch-3--done-2026-08-19).

**Two copy items closed on 2026-08-19**, both deferred by the batches that found them: Riot's
required notices now appear verbatim on the About card, and the welcome screen no longer tells users
their data lives only on this device when both platforms back it up.
[Detail](#t1-batch-4--done-2026-08-19).

**One item came out of batch 2 that is not a security fix.** The welcome screen tells users *"Your
decks and games live only on this device."* Both platforms back the database up — Google Drive on
Android, iCloud on iOS — so the sentence is false as shipped. ~~The backup stays; the sentence
changes.~~ [Why](#t1-batch-2--done-2026-08-19). **Reversed on Android 2026-08-22:** the owner
uninstalled the app and its data came back, `android.allowBackup` is now `false`, and the
sentence changed again — this time to say that uninstalling deletes everything. iOS still backs the
database up to iCloud and does not have the fix. [Detail](#s1--the-device-pass--2026-08-22).

**M9 — Ship has not started, and several of its items need lead time rather than effort.**
`app.json` still carries the pre-retheme `#0A0B0F` for the splash and the Android adaptive icon
against a `#141416` shell; `assets/` holds ~~only `domains/` and `seed/`~~ **`domains/`, `seed/`
and one placeholder splash**, so there is still no app icon or store screenshot; and there is no
`eas.json`, ~~which is also what blocks D2~~. (The missing error boundary was the fourth item
here — ~~added in T1 §F on 2026-08-16~~.) None of it is hard. All of it is required before a build
reaches a store.

**Two of those items moved to [S1](#s1--stability-on-real-devices) on 2026-08-20**, because they
stopped being release paperwork and became things a device pass needs: the signing keystore, and
real art in place of the `#0A0B0F` square that was generated to stop the Android build failing at
resource linking. **The splash was never cosmetic** — a missing drawable is a build error, not a
plain screen.

---

## H1 — the key, audited (2026-08-16)

**The repository is clean. The key itself is still live until the owner deletes it on
piltoverarchive.com, which is an account action nobody else can perform.**

What was checked, and what each check found:

| Check | Result |
| --- | --- |
| Working tree, `ak_`-shaped secrets | none |
| Working tree, `api_key` / `apikey` / `secret` / `token` | only false positives — `Token` the card supertype, `design-token`, FTS5 tokens, `isTokenCard` |
| **All 17 commits**, every blob, for the key pattern | **absent** — `git grep` over `git rev-list --all` exits 1 |
| `.env` files on disk | none exist; `.gitignore` covers `.env` and `.env.*` (lines 39–40) |
| `piltoverarchive.com` in history | present only as prose in `docs/ROADMAP.md`'s backlog entry — never a call site |

**`@piltoverarchive/riftbound-deck-codes` stays, and removing it would break deck import and
export.** It shares a name with the site and nothing else: version 1.4.0, Apache-2.0, **zero
dependencies**, and no `fetch`, `XMLHttpRequest`, `axios` or `http` anywhere in the package. It
encodes and decodes deck codes offline and has never needed a credential.

So the app requires **no credential of any kind** outside Supabase, which M8 will introduce. That was
already the position after the URL-import feature was dropped; this audit is the evidence for it
rather than the claim.

**Still open, owner-side:** sign in at piltoverarchive.com, find the API key section of the account
settings, and delete the key. Deleting beats regenerating — a replacement is another secret to look
after for a feature that no longer exists. The key was pasted into a chat log, and a log is not a
place a secret stops existing.

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

## M7 — Localization

Two halves that share one job: **making the app legible to somebody who did not build it.** A first
run that explains itself, and an interface that speaks the language of the person holding the phone.

It sits before Cloud deliberately. Onboarding and translation both touch **every screen's copy**, and
doing them after the sync UI exists means doing them to more screens than necessary — sign-in,
conflict messages and sync status are all copy that would need writing twice.

### M7A — Onboarding

- [x] First-run flow: what this app is for, and the one idea it is built on — a deck is a *living
      object with a version history*, and a match is bound to the exact list that played it
- [x] The version-locking rule introduced **by using it**, never by a wall of text. The editor
      already states it inline (*"v2 · 30 matches tracked — saving will create v3"*); onboarding's
      job is to make that sentence land the first time it appears rather than explain it in advance
- [x] Card library download on first launch, with progress — the bundled seed makes this
      non-blocking, and the user should be told that rather than left watching a spinner
- [x] An empty Decks tab that is an invitation, not a blank list — **already satisfied when
      checked**, see below
- [x] Skippable, and re-openable from Profile

**Done when:** a player who has never seen the app can build a legal deck and log a match without
being told anything out of band.

**All five closed 2026-08-16.** See [M7A — what shipped](#m7a--what-shipped-2026-08-16).

### M7B — German and French

- [ ] An i18n layer and a locale store — device locale by default, overridable in Profile
- [ ] Every string in the app extracted. There is no string table today: copy is written inline, and
      much of it is deliberately voiced prose rather than labels, which is what makes this a real
      piece of work rather than a find-and-replace
- [ ] **de** and **fr** translations, English as the fallback for anything missing
- [ ] Plurals and number formatting through `Intl` — records, percentages and confidence intervals
      all render numbers, and a German decimal comma is not a cosmetic difference
- [ ] Dates via `Intl.DateTimeFormat` rather than the hand-rolled `gameDate`
- [ ] **Card data stays in the language the API returns.** Riftcodex serves English card names and
      rules text; translating them locally would invent names that do not appear on the card in the
      player's hand, and a deck list that disagrees with the cards on the table is worse than an
      English one. Only *app* copy is translated

**Done when:** the app runs end to end in German and French with no English left in the interface
chrome, and no card name altered.

**Settled 2026-08-14:** German and French ship **together**. German is proofread by the owner; French
rides on user feedback, so every string in `fr.ts` is a first draft until somebody who speaks it has
read it *in the app*. French is the long pole, not German.

### M7A — what shipped (2026-08-16)

Two screens in `app/onboarding.tsx`, built from `1_Onboarding_Welcome` and `1_Onboarding_Setup` in
the Hi-Fi doc. Welcome, then one progressively-disclosed setup screen: name → language and first
deck. Everything is skippable, and `completeOnboarding()` runs on **every** exit, so seeing it once
is enough however you leave.

**Three deliberate departures from the mockup**, each because the design describes a picture and the
app has to behave:

- ~~The design's product name is **Rifthall**, a naming exploration the app never adopted.~~
  **Adopted 2026-08-22.** The app installed on a phone as *Riftbound Tracker*, the working title,
  and the owner named Rifthall as the real one. It is no longer a departure from the mockup —
  the mockup was right first. [Detail](#s1--the-device-pass--2026-08-22).
- Its name-field helper reads *"Shown on match history and shared decks"* — a promise the app cannot
  keep, since nothing reads a display name and ~~nothing leaves the device~~. It says what is true.
  **Corrected 2026-08-19:** nothing is *sent* anywhere by the app, which is what the helper is about,
  but the database — display name included — is copied to Google Drive or iCloud by OS backup. See
  [T1 batch 2](#t1-batch-2--done-2026-08-19). **Corrected again 2026-08-22:** on Android it is no
  longer copied anywhere — *nothing leaves the device* is now literally true there, and only there.
  [Detail](#s1--the-device-pass--2026-08-22).
- **Skip is always available.** The design fades *"I'll look around first"* in only once the deck
  section opens, which leaves the first thirty seconds of a brand-new app with no way out of a form
  nobody asked for.

**The gate for the second half is the name, not the language — and that is a fix, not a
simplification.** The design opens the deck choice only after a language is *chosen*. English is
preselected, so an English speaker has nothing to choose; tapping the row you are already on is not
an action anyone performs, and the flow dead-ended with the deck options never appearing. Both
sections open on the name instead. **A default that is already correct must never require
confirming** — anything gated behind "change this setting" is unreachable for whoever the default
already suits, which is the majority.

**The version-locking rule is introduced by the editor, not by onboarding.** The rule is a statement
about an object a first-run user does not own yet; it is learnable when it constrains you and not
before. See [the locked-version banner](#the-version-lock-rule-taught-where-it-happens-2026-08-16).

**The empty Decks tab needed no work** — it was checked rather than assumed and was already an
invitation: *"Track a deck through every change"*, the version model in one sentence, and two actions
with a clear primary. `EmptyState`'s own docstring carries the rule it follows.

#### The language picker was an inescapable loop

Reported from a device: choosing a language sent the flow back to step 1, every time.

`<Stack key={locale}>` remounts the entire navigator so every screen re-reads every string — and a
keyed remount unmounts whatever is on screen. The step counter was `useState` inside that screen, so
picking a language destroyed it. **The one control the flow exists to offer was the one thing that
reset it**, and the only way back to the language rows was to walk forward and trip the same wire.

Progress now lives in `useOnboardingDraft` at module scope, which outlives the remount. The language
row writes the draft *before* calling `setLocale`, because `setLocale` is what tears the component
down. Guarded by a test that switches language four times in a row — the loop was not a one-off
reset, and that is what made it inescapable rather than merely annoying.

**Any future screen holding in-progress state has the same exposure.** Onboarding is the only one
today; the deck editor would qualify, but Settings is unreachable without leaving it first.

#### The welcome screen was centred on the wrong box

The hero sat about a tenth of the screen high. `flex: 1` centres within whatever its siblings leave,
and the development disclaimer below it is a ~190 px block — so "the middle" was the middle of a
shorter, upward-biased region. Measured at **38 %** down the screen against a target of 45–50 %.

The disclaimer moved *inside* the centred group, which is where it belongs — it is part of what the
screen has to say, not a footnote pushing the message around. Group centre: **47.9 %**.

A real bug fell out of the same pass: the welcome CTA had **no bottom safe-area inset**, so on any
phone with a home indicator the button sat partly underneath it.

#### The development disclaimer

On the first screen a user ever sees, above the only button — not buried in About, where nobody
looks before using the thing. Bordered in the accent so it reads as a notice rather than more body
copy, and it names the one consequence a player can act on: ~~**the data is local, so the only
backup is the one they make.**~~

**Corrected 2026-08-19.** That reasoning was right and the sentence it produced was not. The copy
read *"Your decks and games live only on this device"*, and [T1 §C](#c--data-at-rest-on-the-device)
found both platforms copy the database into the user's own cloud backup — so the app was making a
promise the OS breaks by default. The consequence a player can act on is still the point; it is now
stated as two clauses rather than one, because **the app sends nothing** and **the device backup is
the user's own** are both true and only the first was being said.
[What changed, and why the backup stays](#t1-batch-4--done-2026-08-19).

#### The card library, reported rather than spun

Four states, and the distinction that matters is **empty versus seeded**, not syncing versus idle.
With cards on the device every message is reassurance; with none, a failure is the one case worth
calling a problem — and even then nothing blocks.

**A progress bar is drawn only while the library is genuinely empty.** Once the bundled seed has
landed the download is background work, and a progress bar over background work is an invitation to
wait for it — the exact failure the checklist item names.

#### Reopenable, without eating the settings it walks past

`beginReplay(displayName())` resets the draft — so a replay cannot resume mid-form from an abandoned
run — then seeds the stored name and marks it committed.

That is not a convenience. `finish()` writes the draft's name back, so **replaying from a blank draft
would erase a name set months ago** — a settings screen deleting a setting because you opened it.
Guarded by a test that fails with `expected '' to be 'Linus'` when the seeding is removed. The
language needs no equivalent: the picker reads the live store and only writes when tapped.

`replaying` lives in the draft store rather than component state for the same reason the step does —
it is read at the very *end* of the flow, to decide whether to hand back to Settings or to the app.

---

### The Settings panel (2026-08-16)

The **You** tab became **Settings**. The old name promised an account the app does not have, and the
screen was never about a person — it is where the app is configured.

Five cards: display name · language · card library · ~~feedback~~ · about. **Four as of 2026-08-19** — see below.

**Migration 23 adds a `settings` key/value table.** Key/value rather than a column per preference,
which would cost a migration every time a checkbox is added to a table whose contents are optional by
definition. The trade is that the schema stops describing itself, so `queries/settings.ts` is the
only module allowed to name a key and `getSetting`/`setSetting` are deliberately **not** exported.
Four keys today: `display_name`, `locale`, `onboarded`, `seen_fork`.

**The language preference now persists** — the last open M7B item. Applied at module load in the root
layout rather than in an effect, because `<Stack>` is keyed on the locale: applying it after the
first render would remount the navigator and the user would watch the app open in one language and
switch to another.

**Feedback collects nothing.** An earlier draft attached the app version, platform, OS version,
language and row counts. Device and OS details are personal data under the GDPR, so collecting them
would oblige the project to run a *Datenschutz-Folgenabschätzung* — for a fan app that otherwise has
nothing to assess. **Owner's decision, and it stands for telemetry, crash reporting and analytics
alike.** The report is a category and what the user typed. There is no backend yet, so the button
copies rather than sends, and the card says so; a Send button that quietly did nothing would be the
one dishonest control in the app.

##### The feedback card was removed on 2026-08-19

**Owner's decision.** The test group is small enough to reach the owner directly, so a real
destination was never the bottleneck — and the card as built was a control whose whole function was
*"copy this, then go find me yourself"*. That is a step, not a feature. **A form comes back with
the backend**, where a report can actually go somewhere.

Four routes were weighed before the removal, and the fork that decided it is worth keeping, because
it is the same fork any future version faces:

| | |
| --- | --- |
| **The app hands off** — opens a mail app, a browser, or a share sheet, and the *user* presses send | The app still transmits nothing, so *"the app collects nothing"* stays true and all three [store documents](STORE.md) are untouched. The user also sees the whole message before it goes, which turns "nothing about your device is attached" from a promise into something they can check |
| **The app sends** — posts to a server | The app now collects user content. The Apple manifest's empty `NSPrivacyCollectedDataTypes`, the Play Data Safety answers and the privacy policy all change, and it needs a public write endpoint that does not exist before M8 |

`mailto:` was the recommendation and removal was the answer, which is the better one while the
group is this small: **a route that exists and is unused costs more than no route**, because it has
to be described accurately in three store documents and kept true.

**What survives the removal is the constraint, not the control.** Whatever replaces it attaches
nothing about the device — no version, no platform, no OS, no locale, no row counts. That was never
about the form; it is the standing rule that also governs
[crash reporting](#f--failure-behaviour) and analytics. The insert-only Supabase shape is recorded
for M8 in [`STORE.md` §7](STORE.md#7--what-m8-inherits).

Ten catalogue keys went with it, in all three languages — the first time the key count has gone
down. `SelectField` and `OptionRow` had no other caller on the screen and left with it; the
clipboard and toast imports too.

**The version in About is read from `app.json`** rather than hand-typed. A hand-written `v0.1.0` is
the same shape of mistake as the `M1` label that sat there for five milestones: a fact about the
build with nothing keeping it true.

The German tab reads **Optionen**, not *Einstellungen*. The bar draws 9.5 px uppercase monospace in
about a 76 pt cell — thirteen characters wrap and take the bar's height with them. The screen title
matches the tab rather than the two disagreeing, and `numberOfLines={1}` on the label means no future
translation can grow the bar.

---

### The icon system (2026-08-16)

Reported as *"the Decks and Collections icons look wrong"*. The audit found something worse than
inconsistency.

**Five "icons" were Unicode characters that no bundled font contains.** Checked against the actual
`.ttf` glyph maps rather than assumed:

| | Space Grotesk | JetBrains Mono |
| --- | --- | --- |
| `⌕` U+2315 — search, 3 sites | **missing** | **missing** |
| `☰` U+2630 — list toggle | **missing** | **missing** |
| `▦` U+25A6 — gallery toggle | **missing** | **missing** |
| `✓` U+2713 — language tick | **missing** | **missing** |
| `⇩` U+21E9 — import | **missing** | **missing** |
| `›` `↓` `−` | present | present |

All five were being drawn by whatever the OS substituted — a different typeface at a different
weight, and **a different one on Android than on iOS**. They were never part of the icon set; they
only looked like they were. `−` stays as text, being genuine typography whose icon form would be the
identical single stroke.

**One control had three drawings.** List/gallery was words in a bordered pill on deck overview, and
`☰`/`▦` in an inset track in the editor and the preview. Now one `ViewToggle`. Icons over words
because the pair sits beside a search field and a filter that are already icons — and because
"Gallery" made the widest thing on that row a translation risk for nothing.

**`decks` described a three-card stack but only closed the front card**; the other two were open
polylines with no corners, so at 23 dp it read as one card with two stray diagonals.

**`cards` took four attempts**, each rendered and looked at rather than reasoned about:

1. rect + spine + rings → read as a sidebar divider
2. two cards in a storage box → the tops merged into a blob
3. 2×2 grid of card-proportioned rects → indistinguishable from `gallery`; a 1.3 aspect ratio is not
   perceptible at 23 dp
4. **folder with a card in it** → distinct silhouette, survives the scale

The lesson that cost three tries: **at this size an icon is read by its outline, not its contents.**
Only changing the silhouette worked. The old one also lit just its top two cells on the active fill,
so the tab looked half-selected whenever you were on it.

---

### The version-lock rule, taught where it happens (2026-08-16)

The rule was already stated at all three moments — the editor banner before the edit, the save sheet
at the confirm, the toast after. The gap was narrower than "introduce the rule": **the earliest
statement, the one placed there specifically to arrive before it is too late, is a terse status line
that a first-time reader has no reason to parse as a rule.**

So the fix is not a new surface. Until a fork has happened, the same line in the same place says the
whole thing; afterwards it collapses to the short form for good. Whole sentences per case
(`.locked.long` / `.one.long` / `.other.long`), never a tail glued onto a translated first sentence —
German puts the new version number at the end of its clause.

**`seen_fork` is written when the fork completes, not when the banner renders**, and the distinction
is the whole reason it is not a dismissal flag: reading a warning and backing out is not the same as
watching it come true, and that player is exactly who still needs the long form. `firstFork` and
`parentGames` are captured **before** the flag is written and before `forkVersion` runs, or the first
would be false on the one occasion it must be true.

The first fork's toast names the games left behind — *"Saved as v2 · v1 keeps its 1 game"*. A count
makes it concrete: "your earlier version is untouched" is a policy; naming their games is a fact
about their deck. It falls back to the standard line when the forked version had none, because
claiming it "keeps its 0 games" would be a lie about the one thing the message exists to make real.

Proved by planting the regression — `seen_fork` written on render — and watching the *second* render
already read short.

---

### M7B — what has landed (2026-08-14)

The foundation, plus the shared formatters. No screen copy beyond Profile yet.

| | |
| --- | --- |
| `src/i18n/en.ts` | The source catalogue. `Key` is derived from it, so an unknown key is a **typecheck error at the call site** — proved by compiling four deliberate mistakes |
| `src/i18n/de.ts` · `fr.ts` | `Partial`, with an English fallback at runtime and a test that fails the build on a gap |
| `src/i18n/pseudo.ts` | English lengthened 35 %, accented, and bracketed — the layout probe, see below |
| `src/i18n/index.ts` | `t()` for `lib/`, `useT()` for components. ~40 lines, no dependency |
| `src/lib/format.ts` | Style and event labels, and `gameDate`, now translated. Slugs map to **catalogue keys**, not to English, so stored vocabulary and displayed vocabulary stay independent |
| `app/_layout.tsx` | The navigator is keyed on the locale — see below |
| `app/(tabs)/profile.tsx` | The language picker. `pseudo` appears only under `__DEV__` |

**No i18n library.** `i18next` and `i18n-js` were both considered. 250 strings across 3 locales needs
a lookup and an interpolation, and the thing this codebase actually wants — a key that fails to
compile — is what neither gives. The catalogue is the durable asset and the runtime is thin enough to
replace if ICU message format or a translation platform ever becomes necessary.

**Changing language remounts the tree** (`<Stack key={locale}>`). Most translated strings come from
plain functions in `lib/` that call `t()` imperatively and do not subscribe; making each a hook would
mean only components could format a label, and `lib/` would stop being pure. One remount on a
deliberate settings action is the cheaper trade than a subscription rule that would be forgotten in
one place and never noticed.

**`expo-localization` is a native module.** It was added as a config plugin, so a dev build compiled
before it exists does not contain it — and an unguarded `getLocales()` throws at module scope, before
first paint. `deviceLocale()` catches and falls back to English, because a missing device language is
not worth a crash when the picker still reaches every language. A `prebuild` and native rebuild is
needed before the phone's own language is honoured.

**Pseudo-localization comes before translation**, deliberately: it finds the containers that break
while the copy is still free to change and before anyone has been paid to translate a string that is
about to be shortened. The app has **48 `numberOfLines={1}` call sites**, every one of which clips
silently rather than wrapping, so those failures are invisible without it. Expansion is set at 35 %
rather than German's average 30 % — the average is measured over running prose, and this app's tight
spots hold single words, where the ratio is far worse (`Draw` → `Unentschieden` is +225 %).

**Fonts were verified before any of this**: Space Grotesk and JetBrains Mono both carry full German
and French coverage, `ß`, `œ` and guillemets included, checked against the actual `.ttf` glyph maps
rather than assumed.

### M7B — every screen migrated (2026-08-14)

> **This section's count was wrong, and the correction is below** — see
> [M7B finished](#m7b--finished-and-enforced-2026-08-16). The "0" was measured against a scanner
> that only looked at two of the seven places a string can live. Left standing rather than edited,
> because the mistake is the useful part: a zero from a search that cannot see everything is
> indistinguishable from a zero from one that can.

**All app copy now flows through `t()`.** The inventory went 239 → 0 real strings; what the scanner
still reports is code fragments its regex catches (`Record<…>`, `useState<…>`), not copy.

Roughly **330 keys**, each in all three languages, with the completeness and placeholder tests green.

Three things that were more than plumbing:

**Screen-reader labels are translated too.** Found hardcoded on several screens and treated as
first-class copy — a German app that speaks English to a blind user is not a German app.

**The findings layer is fully parameterised.** `lib/analytics/findings.ts` writes sentences about the
player's own data, and they were built by concatenating fragments in English word order. German puts
the verb where English puts the object, so no amount of translating the pieces would have made those
read as German. Every headline and every evidence line is now one key with named placeholders. The
plural noun in `finding.nextStep` is its own key rather than an inline ternary, because *which form
to use* is itself a decision that has to be translatable.

**`expo-localization` is now required lazily**, and this is the second reason rather than a
refinement of the first. The static import broke the **test suite** the moment `lib/` code started
translating: `findings.test.ts` could not load a React Native module, and `lib/` is pure,
tested-in-Node code by design. `__DEV__` needed a `typeof` guard for the same reason. The crash
guard for an un-rebuilt dev client falls out of the same change.

**Gate:** typecheck clean, lint clean, **527 tests / 31 files**. Bundle 200 / 13.90 MB with German
and French strings from every cluster confirmed present.

**The first real casualty is already in**: `game.result.draw` is `Unentschieden` in natural German
and does not fit a third of the screen at one line in `ChoiceRow`. Shortened to **`Remis`**, per the
owner's standing call that a tight container wins over the voice. The prose strings — `Prompt` and
`EmptyState` bodies, helper text — sit in containers that wrap freely and keep their full length.

---

### M7B — finished, and enforced (2026-08-16)

**M7B is done.** The two open checklist items — the last of the copy, and locale-aware number
formatting — are closed, and a test now fails the build if either regresses.

**The 2026-08-14 count was measured against the wrong thing.** That pass reported 239 → 0 and the
zero was true *for what it searched*: text between JSX tags, and a list of known prop names. A fresh
scan found **137 strings still in English across 26 files**, living in five shapes the first scanner
never looked at:

| Shape | Example |
| --- | --- |
| An argument to a call | `Alert.alert('Delete this deck?', 'Its versions and match history go with it.')` |
| A value in an object literal | `needs: 'No games in this scope.'` |
| A string returned from a helper | `return onPlay ? 'On the play' : 'On the draw'` |
| A template literal | `` `Match ${n}` `` — the old pattern matched `'quotes'` only |
| A module-scope constant table | `BLOCK_LABELS`, defined far from the component that draws it |

Two more turned up while fixing those, and both are worth naming because they are the same class of
blind spot: an **ALL-CAPS label** (`LEGEND`, `CHAMPION`) reads as an identifier and passed every
capital-first rule, and a **sentence opening with an interpolation** (`` `v${n} is measurably ahead…` ``)
starts with a lowercase letter and passed them too.

**Coverage came out uneven, not uniformly missing**, which is why spot-checking would never have
caught it. `app/game/[id]/index.tsx` had a fully translated delete dialog; `deck/[id]/index.tsx` next
door had four dialogs and one translated title. The archive prompt ended up with a **German title, an
English body and German buttons** — worse than untranslated, because it reads as broken rather than
as unfinished. Every dialog touched in this pass was converted whole.

**Several strings already had keys.** `match.pick.hand`, `match.pick.whichBack` and four others
existed in all three languages while the component beside them rendered the English literal. The
first pass created the key and never wired the call site.

**`src/i18n/scan.ts` does not look for shapes.** It takes every string literal in a file and decides
by *content* whether a person reads it — the only rule that a new way of writing a string cannot
out-flank. False positives are named (`ALLOWED`, `NEVER_TRANSLATED`, or an inline `// i18n-ignore`)
rather than handled by narrowing the search, so every exception is a decision somebody wrote down.

- `npm run i18n:scan` — per-file counts. `-v` for every string with its line.
- `src/i18n/untranslated.test.ts` — the same scanner, as a build failure. It asserts the file list is
  non-empty first, so a broken path cannot pass vacuously.
- `src/i18n/scan.test.ts` — 19 fixtures, one per shape, written from the **real** strings that got
  through. A scanner tested on invented strings only proves it finds what someone already thought of.

Proved non-vacuous by planting an `Alert.alert` argument and watching the gate name the file, the
line and the string.

**Numbers now follow the app's language, not the phone's.** Thirteen `toLocaleString()` calls passed
no locale, so a German app on an English phone printed `1,451` where German writes `1.451` — quietly
undoing the override that exists for exactly the player whose phone and head are in different
languages. All of them route through `localeNumber()` in `lib/format.ts`. Dates were already correct.

**Gate:** typecheck clean, lint clean, **578 tests / 36 files**, **664 keys** in each of three
languages, scanner reporting 0 across 68 files.

> **That 0 was over 68 files, and there are 97.** See
> [the roots gap](#the-gates-own-roots-gap-2026-08-16) below — the same mistake this section
> documents, made one level up.

### The gate's own roots gap (2026-08-16)

The scanner was pointed at `app` and `src/components` and told to read `.tsx`. So **`src/features`,
`src/lib` and `src/api` were never scanned at all** — and being mostly plain `.ts`, they would have
been skipped by the extension filter even if the roots had covered them. 32 strings sat there
through a migration that reported zero.

This is precisely the failure the section above describes, one level up: a search that cannot see
everywhere returns a zero indistinguishable from one that can. The first time it was the shapes;
this time it was the directories.

Roots are now `app`, `src/components`, `src/features`, `src/lib`, `src/api`, matching `.ts` and
`.tsx`. **97 files, 0 findings.**

**26 of the 32 were translated.** The rest were judged, not translated, and each exclusion is named:

| | |
| --- | --- |
| `legality.ts` (11) | Every legality message. The count lines were built from a label, a fraction and a tail — German puts the shortfall *before* the noun, so no fragment order reads correctly in both. `plural()` is gone with them; each case is a whole key |
| `deck-code.ts` (8) | Import and export errors. `DeckCodeError.message` renders directly on deck detail and the import screen |
| `sync.ts` (2) | `Downloading cards (3/15)` renders in Settings as `progress.message` |
| `hands.ts` · `summary.ts` · `deck-diff.ts` (4) | Analytics row labels and a diff chip |
| `finishes.ts` (2) | `finishLabel()` is a display label. German keeps **Foil** as the loanword collectors actually use — a translation choice, not an exclusion |
| **`client.ts` (3) — excluded** | `RiftcodexError.message` names an endpoint, a retry count, or Zod's own parse output. Diagnostics, not copy. Marked `// i18n-ignore` with the reason on the class |
| **`card-identity.ts` (2) — excluded** | `Alternate Art` and `Overnumbered` are **parsed out of the card's own name** — `variantLabel()` extracts them and `PICKABLE_VARIANTS` matches against exactly that string. Translating them would break the picker's filter outright. Added to `CARD_VOCABULARY` with all eight printing suffixes |

**Excluding `client.ts` uncovered a real leak.** `syncCards` put `err.message` straight into
`progress.message`, which Settings renders in red — so a schema drift could show a German player
*"Unexpected response shape for /cards: items.0.name Expected string, received null"*. The user now
gets a translated sentence and the exception text goes to `sync_meta.last_error`, where it is
readable when something actually needs diagnosing. Excluding a string from translation was only
defensible once it had stopped reaching a screen.

`lib/` stayed pure: `deck-code`, `legality`, `finishes`, `deck-diff` and `analytics` all gained an
`@/i18n` import and all of their Node tests still load — which is the constraint that broke
`findings.test.ts` the first time.

The pragma now also covers the line beneath a comment-only `// i18n-ignore`, like
`eslint-disable-next-line`, because a multi-line template literal has nowhere on its first line to
put a trailing comment.

Proved non-vacuous by planting an English string in `src/lib/finishes.ts` — a directory the old
roots never saw — and watching the gate name it: `src/lib/finishes.ts:66  Foil printing`.

**Gate:** typecheck clean, lint clean, **592 tests / 37 files**, scanner reporting **0 across 97
files**.

---

## T1 — Security hardening

Everything that has to be true before a build is allowed near a store, and before a backend exists
to get it wrong against. It sits **between M7 and M8 deliberately**: half of it is about what the app
already does, and the other half sets the rules M8's backend has to be built to. Auditing the client
after the server exists means auditing twice.

**Done when:** the app can be submitted to both stores without a policy answer being guessed at, no
secret ships in the bundle that is not designed to be public, and every place untrusted input enters
the app has a named owner and a test.

**Status: complete as of 2026-08-20.** §A through §F are closed. The two Riot items that kept §A
open moved to [R1](#r1--riot-api-and-compliance) — they were never code, and a milestone should not
stay amber waiting on someone else's reply.

**Original status, kept:** batch 4 done (2026-08-19) — §B through §F complete, §A down to two
owner-side items.
Batch 1 was the code half, batch 2 the decisions half, batch 3 the store-facing documents (now in
[`docs/STORE.md`](STORE.md)), batch 4 the two copy items the decision batches deferred.

**Everything T1 can close from inside the repo is closed.** What remains is two items only Riot can
answer: **registration**, which the Riftbound developer policy makes mandatory for any product that
serves players, and the **asset-sourcing clause** that restricts card assets to those *"provided by
the Riot API"* when the app's data path is a community API. Findings are in
[batch 1](#t1-batch-1--done-2026-08-16), [batch 2](#t1-batch-2--done-2026-08-19),
[batch 3](#t1-batch-3--done-2026-08-19) and [batch 4](#t1-batch-4--done-2026-08-19).

### A · Store and platform requirements

All three store-facing documents live in **[`docs/STORE.md`](STORE.md)**, written together on
2026-08-19 rather than separately, because they describe the same facts and the failure mode is that
they drift apart and a reviewer notices first.

- [x] **Apple privacy manifest — written and applied 2026-08-19.** Declared through
      `app.json` → `ios.privacyManifests` (this is CNG, so `ios/` is generated), and it resolves:
      `npx expo config` shows it. **One required-reason API, `FileTimestamp` / `C617.1`**, because
      three linked modules use it and **none ships its own manifest** — `expo-modules-core`'s
      `PersistentFileLog`, `expo-sqlite` `stat`-ing the database, `expo-image`'s cache expiry.
      `DiskSpace`, `UserDefaults` and `SystemBootTime` are **deliberately not declared**: every module
      that uses them ships its own manifest, and claiming them at app level would invite a question
      with no answer. `NSPrivacyCollectedDataTypes` is genuinely empty.
      [Reasoning, and the four not-declared categories](STORE.md#2--apple-privacy-manifest).
- [x] **Google Play Data Safety answers — settled 2026-08-19.** No collection, no sharing, encrypted
      in transit, deletion by uninstall because there is no server copy.
      [The answers, and the two a reviewer might push back on](STORE.md#3--play-data-safety-answers).
      The privacy policy is written to match, and needs a public URL before either listing can be
      submitted — one more argument for building the web platform early.
- [x] **Account deletion — recorded as an M8 build constraint, not as built work.** The T1 job was to
      set the rule before the account exists; the build item lives once, in
      [M8's checklist](#what-gets-built).
- [x] **Attribution — ~~the answer is *no*~~ closed 2026-08-19.** Checked in batch 3 and it failed:
      the About screen stated the substance in the app's own words, and Riot specifies the notice as
      **wording**. Batch 4 added both required notices verbatim —
      `profile.about.riotFan` (Legal Jibber Jabber, what the app ships under) and
      `profile.about.riotDev` (the registered-product boilerplate, carried early so registration is
      not also a copy change). The plain-language strings stay above them: those are what a player
      understands, these are the compliance artefact.

      **They are the same string in all three catalogues, and a test holds that.** Riot's sentence
      rendered in German is no longer Riot's sentence, so `i18n.test.ts` fails if any locale
      diverges — the failure mode is a translator being helpful, and it would otherwise ship
      silently because the result reads as correct.
      [Policy text and why both](STORE.md#5--riot-attribution-and-the-riftbound-developer-policy).
- [x] **~~Register the app with Riot~~ · ~~Resolve the asset-sourcing clause~~ — moved to
      [R1](#r1--riot-api-and-compliance) on 2026-08-20.** Both are conversations with Riot rather
      than work in this repo, and they were the only two items holding a finished milestone open.
      The reorder puts Riot at the end, so they now sit where they are actually done.
- [x] **Age rating — settled 2026-08-19, consistent across both stores.** Apple **9+**; IARC ESRB
      **E10+** · PEGI **7** · USK **6**. Consistency means the *questionnaire answers* match — the
      labels differ because the systems do. [The answer set](STORE.md#6--age-rating).

### B · Secrets, transport, and what ships in the bundle

- [x] **The JS bundle is public — the rule, settled 2026-08-19.**

      > **Anything in the bundle can be read by anyone who installs the app.** There is no such
      > thing as a secret shipped to a client. A value either is designed to be public, or it does
      > not go in.

      The rule is written down now, while nothing weighs on it. Re-verified 2026-08-19: the app has
      **no credential of any kind** — no `process.env` read, no `EXPO_PUBLIC_*`, no `.env` file, no
      `Authorization` header, and one unauthenticated host
      ([H1 audit](#h1--the-key-audited-2026-08-16)). M8 is what gives the rule something to govern,
      which is why it is settled before M8 rather than during it.

- [x] **RLS is the authorization boundary, not a convenience — settled 2026-08-19.** The Supabase
      anon key is *designed* to be public: it is a JWT naming the project and the `anon` role, and
      it authorises nothing by itself. Three consequences, and M8 is bound by all three.

      **RLS is the only boundary, not defence in depth.** Nothing sits in front of it. Treating the
      anon key as a secret is the mistake that makes people relax the policies, because it invents a
      second layer that does not exist.

      **Default-deny, with `auth.uid() = user_id` on all four verbs.** Enable RLS on every table and
      write `select`, `insert`, `update` **and** `delete` policies explicitly. A policy set that
      covers `select` and forgets `delete` is the exact shape this fails in — and it fails quietly,
      because reads keep looking correct while anyone can erase anyone's rows.

      **The `service_role` key must never reach the app, the web app, or any client bundle.** It
      bypasses RLS by design. This is the failure most likely to happen by accident during M8: it
      sits one environment-variable name away from the anon key, and a build that picks up the wrong
      one is not visibly broken.

      **The web platform sharpens this rather than adding a case.** Same key, same policies, and a
      bundle that is *more* trivially readable than the app's — served as JavaScript to a browser
      with devtools open. There is no second security model to design for web; there is one
      boundary and a second client that makes ignoring it harder to get away with.

      The policies themselves are M8's work. **The rules they must satisfy are T1's**, which is the
      whole reason T1 sits before M8.

- [x] **HTTPS everywhere, no ATS exceptions — confirmed 2026-08-19.** Zero occurrences of `http://`
      in `src/`, `app/`, `scripts/` or `app.json`. Two hosts, both `https:` — `api.riftcodex.com`
      and `cmsassets.rgpub.io`. `app.json` sets no `ios.infoPlist`, so Expo's template applies:
      `NSAllowsArbitraryLoads` **false**, with `NSAllowsLocalNetworking` true so Metro works in
      development. On Android `usesCleartextTraffic="true"` appears **only in the `debug` and
      `debugOptimized` manifests**, never in `main` — a release build has no cleartext path.

- [x] **Card images: HTTPS, and the parameters are not identifying** — 2026-08-19, with the
      residual recorded alongside the claim.

      The literal answer is that there *is* a parameter. 1436 of the 1451 seed URLs arrive from the
      API already carrying `?accountingTag=RB` (the other 15 carry no query at all) — Riot's own
      constant, identical on every card, naming the product rather than a person. `src/lib/cdn.ts`
      appends `w`, `fm`, `q`, and `blur` for the placeholder. Nothing else. All 1451 are
      `https://cmsassets.rgpub.io`.

      **The residual, which the claim alone hides:** the *request* still discloses the user's IP
      address and which cards they are looking at to Riot's CDN. No parameter carries that — the
      connection does. It is inherent to hotlinking, it was an accepted trade in the original plan,
      and `src/lib/cdn.ts` exists as the single indirection precisely so a proxy could take it away
      later. **"No identifying query parameters" is true, and it is not the same sentence as "no
      privacy exposure."**

### C · Data at rest on the device

- [x] **The SQLite file is not encrypted, and that is the decision — settled 2026-08-19.**

      > **No SQLCipher.** The database holds decks, versions, match history, binders and a
      > 40-character display name. Every field in it is content a player would put in a deck-list
      > post.

      **What the OS already gives us.** On iOS the file sits in the app sandbox under Data
      Protection, whose class key is derived from the passcode — on a locked device it is not
      readable at all. On Android it sits in the app's private data directory under File-Based
      Encryption, with the credential-encrypted store unlocked only after first unlock. Neither is
      something the app turns on: both are the platform default, and both are already in force.

      **What SQLCipher would cost.** It is not in `expo-sqlite` — no `PRAGMA key`, no codec, nothing
      in the module to enable. Adding it means a config plugin, leaving the managed prebuild for a
      custom native build, and a rekey migration on top of the existing 23.

      **What an attacker actually gains, which is what makes this a clean no.** The key would live
      in `expo-secure-store` **on the same device**, and `src/db/client.ts` opens the database at
      *module load* — before any screen renders and before any user interaction. So the key has to
      be readable at cold start with nobody present to authorise it. **Encryption of this kind
      defends a stolen file, not a stolen device.** The two ways the file leaves the sandbox on a
      device — rooted or jailbroken, or unlocked in someone else's hands — are both cases where the
      key is available too.

      The third way out is an OS backup, and there encryption is actively worse. `expo-secure-store`
      is backed by the Keychain and the Android Keystore, neither of which restores to a new device
      the way app data does. A restored backup would hand the user an encrypted database and no key.
      **SQLCipher would not protect the backup path; it would destroy it.** See
      [T1 batch 2](#t1-batch-2--done-2026-08-19) for what the backup check found.

      **The tripwire — the condition that reverses this.** Recorded as a rule rather than a caveat,
      because it is what makes a "no" safe to write down:

      > **The moment the schema gains a token, an email address, a password, another person's
      > contact details, or anything a user would not post publicly, this decision is void** and is
      > made again from the start.

      Concretely, any of these trips it: an auth or refresh token landing in `settings`; `user_id`
      becoming an email rather than an opaque uuid; a free-text column repurposed to hold someone
      else's identity. **That last one has a precedent in this schema** — `games.opp_label` was a
      free-text field for typing an opponent's name, and migration 22 removed it. It is exactly the
      shape the tripwire watches for, and it was already here once.

      Watched, not tripped: `events.location` is user-typed and unconstrained, so a player *can* put
      a personal address in it. It is their own, they were never asked for it, and no other column
      in the app holds a second person's anything.

- [x] **Auth tokens get the other answer, and it is already written down.** See
      [Auth constraints, set by T1](#auth-constraints-set-by-t1-2026-08-16) under M8 —
      `expo-secure-store`, never SQLite, never `AsyncStorage`. Deliberately not restated here:
      batch 1 had to delete a triplicated "in-app account deletion", and a rule that lives in two
      places is a rule that can disagree with itself. `expo-secure-store` is **not yet a
      dependency**, which is correct — M8 has not started.

- [x] **Nothing sensitive reaches logs — checked 2026-08-19.** Every `console.*` call in `src/` and
      `app/` is `__DEV__`-guarded — eleven sites, four of which (three in `useLocale.ts`, one in
      `ErrorBoundary.tsx`) use the `typeof __DEV__ !== 'undefined'` form so `lib/`'s Node tests can
      still load them. None logs user content: ids, counts and millisecond timings only — no deck
      name, no display name, no notes. `sync_meta.last_error` holds an HTTP status and a Riftcodex
      endpoint path, or up to three Zod issue paths and messages: card-shaped server data, never
      anything a player typed.
      ~~**Residual: nothing enforces this.**~~ **Closed 2026-08-19** by
      `src/lib/console-guard.test.ts`, an allowlist of the call sites in the shape of
      `sql-injection.test.ts`'s. It deliberately does **not** try to verify the guard or judge the
      argument — both need a parser or a mind reader. It notices that the *set of sites changed*,
      which is the one thing a machine does better than a person, and hands the judgement back at
      the moment someone is writing the line. See [batch 4](#t1-batch-4--done-2026-08-19).

- [x] **OS backup: the welcome copy said something false, and the copy changed — closed 2026-08-19.
      Reopened and settled the other way 2026-08-22** — see
      [the device pass](#s1--the-device-pass--2026-08-22). The record below is what was decided
      then, and the reasoning still holds; what it lacked was the observation that a deliberate
      uninstall silently does not uninstall.
      Batch 2 found the database is copied to Google Drive on Android and iCloud on iOS while
      `onboarding.wip.body` told the user *"Your decks and games live only on this device."* The
      decision was that the **backup stays and the sentence changes**, because until M8 ships sync
      it is the only thing that survives a phone replacement.

      Rewritten in all three languages to *"Your decks and games stay on this device — nothing is
      sent anywhere, though your own device backup may include them."* Two clauses because two
      things are true and only one of them was being said: **the app sends nothing**, which is the
      part that matters and stays absolute, and **the device backup is the user's own**, which is
      the part that was missing. German and French are marked for the owner's proofread in
      [batch 4](#t1-batch-4--done-2026-08-19).

### D · Untrusted input

- [x] **The deck-code parser is the app's one real attack surface.** It takes arbitrary text from the
      clipboard (`import.tsx`) and hands it to a third-party decoder. Fuzz it: malformed base32,
      enormous inputs, deeply nested or absurd card counts. It already throws `DeckCodeError` on bad
      input — the question is whether it *always* throws rather than hanging or allocating wildly.

      **Closed 2026-08-16.** 29 fuzz cases in `deck-code-fuzz.test.ts`. It always threw correctly —
      but it allocated **~20× its input** on the way there, 98 MB of heap to reject a 5 MB paste.
      Three ceilings now sit ahead of any work: 4 KB per code, 64 KB per paste, 32 candidate runs.
- [x] **Audit the ~~four~~ fifteen dynamic SQL sites.** `events.ts:181` and `games.ts:316` interpolate
      a `sets.join(', ')` column list; `migrations.ts:855` and `testing.ts:96` interpolate a version
      number. All four look like code-built identifiers rather than user data, and every value is
      already parameterised — **confirm it, and add a test that fails if a user-supplied string ever
      reaches one.**

      **Closed 2026-08-16 — there are fifteen, not four.** The original grep matched one pattern.
      `sql-injection.test.ts` proves it two ways: seven payloads round-tripping verbatim with every
      table intact, and a structural scan that fails on any future interpolation not on a named
      allowlist. The allowlist is the point — it makes the fifteenth site the last one that can be
      added silently.
- [x] **Deep links — the rule, settled 2026-08-16.**

      > **The scheme carries navigation only, never credentials or commands.** Every deep link must
      > be equivalent to a tap the user could have made themselves. **Nothing acts**: no delete, no
      > import-and-save, no sign-out.

      The scheme was never "unhandled" — there is no linking config, so expo-router's default
      applies and **all twenty routes are already reachable** from outside. Six take an id, and that
      id is the only part of the surface an attacker chooses.

      `src/db/route-params.test.ts` turns "the id is looked up and misses" from reasoning into a
      guarded property: fifteen hostile ids — SQL payloads, path traversal, 100 KB strings, unicode,
      null bytes — against all seven lookups the six routes perform. None throws, all return empty,
      every table survives. Proved non-vacuous by making `getDeck` throw on a blank id.

      `/_sitemap` is overridden at `app/_sitemap.tsx` — see below.
- [x] **Riftcodex responses are already validated with Zod** at the boundary. Confirm no path around
      it, including the bundled seed. **Confirmed 2026-08-16.** The seed is the one path around it,
      and correctly so — `generate-seed.ts` validates with `cardPage.parse`. The unguarded gap was
      schema drift between generation and load; `seed-shape.test.ts` holds it.

### E · Supply chain
- [x] **Re-measure the npm advisories** (the standing Backlog item) as part of the audit rather than
      separately. **Done 2026-08-16: 27 → 26 advisories, 4 root causes → 3** — `nanoid` cleared by a
      patch bump. See the correction in H2 for what that count used to say and why it was wrong.

      **`nanoid` does ship** — `node_modules/nanoid/non-secure/index.js`, confirmed by source map,
      not by grep. The remaining three (`uuid`, `image-size`, `esbuild`) genuinely do not. Re-check
      with `npm run audit:bundle` after every SDK bump rather than reasoning about it.
- [x] **Upgrade Expo 57.0.11 → 57.0.13 and the six drifting packages**, then re-measure. Deferred
      through the UI work on purpose; T1 is where it belongs, because a dependency bump plus a
      rebuild-and-retest is exactly this milestone's shape. **Done 2026-08-16** — `expo install
      --check` reports everything up to date.
- [x] **`npx expo-doctor` clean**, and recorded. **21/21 on 2026-08-16** — the check count grew from
      20 with the SDK bump.

### F · Failure behaviour
- [x] **Error boundary.** Nothing in the tree implemented `componentDidCatch`, so a render error took
      the whole app down with no recovery and no report. Listed here rather than in M9 because it is
      also the thing that decides *what a crash is allowed to say* — and the app has just finished
      removing exception text from a user-facing screen. **Added 2026-08-16** at the root, inside the
      providers and outside the navigator. It never renders the exception and *does not keep it in
      state* — `getDerivedStateFromError` drops the error rather than storing it, so a stack trace is
      not one careless edit away from the screen. The `console.error` is `__DEV__`-guarded.
- [x] **If crash reporting is added, it collects nothing about the device.** Standing owner decision:
      no telemetry, no OS or device data, no location. A crash reporter that phones home with a
      device profile would reintroduce exactly the DSFA obligation the feedback form was designed to
      avoid. **Ticked 2026-08-16 as a recorded constraint, not as built work** — there is no crash
      reporter and none is planned; the boundary above deliberately reports nowhere. This is the
      standing rule any future one must satisfy.

---


### T1 batch 1 — done (2026-08-16)

**§D, §E and §F are complete.** ~~§A (store paperwork), §B (bundle and transport) and §C (data at
rest) remain~~ — **§B and §C closed in [batch 2](#t1-batch-2--done-2026-08-19) on 2026-08-19; §A
alone remains.**

Four recorded claims were disproven by measuring them. Each had been written down as fact, and each
was measured with a method that could not see what it claimed to rule out — the same shape as the
M7B "239 → 0" count and the gate's own roots gap.

| Recorded | Actual |
| --- | --- |
| npm: 4 root causes | **3** — `nanoid` cleared by a patch bump |
| "none of the four is in the release bundle" | **`nanoid` shipped** |
| "every remedy npm proposes is a downgrade" | true of three; `nanoid` was `npm audit fix` |
| T1 §D: "four dynamic SQL sites" | **fifteen** — the original grep matched one pattern |

Corrected in place at [H2](#corrected-2026-08-16--three-of-the-claims-above-were-wrong), in the
Backlog entry, and in gap 10.

**What the work turned up beyond the checklist:**

**The deck-code parser allocated ~20× its input before rejecting it.** A 5 MB paste cost 98 MB of
heap on the way to throwing. It always threw the right error — but rejecting *after* allocating is
not rejecting, and on a phone that is how a stray paste becomes an out-of-memory crash. Three
ceilings now sit ahead of any work: 4 KB per code, 64 KB per paste, 32 candidate runs.

**Every route survives a hostile id, and that was worth proving rather than assuming.** The deep-link
audit's real question was whether any of the six `[id]` routes throws on a malformed parameter
instead of rendering an empty state — a route that throws is a crash reachable from outside the app
by anyone who can send a link. `route-params.test.ts` puts fifteen hostile ids through all seven
lookups: **none throws, all return empty, every table survives.** The claim held. It is now a
guarded property rather than a reading of the code, which matters because the next `[id]` route is
one file away and nothing else would catch it.

**`/_sitemap` ships in release builds.** expo-router generates a screen listing every route in the
app, and it is not dev-only — confirmed in the release bundle's source map. Same class as gap 21,
where `version-selfcheck` sat in the production bundle for five milestones.

**There is no app-facing config for it.** `sitemap: false` exists but is passed to `ExpoRoot`
through a `config` prop owned by the generated entry point, not surfaced through `app.json` or the
config plugin. **The fix is a route override** — `app/_sitemap.tsx`, a deliberate choice, and the
supported mechanism: `appendSitemapRoute` only generates the internal route when the app has not
provided one. It redirects to `/` rather than rendering nothing, so the link is a no-op instead of
a dead end. The expo-router `Sitemap.js` *module* remains in the bundle as dead weight — it is
statically referenced by the system-route factory and cannot be removed from app code — but the
route no longer renders it.

**The suite's only wall-clock assertion was over-tight.** `expect(compareMs).toBeLessThan(25)`
failed once under disk load and passed three runs after. Measured cost is 0.3–0.6 ms; the bound was
forty times that and still could not tell "slow code" from "descheduled process". **Widened to
250 ms with the reasoning recorded in the test**, because an implementation that walked the whole
history would take seconds at 800 versions — the regression it guards is caught either way.

**The seed is the one path around the Zod boundary, and that is correct.**
`scripts/generate-seed.ts` validates with `cardPage.parse`, so the data *is* Zod-checked — at
generation, not at load. What was unguarded is the gap between those moments: the seed is a
hand-regenerated artefact, the schema moves with migrations, and `as NewCardRow[]` hides drift.
The seed on disk predates ten migrations; checked, and it still matches at **29 columns for 29**.
`seed-shape.test.ts` now holds that.

**The error boundary is written to have nothing to leak.** `getDerivedStateFromError` drops the
error instead of storing it, so `State` is `{ crashed: boolean }` and there is no exception in the
component to render by accident later. That is deliberate, and it is the same decision as the
feedback form: the cheapest way to guarantee something is never shown or sent is to never hold it.

**New tooling:** `npm run audit:bundle` reads a source map and reports which packages genuinely
ship. It exists because the naïve method fails in both directions — grepping bytecode matched
`esbuild` and `uuid` as bare words, and searching a *minified* bundle for renamed identifiers is
how "none in the release bundle" became a recorded fact while `nanoid` shipped.

**Gate:** typecheck clean, lint clean, **755 tests / 42 files** (642 / 41 before this batch),
scanner 0 across 99 files, `expo-doctor` 21/21, bundle rebuilt and re-audited — `nanoid` still the
only advisory root present, `/_sitemap` now resolving to `app/_sitemap.tsx`.


### T1 batch 2 — done (2026-08-19)

**§B and §C are complete. T1 is closed except for §A.** This batch wrote no code, which is what §B
and §C always were: decisions to record, and the point of recording them is that they stop being
omissions. Seven checklist items ticked, one new item opened.

Batch 1 found four recorded claims that measurement disproved. Batch 2 found something quieter and
worse — **two claims that are true as written and misleading as read**, and **one sentence of
shipped user-facing copy that is simply false**.

| Recorded | Actual |
| --- | --- |
| §B: card images "carry no identifying query parameters" | True, and incomplete. There **is** a parameter — `accountingTag=RB`, Riot's own, on 1436 of 1451 — and the real exposure is the request, not the query |
| §C: "on a locked phone it already sits inside the OS sandbox" | True, and it also sits in the user's **Google Drive or iCloud backup** |
| Onboarding `wip.body`: *"Your decks and games live only on this device."* | **False on both platforms** — and it is on the first screen a user ever sees |

#### The database leaves the device, and the app tells users it does not

This was the addition to the brief, and it is the finding of the batch. ADB and cloud backup are the
one path that extracts the database without root, so they are the threat the sandbox argument does
not cover.

**Android: the effective value is `allowBackup="true"`, and reading the template says the
opposite.** `app.json` sets no `android.allowBackup`, so the framework default applies — and naming
that default
takes two steps that disagree with each other. Expo's prebuild template ships
`android:allowBackup="false"` in `android/app/src/main/AndroidManifest.xml`. But `withAllowBackup`
is registered in `withDefaultPlugins` and rewrites the attribute on every prebuild from
`config.android?.allowBackup ?? true` (`@expo/config-plugins/build/android/AllowBackup.js:25`). The
plugin runs last, so **the manifest in the repo template is not the manifest that ships.** Reading
the template alone would have produced a confident wrong answer — the same class of mistake as
batch 1's grep of a minified bundle: a method that cannot see the step that decides.

Consequence: Android Auto Backup copies the app's data directory, `riftbound.db` included, to the
user's Google Drive.

**iOS: included, and nothing excludes it.** `expo-sqlite`'s `defaultDatabaseDirectory` is
`<Documents>/SQLite` (`SQLiteModule.swift:28`) and `src/db/client.ts` passes no directory override.
`Documents/` is in iCloud backup by default, and nothing in the app sets
`NSURLIsExcludedFromBackupKey`. The same file goes to iCloud.

**Is the framework default the right answer? ~~For the config, yes.~~ For the copy, no.**

> **Overturned for Android on 2026-08-22, on evidence this section did not have.** The owner
> uninstalled the app on a real phone and the data survived. `android.allowBackup` is now
> `false`. The reasoning below is not retracted — it is still the correct account of what the
> backup was buying, and the cost it names is now genuinely being paid. What it was missing is that
> the same mechanism makes *uninstall* a lie, and that surprise costs more than the continuity was
> worth two milestones before sync. iOS is untouched and still backs up.
> [Detail](#s1--the-device-pass--2026-08-22).

Turning backup off is one line in `app.json` for Android and a startup exclusion call for iOS. It
was **declined**, and the reason is the app's own premise: until M8 ships sync, a user replacing a
phone would lose their entire match history — in an app whose whole value is that the history is
longitudinal. OS backup is the only continuity that exists today, and both platforms encrypt it:
Android's is end-to-end encrypted with the device lock screen since Android 9, and iCloud's is bound
to the user's Apple account.

~~So the config stays and **the sentence changes.**~~ **2026-08-22: the config changed too, and
the sentence changed a second time.** `onboarding.wip.body` ends *"Your decks and games
live only on this device."* That is a promise, it is on the first screen, and it is not true. Three
strings, one per language. It is [tracked unticked in §C](#c--data-at-rest-on-the-device) rather
than fixed here, because this batch wrote no code.

**This does not reopen the encryption question — it settles it harder.** The key would live in
`expo-secure-store`; the Keychain and the Android Keystore do not restore across devices the way app
data does; an encrypted database in a restored backup is a database nobody can open. Encryption
would not defend the backup path. It would break it.

#### Encryption: no, and the reason is where the key would have to live

The full argument is in [§C](#c--data-at-rest-on-the-device). The one line worth repeating here is
the one that decides it: `src/db/client.ts` opens the database at **module load**, before any screen
renders and before any user interaction, so the key has to be readable at cold start with nobody
present to authorise it. **That defends a stolen file, not a stolen device** — and every realistic
on-device path to the file is a stolen-device path.

Against that: SQLCipher is not in `expo-sqlite` at all. It would cost a config plugin, leaving the
managed prebuild for a custom native build, and a rekey migration on top of the existing 23. What it
would protect is deck lists, match history, binders and a 40-character display name.

**The tripwire is the part that makes the "no" safe to record**, and it is written as a rule rather
than a caveat: the moment the schema gains a token, an email address, a password, another person's
contact details, or anything a user would not post publicly, the decision is void and gets made
again. It is not hypothetical — `games.opp_label` was a free-text field for typing an opponent's
name, and migration 22 removed it. The exact shape the tripwire watches for has already been in this
schema once.

#### RLS is a T1 deliverable, and it is the rules rather than the policies

The three sharpenings are in [§B](#b--secrets-transport-and-what-ships-in-the-bundle) and none of
them is new information; what is new is that they are now binding on M8 rather than advice to it.
The one most likely to be got wrong in practice is the third: `service_role` bypasses RLS entirely
and sits one environment-variable name away from the anon key, so the failure mode is a build that
picks up the wrong name and is **not visibly broken**.

The web platform sharpens this rather than adding a case — same key, same policies, and a bundle
served as JavaScript to a browser with devtools open.

#### Transport and logs, both verified rather than assumed

No `http://` anywhere in `src/`, `app/`, `scripts/` or `app.json`; two hosts, both HTTPS. Expo's
Info.plist template sets `NSAllowsArbitraryLoads` false, and `app.json` adds no `ios.infoPlist` to
override it. On Android `usesCleartextTraffic="true"` exists **only in the `debug` and
`debugOptimized` manifests** — a release build has no cleartext path at all.

Every `console.*` call in `src/` and `app/` is `__DEV__`-guarded, and none logs user content.
`sync_meta.last_error` carries an HTTP status and an endpoint path, or Zod issue paths — server
data, never anything a player typed. **Recorded residual: nothing enforces either of these.** They
were read, not tested, and the next unguarded `console.log` of a deck name would pass the gate.

#### What remains in T1

**§A only** — five items of store paperwork, and every one of them needs artefacts that do not exist
yet. The privacy manifest and the Data Safety form have to agree with each other and with a privacy
policy; the attribution check needs the actual Legal Jibber Jabber text rather than a paraphrase;
the age rating needs a store listing. None is hard and none can be finished before there is a build
to submit, which puts §A next to M9's missing `eas.json` rather than next to the work above.

**Gate:** typecheck clean, lint clean, **755 tests / 42 files**, scanner 0 across 99 files. No
bundle rebuild: nothing in `src/` or `app/` changed — the only file this batch touched is this one.


### T1 batch 3 — done (2026-08-19)

**§A is written and did not close.** The three store-facing documents — Apple privacy manifest, Play
Data Safety answers, privacy policy — are in [`docs/STORE.md`](STORE.md), written together because
they describe the same facts and drift apart when written separately. Four items ticked, three
opened. The manifest is applied to `app.json`; everything else in the batch is documents.

**§A was scoped as paperwork. It is not paperwork.** The item said *"T1 confirms it satisfies the
actual policy text rather than a paraphrase of it"* — so the batch read the actual policy text, and
three things came back that no paraphrase contains.

| Assumed | Actual |
| --- | --- |
| Attribution is a topic to cover | Riot specifies it as **wording**. The About screen states the substance in its own words, which is a paraphrase |
| A fan project just needs a disclaimer | *"If your product serves players, you must register it with us regardless of whether or not your product uses official documented APIs."* **Not done** |
| Card sources are our choice | *"Your App may only use Riftbound assets (including cards) provided by the Riot API. No external or unofficial materials."* Card data comes from **Riftcodex**, a community API |
| The app's analytics are uncontroversial | Publishing *"metagame-defining data"* — play rates, win rates, matchup percentages — is an **unapproved use case**. The phone app is clear; **M8's web platform is the described case** |

#### The one that reaches the architecture

Clause 2 is the one worth sitting with. The **images** are Riot's own — hotlinked from
`cmsassets.rgpub.io`, which is as official as a source gets. The **data** — names, text, types,
domains, collector numbers — comes from Riftcodex, and the clause names external and unofficial
materials specifically. That was a founding decision of this project (M1 exists because the API
"cannot filter by type, domain, rarity, energy, or tag", so a local mirror was mandatory), and it is
now a question to put to Riot at registration rather than one to answer here.

#### The one that lands on M8

*"Cannot publish metagame-defining data like play rates, win rates, or matchup win percentages for
cards/decks."* Every rate this app computes comes from **the user's own logged games**, is shown only
to them, and is never pooled. That is not what the clause describes.

**A web platform that aggregates match data across accounts and shows "decks led by this Legend win
58%" is what the clause describes, almost word for word.** M5 built the analytics; M8 would be the
thing that publishes them. Recorded in [`STORE.md` §7](STORE.md#7--what-m8-inherits) alongside
account deletion, the user-generated-content gate, and the requirement that all three documents be
re-answered before M8 ships rather than after.

#### The manifest is short because it was measured

Every Expo module in the tree was checked for a shipped `PrivacyInfo.xcprivacy`. Four have one —
`expo-constants`, `expo-file-system`, `expo-localization` and `react-native` — and they cover
`UserDefaults`, `DiskSpace` and `SystemBootTime` for themselves. **So the app declares none of those**,
and declares exactly one category it can demonstrate: `FileTimestamp` / `C617.1`, used by
`expo-modules-core`'s `PersistentFileLog`, by `expo-sqlite` opening the database, and by
`expo-image`'s disk cache — none of which ships a manifest.

That is the item working as written. **A manifest that over-declares invites questions that have no
answer:** claiming `UserDefaults` would invite "which preferences do you keep there?", and the honest
answer is none — the language choice is a row in SQLite.

`NSPrivacyCollectedDataTypes` is **empty, and true**. Apple's *collect* means transmitted off the
device; nothing the user creates ever is. The feedback form copies to the clipboard, verified again
here. **OS backup is not developer collection** — it is the user's own iCloud — but batch 2's finding
is disclosed in the privacy policy anyway, because "we collect nothing" and "nothing leaves your
device" are different sentences and only the first is true.

**What the manifest cannot prove yet:** CocoaPods resolved at `pod install` — SDWebImage behind
`expo-image` is the one that matters — are not in `node_modules` and were not inspected. Xcode's
*Generate Privacy Report* on the first archive aggregates every embedded manifest and settles it.
That belongs with M9's first real build, next to [D2](#where-things-stand--2026-08-16).

#### Confidence, stated rather than assumed

Riot's clauses were read through a fetching tool's summarizer rather than from the rendered page.
Two independent fetches of the Riftbound policy returned the same sentences, which is good evidence
and is not the same as having read it. `STORE.md` §5 links the three primary sources and says
plainly that the owner should read them before acting on clause 2. This is the same discipline as
batch 1's source-map rule: **name the method, and say what it cannot see.**

One aside, because it vindicates work already done: the same policy says *"Your API key may not be
included in your code, especially if you plan on distributing a binary."* That is
[H1](#h1--the-key-audited-2026-08-16) and [§B](#b--secrets-transport-and-what-ships-in-the-bundle),
in Riot's words.

#### Age rating, settled by answering rather than by labelling

Apple **9+**; IARC ESRB **E10+** · PEGI **7** · USK **6**. The labels differ because the systems do —
what has to match is the *questionnaire answers*, and those are one table in
[`STORE.md` §6](STORE.md#6--age-rating). Mild fantasy violence (1,451 cards of static combat
illustration), nothing else, and **no user-generated content** — which is *No* today only because
nothing is shared, and is the second thing M8 flips.

#### What batch 3 did not settle

- **Registration with Riot has not been started.** Owner-side, and it gates submission.
- **The asset-sourcing clause is unresolved**, and could reach the architecture.
- ~~**The About screen still carries the paraphrase.**~~ **Closed in
  [batch 4](#t1-batch-4--done-2026-08-19) on 2026-08-19** — both notices now render verbatim.
- **The privacy policy has no controller name, contact, or URL.** All three are owner-supplied.

**Gate:** typecheck clean, lint clean, **755 tests / 42 files**, scanner 0 across 99 files.
`npx expo config` resolves the new `ios.privacyManifests` block. No bundle rebuild: `app.json` needs
a `prebuild` to take effect, not a bundle, and no JS changed.


### T1 batch 4 — done (2026-08-19)

**The two copy items the decision batches deferred, and one residual closed.** Batch 3 found the
attribution failed and left it, because it produced documents. Batch 2 decided the onboarding
sentence had to change and left it, because it wrote no code. This batch wrote the code.

§A's attribution item and §C's backup item are ticked. **T1 now has nothing left that can be closed
from inside the repo** — the two open items are Riot's to answer.

#### The i18n gate had the mechanism, and it was the wrong one

A verbatim legal notice must not be translated, and `npm run i18n:scan` fails the build on
untranslated English prose. The scanner does have an escape hatch — `// i18n-ignore`, including a
comment-only form that covers the line beneath, built for exactly this shape of problem.

**It is the wrong tool here, and reaching for it would have been the silent workaround.** The pragma
suppresses a finding in *scanned code*; the scanner's roots are `app`, `src/components`,
`src/features`, `src/lib` and `src/api`, and it never reads `src/i18n`. Riot's notices are copy.
Copy lives in the catalogue. **Put in the catalogue, they need no escape hatch at all** — they are
three catalogue entries that happen to hold identical text, which is what "the same in every
language" looks like when the catalogue is the mechanism.

That is not a new idea in this codebase: the scanner's own `NEVER_TRANSLATED` set already holds
`English`, `Deutsch`, `Français`, `Riftbound` and `Riot Games` for the same reason.

**What it costs is that the scanner can no longer see them**, and the guard has to come from
somewhere else. So `i18n.test.ts` gained one: the three catalogues must hold `profile.about.riotFan`
and `profile.about.riotDev` byte-identical, and a non-vacuity check that the keys exist and mention
Riot Games. Proved by translating the German copy — it failed, naming the key.

**The failure mode is a translator being helpful**, and it is the nastiest kind: a German rendering
of Riot's sentence reads *better* than the English one sitting in a German app, so nothing about the
result looks wrong. It just stops satisfying the policy.

#### Both notices, and why the second one ships now

`.riotFan` is the Legal Jibber Jabber notice, required of the app as it exists today. `.riotDev` is
the developer-portal boilerplate required of a **registered** product — the footing the app moves to
if [registration](#a--store-and-platform-requirements) produces an API key.

Carrying both now costs two lines and one style rule. Carrying only the first would mean that on the
day registration lands, the compliance change is also a copy change in three languages and a new
release — which is exactly the shape of thing that gets forgotten because it is small.

They render below the existing plain-language pair, in `caption` rather than the meta face: three
lines of tracked 9.5-point capitals stop being readable about where the sentence gets interesting,
and the one thing on that card that must survive being read is the notice. Faint, not hidden — both
policies use the word *conspicuous*.

#### The onboarding sentence, and what "true without being alarming" required

Old: *"Your decks and games live only on this device."* One clause, and false on both platforms.

New: *"Your decks and games stay on this device — nothing is sent anywhere, though your own device
backup may include them."*

Two clauses, because two things are true and the old sentence said only one. **The app sends
nothing** is the part that matters, it is absolute, and it comes first. **The device backup is the
user's own** is the part that was missing, and the word doing the work is *your own* — the sentence
that would alarm is one implying something was taken, and nothing was.

**German and French are the owner's to proofread.** Both were written to match the register of the
strings around them rather than translated literally.

- **German** — `dein eigenes Geräte-Backup kann sie aber enthalten`. *Geräte-Backup* is the loanword
  German actually uses in this context (*iCloud-Backup*, *Google-Backup*), and it is the word I am
  least sure of. *Die Sicherung deines Geräts* is more properly German and reads heavier; if the
  file's voice prefers it, it is a one-line swap.
- **French** — `mais la sauvegarde de votre appareil peut les inclure`. *Sauvegarde* is the standard
  term and reads naturally. Typographic apostrophes matched to the file (`rien n'est envoyé`).

Nothing in the suite asserted the old string — checked before changing it, because a test asserting
copy is exactly the thing that turns a copy fix into a failing build for no reason.

#### The log residual, closed with an allowlist rather than an analysis

§C recorded that every `console.*` was `__DEV__`-guarded and free of user content, and that
**nothing enforced it** — read, not tested. `src/lib/console-guard.test.ts` closes it in the shape
of `sql-injection.test.ts`'s structural half.

**It was worth building, and the reason is what it does not do.** Two properties were on the table:

1. *Is the guard present?* A guard is an enclosing `if (__DEV__)`, or an early
   `if (!__DEV__ || …) return;` at the top of the function, or the
   `typeof __DEV__ !== 'undefined'` form the Node-reachable modules use. Deciding which covers a
   given line needs the enclosing function, which needs a parser. A regex that guessed would be a
   second thing that can be wrong about the file it is checking.
2. *Is the argument user content?* `\`[stats] deck=${active}\`` is an id and `deck.name` is a name.
   Nothing structural separates them, and any rule strict enough to catch the second would flag
   the first.

Both are judgements a person has to make, so the test does not attempt either. It **notices that the
set of call sites changed** — the one thing a machine does better than a person — and hands the
judgement back at the moment someone is writing the line. Adding a `console.log` is a two-line diff
in the allowlist, and writing that line is where someone has to say what is being logged.

That is the same trade `sql-injection.test.ts` made, accepted for the same reason: **the allowlist
does not prove the code is safe, it proves nobody added a site without looking.** Proved non-vacuous
by planting an unguarded `console.log` in `format.ts` — it failed, naming file and line.

**Six entries, eleven calls.** The allowlist is keyed `file:method`, so the three warnings in
`useLocale.ts` are one entry. The scanner strips comments first, which matters more than it sounds:
several files discuss their own logging in prose, and a scanner that read those would report sites
that do not exist and then pass against an allowlist built from them. There is a test for that too.

#### Corrected in place

The M7A entry describing the development disclaimer explained its reasoning as *"the data is local,
so the only backup is the one they make"* — right reasoning, and it produced a sentence the OS
breaks by default. Marked with the correction rather than rewritten, per the convention.

#### What is still open in T1

Two items, both §A, both Riot's to answer rather than ours:

- **Registration.** *"If your product serves players, you must register it with us."* Not started,
  owner-side, gates submission.
- **The asset-sourcing clause.** Card data comes from Riftcodex; the clause restricts assets to
  those *"provided by the Riot API"*. An architectural question, and the most likely reason a
  registration review comes back with conditions.

Also unchanged and owner-supplied: the privacy policy's controller name, contact and public URL.

**Gate:** typecheck clean, lint clean, **761 tests / 43 files** (755 / 42 before this batch),
scanner 0 across 99 files — the notices are catalogue entries, so the count is unchanged and that is
the point. Both new tests proved non-vacuous by mutation, and both mutations reverted.

---

## M8 — Cloud and the web platform

> **Superseded 2026-08-20 — split into [B1 — Backend](#b1--backend) and
> [W1 — Web platform](#w1--web-platform).** Kept whole rather than deleted, because most of it
> survived the split: the sync protocol, last-write-wins, the shared-package argument, the
> not-Expo-Web argument and the auth constraints are all still the plan and are still read from
> here.
>
> **What changed is the hosting and, with it, the shape.** M8 assumed managed Supabase with both
> clients querying Postgres directly, which made RLS the authorization boundary. B1 is self-hosted,
> so the first question became surface area rather than convenience — and *"No custom API server"*
> below is the one decision that did not survive. [B1 argues it out](#the-decision-that-changed-and-why)
> rather than waving it away; the M8 reasoning was good and lost on grounds that did not exist when
> it was written.

Two interfaces onto one account: **the phone for the table, the web for the desk.** You log a match
between rounds on your phone; you sit down at home and rebuild the deck on a screen with room for it.

The scope grew on 2026-08-16 from "cloud sync" to "cloud sync plus a web platform". That is a bigger
change to the *product* than to the *plan*, because a web client needs the same thing sync needed: a
Postgres database with row-level security and auth in front of it. The web app is a second consumer
of that, not a second backend.

### The shape

```
                     ┌──────────────────────────┐
   phone ─ SQLite ──▶│  Supabase                │◀── web browser
      (offline-first)│  Postgres · Auth · RLS   │    (online-only)
        sync engine  └──────────────────────────┘    direct queries
                                 ▲
                                 │  shared, verbatim
                     ┌───────────┴──────────────┐
                     │  packages/core           │
                     │  legality · deck-diff    │
                     │  deck-code · analytics   │
                     │  i18n catalogue          │
                     └──────────────────────────┘
```

**~~No custom API server.~~ Overturned 2026-08-20 — see [B1](#the-decision-that-changed-and-why).**
The argument below is still the right argument *for managed hosting*; self-hosting changed what it
weighs against. Supabase is Postgres with auth and row-level security in front of it, and
both clients speak to it with the same library. Writing an API server instead would mean
re-implementing authorization in application code — the layer most likely to have a hole, replacing
one the database enforces. Given [T1](#t1--security-hardening) makes RLS *the* authorization
boundary, adding a second one to get wrong is the opposite of the goal.

**Only the phone needs a sync engine.** This is the simplification most easily missed. The phone is
offline-first and keeps its SQLite, so it needs reconciliation. The web app is online by definition —
it queries Postgres directly and holds no local copy. Half the hard work only has to exist once.

**`src/lib/` moves to a shared package, and it can.** Legality, deck diffing, deck codes and the
analytics layer are pure TypeScript with **zero React Native imports** — a property this codebase has
defended deliberately, most recently when the i18n layer had to stay Node-loadable. That makes the
move close to a file move, and it buys the thing that matters: the web platform and the app cannot
disagree about whether a deck is legal. Two clients giving different answers about the same list is
the worst bug this product could ship.

**Not Expo Web.** The Expo app compiles to web, and the backlog has carried "web export" for months.
It is the wrong tool here: a web platform for the desk wants width, a keyboard and multiple columns,
and Expo Web would deliver a phone in a browser window. Share the logic, not the screens.

### What gets built

**Backend**

- [ ] Supabase project; Postgres schema mirroring the eight user tables — `decks`, `deck_versions`,
      `deck_version_cards`, `games`, `matches`, `events`, `binders`, `binder_cards`
- [ ] RLS `auth.uid() = user_id` on every one of them, written and tested **before** any client
      trusts it (a T1 rule)
- [ ] Auth: email, Sign in with Apple, Google
- [ ] **In-app account deletion**, because Apple requires it of any app that creates an account.
      A control **inside the app** — not an email address, not a web form — and built with sign-up
      rather than after it, because shipping sign-up without it ships a known rejection. This is the
      one home for the item; [T1 §A](#a--store-and-platform-requirements) sets the rule and
      [`STORE.md` §7](STORE.md#7--what-m8-inherits) lists it among what M8 inherits
- [ ] The card catalogue server-side: one job syncs Riftcodex into Postgres so the web app has cards
      to read without every browser paging a hobby API

**Phone**

- [ ] Sync engine: pull-then-push, last-write-wins on `updated_at`, soft deletes propagate via
      `deleted_at`
- [ ] **Sign-in claims existing local rows rather than replacing them** — stamp `user_id` and upload.
      The single most data-destructive thing on this list if it is got wrong
- [ ] Sync status and a manual trigger in Settings
- [ ] Offline queue; the app stays fully usable signed-out

**Web**

- [ ] A separate app — Next.js or Vite + React — reading Supabase directly
- [ ] Deck browsing, the editor, the version timeline, analytics, and the card gallery, laid out for
      a screen rather than a thumb
- [ ] The same three languages, from the same catalogue

**Shared**

- [ ] `packages/core` — `legality`, `deck-diff`, `deck-code`, `analytics`, and the i18n catalogue,
      imported by both clients

### The columns that were waiting for this

`user_id`, `dirty`, `updated_by_device` and `deleted_at` have been on every user table since **M0**,
before anything needed them. `deleted_at` is why deletion can sync at all: a genuinely deleted row is
invisible, so the other device would simply upload it again — a soft delete is a *change*, and
changes travel.

Migration 22 then dropped six write-only columns and the `sets` table specifically so none of it
would be mirrored into Postgres, wrapped in an RLS policy and taught to a sync engine. Migration 23's
key/value `settings` table means a new preference costs no migration on either database.

### Why last-write-wins is enough

It is a crude conflict rule and it is the right one here, because of what the data model already
prevents. **A version is immutable once a game is logged against it, and games are only ever added.**
There is very little two devices can genuinely fight over: editing a played deck on both produces two
forks, not a conflict, and both survive. Anything more elaborate would be machinery for a problem the
version rule already rules out.

**Done when:** two devices converge after concurrent offline edits · a signed-out user who signs in
keeps every deck and match they already had · the web platform and the app agree, to the card, on
what a deck contains and whether it is legal.

---


### Auth constraints, set by T1 (2026-08-16)

These are decisions [T1](#t1--security-hardening) made on M8's behalf, because auditing a client
after the server exists means auditing twice. They are requirements, not preferences.

- [ ] **PKCE is mandatory** — Supabase's `flowType: 'pkce'`. A custom scheme cannot be claimed
      exclusively, so another app can register `riftbound://` and receive the callback. PKCE makes
      an intercepted authorization code useless without the verifier, which never leaves the device.
      This is *the* answer to scheme hijacking, and it is not optional.
- [ ] **Prefer Universal Links / App Links over the custom scheme.** Both are *verified* — they
      require a file hosted on your domain, so no other app can claim them. The usual reason not to
      bother is that you need a domain. **M8 is building a web platform, so there will be one**,
      which makes verified links close to free — and is a concrete argument for **building the web
      app before wiring auth** rather than after.
- [ ] **The callback validates `state`, exchanges immediately, and never persists or logs the
      params.** An authorization code that lingers in a log or a database row is a credential at
      rest that nobody is guarding.
- [ ] **Session tokens go in `expo-secure-store`** (Keychain / Keystore), **never in SQLite**. The
      database is decided as unencrypted (T1 §C) precisely because it holds nothing that needs
      protecting; a session token would change that answer overnight.

**The callback is the one deep link that acts, and that is why it is fenced.** T1 §D's rule is that
the scheme carries navigation only — every link equivalent to a tap the user could have made. An
OAuth callback breaks that by definition: it arrives from outside and completes a sign-in. So it is
the **single** exception, and the constraints above are what keep it narrow — it acts only on a flow
*this device started*, proves that with a verifier that never left the device, and consumes the code
immediately. A second acting link would be a new exception needing the same argument made again, and
the answer should be no.


---

## S1 — Stability on real devices

**The app is feature-complete and has barely been used on a phone.** Two navigation bugs turned up
within minutes of the first release build reaching a device on 2026-08-20, and both had been in the
tree since M7A. Neither was subtle once seen; nothing in the repo could have seen them, because the
suite runs in Node with no renderer and no navigator.

That is the gap S1 closes. Not more features — **confidence that what exists works on hardware.**

**Done when:** a release APK survives a full session on a real phone — onboarding, build a deck,
import a deck, log ten games, read the stats, change language, force-quit and reopen — with no dead
control and no stuck screen.

- [x] **[D2](#where-things-stand--2026-08-16) — 60 fps and airplane mode** — ~~postponed
      2026-08-14 because Metro is the connection airplane mode cuts~~. **Both hold on hardware.
      Closed 2026-08-22** on the [first device pass](#s1--the-device-pass--2026-08-22).
- [x] **The first-push transition** after onboarding hands off to the Decks tab — ~~the deck list
      may flash for a frame before import slides over it~~. **It does not. Closed 2026-08-22**; it
      needed a person with a phone to answer, and that is the whole point of S1.
- [x] **Uninstalling did not remove the app's data**, and reinstalling restored it — Android Auto
      Backup, on by framework default. `app.json` now sets `android.allowBackup: false`. **Fixed
      2026-08-22**, reversing a [T1 batch 2 decision](#t1-batch-2--done-2026-08-19) with its cost
      stated: there is now no continuity on Android until [B1](#b1--backend) ships sync.
- [x] **The app installed as "Riftbound Tracker".** `expo.name` held the working title. The
      product is **Rifthall** — the design's own name, adopted 2026-08-22 — and it was renamed in
      all 22 user-visible places. **Fixed 2026-08-22.**
- [ ] **A device pass over every flow**, written down as a checklist so the next build can be
      re-run against it rather than re-remembered. **The first pass ran 2026-08-22** and found the
      two bugs above; the checklist itself is still unwritten, which is the part that makes the
      next pass repeatable rather than remembered.
- [ ] **A real signing keystore.** ~~The current APK is signed with the Android debug key, which
      installs fine and can never be updated on a store listing.~~ **The pipeline is built and
      proven; the key itself is not generated** — it needs a password, and a password typed into a
      transcript is a leaked password. One command from the owner finishes it:
      `bash scripts/make-upload-key.sh`. See
      [the release signing pipeline](#the-release-signing-pipeline--2026-08-23).
- [x] **`android.package` and `ios.bundleIdentifier` are `com.rifthall.app` — decided
      2026-08-23.** ~~Both still read `com.riftboundtracker.app` after the rename.~~ Neither is
      user-visible, and **neither could be changed once a listing exists** — Google Play package ids
      are permanent. The owner named Rifthall the official project name and took the free window.
      **The APK built on this id is a different app to Android**, so the 2026-08-22 build must be
      uninstalled by hand rather than upgraded over.
- [ ] **iOS has never run.** No Mac, so no build — [the reasons and the price
      are recorded](#ios-was-asked-for-and-not-built-2026-08-20). **Deferred 2026-08-22 to behind
      the Android and web releases**, so it now sits after M9 rather than inside S1. Until a build
      exists, **every iOS-specific T1 decision is reasoned and unobserved**: Data Protection, the
      privacy manifest, iCloud backup, ATS. Two of those are now *known* to be unfinished rather
      than merely unobserved — the database is still in `Documents/` with no
      `NSURLIsExcludedFromBackupKey`, so iOS does not have the fix Android just got. The device
      pass above is Android's, and only Android's.
- [ ] **Android device-to-device transfer is still open.** `allowBackup="false"` shuts cloud
      backup but, per Android's own docs, not necessarily D2D transfer on Android 12+. Closing it
      needs an `android:dataExtractionRules` file with an empty `<device-transfer>`, which
      `@expo/config-plugins` cannot express — it would take a custom config plugin. Not the bug
      that was reported; recorded so it is not mistaken for covered.
- [ ] **App icon and splash.** The current splash is `assets/placeholder/splash.png`, a solid
      `#0A0B0F` square generated to unblock the build — the missing asset did not make the app
      plain, it made it fail at resource linking. Real art replaces it. **Deferred 2026-08-22** by
      the owner; it blocks nothing before M9.
- [ ] **`expo-system-ui` is missing**, so `app.json`'s `"userInterfaceStyle": "dark"` is inert on
      Android. The app paints its own surfaces so nothing looks wrong; the setting is a lie until
      the package is installed.

### S1 — the device pass — 2026-08-22

The owner ran the release APK on a real phone. **Three things it was waiting to learn came back
clean, and two bugs came back that no test could have found**, because both live in configuration
the suite never reads.

**Clean:**

- **[D2](#where-things-stand--2026-08-16) — 60 fps and airplane mode both hold.** The scroll target
  from the original plan is met on hardware and the app is fully usable with the radio off. D2 was
  written on 2026-08-14, postponed the same day because Metro is the connection airplane mode cuts,
  and is closed here on the first build that could answer it.
- **The first push after onboarding does not flash.** The deck list does not appear for a frame
  before import slides over it. This was a suspicion recorded because it could not be checked from
  a machine with no renderer; the answer is no, and it needed a person with a phone to say so.

**Bug 1 — uninstalling the app did not remove its data, and reinstalling brought it back.**

Not a bug in the app's code: `app.json` set no `android.allowBackup`, and Expo's plugin defaults it
to `true` (`config.android?.allowBackup ?? true`, measured in
[T1 batch 2](#t1-batch-2--done-2026-08-19)). Android Auto Backup therefore copied the app's data
directory — `riftbound.db` included — to the user's Google Drive, and Android restored it on the
next install. **Fixed:** `app.json` now sets `"allowBackup": false`.

**This reverses a T1 batch 2 decision, deliberately, and the reason it was declined then was not
wrong — it was outweighed.** Batch 2 kept backup on because it is the only continuity the app has
until sync ships, and losing a phone would mean losing the whole match history. That trade is real
and it still costs something: **there is now no safety net at all on Android.** What changed is that
the behaviour was observed rather than reasoned about, and a deliberate uninstall silently not
uninstalling is the kind of surprise that costs more trust than the continuity was buying.
Continuity is [B1](#b1--backend)'s job, and B1 is two milestones away.

**Three things follow from it, and all three are recorded rather than assumed:**

- **The welcome copy changed back.** `onboarding.wip.body` was corrected in batch 2 *away* from
  *"live only on this device"* precisely because backup made it false. It is now true again, and it
  says the new consequence out loud rather than quietly dropping the clause: *"nothing is sent
  anywhere and nothing is copied to a cloud backup, so uninstalling the app deletes them."* Three
  strings, one per language. [`STORE.md`](STORE.md)'s privacy policy draft says the same.
- **iOS is not covered by this and must not be assumed to be.** `allowBackup` is an Android manifest
  attribute. The database still sits in `Documents/`, which iCloud backs up by default, and nothing
  sets `NSURLIsExcludedFromBackupKey`. Tracked below.
- **`allowBackup="false"` does not close device-to-device transfer on Android 12+, and the docs say
  so explicitly.** Checked rather than recalled — Android's Auto Backup guide: *"On devices from
  some device manufacturers, specifying `android:allowBackup="false"` disables cloud-based backup
  and restore … but doesn't disable device-to-device transfers for the app."* Closing that needs an
  `android:dataExtractionRules` XML with an empty `<device-transfer>`, and `@expo/config-plugins`
  has no option for it — grepped, there is none — so it would take a small custom config plugin.
  **It is not what the owner hit** (uninstall-and-reinstall is the cloud-backup path, which is now
  shut), so it is tracked below rather than built here.

**Bug 2 — the app installs as "Riftbound Tracker". The name is Rifthall.**

`expo.name` is what Android puts under the launcher icon, and it still held the working title.
**Fixed:** `app.json` now reads `"name": "Rifthall"`, and the name was renamed everywhere it is
shown to a user — 22 occurrences across the three translation catalogues, the Settings version line,
the i18n scanner's proper-noun allowlist, `README.md`, `PROJECT.md` and `STORE.md`, including the
Riot attribution and the privacy-policy draft. The occurrence in this document was left alone: it is
the old OneDrive folder path in [the move record](#moved-out-of-onedrive-2026-08-07), which is
history and not a name.

**Rifthall is not a new idea — it is the design's own name, adopted at last.** M7A recorded it as
*"a naming exploration the app never adopted"* and used the working title instead. That note is
[corrected in place](#m7a--what-shipped-2026-08-16). The game is still Riftbound; only the product
renamed.

**~~What did not change, and is now the last free moment to change it:~~ changed 2026-08-23.**
`android.package` and `ios.bundleIdentifier` were both `com.riftboundtracker.app`, the working
title's id. Neither is visible to a user, and both are **permanent once a listing exists** — a
package id cannot be changed on Google Play, only abandoned — so the window was open exactly until
the first release, and it was still open. Both now read **`com.rifthall.app`**.

**The consequence is worth naming, because it is the same trap in a different coat.** An id change
makes a *new app* as far as Android is concerned: the 2026-08-22 build cannot be upgraded over, it
has to be uninstalled, and its data does not carry across — which is now genuinely gone rather than
quietly restored, since backup is off. That is the correct behaviour and it is still a surprise if
nobody says it out loud.

**`scheme` was deliberately not changed.** It stays `riftbound`, so deep links remain
`riftbound://deck/…`. Unlike a package id a scheme can be changed at any time, nothing publishes
one yet, and the game genuinely is Riftbound — it is the product that renamed. Revisit it at
[M9](#m9--ship) if the deep links ever go in a store listing.

### The release signing pipeline — 2026-08-23

**An Android release build no longer *can* be signed with the debug key.** That is the whole
property, and it is worth stating as a prohibition rather than a feature, because the failure mode
this replaces was silent: Expo's generated `android/app/build.gradle` ships

```gradle
release {
    // Caution! In production, you need to generate your own keystore file.
    signingConfig signingConfigs.debug
```

so a release APK builds, installs, runs, and is worthless for a store listing, with nothing anywhere
saying so. **Adding a `release` signing config without deleting that line changes nothing.**

**Where it lives, and why not in `android/`.** `android/` is generated and gitignored; a signing
config written there is deleted by the next `expo prebuild`. So it is a local config plugin,
[`plugins/withReleaseSigning.js`](../plugins/withReleaseSigning.js), registered in `app.json`,
which re-injects it on every regeneration. The Groovy itself is a separate file,
[`plugins/release-signing.gradle`](../plugins/release-signing.gradle) — **the first attempt kept it
in a JS template literal and shipped a build file that would not parse**, because `\n` and `$`
were consumed by JavaScript before Groovy ever saw them. A `.gradle` file has no escaping layer.

**Three refusals to fail quietly, each verified rather than asserted:**

| | Verified |
| --- | --- |
| A release build with no keystore **fails** with a message naming what is missing and where | `assembleRelease` stopped with exactly that, listing all four missing keys and the absolute path it wanted them in |
| The debug-key line is **gone**, not merely supplemented | `signingConfig signingConfigs.release` in `buildTypes.release`; the only remaining `signingConfigs.debug` is the debug build type's own |
| Debug builds are **unaffected** — the check reads the task graph, not the config | `assembleDebug` BUILD SUCCESSFUL in 5m 13s |

Two more properties are structural. The plugin **asserts every anchor it edits**, so a future Expo
template that renames the release block fails `prebuild` loudly instead of leaving debug signing in
place — the one outcome the whole plugin exists to prevent. And it is **idempotent**: a plain
prebuild finds its marker and does nothing, so the block cannot double-inject. Both were exercised —
`prebuild --clean` twice and a plain `prebuild` once, with the marker count still showing a single
block.

**What the documentation actually says, checked rather than recalled.** Three claims mattered and
one of them was nearly wrong:

- **Play App Signing is required for new apps**, so this key is an *upload* key only — Google holds
  the app signing key. Android's own docs: *"configuring Play App Signing is required to sign your
  app for distribution through Google Play (except for apps created before August 2021)."* A first
  fetch summarised this as "not mandatory" by reading the auto-enrolment sentence; the direct quote
  settles it.
- **The algorithm is not a free choice.** Play Console help: *"Must be an RSA key of 2048 bits or
  more."* EC P-256 is **not** accepted for upload keys, so the script generates RSA 2048.
- **An upload key is recoverable and the app signing key is not.** *"If you lose your upload key or
  suspect that it was compromised, you are not locked out of your app"* — it is reset through the
  Play Console by submitting the certificate. The script exports that certificate
  (`rifthall-upload-certificate.pem`) at generation time, so the recovery path exists before it is
  ever needed. **This materially lowers the stakes of the warning this item has carried since it was
  written**: losing the upload key is recoverable; it is the Play-held signing key that is not.

**One deviation from Google's wording, deliberate.** Play's help page describes the keystore as
*"stored in a Java keystore (`.jks` or `.keystore`)"*, and this uses PKCS12 (`.p12`). Nothing
breaks: **Play never receives the keystore.** It receives a signed artifact, and — only for a reset
— a PEM certificate. The format is a local concern, JKS is a proprietary format keytool itself warns
about migrating away from, and `developer.android.com` mandates no format at all.

**The password is the owner's and was never handled here.** `keytool` takes `-storepass` only as a
plain argument, which puts the secret in the process list and the shell history, and it has no
`:env` or `:file` form. So [`scripts/make-upload-key.sh`](../scripts/make-upload-key.sh) reads it
with terminal echo off and pipes it to `keytool` over stdin. It never appears in a transcript, an
argument vector, or a tracked file. The script also refuses to overwrite an existing keystore, since
that is the one mistake with no undo.

**Ignored, and checked by rule rather than by outcome.** `/credentials/`, `keystore.properties`
and `*.keystore` were added; `git check-ignore -v` reports all three artifacts matching
`.gitignore:40:/credentials/`. That distinction matters — the pre-existing `*.p12` rule would
have matched the keystore anyway and made the check pass without the new rules landing, and
`credentials.json` on line 46 is EAS's unrelated file.

**Not done, and it needs the owner:** the key does not exist yet, so nothing is signed with it and
[S1's item](#s1--stability-on-real-devices) stays unticked. The verification step —
`apksigner verify -v --print-certs` against the built APK, reading the certificate out of the
binary rather than trusting the config — runs after the key does.

**Two S1 items were deferred by the owner, not dropped:** the app icon and splash come later, and
iOS moves behind the Android *and* web releases — so the order is now
**S1 → T2 → B1 → W1 → R1 → M9 → iOS.**


---

## T2 — OWASP hardening

**"OWASP Top 10" is three different lists, and picking the wrong one produces theatre.** The famous
one is written for web applications. Applied to a React Native app it spends half its attention on
risks that cannot exist there — while the things that actually threaten a mobile app are not on it.
So this milestone runs three lists against three surfaces:

| Surface | List | Edition |
| --- | --- | --- |
| The app | [OWASP **Mobile** Top 10](https://owasp.org/www-project-mobile-top-10/2023-risks/) | **2024** — first update since 2016 |
| The web platform | [OWASP **Top 10**](https://owasp.org/Top10/2025/) | **2025** — released Nov 2025 |
| The backend | [OWASP **API Security** Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | **2023** |

**Editions verified 2026-08-20, and one of them corrected a wrong assumption.** The web list was
believed to be 2021; the 2025 edition replaced it, moved Security Misconfiguration to second, split
supply chain into its own category, and added a tenth that did not previously exist. Working from
the remembered list would have meant hardening against a five-year-old consensus — the same failure
as paraphrasing Riot's policy instead of reading it.

> **Naming hazard.** The Mobile list numbers its items **M1–M10**, and this roadmap numbers
> milestones **M0–M9**. They are unrelated. Every reference below writes *Mobile M7*, never *M7*.

### T2 sits here for the same reason T1 did

Half of it is about what the app already does, and half sets the rules the backend and the web
platform have to be built to. **The API list is not an audit to run after B1** — it is a set of
constraints B1 builds to, or it is a retrofit. That was T1's argument for sitting before M8 and it
did not stop being true.

### Most of this is already done, and it was done without the name

T1 covered a large share of the web list before anyone called it OWASP. Recording the mapping is the
point of doing so now: **it prevents re-doing finished work, and it makes the real gaps visible.**

| 2025 category | Where it already stands |
| --- | --- |
| A01 Broken Access Control | **Nothing yet — there is no server.** [B1's scoping helper](#what-replaces-rls) is the whole answer. Gates B1 |
| A02 Security Misconfiguration | [§A](#a--store-and-platform-requirements) privacy manifest · `allowBackup` measured · `/_sitemap` overridden · ATS and cleartext verified |
| A03 Software Supply Chain Failures | [§E](#e--supply-chain) · `npm run audit:bundle` · advisories measured by source map, not grep |
| A04 Cryptographic Failures | [§B](#b--secrets-transport-and-what-ships-in-the-bundle) HTTPS-only · [§C](#c--data-at-rest-on-the-device) data at rest, decided with a tripwire |
| A05 Injection | [§D](#d--untrusted-input) · fifteen SQL sites with an allowlist test · deck-code parser fuzzed |
| A06 Insecure Design | [§D](#d--untrusted-input) deep-link rule — *navigation only, never commands* · the version-lock rule |
| A07 Authentication Failures | [Auth constraints](#auth-constraints-set-by-t1-2026-08-16) — PKCE, verified links, tokens in secure-store. Gates B1 |
| A08 Software or Data Integrity Failures | `seed-shape.test.ts` · Zod at the Riftcodex boundary · B1 adds the schema parity test |
| A09 Security Logging and Alerting Failures | **A deliberate gap on the app, and an open question on the server.** See below |
| A10 Mishandling of Exceptional Conditions | **New in 2025, and [§F](#f--failure-behaviour) already did it** — an error boundary that holds nothing, a parser that always throws rather than hanging, diagnostics separated from user-facing text |

**So T2 is smaller than it sounds.** What is genuinely open is A01 and A07 (which do not exist until
B1), A09 (below), and the mobile items nothing has looked at.

### A09, and the tension worth naming

The app has **no logging, no crash reporting, no analytics, and no monitoring**, by standing owner
decision. Against the web list that is an A09 failure. On the app it is defensible and stays:
there is nothing to monitor, no server to attack, and the alternative reintroduces exactly the
device-data collection the project refused.

**On the backend it stops being defensible.** A server with accounts that cannot tell you someone is
brute-forcing logins is not privacy-preserving, it is blind.

> **The resolution: logging about the *service* is not telemetry about the *user*.** Failed logins,
> rate-limit trips, 5xx rates and sync errors are operational facts about a machine the owner runs.
> None of it requires a device profile, an advertising id, or anything the app was refused
> permission to collect. **The no-telemetry rule survives intact; it was never a rule against
> knowing whether your own server is on fire.**

- [ ] **Server-side operational logging**, with a written list of what is recorded and what is
      never recorded. IP addresses are the hard case — needed for rate limiting, and personal data
      under the GDPR. Decide retention explicitly rather than by default.

### The app — Mobile Top 10 (2024)

- [ ] **Audit and record the ten**, most of which map onto closed T1 items: Mobile M1 improper
      credentials → [H1](#h1--the-key-audited-2026-08-16) and §B · M2 supply chain → §E · M4
      input validation → §D · M5 communication → §B · M6 privacy → [`STORE.md`](STORE.md) ·
      M9 data storage → §C · M10 cryptography → §C. **Mobile M3 auth is B1's.**
- [ ] **Mobile M8 misconfiguration on the generated manifest.** `allowBackup` is measured and
      decided — and **re-decided 2026-08-22 to `false`**, with
      [device-to-device transfer still open](#s1--the-device-pass--2026-08-22); exported components
      and any debug flags in a release build are not. The native
      project is regenerated by `prebuild`, so this is a check against the *output*, not the config.
- [ ] **Mobile M7 — Insufficient Binary Protections. The recommendation is a deliberate *no*.**

      > No obfuscation, no root or jailbreak detection, no anti-tamper.

      Binary protection protects secrets inside a binary, and
      [§B](#b--secrets-transport-and-what-ships-in-the-bundle) already establishes there are none — verified again 2026-08-19: no `process.env`, no
      `EXPO_PUBLIC_*`, no `.env`, no `Authorization` header. Nothing is gated client-side, so there
      is no check worth defeating. Adding it would obscure a bundle containing nothing, and cost
      real debuggability.

      **Tripwire, in the shape §C used:** the moment the app holds a secret, performs a client-side
      entitlement or licence check, or gains anything a user could profit by tampering with, this
      decision is void and gets made again.

### The backend — API Security Top 10 (2023), as B1 build constraints

These are requirements on [B1](#b1--backend), not an audit after it.

- [ ] **API1 · Broken Object Level Authorization — the number-one API risk and the one this design
      is most exposed to.** Answered by [the scoping helper](#what-replaces-rls) and its structural
      test: no route composes its own `where` against a user table.
- [ ] **API3 · Broken Object Property Level Authorization — the sharpest item for a sync endpoint,
      and it deserves naming precisely.** The endpoint accepts *rows from the client*. If it trusts
      the `user_id` on an incoming row, **any user can write rows owned by anyone.**

      > `user_id` is derived from the session and never read from the payload. A request that
      > carries one is rejected, not corrected.

      The mirror of it: a response must never carry another user's columns.
- [ ] **API4 · Unrestricted Resource Consumption.** A sync endpoint that accepts an unbounded batch
      is a denial of service with extra steps. Caps on batch size, body size and request rate —
      **and this project has already learned this exact lesson once**: the deck-code parser
      allocated ~20× its input before rejecting it, and *"rejecting after allocating is not
      rejecting"* ([batch 1](#t1-batch-1--done-2026-08-16)).
- [ ] **API2 · Broken Authentication.** better-auth handles the mechanism; session lifetime,
      rotation, and lockout after repeated failures are still decisions.
- [ ] **API6 · Unrestricted Access to Sensitive Business Flows.** Account creation is the one that
      matters on a self-hosted box — unthrottled signup is how a small server becomes someone
      else's spam relay.
- [ ] **API7 · SSRF.** The card-catalogue job is the only server-side fetch. Its URLs come from
      code, never from user input, and that must stay true when the source becomes Riot's API in
      [R1](#r1--riot-api-and-compliance).
- [ ] **API8 · Security Misconfiguration.** Postgres unreachable from outside, TLS at the edge,
      no default credentials — already in [B1's self-hosting section](#self-hosting-concretely).
- [ ] **API9 · Improper Inventory Management.** Self-hosting now and rented hosting later means two
      environments will exist at once. **A forgotten dev instance with real data is the classic way
      this goes wrong.**
- [ ] **API10 · Unsafe Consumption of APIs.** Already the pattern — Zod validates Riftcodex at the
      boundary and the app keeps its last-known-good mirror on drift.

### The web platform — Top 10 (2025), as W1 build constraints

The app is native and skips the browser risks entirely. [W1](#w1--web-platform) does not.

- [ ] **A03 supply chain widens.** A browser bundle pulls a different dependency tree, and
      `audit:bundle` measures the *mobile* bundle. The web build needs the same treatment or the
      answer is only true for one client.
- [ ] **XSS on card text.** Card data includes `text_rich`, which is **HTML from an upstream API**.
      The app renders `textPlain` and never the rich field; a web client that innerHTMLs
      `text_rich` has an injection path from a third party straight into the DOM. Sanitise or keep
      rendering the plain field.
- [ ] **CSRF and cookie policy**, if sessions are cookie-based. SameSite, Secure, HttpOnly.
- [ ] **Standard response headers** — CSP, HSTS, `X-Content-Type-Options`, frame ancestors.
- [ ] **A01 again, from a second client.** The web app must go through the same scoping helper. Two
      clients reaching data by two different paths is how one of them ends up wrong.

**Done when:** each of the three lists has every item either satisfied or recorded as a deliberate
decision with a tripwire — the [§C](#c--data-at-rest-on-the-device) standard, where *"no"* is an
answer and *"we did not look"* is not.

---

## B1 — Backend

**Where user data lives once it is not only on one phone.** Accounts, decks, collection, games —
the same eight tables the device already carries, on a server the owner runs.

**Self-hosted first, deliberately.** The stated plan is to run this on hardware already paid for
move it to rented hardware when there is money to rent it with. That is a real constraint and it
shapes the architecture more than any preference would: **everything here has to be a thing you can
pick up and put down somewhere else.**

### The shape

```
   phone ─ SQLite ──┐                        ┌── web browser
   (offline-first)  │                        │   (online-only)
    sync engine     ▼                        ▼
                  ┌────────────────────────────┐
                  │  API — Hono on Node        │   the only thing on the internet
                  │  better-auth · Drizzle     │
                  └─────────────┬──────────────┘
                                │  private network, never exposed
                  ┌─────────────▼──────────────┐
                  │  Postgres                  │
                  └────────────────────────────┘
                                ▲
                    ┌───────────┴──────────────┐
                    │  packages/core           │  shared verbatim by all three
                    │  legality · deck-diff    │
                    │  deck-code · analytics   │
                    └──────────────────────────┘
```

### The decision that changed, and why

[M8](#m8--cloud-and-the-web-platform) recorded **"No custom API server"**, and the argument was
good: Supabase is Postgres with auth and row-level security in front of it, both clients speak to it
directly, and writing an API instead means re-implementing authorization in application code — the
layer most likely to have a hole, replacing one the database enforces.

**Self-hosting does not by itself overturn that** — Supabase runs self-hosted, and taking it would
preserve every T1 decision unchanged. It was weighed and it lost on three grounds:

**1 · Home hosting makes surface area the first question, not the third.** The Supabase shape puts a
database endpoint on the internet and relies on RLS being correct to keep it safe. That is a
defensible trade on managed infrastructure with someone else's security team. On a home connection
it means ten containers exposed where one process would do. **In the API shape Postgres never faces
the internet at all** — it listens on a private Docker network and nothing routes to it.

**2 · Local-first means the API is a sync endpoint, not a CRUD API.** This is the part most
missed. The device already owns its data and already reconciles; the server needs *push changes*,
*pull changes since*, and auth. That is a surface small enough to hold in your head — which is
exactly the condition under which "authorization in application code" stops being the scary option.

**3 · The web client goes through the API too**, so there is no direct-database client anywhere.
RLS was load-bearing in the M8 design *because* browsers queried Postgres. Remove that and the
reason for it goes with it.

**What it costs, stated plainly:** authorization becomes code the project owns rather than a
guarantee the database makes, and T1's RLS-specific decisions need rewriting. See
[what replaces RLS](#what-replaces-rls) below — the answer is not "be careful".

### Stack

| Layer | Choice | Why this one |
| --- | --- | --- |
| Runtime | **Node 24** | Already the toolchain. No second runtime to learn or pin |
| API | **Hono** | Tiny, TS-first, and runs unchanged on Node, Bun, Deno and Workers — which *is* the portability requirement, not a nice-to-have |
| Database | **Postgres 17** | The one piece with no realistic alternative. Every hosting story ends at managed Postgres |
| ORM | **Drizzle** | Already used on the device. `pg-core` and `node-postgres` are in the installed package today |
| Auth | **better-auth** | TS-native, has a Drizzle adapter, covers email/password, OAuth and sessions. Verify it is still the healthy choice before committing — this was written 2026-08-20 |
| Validation | **Zod** | Already the boundary tool for Riftcodex. Same job, same library |
| Container | **Docker Compose** | Two services. The whole thing must come up with one command or it will not be reproducible on the machine it moves to |

**Rejected:** self-hosted Supabase (above); PocketBase and Appwrite (neither aligns with Drizzle,
and the alignment is the point); a serverless platform (the stated plan is a machine you own).

### The data layer, and one honest limitation

The device defines eight user tables in Drizzle. The server needs the same eight in Postgres. **The
obvious hope — one definition, two dialects — does not work.** Drizzle's table builders are
dialect-specific: `sqliteTable` and `pgTable` are different functions producing different types.
There is no supported way to declare a table once and materialise it in both.

So the shape is **two definitions and one parity test**, which is this project's existing idiom —
`seed-shape.test.ts` holds the seed at 29 columns for 29 for exactly the same reason. The test
asserts that every table has the same column names, that nullability agrees, and that the sync
columns are present on both sides. **Drift between device and server is the defect class most likely
to cost real user data, and it is the one a type system cannot catch across a network boundary.**

`packages/schema` holds both definitions side by side so the diff is visible in one file rather than
across two repositories.

**The sync columns were built for this and have been waiting since M2** — `user_id`, `updated_at`,
`deleted_at`, `dirty`, `updated_by_device` are already on every user table. Soft deletes are why
deletion can propagate at all.

### What replaces RLS

Not vigilance. Three things, in the order they fail:

- [ ] **One scoping helper, and every user-table query goes through it.** No route composes its own
      `where` clause against a user table. The helper takes the session and returns a scoped
      builder; there is no way to ask for rows without saying whose.
- [ ] **A structural test that fails on any query bypassing it** — the shape of
      `sql-injection.test.ts`'s allowlist, which already guards fifteen interpolation sites the same
      way. It does not prove the queries are correct. It proves nobody added one without being seen.
- [ ] **Postgres is not reachable from outside.** Private network, no published port. If the
      application layer is wrong, the blast radius is still one process.
- [ ] **The service credential never leaves the server.** The mobile and web bundles are public
      ([T1 §B](#b--secrets-transport-and-what-ships-in-the-bundle)); the database password lives in
      the server's environment and is not a value any client has ever seen.

### The sync protocol

Already decided in M8 and unchanged: **pull-then-push, last-write-wins per row on `updated_at`,
soft deletes propagate.** Versions are immutable once played and games are append-mostly, so genuine
conflicts are rare — [why last-write-wins is enough](#why-last-write-wins-is-enough) still holds.

**Signing in claims local rows rather than replacing them.** The app is fully usable signed out; the
first sign-in stamps `user_id` onto what is already there and uploads it. A player who used the app
for a month before making an account must not lose that month.

### Self-hosting, concretely

- [ ] **Docker Compose with two services**, Postgres and the API, and a named volume for the data.
- [ ] **TLS at the edge** — Caddy or a tunnel. A password crossing the internet in the clear is the
      one failure that is unrecoverable for the user rather than for the project.
- [ ] **Backups, and a restore that has actually been run.** This is the item most likely to be
      skipped and the only one whose absence is catastrophic: the moment sync exists, some players
      will have data that exists *only* on this machine. An untested backup is not a backup.
- [ ] **A domain**, which the web platform needs anyway and which
      [T1's auth constraints](#auth-constraints-set-by-t1-2026-08-16) already argued for — verified
      App Links are close to free once one exists.

### The T1 §C tripwire fires here

[T1 §C](#c--data-at-rest-on-the-device) decided the device database needs no encryption, and
recorded the condition that voids it: *the moment the schema gains a token, an email address, a
password, or anything a user would not post publicly.* **B1 is that moment**, and this is the first
time the tripwire has been reached.

What it obliges, none of it optional:

- [ ] **Re-make the encryption decision** rather than inherit it. The device answer may well stay
      the same — session tokens belong in `expo-secure-store`, never in SQLite, which was already
      recorded — but it gets made again with the new schema in front of it.
- [ ] **All three store documents are re-answered before anything ships.** The Apple manifest's
      `NSPrivacyCollectedDataTypes` stops being empty; the Play Data Safety answers change from "no
      collection" to email and user content; the privacy policy gains a controller processing
      personal data, and with it the rights that attach. All three are in
      [`docs/STORE.md`](STORE.md), written to be re-answered in one edit.
- [ ] **The privacy policy's own promise comes due.** It says a version introducing accounts will
      update the policy **before** shipping. That sentence was written as a commitment.
- [ ] **In-app account deletion, built with sign-up and not after it.** Apple requires it of any app
      that creates an account. The build item lives in [M8's checklist](#what-gets-built).
- [ ] **A German-operated public service needs an *Impressum*** under DDG §5, separate from the
      privacy policy.

### The repository becomes a monorepo

Three consumers of the same logic is one too many for a single app directory.

```
riftbound-tracker/
├── apps/
│   ├── mobile/            the Expo app, moved wholesale
│   ├── server/            Hono · Drizzle · better-auth
│   └── web/               W1
├── packages/
│   ├── core/              was src/lib — legality, deck-diff, deck-code, analytics
│   ├── schema/            both Drizzle definitions + the parity test
│   └── contract/          Zod request and response types, shared by all three
├── infra/                 docker-compose.yml, Caddyfile, backup script
└── docs/
```

**`src/lib/` can make this move, and that is not luck.** It is pure TypeScript with zero React
Native imports — a property defended repeatedly, most recently when the i18n layer had to stay
Node-loadable. One file has a seam: `id.ts` lazily `require`s `expo-crypto`, which becomes a
platform-injected dependency rather than an import.

**This is the riskiest step in B1 and it is first.** It touches every import path in a working app —
the `@/` alias, `tsconfig`, `vitest.config.ts`, the ESLint config, Metro. It is gated on the full
suite passing **unchanged**: same test count, same scanner result, no new failures. A restructure
that "mostly works" is worse than no restructure.

**Not done on 2026-08-20, deliberately.** The app was mid device-testing with a release APK in the
owner's hands, and destabilising the import graph while bugs are being reported against a build
would make both jobs harder. It is B1's first task, not a prerequisite to planning it.

### What gets built

- [ ] Monorepo restructure, gated on the suite passing unchanged
- [ ] `packages/schema` — Postgres definitions for the eight user tables, plus the parity test
- [ ] Postgres + drizzle-kit migrations, versioned like the device's 23
- [ ] better-auth: email/password first, OAuth after — one working path beats three half-wired ones
- [ ] The scoping helper and its structural test, **before** the first route that reads user data
- [ ] **[T2](#t2--owasp-hardening)'s API constraints are build requirements here, not an audit
      after.** They are not restated in this checklist — BOLA, the `user_id`-from-session rule, and
      the batch-size caps live in one place, and a rule in two places is a rule that can disagree
      with itself
- [ ] `POST /sync` and `GET /sync?since=` — the whole data API
- [ ] The card catalogue server-side: one job syncs the library into Postgres so the web app has
      cards to read without every browser paging a hobby API
- [ ] Docker Compose, TLS, backups with a rehearsed restore
- [ ] The phone's sync engine, claiming local rows on first sign-in

**Done when:** two devices converge after concurrent offline edits · a signed-out user who signs in
keeps every deck and game they already had · Postgres is unreachable from outside the host · a
backup has been restored onto a clean machine and the data is all there.

---

## W1 — Web platform

**The phone for the table, the web for the desk.** Log a game between rounds on your phone; sit down
at home and rebuild the deck on a screen with room for it.

**Not Expo Web**, and the M8 reasoning holds unchanged: the app compiles to web, and it would
deliver a phone in a browser window. A web platform for the desk wants width, a keyboard and
multiple columns. **Share the logic, not the screens** — `packages/core` is what crosses, not the components.

**No sync engine here.** The web client is online by definition and holds no local copy. It reads
and writes through the same API the phone syncs against. Half the hard work only has to exist once.

**[T2](#t2--owasp-hardening) sets the web security constraints**, and one of them shapes a screen
rather than a config file: card `text_rich` is **HTML from an upstream API**, and a web client that
renders it directly has an injection path from a third party into the DOM. The app sidesteps this by
rendering `textPlain`; the web platform has to decide deliberately.

### Two decisions still open

Both were raised before and neither has an answer. They are the first thing W1 has to settle,
because everything else follows from them.

- [ ] **Scope of v1 — read-only, or full parity?** A read-only web view (browse decks, read stats)
      is a fraction of the work and answers most of what a desk is wanted for. Full parity means the
      deck builder, the log form and the collection all exist twice.
- [ ] **The card catalogue in the browser** — served from the API per request, or synced into the
      browser once and held? The device holds all 1,451 cards precisely because the Riftcodex API
      cannot filter by type, domain, rarity or tag. **A browser that queries per keystroke inherits
      that limitation**; one that downloads the catalogue inherits the phone's design instead.

---

## R1 — Riot API and compliance

**Deliberately last of the build milestones.** Registration puts the project in front of Riot with
something finished to show, rather than asking permission for a plan. Nothing before this point
depends on Riot saying yes — the app has run on Riftcodex data since M1.

Moved here from [T1 §A](#a--store-and-platform-requirements) on 2026-08-20, where they were the only
two items keeping a finished milestone open. They were never code; they were always a conversation
with someone else, and they were blocking a status rather than a task.

- [ ] **Register the app with Riot.** *"If your product serves players, you must register it with us
      regardless of whether or not your product uses official documented APIs."* Owner-side, gates
      store submission, and has a lead time nobody controls.
- [ ] **Resolve the asset-sourcing clause.** *"Your App may only use Riftbound assets (including
      cards) provided by the Riot API. No external or unofficial materials."* Card **data** comes
      from Riftcodex, a community API; card **images** are hotlinked from Riot's own CDN. This is an
      architectural question, not paperwork, and the most likely reason a registration review comes
      back with conditions.
- [ ] **Migrate the catalogue to Riot's API if required.** `src/api/riftcodex/` is one boundary with
      Zod validation at the edge and a mapper behind it — the shape that makes a source swap a
      rewrite of one directory rather than of the app. That was not designed for this and it is what
      makes it survivable.
- [ ] **Keep card text in Riot's words.** *"All Riftbound cards must display the official English
      text or — if available via the API — Riot's official translation."* The app already renders
      `textPlain` verbatim and translates no card text, which M7B chose for a different reason and
      which is now a compliance requirement.
- [ ] **Aggregated win rates stay off the table.** Publishing *"metagame-defining data"* — play
      rates, win rates, matchup percentages — is an unapproved use case. Per-user rates over a
      player's own games are the product and are fine. **W1 is where this could be crossed by
      accident**, and it must not be.

**Done when:** the project is registered, the asset-sourcing answer is written down, and the
attribution on the About card matches the footing the app is actually on.

---

## M9 — Ship

- [ ] Motion and haptics polish pass
- [ ] All empty states designed and implemented
- [x] ~~First-run onboarding~~ — **moved to M7A**, where it sits with the rest of the
      first-impression work rather than being one line on a release checklist
- [ ] Accessibility pass — contrast, 44pt targets, screen reader labels (use `accessibility_text`
      from the API for cards), Dynamic Type, reduce-motion
- [x] ~~Attribution / disclaimer screen~~ — the screen exists (Settings › About). Whether it is
      *sufficient* against Riot's actual policy text is a compliance question, and moved to
      [T1 §A](#a--store-and-platform-requirements)
- [x] ~~Error boundaries and crash reporting~~ — **moved to [T1 §F](#f--failure-behaviour)**. It
      is not only a polish item: it decides what a crash is allowed to *say*, and the app has just
      finished removing exception text from a user-facing screen
- [ ] EAS Build + EAS Update pipeline
- [ ] App icon, splash, store screenshots and copy
- [x] ~~Privacy policy~~ — **moved to [T1 §A](#a--store-and-platform-requirements)**, where it
      sits beside the Apple privacy manifest and the Play Data Safety form. All three describe the
      same facts and have to agree; writing them apart is how they end up disagreeing
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

Ran before starting the Cloud milestone (M8, then numbered M7), over the whole tree rather than the
last change. Method: an exported-symbol
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

All eight items above resolved in one pass, on the owner's call, **before** Cloud rather than after.
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

Grouped and worked before the Cloud milestone. The data-layer group is above; this is the functional
one.

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

## The real domain marks (2026-08-14)

Six official domain icons supplied in `samples/Domains/`, replacing the hand-drawn stand-ins whose
own comment admitted they were *"original marks, not reproductions of Riot's official domain
symbols"*. Those had replaced Unicode placeholders (`✦ ❋ ◈ ⬢ ✷ ◉`) that rendered as tofu on Android
devices without Noto Sans Symbols — both problems stay solved, since an image cannot fail to draw for
want of a font.

### The white background was not there

The brief said the icons have a white background and to use a blend mode. They do not: the sources
already carry a correct alpha channel, and only **13–33 % of each frame is opaque**. What looks white
is a file preview showing through transparency. Verified by reading the corner pixel — `alpha 0` — not
by looking at a thumbnail.

Worth writing down because the instruction was reasonable and the fix would not have worked. **No
blend mode removes white on a dark surface.** `multiply` clears white only over *light* backgrounds
and would have crushed these marks to near-black on `#141416`; `screen` clears black and would have
kept the square; `lighten`/`darken` each pick the wrong side. Had the sources really been on white,
the answer would have been to key the white to alpha, not to blend.

### Tinted, not shown in their own ink

The sources are single-colour marks in Riot's print inks — Fury `#B32F29`, Mind `#23779B`, Order
`#CEA903`. `theme/domains.ts` already holds those under `print` and labels them **reference only — do
not render**: they are ink on card stock and five of six fall below 3:1 on a dark surface.

So each asset ships as a **white silhouette carrying nothing but alpha**, and `tintColor` colours it
from the palette, where every `base` clears 6.3:1 on `surface`. The shape is Riot's, the colour stays
the app's. This also keeps the `color` prop working — `DomainBadge` passes `base`, and the filter
chips flip the glyph to `bg` when selected — which a baked-in colour would have silently broken.

Alpha is copied **verbatim** from the source rather than re-derived from colour. A first pass
recovered coverage from `(255 − p) / (255 − C)`, which is exact only for one flat colour and would
have quietly thinned any two-tone mark. The interior holes — Fury's ring, Calm's veins, Mind's dots,
Body's cut-outs, Order's wings — are real transparency, and were confirmed by compositing the tinted
silhouettes onto `#141416` and **looking at the result**, not by trusting the pixel counts.

### Colorless keeps its ring

No mark was supplied for it and none was invented. The drawn open ring is the right shape anyway:
Colorless is the *absence* of a domain, and an open ring reads as exactly that beside six filled
marks.

### The palette had the right colours on the wrong names

Reported from a device: *"Calm is blue, Body is green, Mind is purple, Chaos is pinkish."* All four
correct, and the cause was not the new icons — it was the **domain palette itself**, which the Hi-Fi
retheme had shipped with its hues attached to the wrong domains. Measured against the official marks
in OKLCH:

| Domain | Palette was | True hue | Error |
| --- | --- | --- | --- |
| Calm | blue `#4C86B0` | green 145° | **96°** |
| Mind | purple `#8A6FD1` | blue 231° | **63°** |
| Body | green `#5DA37A` | orange 52° | **105°** |
| Chaos | magenta `#B15CA0` | purple 313° | 22° — the "pinkish" one |
| Fury · Order | — | — | 3° each, already right |

**Reassigned rather than restyled.** Four of those values were already correct for *some* domain, so
each moved to the one it actually matches. Only **Body** was minted — the set contained no orange at
all — derived in OKLCH at the kept set's median lightness and chroma (L 0.611 · C 0.103) so it sits
with its siblings rather than beside them. Every domain now lands within **18°** of its own ink while
the palette keeps the desaturated character the retheme chose. Magenta `#B15CA0` is retired.

Verified by rendering the six official marks above the six palette-tinted ones on `#1B1B1E` and
looking at the pair, not by comparing hex.

**A false claim found while measuring.** `theme/domains.ts` stated *"every `base` clears 6.3:1 on
`surface`"*. That described the M0 derivation at L 0.70; the retheme replaced the set and the
sentence was never updated. The shipped set runs **4.00 – 6.31**, and only Order clears 6.3. All six
clear the 3:1 a non-text UI mark needs — which is what these are — but the file was describing a
palette that no longer existed. Corrected in place rather than quietly deleted.

### Deck overview was drawing a coloured square

Also reported. It was never showing the placeholder glyphs — it drew a **7 pt coloured dot** beside
the domain name, so it had nothing to update when the marks landed. Worth naming as more than an
oversight: a bare dot means **colour was carrying the meaning alone** on that screen, which is the
one thing the domain system says it must never do, and it was the screen where Fury and Body — 25°
apart — sit side by side. It now renders the real `DomainGlyph`.

### The names were never placeholders

`Fury · Calm · Mind · Body · Chaos · Order · Colorless` are the official vocabulary, taken from the
Riftcodex `/index/domains` endpoint at M1 and unchanged since. Only the glyphs were stand-ins.

`types/images.d.ts` is new and checked in: Metro resolves a `.png` import to an asset-registry id,
TypeScript knows nothing about that, and `expo-env.d.ts` does not cover it — nor could it, being
generated and gitignored.

**Gate:** typecheck clean, lint clean, **506 tests / 29 files**. Bundle 200 / 13.13 MB with all six
`assets/domains/*.png` registered, the placeholder SVG paths confirmed gone, and the retired magenta
present only inside the comment that records why it was retired.

## Three device-reported bugs (2026-08-14)

All three came from using the app rather than from an audit, and all three are the same shape: the
logic was right and the surface reading it back was not.

### Renaming a deck saved nothing

`renameDeck` lived inside `commit()` — the function the save-version sheet calls — and that sheet
only opens for a **non-empty card diff**. Changing only the name took `onSave`'s empty-diff branch,
which navigated away without writing. The one edit that never forks a version was also the one edit
that never saved. Renaming *and* moving a card worked, which is why it looked intermittent.

The rename decision and the write are now one pair of helpers called by both exits, so they cannot
disagree. Two further problems fell out: `hasUnsavedWork()` only ever checked the card list, so
renaming and leaving by the back gesture discarded the name with no prompt; and the empty-diff branch
now writes, so it needed the double-tap latch the fork path already had.

### A 41-card main deck read as illegal

It is not. Re-verified against the Core Rules (v2026-07-16) rather than trusting the comment: 103.2
is *"A Main Deck of at least 40 cards"*, and `legality.test.ts` has pinned that since M2.

**The readout was the defect.** Every screen printed `Main 41/40` — the same `x/y` form the exact
zones use (`Runes 12/12`, `BF 3/3`) — so the notation said "one over" beside a verdict reading
*"Legal — every zone is within its limits."* `LegalityBar` went further and coloured the 41 in
`danger` red while its own status line said "Legal deck". `MAIN_DECK_TARGET` (`"40+"`) is now the one
display form across five render sites, and `Count` knows which thresholds are minima — a minimum can
be met but never exceeded, so it has no "over" state to warn about.

### The match view was still pre-retheme

The log form was rebuilt to the Hi-Fi design; the screen that reads the same game back was not, which
is why the two stopped looking related. Rebuilt on the same vocabulary — `MatchupCard`, `ChoiceRow`,
`SelectField`, `CardSlot`.

| Was | Now |
| --- | --- |
| Header set the **opponent's** Legend in the 30px display face, wrapping to two lines and repeating the field 20pt below; your deck was metadata | `MatchupCard` pair — YOU vs THEM, both with art. Header is just `Game` |
| Chips sized to their labels: **120/137/142**, **93/119/126**, **166/160/256** — three targets per row, a third of the screen unused | `ChoiceRow`, `flex: 1` at fixed height |
| Score as `7–8 points` inside 9px uppercase metadata | A scoreline with You/Them columns, winning side lifted |
| The hand as prose | `CardSlot` tiles — the deal with sent-back cards dimmed and badged, then a "Drew back" row |

The chip *heights* were measured off the screenshot at 92–97px selected and unselected alike: the
selected one is not bigger, it only reads that way filled. Worth recording, since it is the obvious
suspect and the wrong one.

**The hand line was a correctness bug, not a style one.** It printed `openingHand` under the word
"Kept" — but that column stopped meaning "the cards kept" and started meaning the whole deal, so every
recycled card was listed as kept *and* as sent back in one sentence. It also joined names with `, `
when Riftbound names are `Name, Epithet`, so a four-card hand holding two "Kayle, Justified" read as
six items. And it never showed `replacements` at all.

`dealOf()` (`src/lib/opening-hand.ts`) reads **both storage formats**: migration 20 added
`replacements` without backfilling the redefinition, so pre-redefinition rows hold the deal as
`kept ∪ mulliganed`. Any mulliganed id the deal cannot account for is appended, which reconstructs
those rows; under the current format the budget empties and nothing is appended. It also consumes a
budget per id rather than testing membership, so a hand holding two copies and recycling one marks
one. Both rules were **proved non-vacuous** — breaking the budget failed 4 tests, removing the
reconstruction failed 2.

Also fixed: the Edit-match-detail button advertised "Champion turns", a column dropped in migration 19.

**Gate:** typecheck clean, lint clean, **514 tests / 30 files** (7 new). Bundle 200 / 13.79 MB;
`MatchSummary` present only inside the comment recording its deletion. All three device-confirmed.

## H2 · The npm advisories, measured (2026-08-14)

> **Three claims in this section were disproven on 2026-08-16** — see
> [the correction](#corrected-2026-08-16--three-of-the-claims-above-were-wrong) at the end.

**27 findings, 4 root causes.** The other 23 are packages that merely depend on one of these four —
npm counts every link in the chain, which is what makes the headline number alarming.

| Root | Severity | What it is | Reaches the app? |
| --- | --- | --- | --- |
| `image-size` | high ×2 | ICNS / JXL / HEIF parsers loop forever on a malformed image | **No.** `metro` → `@expo/metro` → `expo`. Bundler-only, and confirmed absent from the bundle |
| `nanoid` | high | `customRandom` can loop forever when `size` is 0 | **Ships, vulnerable function does not.** See below |
| `esbuild` | moderate | Any website can query the dev server and read the response | **No.** `drizzle-kit` → `@esbuild-kit`, a devDependency. Only live while `drizzle-kit` runs on the dev machine |
| `uuid@7` | moderate | Missing buffer bounds check in v3/v5/v6 when `buf` is passed | **No.** `xcode` → `@expo/config-plugins` → `expo`. Runs during `prebuild`, never at runtime |

**`nanoid` is the only one worth a second look**, because unlike the other three it is a *runtime*
dependency — it arrives through `expo-router@57` and is genuinely in the shipped bundle. Checked
against the built bundle rather than assumed:

- `nanoid` and `urlAlphabet` — **present**
- `customRandom` — **absent**, and it is the function the advisory is about
- `customAlphabet` — present, but it is a wrapper; the loop is in `customRandom`

The app also never calls nanoid itself. `src/lib/id.ts` generates every row id through
`expo-crypto.randomUUID()`, because Hermes ships no Web Crypto global — so there is no call site of
ours that could pass `size: 0` even if the code were bundled.

**Why the fix is worse than the finding.** `npm audit fix --force`, run as a dry run, wants to
install `expo@53` (against 57), `react-native@0.72` (against 0.86), `drizzle-kit@0.18`,
`react-native-reanimated@4`, and `expo-splash-screen@55` — five SemVer majors, all backwards. That
is rolling the project back two years to silence warnings about a bundler. The correct move is to
wait for Expo to bump its own dependencies, which is the only place these can actually be fixed.

### Do they endanger the first release? Measured: no

Asked directly, so answered by building the thing that ships rather than by reasoning about it. A
**production** bundle (`dev=false&minify=true`) came out at **6.04 MB** against the dev bundle's
13.79, and none of the vulnerable code is in it:

| Looked for | Release bundle |
| --- | --- |
| `customRandom` — the nanoid function the advisory is about | absent |
| `urlAlphabet` — nanoid's table, present in dev | absent |
| `image-size`, `ICNS` | absent |
| `esbuild` | absent |

The **dev** bundle is the conclusive half of that, because it is unminified — every identifier
survives verbatim, so `customRandom` being absent there means the module was never included at all,
rather than renamed by a minifier. The production build then removes even the parts that were there.

So the app a player installs contains none of the four. Three never could — they are bundler and
`prebuild` tooling that runs on the build machine — and the fourth ships as a library whose broken
function is not reachable. Nothing here is a reason to hold a release.

Two things that are **not** claimed by the above: this says nothing about any advisory published
after 2026-08-14, and nothing about the build machine itself. The `esbuild` finding is a real
developer-machine issue in principle — a website able to query a local dev server — but it needs
`esbuild --serve`, and `drizzle-kit` uses esbuild to transpile a config file rather than to serve
anything, so no such server is ever opened.


### Corrected 2026-08-16 — three of the claims above were wrong

Re-measured during [T1 §E](#e--supply-chain). Left in place rather than edited away, on the same
principle as the M7B "239 → 0" correction: **the mistake is the useful part.** Each of these was
recorded as measured fact, and each was measured with a method that could not see what it claimed to
rule out.

| Recorded above | Actual, 2026-08-16 |
| --- | --- |
| 4 root causes | **3** — `nanoid` is cleared |
| "the app a player installs contains none of the four" | **`nanoid` shipped**, and this section's own table said so two paragraphs earlier |
| "every remedy npm proposes is a *downgrade*" | True of three. **`nanoid` was a patch bump**, 3.3.17 → 3.3.18 |
| `expo-doctor` 20/20 | **21/21** — the check count grew with the SDK |

**The release-bundle check had a hole, and it is the interesting one.** It searched a *minified*
production bundle for `urlAlphabet` and `customRandom` and concluded absence. But a minifier renames
local identifiers, so their absence from a minified bundle is not evidence of anything — the section
even names that trap when arguing the *dev* bundle is "the conclusive half", then relies on the
minified one for the release claim anyway.

The sound method is the **source map**: `sources` lists every file Metro compiled in, by path,
regardless of minification.

```
modules in the RELEASE bundle: 2275
  uuid        not in bundle
  image-size  not in bundle
  esbuild     not in bundle
  nanoid      IN BUNDLE (1)  /node_modules/nanoid/non-secure/index.js
```

Grepping the Hermes bytecode for strings had *also* matched `esbuild` and `uuid` — as bare words in
unrelated code, not as modules. Both directions of that error are why the source map is now the
method of record.

**What was right:** the vulnerable function still never shipped. The advisory
([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)) is about `customRandom` in
`nanoid/index.js`; what ships is `nanoid/non-secure/index.js`, whose `while (i-- > 0)` exits
immediately at size 0. So the conclusion — no reason to hold a release — held. The reasoning under it
did not.

Now moot regardless: `npm audit fix` (not `--force`) bumped nanoid to 3.3.18. **27 → 26 advisories,
4 → 3 root causes**, no downgrade, no SDK change.


## H3 · The over-exposed exports, re-verified (2026-08-14)

Seven names carry `export` and are referenced in exactly **one file each** — their own. Confirmed by
searching `src` and `app` including test files, so none of them is exported "for testing" either.

| Name | Lives in |
| --- | --- |
| `toFtsQuery` | `src/db/queries/cards.ts` |
| `legendOf` · `championOf` · `SIGNATURE_LIMIT` | `src/lib/legality.ts` |
| `upsertCards` · `isSyncDue` · `SYNC_TTL_MS` | `src/api/riftcodex/sync.ts` |

**Over-exposed, not dead** — every one has a caller, just never an outside one. Nothing is broken and
nothing is unreachable; the module boundary is simply wider than the module needs. Left alone
deliberately: dropping `export` is a five-line change with no observable effect, and the audit that
found these exists to catch code that is *unreachable*, which none of this is.

**Moved to the Backlog 2026-08-14.** It is not a gap — a gap is something wrong. This is seven
keywords that make a module's front door wider than its hallway, with no consequence at runtime, in
the bundle, or to a user. It is filed as tidying so it stops occupying a slot on a list of defects.

### Closed 2026-08-16 — all seven

Re-measured first, because the earlier count was two days old and 73 files had changed since. Each
name still had callers only inside its own file, and both traps were checked rather than assumed:

- **No barrel re-exports them.** `src/i18n/index.ts` is the only barrel in the tree and it names none
  of these modules.
- **No test imports either constant.** `SIGNATURE_LIMIT` and `SYNC_TTL_MS` are referenced only by the
  functions beside them, so nothing had to choose between reaching for a constant and hardcoding a
  number.
- Nothing outside TypeScript refers to them either — no `.js`, `.mjs` or config file, so a dynamic
  reference that typecheck could not see does not exist.

The change is seven lines, one keyword each. No reordering, no renaming, nothing moved:
`git diff --numstat` reads `3/3`, `1/1`, `3/3` across the three files.

**A clean typecheck is the proof, not a formality** — an unexported name with an outside importer
does not compile. Gate: typecheck clean, lint clean, 592 tests / 37 files.

## Two navigation bugs from the first release build (2026-08-20)

**The first time the app ran as a release APK on a real phone, two bugs surfaced within minutes.**
Both had been in the tree since M7A. Both were one line.

Reported as two problems:

1. After choosing **Import Deck** in onboarding, the Decks tab was stuck on the paste screen —
   every return to the tab landed there again.
2. After importing, opening the deck left the back control dead. It rendered, and pressing it did
   nothing.

**One cause.** `onboarding.tsx` handed over with `router.replace('/deck/import')`, and
`replace` swaps the *current* screen rather than pushing onto it. So the import route became the
**root of the Decks stack** and the deck list was never in it. The first symptom is that root
restoring itself on every visit; the second is `import.tsx` then replacing import with the new
deck, leaving a stack one screen deep with nothing to pop.

**The second report is what made the first diagnosable.** "Stuck on import" alone has a dozen
plausible causes. "And back does nothing afterwards" says the stack itself is wrong, not the
routing — two symptoms triangulating one fault, which is worth more than either alone.

**The fix is not the obvious two-liner.** Chaining `replace('/')` then `push('/deck/import')` looks
equivalent and is not: expo-router queues both actions and resolves each one's target at drain
time (`routingQueue.run`), so the push can be computed against state the replace has not applied
yet. That is a race, and it would have been a race that usually worked.

The choice travels in `useOnboardingDraft.handoff` instead, and the Decks tab pushes it once
**mounted** — which is the ordering guarantee that was missing. Five tests hold it; the one that
matters asserts `takeHandoff` clears as it reads, because the navigator remounts on every
language change (`<Stack key={locale}>`) and a surviving handoff would push a screen nobody asked
for, months later. Proved non-vacuous by removing the clear.

**Typecheck caught what 766 tests did not.** The first version called
`useOnboardingDraft.getState()` inside the store's own initializer, which makes the type circular
and silently infers `any`. Every test passed. `tsc` did not. It now uses zustand's `get`.

**Nothing in the repo could have caught either bug.** The suite runs in Node with no renderer and
no navigator, which is a deliberate trade — it is why 766 tests run in under four seconds — and
this is the class of defect it pays for. [S1](#s1--stability-on-real-devices) exists because of
that gap: the answer is a device pass, not a heavier test runner.


---

## iOS was asked for and not built (2026-08-20)

**The build request was "Android and iOS, so I can install them." One of the two exists.**
`android/app/build/outputs/apk/release/app-release.apk` is real and installed on a phone. There is
no iOS build, and the reason is a platform rule rather than a difficulty worth pushing through.

**Compiling an iOS binary requires Xcode, and Xcode runs only on macOS.** This machine is Windows.
The trap is that `expo prebuild --platform ios` *succeeds* on Windows — it is a file generator, not
a compiler — so it is possible to produce an `ios/` directory and mistake it for progress. Verified
here: there is no `ios/` directory and no `eas.json`.

**The cloud path exists, and it has a price that is worth knowing before it is needed.** EAS Build
runs macOS workers, so no Mac has to be bought. But an iOS build that installs on a phone is
*ad-hoc distribution*, and Expo's own documentation is explicit about what that costs — checked
2026-08-21 rather than recalled:

- a **paid Apple Developer Program membership** is required;
- every test device's **UDID must be registered** (`eas device:create`) before it can install;
- the method is capped at **100 devices per year**.

The free alternative is a **simulator** build, which needs a Mac to run — so it does not answer
"install it on my phone" either. Android's side of this is the contrast worth naming: an APK
installs on any phone that will accept an unreviewed app, with no account and no registration.

### The part that matters is not the missing file

**Every iOS-specific thing T1 decided has been reasoned and never observed.** Data Protection keyed
to the passcode ([§C](#c--data-at-rest-on-the-device)), the privacy manifest
([§A](#a--store-and-platform-requirements) and [`STORE.md`](STORE.md)), iCloud backup including the
database, ATS with no exceptions — all of it read from documentation, none of it run on an iPhone.
The decisions are still the right ones; what is missing is confirmation that the app they describe
behaves that way on the device.

**§C's standard was that *"no"* is an answer and *"we did not look"* is not.** This is the second
kind, so it is written down rather than left to be assumed closed.
[S1](#s1--stability-on-real-devices) carries it as an item.

**What it does not block.** Android is the whole device pass for now, and the reordering already
moved the store release to the end. The membership becomes necessary at [M9](#m9--ship) regardless —
an App Store listing requires it — so the open question is *when* it gets paid for, not whether.

### Deferred behind Android and web — 2026-08-22

The owner moved iOS **after the Android and web releases**, so the order ends
**… → [R1](#r1--riot-api-and-compliance) → [M9](#m9--ship) → iOS** rather than folding iOS into
[S1](#s1--stability-on-real-devices). That answers the *when*: the Apple membership is not needed
until iOS is, which is now the last thing on the list.

**One of the four unobserved decisions above stopped being merely unobserved.** The
[device pass](#s1--the-device-pass--2026-08-22) turned Android's Auto Backup off, because
uninstalling the app did not remove its data. **iOS did not get that fix and cannot get it the same
way** — `allowBackup` is an Android manifest attribute; the iOS equivalent is setting
`NSURLIsExcludedFromBackupKey` on the database file at startup, and nothing does. So the database
in `Documents/` still goes to iCloud, and the welcome copy and
[`STORE.md`](STORE.md) privacy draft are now written for Android's behaviour. **Both must be
revisited before any iOS submission**, and that is a code change, not a config one.

---

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
| 10 | ~~**15 moderate `npm audit` advisories, all dev tooling**~~ — **re-measured; the entry was stale and understated.** It is **26 (12 moderate, 14 high)** and no longer "all dev tooling" by name — `react-native`, `expo` and `react-native-reanimated` are listed. But only **four root advisories** exist; the other 22 are transitive echoes: `esbuild` (dev-server request forgery), `image-size` ×2 (DoS parsing ICNS/JXL/HEIF), `uuid` (buffer bounds). **None reaches the app** — verified by searching the full dev bundle's module graph for `node_modules/uuid`, `node_modules/image-size` and `node_modules/esbuild`: zero references each. ~~**Still not fixed, and now for a stated reason:** every remedy npm proposes is a *downgrade*~~ — **corrected 2026-08-16.** True of three of them; `nanoid` was a plain patch bump that `npm audit fix` applied without touching Expo, taking the count to 26 findings and 3 roots. The rest still want `expo@53` (on 57) and `react-native@0.72.17` (on 0.86.2), which `--force` would roll back three SDK majors. `npx expo-doctor` now passes **21/21** | Post-move `npm ci`; re-measured in the final gap sweep | Low — decided, not deferred |
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
- ~~**Import a public decklist from a piltoverarchive.com URL**, using their API key~~ — **dropped
  2026-08-14, by owner decision.** It was the only thing in the project that would ever have needed
  that key, and the deck code already covers sharing: this only added "paste a link" convenience over
  a path that works in airplane mode, which is where import/export is actually reached for. Dropping
  it means the app needs **no credential of any kind** outside Supabase, which is worth more than the
  convenience. Note that `@piltoverarchive/riftbound-deck-codes` is unaffected — it is an offline
  Apache-2.0 npm package with zero dependencies and no network calls, and shares only the name
- **Re-check the npm advisories after every Expo SDK upgrade** (was H2). ~~27 findings, 4 root
  causes — `image-size`, `nanoid`, `esbuild`, `uuid@7` — and none of them is in the release
  bundle~~ — **corrected 2026-08-16: 26 findings, 3 root causes, and `nanoid` did ship** until it was
  bumped. See [the correction](#corrected-2026-08-16--three-of-the-claims-above-were-wrong). The
  remaining three are still absent from the release bundle,
  verified by building it. Three are bundler and `prebuild` tooling that never leaves the build
  machine; the fourth ships as a library whose vulnerable function does not. They cannot be fixed
  here: `npm audit fix --force` proposes five SemVer *downgrades*, `expo@53` against 57 and
  `react-native@0.72` against 0.86. **The upgrade is the fix** — Expo bumping its own dependencies is
  the only thing that clears them, so re-run `npm audit` after each SDK bump and re-measure rather
  than assuming the shape is unchanged
- ~~**Drop `export` from seven internal-only names** (was H3)~~ — **done 2026-08-16, all seven.** `toFtsQuery`; `legendOf`, `championOf`,
  `SIGNATURE_LIMIT`; `upsertCards`, `isSyncDue`, `SYNC_TTL_MS`. **The actual state: nothing is
  broken, nothing is dead, nothing is unreachable** — each has a caller inside its own file and no
  caller outside it, tests included. The only effect is that the module advertises more surface than
  it needs, which makes it marginally easier for future code to reach in and take a dependency on an
  internal. No runtime, bundle, or user-visible consequence whatsoever. Five-line change, do it
  whenever a file is open for another reason
- **Virtualise the version timeline** (was F2). It mounts every node it is given and folds past 30
  behind a tap. Measured comfortable into the low hundreds — storage and query stay linear
  (~14 KB and ~0.5 ms per version) and the ceiling is the render, not the database. The fix is a
  `FlashList` and a restructured screen, the same change C1 made to the editor. Do it if a real deck
  ever passes a few hundred versions
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

  Not simply the same fix again, which is why it was carried rather than done. The log form is a
  presented modal, so a downward swipe is a more deliberate act than an edge swipe on a pushed
  screen, and the flow has a **ten-second budget** that a confirmation dialog directly attacks — a
  two-tap log must never become a three-tap log. The honest version probably guards only when the
  draft holds more than the fast path collects, which is a rule that needs stating before it can be
  written. The machinery is already proven: `useNavigation()` + `beforeRemove`, no new dependency.

  **Closed 2026-08-14** on the owner's call, with that rule stated: the guard tests for **answers,
  never for defaults**. The form opens pre-filled — a deck, Casual, Bo1, the logging mode you last
  used — and none of that is work; it is the shape of the question. `hasDraft()` counts only the
  opponent, the event, the note, and anything said about any game (result, turn order, either
  Battlefield, either score, or any card in a hand). So opening the sheet and closing it again asks
  nothing, and the ten-second path never meets a dialog — while an Advanced draft holding three
  matches' hands cannot be lost to a stray swipe.

  Three options rather than the editor's three of the same name. The editor can offer *Save and
  leave* because an illegal decklist is still saveable; a game is not, since the result is **derived
  from the matches** and an unanswered match has no result to record. *Review and save* therefore
  appears only once the games settle one, and the prompt falls back to *Discard* / *Keep logging*
  before that, rather than offering a button that cannot work.

  `save()` sets `leaving` before its own `router.back()`, or the guard would interrogate the user
  about a draft that had just been written. Same latch the editor's `commit()` uses.

- **F2 · The version timeline is not virtualised.** It is a plain column sharing deck detail's
  scroll view, so every node it is given is mounted, each with a diff view of up to six chips. It
  draws 30 and folds the rest behind a tap, which is the mitigation rather than the fix.

  Measured and comfortable for now: storage and query time stay linear into the thousands
  (~14 KB and ~0.5 ms per version), and **the practical ceiling is the render, not the database**.
  If a real deck ever passes a few hundred versions the answer is a `FlashList` and a restructured
  screen — the same change C1 made to the editor's candidate list, on a screen that has not yet
  earned it. Deferred deliberately: nobody has a deck with 300 versions.

  **Moved to the Backlog 2026-08-14** on the owner's call, on exactly that reasoning. It stops being
  a tracked gap and becomes a thing to do if a deck ever gets there.

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
- ~~**Gallery is drawn as filable**, but ownership lives only in binders, so `/binder/gallery` is
  read-only~~ — **closed 2026-08-14: the read-only treatment is the spec.** A default binder was the
  other option and was declined — it would ship every install a binder nobody made, to keep a
  stepper the library cannot store
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
