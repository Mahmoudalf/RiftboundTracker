# Store-facing documents

Everything a review board, a store form, or a user can ask about what this app does with data — and
what Riot requires it to say. Written 2026-08-19 as [T1](ROADMAP.md#t1--security-hardening) §A.

**These are one document on purpose.** The Apple privacy manifest, the Play Data Safety answers and
the privacy policy all describe the same facts, and the failure mode is that they drift apart and a
reviewer notices before we do. They are derived from
[the facts](#1--the-facts-everything-else-is-derived-from-these) below, so changing a fact changes
all three in one edit.

**Two of the findings here are not paperwork.** Riot's Riftbound developer policy requires
registration and restricts where card assets may come from, and one of its unapproved use cases sits
directly on M8's roadmap. See [§5](#5--riot-attribution-and-the-riftbound-developer-policy).

---

## 1 · The facts everything else is derived from these

| | |
| --- | --- |
| **Stored on the device** | Decks and versions, games and matches, binders, events, a display name (≤40 chars), free-text notes, a language preference, and a mirror of the public Riftbound card library |
| **Transmitted off the device by the app** | **Nothing the user creates.** The app makes outbound requests to two hosts and sends no payload it authored |
| **Accounts** | None. The app has no sign-in and no user identity. M8 introduces one |
| **Analytics / telemetry / crash reporting** | **None, and none planned.** The error boundary deliberately reports nowhere ([T1 §F](ROADMAP.md#f--failure-behaviour)) |
| **Advertising / tracking** | None. No ad SDK, no attribution SDK, no third-party analytics |
| **Device or OS data** | None read, none stored, none sent. Standing owner decision |
| **Location** | Never requested, no permission declared |
| **Contacts, photos, camera, microphone, calendar** | None requested |
| **Feedback** | **No control in the app as of 2026-08-19.** The card was removed rather than wired to a destination; there is nothing to send and nothing to attach |
| **Credentials in the app** | None of any kind ([H1](ROADMAP.md#h1--the-key-audited-2026-08-16), re-verified in [T1 §B](ROADMAP.md#b--secrets-transport-and-what-ships-in-the-bundle)) |

### The two outbound hosts

| Host | Why | What it can see |
| --- | --- | --- |
| `api.riftcodex.com` | The public card catalogue, refreshed at most daily | The request itself: IP address and which pages of the card list were fetched |
| `cmsassets.rgpub.io` | Riot's CDN, which serves the card images | IP address, and **which cards the user is looking at** |

Both are HTTPS with no cleartext fallback. Neither request carries a user identifier, an account, a
device id, or anything the user typed — there is nothing to send, because nothing is collected.

**The CDN residual is stated rather than buried.** Hotlinking means Riot's CDN sees an IP address and
a browsing pattern. That is inherent to the approach, it was an accepted trade in the original plan,
and `src/lib/cdn.ts` is the single indirection so a proxy could remove it later. It is disclosed in
the privacy policy below, because "we collect nothing" and "no third party learns anything" are
different sentences and only the first one is true.

### One fact the app currently gets wrong, and it belongs here

The database is copied to **Google Drive on Android and iCloud on iOS** by OS backup — found in
[T1 batch 2](ROADMAP.md#t1-batch-2--done-2026-08-19), where the decision was that the backup stays
and the welcome copy changes. This is not collection by the developer: it is the user's own account,
with keys the developer never holds. **It is still disclosed below**, because a user reading
"everything stays on your device" and then finding their decks on a new phone deserves the real
answer.

---

## 2 · Apple privacy manifest

The app is CNG, so `ios/` is generated. The manifest is declared in `app.json` under
`ios.privacyManifests` and written to `ios/<project>/PrivacyInfo.xcprivacy` on the next
`expo prebuild`. **Applied to `app.json` on 2026-08-19.**

```json
"privacyManifests": {
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyCollectedDataTypes": [],
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
      "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
    }
  ]
}
```

### Why it is this short, and why it is not shorter

**`NSPrivacyCollectedDataTypes` is genuinely empty.** Apple's definition of *collect* is transmitting
data off the device. The display name, the notes and the match history never leave, so none of it is
collected. OS backup is not developer collection — the data goes to the user's own iCloud under keys
Apple holds, not to us.

**`NSPrivacyTracking` is `false` and `NSPrivacyTrackingDomains` is empty.** There is no advertising
identifier, no cross-app linkage, and no third party to link with.

**One required-reason API is declared, and it is declared because it is used.** `C617.1` is the
reason for accessing timestamps and metadata of files *inside the app's own container*. Three things
in the tree do that and **none of them ships its own manifest**:

- `expo-modules-core` — `ios/Core/Logging/PersistentFileLog.swift` reads file attributes
- `expo-sqlite` — SQLite `stat()`s the database file on open
- `expo-image` — a disk cache expires entries by modification date

**Four categories are deliberately *not* declared, and each has a reason:**

| Not declared | Why |
| --- | --- |
| `…CategoryDiskSpace` | Only `expo-file-system` uses it, and it **ships its own manifest** (`E174.1`, `85F4.1`). Declaring it again would claim usage the app binary does not have |
| `…CategoryUserDefaults` | Used only by `expo-constants`, `expo-localization` and `react-native`, **all three of which ship manifests** (`CA92.1`). The app stores its own preferences in SQLite, not `NSUserDefaults` |
| `…CategorySystemBootTime` | Used only by React Native's timing code and boost, **both of which ship manifests** (`35F9.1`) |
| `…CategoryActiveKeyboards` | Nothing in the tree reads the keyboard list |

This is the point of the item as it was written in T1: **a manifest that over-declares invites
questions that have no answer.** Declaring `UserDefaults` at the app level would invite "which of
your preferences do you store there?", and the honest answer is "none of them".

### The one thing this cannot verify until there is a build

CocoaPods that arrive at `pod install` time — SDWebImage behind `expo-image` is the notable one —
are not in `node_modules` and could not be inspected here. Recent SDWebImage ships its own manifest;
that was not confirmed.

**The check that settles it:** archive in Xcode, then *Generate Privacy Report*. It aggregates every
embedded `PrivacyInfo.xcprivacy` in the build and prints the union. If a category appears there that
is not in the table above, this document is what needs updating. That check belongs with M9's first
real build, alongside [D2](ROADMAP.md#where-things-stand--2026-08-16).

---

## 3 · Play Data Safety answers

Google's form asks about collection and sharing, where both mean **transmitted off the device**.

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all user data encrypted in transit? | **Yes** — HTTPS only, no cleartext path in release ([T1 §B](ROADMAP.md#b--secrets-transport-and-what-ships-in-the-bundle)) |
| Do you provide a way for users to request data deletion? | **Data is only on the device.** Deleting the app deletes all of it. There is no server-side copy to request the deletion of |
| Does your app have a privacy policy? | **Yes** — [§4](#4--privacy-policy) |
| Are you committed to following the Play Families policy? | **N/A** — the app is not targeted at children ([§6](#6--age-rating)) |
| Data types collected | **None** across every category: location, personal info, financial, health, messages, photos, audio, files, calendar, contacts, app activity, web browsing, app info and performance, device or other IDs |

### The two answers a reviewer might push back on, answered in advance

**"You make network requests — isn't the IP address collected?"** The IP is visible to the two hosts
as a property of any HTTPS connection; the app does not read it, store it, or send it anywhere. Play
treats data used solely to serve a request and not retained by the developer as out of scope, and
there is no developer-controlled server in the picture at all — `api.riftcodex.com` is a third-party
public API and `cmsassets.rgpub.io` is Riot's CDN. This is disclosed in the privacy policy anyway.

**"The app has free-text fields — isn't that user content?"** It is, and it never leaves the device.
There is no upload, no sharing between users, and no send path at all — the feedback card was
removed on 2026-08-19 rather than given one, so the app has no control that transmits anything.

**Both answers change at M8.** An account means personal information collected (email), user content
transmitted, and a real deletion path required. See [§7](#7--what-m8-inherits).

---

## 4 · Privacy policy

Publishable text. It needs a stable public URL before either store listing can be submitted — the
M8 web platform is the natural home, which is one more reason
[to build the web app early](ROADMAP.md#auth-constraints-set-by-t1-2026-08-16).

> ### Privacy Policy — Riftbound Tracker
>
> *Last updated: 19 August 2026*
>
> **The short version.** Riftbound Tracker does not collect anything about you. There is no account,
> no analytics, no crash reporting, no advertising, and no tracking. Nothing you type into the app
> is sent anywhere.
>
> #### What the app stores, and where
>
> Your decks, deck versions, games and matches, binders, events, notes, display name and language
> preference are stored in a database **on your device**. They are not uploaded, and there is no
> server holding a copy.
>
> The app also stores a copy of the public Riftbound card library on your device so that browsing,
> searching and deckbuilding work without a connection. That data is about cards, not about you.
>
> #### Your device's own backup
>
> If you have device backup enabled, your operating system may include the app's database — and
> therefore your decks and match history — in your personal backup: **Google Drive on Android, or
> iCloud on iOS**. Those backups belong to your Google or Apple account, are encrypted by the
> platform, and are not accessible to the developer of this app. You can control them in your
> device's settings.
>
> #### What the app sends over the network
>
> The app contacts two services, and sends neither your data nor any identifier to either:
>
> - **Riftcodex** (`api.riftcodex.com`), a community-run public database, to refresh the card list.
> - **Riot Games' image CDN** (`cmsassets.rgpub.io`), to load card images.
>
> As with any internet request, these services can see your IP address, and the image CDN can see
> which cards you are viewing. The app sends nothing else — no account, no device identifier, and
> nothing you have typed. Both connections use HTTPS.
>
> #### Analytics, tracking and advertising
>
> There are none. The app contains no analytics SDK, no advertising SDK, no crash reporter, and no
> tracking of any kind. It does not read your device model, operating system version, advertising
> identifier, or location.
>
> #### Children
>
> The app is not directed at children and does not knowingly collect information from anyone,
> including children — because it does not collect information from anyone at all.
>
> #### Your data and your rights
>
> Because everything is stored only on your device, you already have direct control of it: deleting
> a deck, a game or the app itself removes the data permanently. There is no copy held by the
> developer, so there is nothing to request access to, correct, export or erase from a server.
>
> #### Changes
>
> If a future version of the app introduces an optional account and cloud sync, this policy will be
> updated **before** that version ships, and the change will be described here rather than applied
> silently.
>
> #### Contact
>
> _[Controller name and contact address — owner-supplied, see the note below.]_

**Two blanks, deliberately left.** The controller's name and a contact address are required by both
stores and by GDPR Art. 13, and they are the owner's personal details rather than a technical
decision. They are not filled in here.

**One thing to check when the web platform exists:** a website operated from Germany generally needs
an *Impressum* under DDG §5, which is a separate page from the privacy policy. It is an M8 item, not
an app item, but it is cheapest to remember now.

---

## 5 · Riot attribution and the Riftbound developer policy

The T1 item asked whether the About screen satisfies **Riot's actual policy text rather than a
paraphrase**. Checked against the policy pages on 2026-08-19.

### The answer was no. Closed 2026-08-19

Riot's Legal Jibber Jabber policy — and the Riftbound developer policy, which repeats it — specifies
the notice as wording rather than as a topic:

> "[The title of your Project] was created under Riot Games' 'Legal Jibber Jabber' policy using
> assets owned by Riot Games. Riot Games does not endorse or sponsor this project."

The About screen currently carries two strings that cover the same ground **in the app's own words**:

- *"Riftbound Tracker is an unofficial fan project. It is not affiliated with, endorsed by, or
  sponsored by Riot Games."*
- *"Card data comes from Riftcodex. Card images, names, and game text are the property of Riot
  Games, used under Riot's Legal Jibber Jabber policy for non-commercial fan content."*

Between them they state the substance. They were still a paraphrase, and the second said the
*images* are used under the policy where the policy covers the *project*.

**Fixed 2026-08-19 in [T1 batch 4](ROADMAP.md#t1-batch-4--done-2026-08-19).** Both required notices
now render on the About card verbatim, **below** the two strings above rather than instead of them:
Riot's sentence is the compliance artefact, the plain-language pair is what a player understands.
They are `profile.about.riotFan` and `profile.about.riotDev`, and they are **the same string in all
three catalogues**, held there by a test — a German rendering of Riot's sentence is no longer Riot's
sentence.

The registered-product policy specifies a **different** boilerplate again ("isn't endorsed by Riot
Games and doesn't reflect the views or opinions of…"), applicable if registration produces an API
key. **Both ship now.** Carrying only the first would mean that on the day registration lands, the
compliance change is also a copy change in three languages and a release — exactly the shape of
thing that gets forgotten because it is small.

**Placement.** Both policies use words like *conspicuously* and *readily visible to players*. About,
inside Settings, is the conventional place and is defensible. The development disclaimer on the
first onboarding screen is more visible, and is the obvious second home if a reviewer disagrees.

### Three clauses in the Riftbound policy that are not about wording

These are the reason this section is longer than "yes, the attribution is fine".

**1 · Registration is mandatory.** *"If your product serves players, you must register it with us
regardless of whether or not your product uses official documented APIs."* This app serves players
and is not registered. It is a prerequisite for store submission, it is owner-side, and it has a lead
time nobody controls — so it should start **now** rather than at M9.

**2 · Asset sourcing is restricted.** *"Your App may only use Riftbound assets (including cards)
provided by the Riot API. No external or unofficial materials."* The app takes card **data** from
Riftcodex, a community API, and hotlinks card **images** from Riot's own CDN. The images are Riot's;
the data path is an unofficial intermediary, which is the thing this clause names. This is an
architectural question, not a paperwork one, and it is the single most likely reason a registration
review comes back with conditions.

**3 · One unapproved use case sits on the roadmap.** The policy lists apps that publish
*"metagame-defining data"* — play rates, win rates, matchup win percentages for cards or decks — as
unapproved. **The app today is clear of this**: every rate it computes comes from the user's own
logged games, is shown only to them, and is never aggregated across users or published.

**M8 is where that stops being obviously true.** A web platform that pools match data across accounts
and shows "decks led by this Legend win 58%" is the described case almost word for word. It is
recorded as a constraint in [§7](#7--what-m8-inherits).

### Confidence, stated rather than assumed

These clauses were read through a fetching tool's summarizer, not from the rendered page, and two
independent fetches of the Riftbound policy returned the same sentences. That is good evidence and it
is not the same as having read the page. **Before acting on §5 — particularly clause 2, which touches
the architecture — the owner should read the primary sources:**

- [Legal Jibber Jabber](https://www.riotgames.com/en/legal)
- [Riftbound developer policy](https://developer.riotgames.com/policies/riftbound)
- [General developer policies](https://developer.riotgames.com/policies/general)

One aside worth noting, because it vindicates work already done: the same policy says *"Your API key
may not be included in your code, especially if you plan on distributing a binary."* That is
[H1](ROADMAP.md#h1--the-key-audited-2026-08-16) and
[T1 §B](ROADMAP.md#b--secrets-transport-and-what-ships-in-the-bundle), stated by Riot.

---

## 6 · Age rating

The two stores use different scales, so **consistency means the questionnaire answers match**, not
the labels. The labels differ because the systems differ.

### The answers, identical on both forms

| Question | Answer |
| --- | --- |
| Cartoon or fantasy violence | **Infrequent / mild** — the card gallery shows static fantasy illustration, including implied combat |
| Realistic violence, sexual content, nudity, profanity, horror, alcohol/tobacco/drugs | **None** |
| Simulated gambling, contests, real-money gambling | **None** — and Riot's Riftbound policy forbids betting or gambling outright, so this can never become yes |
| User-generated content shared between users | **No** — free-text fields are local to the device with no upload and no sharing |
| User-to-user communication | **No** |
| Unrestricted web access | **No** — the app opens no arbitrary web content |
| Shares user location | **No** |
| In-app purchases or ads | **None** |
| Targeted at children | **No** |

### What that produces

| Store | Rating |
| --- | --- |
| Apple App Store | **9+** |
| Google Play (IARC) | ESRB **Everyone 10+** · PEGI **7** · USK **6** · ClassInd **L** |

**Why 9+ rather than 4+.** Declaring "no violence at all" for an app whose main screen is a grid of
1,451 fantasy combat illustrations is the kind of under-declaration that gets an app re-rated after
launch, which is a worse outcome than starting one tier up. 9+ costs nothing.

**Why not 12+/13+.** *Frequent or intense* is the tier for content that depicts violence in motion
and repeatedly. Static card art is the standard case for *infrequent or mild*. If a reviewer
disagrees, accepting 12+ costs nothing either — but it should be a reviewer's call, not a pre-emptive
one.

**The answer that will change: user-generated content.** It is *No* today only because nothing is
shared. If M8's web platform lets one user see another's decks, comments or names, it becomes *Yes*
on both forms, both ratings move, and Apple additionally requires content filtering, a reporting
mechanism, and a block function. That is a feature obligation, not a form obligation.

---

## 7 · What M8 inherits

Constraints T1 is setting on M8's behalf, because retrofitting them costs more than building to them.
They join the [auth constraints](ROADMAP.md#auth-constraints-set-by-t1-2026-08-16) from batch 1.

- [ ] **In-app account deletion, built with the account rather than after it.** Apple requires it of
      any app that creates an account. The build item has one home —
      [M8's checklist](ROADMAP.md#what-gets-built) — and is not restated here; T1 §A sets the rule,
      M8 builds it. It is in this list because it is the clearest case of the pattern: building
      sign-up without it means shipping a known rejection.
- [ ] **The moment another user can see it, it is user-generated content.** Both age-rating
      questionnaires change, and Apple additionally requires filtering, reporting and blocking. This
      is the gate on any "share your deck" feature.
- [ ] **Aggregated win rates across users are an unapproved use case under Riot's Riftbound policy.**
      Per-user rates over a user's own games are fine and are the whole product. Pooled
      metagame statistics are the thing the policy names. See
      [§5](#5--riot-attribution-and-the-riftbound-developer-policy).
- [ ] **All three documents above are re-answered before M8 ships, not after.** An account changes
      the manifest (`NSPrivacyCollectedDataTypes` stops being empty), the Data Safety form
      (email collected, user content transmitted, deletion path required) and the privacy policy
      (a controller processing personal data, with the rights that attach). The privacy policy says
      it will be updated *before* such a version ships; that sentence is a commitment.

---

## 8 · What this batch did not settle

- **Registration with Riot has not been started.** Owner-side, and it gates submission.
- **The asset-sourcing clause is unresolved.** Whether Riftcodex as the data path is acceptable is a
  question for Riot at registration, and the answer could reach the architecture.
- **The controller name and contact are blank** in the privacy policy, and only the owner can fill
  them.
- **The privacy policy has no URL yet.** Both stores need one before submission.
- **The manifest is unverified against CocoaPods.** Settled by *Generate Privacy Report* on the first
  real archive, with M9's build.
