# Design & UX

UI and UX are the primary success criteria for this app, not a finishing layer. Two hard rules
govern every decision in this document:

> **1. Logging a match takes under 10 seconds**, tab bar to confirmation.
> **2. The version model must be invisible.** The user learns it by using the app, never by reading
> about it.

---

## 1. Direction

**Dark-first, content-forward, high-contrast.** Riftbound cards are gorgeous, densely illustrated
objects. The interface's job is to get out of their way: deep neutral backgrounds, restrained
chrome, and generous space around art. Angular, technical accents echo the game's visual language
without imitating Riot's brand assets.

The app should feel like a **precision instrument** — a tool a competitive player reaches for
between rounds — rather than a social app or a collection scrapbook.

**Anti-goals:** glassmorphism, decorative gradients on non-deck surfaces, stock icon sets used
without curation, and stat screens that look like a generic dashboard template.

---

## 2. Color

### Domain palette

The visual identity of the entire app derives from Riftbound's six domains. Defined once in
`src/theme/domains.ts` and never hardcoded anywhere else.

| Domain | Color | Opposite |
| --- | --- | --- |
| **Fury** | Red | Calm |
| **Calm** | Green | Fury |
| **Mind** | Blue | Body |
| **Body** | Orange | Mind |
| **Chaos** | Purple | Order |
| **Order** | Yellow | Chaos |
| *Colorless* | Slate | — |

> ⚠️ **M0 task:** sample the exact hex values from the official card domain symbols rather than
> eyeballing them. Each domain needs a triplet — `base` (fills, text on dark), `muted` (chips,
> borders), `glow` (accents, gradient stops) — with `base` verified at ≥4.5:1 against the surface.

### Deck accents

Each deck derives a **two-stop gradient from its Legend's domains**. A Fury/Order deck reads
red→yellow; a Mind/Body deck reads blue→orange. Consequence: decks are instantly distinguishable in
a list *before you read a single name*, and the accent carries through to that deck's detail header,
charts, and version timeline.

### Accessibility

**Color never carries meaning alone.** Every domain indicator pairs the color with its glyph or
label — required for colorblind users, and better for everyone at a glance. Win/loss uses shape and
position as well as green/red. Contrast targets: 4.5:1 body text, 3:1 large text and UI boundaries.

---

## 3. Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display / headers | **Chakra Petch** or **Rajdhani** | Condensed, geometric, technical — fits the game's aesthetic. Both free via Google Fonts |
| Body / UI | **Inter** | Excellent at small sizes, wide weight range |
| Numerals | Inter, **tabular figures** | Non-negotiable anywhere stats appear — proportional figures make win-rate columns jitter as they update |

Respect Dynamic Type / font scaling. Stat layouts must survive a 200% text size without clipping.

---

## 4. Navigation

Four tabs plus a center action:

```
┌────────┬────────┬─────────┬────────┬─────────┐
│ Decks  │ Cards  │  ( + )  │ Stats  │ Profile │
└────────┴────────┴─────────┴────────┴─────────┘
```

The center **(+)** opens the log-match sheet from anywhere in the app. It is **context-aware**:
opened from a deck screen it pre-selects that deck and its current version. This is the single most
important control in the app — it gets the most prominent position.

```
app/
  (tabs)/index.tsx          Decks     — deck cards: accent gradient, legend art, record, sparkline, version badge
  (tabs)/cards.tsx          Cards     — full gallery
  (tabs)/stats.tsx          Stats     — cross-deck hub
  (tabs)/profile.tsx        Profile   — account, sync, collection, export, settings, attribution

  deck/[id]/index.tsx       Deck detail — segmented: Overview | List | Versions | Matches | Stats
  deck/[id]/edit.tsx        Deck editor
  deck/new.tsx              Create: Legend → Champion → build

  match/new.tsx             Log match (modal bottom sheet)
  match/[id].tsx            Match detail / edit

  card/[id].tsx             Card detail (modal, shared-element from grid)
  event/[id].tsx            Event / tournament detail
  goldfish/[versionId].tsx  Hand simulator
```

Deep links (`riftbound://deck/…`) come free with expo-router and enable deck sharing.

---

## 5. Key flows

### Flow 1 — Log a match

*The flow that decides whether this app gets used at all.*

A half-height bottom sheet. **Two taps and it's saved.**

```
┌─────────────────────────────────────────┐
│  ▾  Zed Midrange              v3        │  ← deck selector, defaults to last used
├─────────────────────────────────────────┤
│                                         │
│    ┌───────────┐   ┌───────────┐        │
│    │    WIN    │   │   LOSS    │        │  ← large targets, haptic on tap
│    └───────────┘   └───────────┘        │
│              · draw ·                   │  ← tertiary, deliberately small
├─────────────────────────────────────────┤
│  Opponent                               │
│  (Yasuo) (Lux) (Viktor) (Jinx)  ( 🔍 )  │  ← 8 most-recently-faced legends
├─────────────────────────────────────────┤
│  ⌄ Add details                          │  ← everything else lives here
└─────────────────────────────────────────┘
```

Save enables on the result tap. Behind **"Add details"**: on-play/on-draw segmented control, BO3
per-game strip, event picker, mulligan stepper, tags, notes.

Two details that matter more than they look:

- **Undo.** After saving, a toast: *"Logged · Zed v3 now 19–11 (63%)"* with an Undo action. Mandatory
  on any fast-tap surface — mis-taps are guaranteed when the whole point is speed.
- **"Log another."** Keeps the sheet open with the deck retained, for entering a tournament's rounds
  back to back. The opponent chip clears; everything else persists.

### Flow 2 — Build / edit a deck

Split view. Top: your list grouped by zone (Legend · Champion · Main · Runes · Battlefields) with
`−  2  +` steppers. Bottom: a searchable card rail, pre-filtered to cards legal in your Legend's
identity, with a toggle to grey out illegal cards rather than hide them.

A sticky **legality bar** updates live:

```
Main 38/40 · Runes 12/12 · Battlefields 3/3 · Signatures 2/3      ⚠ 2 cards short
```

Green when legal, amber with the *specific* reason when not.

**Illegal decks remain saveable.** Deckbuilding is iterative — blocking a save because the list is
mid-edit is hostile. They're flagged, not forbidden.

**Versioning, surfaced without a lecture.** Opening the editor on a locked version shows a quiet
inline banner:

> *v2 · 30 matches tracked — saving will create v3.*

And the save sheet leads with the **diff**, not a form:

```
┌─────────────────────────────────────────┐
│  Save as v3                             │
├─────────────────────────────────────────┤
│  + 2  Statikk Shock                     │
│  − 2  Bewitching Spirit                 │
│  + 1  Blade of the Ruined King          │
│  − 1  Sump Dredger                      │
├─────────────────────────────────────────┤
│  Label   [ −2 Bewitching Spirit      ]  │  ← pre-filled from the largest change
│  Notes   [                           ]  │  ← "why did I make this change?"
├─────────────────────────────────────────┤
│  [ Amend v2 instead ]      [ Save v3 ]  │
└─────────────────────────────────────────┘
```

Reviewing what changed is the useful act; naming the version is optional and pre-filled. "Amend v2
instead" is present but quiet, and confirms with the consequence stated in full.

### Flow 3 — Version timeline

*The signature screen. This is what the app exists for.*

A vertical timeline, newest first. Each node is a version:

```
│
◉  v3  −2 Bewitching Spirit                    current
│   Jul 12 – now · 40 matches
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  63%   CI 47–77%
│   +2 Statikk Shock  −2 Bewitching Spirit  +1 BORK  −1 Sump Dredger
│
◉  v2  rune fix
│   Jun 28 – Jul 12 · 30 matches
│   ▓▓▓▓▓▓▓▓▓░░░░░░░░░  47%   CI 30–64%
│   +2 Fury rune  −2 Order rune
│
◉  v1  initial build
│   Jun 02 – Jun 28 · 12 matches                          provisional
│   ▓▓▓▓▓▓▓▓░░░░░░░░░░  42%   CI 19–68%
```

Long-press two nodes to enter **Compare** — side-by-side stats, the full card diff, and an honest
verdict line:

> *v3 is 16 points ahead of v2, but the intervals overlap. About 25 more matches on v3 would settle
> it. Note that the metagame also shifted between these versions.*

The timeline reads as the *story of the deck*. Forking then feels like the natural act rather than a
database side effect — which is the whole point of the design.

### Flow 4 — Card gallery

FlashList grid, 3 columns, `w=240` webp thumbnails (see [`API.md`](API.md) §5 — 9 KB instead of
790 KB per image; the gallery is impossible without this).

Sticky filter chip row: **Set · Type · Domain · Rarity · Cost**. The full filter panel is a bottom
sheet. Search hits local FTS5 with results as you type — no network round-trip, no spinner, ever.

Tapping a card runs a shared-element transition into a full-bleed detail view: pinch-zoom art, card
text, set and artist, and an "add to deck" action when arriving from the builder.

---

## 6. Motion & feel

| Aspect | Approach |
| --- | --- |
| Animation | **Spring physics** (Reanimated), not duration easing. Interruptible, natural, and it makes gesture-driven sheets feel attached to the finger |
| Transitions | Shared-element for card→detail and deck→detail |
| Haptics | Result taps (medium), version save (success), legality state change (light), destructive confirm (warning). Tactile feedback is a large part of why a 2-tap flow *feels* fast |
| Lists | 60 fps with 1,451 cards is a hard requirement, verified on a physical mid-range Android device |
| Reduce motion | Respected — transitions degrade to fades, never removed entirely |

---

## 7. Empty states

Every empty state is a designed screen, never a blank list. The first-run Decks screen is the app's
onboarding surface: it explains the version concept in one sentence, and offers two paths — *"Build
a deck"* and *"Paste a decklist"* — because importing an existing list is the fastest route to a
user who has something to track.

Also designed: a deck with no matches yet (prompt to log the first), a version with too few matches
for meaningful stats (says so, in the provisional style), and the card gallery mid-sync.

---

## 8. Component inventory

`src/components/ui/` — Button · Chip · Sheet · Stepper · SegmentedControl · StatTile · Toast ·
EmptyState · ProgressBar · ConfirmDialog

`src/components/cards/` — CardThumb · CardGridItem · CardRow · CardDetail · DomainBadge · CostPip

`src/components/decks/` — DeckCard · DeckListSection · LegalityBar · VersionNode · DiffChips ·
VersionCompare

`src/components/matches/` — ResultButton · OpponentChipRail · MatchRow · GameStrip

`src/components/charts/` — WinRateBar (with CI whisker) · RollingWinRateChart · MatchupMatrix ·
Sparkline

Charts: **victory-native XL** (Skia) for time series; hand-rolled RN views for bars and donuts —
sharper and cheaper than pulling a chart library in for a rectangle.
