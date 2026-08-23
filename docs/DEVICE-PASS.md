# The device pass

A re-runnable checklist for every release build, on a real Android phone.

It exists because **the test suite cannot see any of this.** Vitest runs in Node with no renderer
and no navigator: 766 tests pass on a build whose launcher name is wrong, whose icon is missing,
whose data survives an uninstall, and whose list drops frames. Every bug this pass has found so far
has lived in configuration the suite never reads.

Run the whole thing. The items are cheap, and the expensive part is already done by the time you
are holding the phone.

## Status legend

| | Meaning |
|---|---|
| **✅** | Passed on real hardware, on the date given |
| **⚠️** | Failed on hardware once, fixed in config, and **not re-run since** — the fix is unproven |
| **🖥** | Verified only by measurement or rendering on a build machine. **Never seen on a device** |
| **⬜** | Never checked by any means |

**🖥 is not a pass.** It means a file is correct and nobody has looked at it on a screen.

> ## Last full run: 2026-08-23 — **30 of 30 passed**
>
> Build `rifthall-0.1.0-2026-08-23.apk`, signed `CN=Rifthall`, on the owner's device. First run in
> which every item was exercised on hardware; the previous pass (2026-08-22) covered four.
>
> **Both outstanding ⚠️ items cleared** — A1 (the launcher name) and E2 (uninstall retention) were
> the two failures from 2026-08-22, and both fixes are now proven rather than assumed. **E4 was
> run for real**, with a second phone, which is the only evidence that exists for the
> device-to-device rules.

## Before you start

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
npx expo prebuild --platform android --clean
printf 'sdk.dir=C:/Users/Mahmoud/AppData/Local/Android/Sdk\n' > android/local.properties
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Three things bite in that order, and all three have bitten already:

- **Every** `prebuild` deletes `android/local.properties`. Rewrite it with **forward slashes** — a
  `.properties` file treats `\` as an escape, and backslashes produce `Invalid file path`.
- Every `prebuild` also rewrites the `android` / `ios` npm scripts to `expo run:*`. Revert **only
  those two keys**. Reverting the whole `package.json` with `git checkout` also throws away any
  dependency added in the same working tree, which has already eaten one install.
- After any `prebuild`, confirm the release-signing marker is still at **2** in
  `android/app/build.gradle`. That plugin is load-bearing: without it a release build silently
  falls back to the debug key.

**`adb install -r` fails against any build older than 2026-08-23.** The package id changed from
`com.riftboundtracker.app` to `com.rifthall.app`, so Android sees an unrelated app. Uninstall the
old one by hand first — and note that doing so is *not* the retention test in section E, which has
to start from a build already on the current id.

---

## A · Identity — what the phone calls this app

| | Check | Expected | Status |
|---|---|---|---|
| A1 | The name under the launcher icon | **Rifthall**. Not "Riftbound Tracker", not "riftbound-tracker" | **✅ 2026-08-23** — was the 2026-08-22 failure |
| A2 | The launcher icon itself | The charcoal hexagon with the red rift. Not the Android robot, not a white square | **✅ 2026-08-23** |
| A3 | The icon under a **circular** mask | Switch the launcher to circular icons (Pixel: Settings › Wallpaper & style › App shape). No corner of the hexagon is clipped | **✅ 2026-08-23** |
| A4 | The icon under a **squircle** mask | Same, with a visible charcoal field around the hexagon rather than the mark touching the edge | **✅ 2026-08-23** |
| A5 | Long-press the icon, open App info | Name reads **Rifthall**, and the icon there matches the launcher | **✅ 2026-08-23** |

## B · Launch — splash and first frame

| | Check | Expected | Status |
|---|---|---|---|
| B1 | Cold launch from the launcher | The hexagon appears centred on a flat charcoal field, then the app. **No white flash** at any point | **✅ 2026-08-23** |
| B2 | The splash background | The same charcoal the app itself uses. No visible step in brightness when the splash hands over | **✅ 2026-08-23** |
| B3 | The splash mark is not clipped | Android 12+ masks the splash icon to a 192dp circle; the hexagon's top and bottom points survive | **✅ 2026-08-23** — measured 154×177dp, 16dp margin |
| B4 | Rotate the phone during launch | Orientation is locked to portrait. Nothing rotates, nothing crashes | **✅ 2026-08-23** |

## C · Onboarding — first run only

To re-run: uninstall and reinstall. There is no reset control.

| | Check | Expected | Status |
|---|---|---|---|
| C1 | The hero mark on the welcome screen | The hexagon, around 96pt, with **no visible rectangle or seam** around it | **✅ 2026-08-23** |
| C2 | The welcome copy | Reads "Welcome to Rifthall". No "RT" monogram anywhere | **✅ 2026-08-23** |
| C3 | The development notice | Present, accent-bordered, and says the data is local and uninstalling deletes it | **✅ 2026-08-23** |
| C4 | Switch language mid-flow | Picking Deutsch or Français re-renders in that language and **stays on the same step** — it must not bounce back to step 1 | **✅ 2026-08-23** |
| C5 | Skip everything | Tapping past every screen lands on a usable Decks tab | **✅ 2026-08-23** |
| C6 | The card library line under the CTA | Shows progress or a done state, and **nothing waits on it** — the gallery works while it runs | **✅ 2026-08-23** |

## D · Performance and offline

| | Check | Expected | Status |
|---|---|---|---|
| D1 | Scroll the whole card gallery, all ~1,451 cards | Holds 60 fps. No blank tiles that never fill | **✅ 2026-08-22**, again 2026-08-23 |
| D2 | Airplane mode on, then use the app | Gallery, deckbuilding and match logging all work fully. This is the original D2 item | **✅ 2026-08-22**, again 2026-08-23 |
| D3 | Log a match, timed with a stopwatch | Under **10 seconds** from tab bar to toast. If it is over, the flow gets redesigned, not the target | **✅ 2026-08-23** |
| D4 | Push from onboarding into the deck list | The deck list must **not** appear for a frame before import slides over it | **✅ 2026-08-22**, again 2026-08-23 |

## E · Data retention — the section that has failed before

**Do these in order.** E1 has to establish real data before E2 can mean anything.

| | Check | Expected | Status |
|---|---|---|---|
| E1 | Create a deck, log 2–3 matches, force-stop the app, reopen it | Everything is still there | **✅ 2026-08-23** |
| E2 | Uninstall. Reinstall. Open | **Onboarding runs again, and the decks and matches are gone.** Anything else is the 2026-08-22 bug back | **✅ 2026-08-23** — was the 2026-08-22 failure |
| E3 | Settings › Google › Backup, look for Rifthall | The app is not listed as backed up | **✅ 2026-08-23** |
| E4 | Device-to-device transfer onto a second phone | Rifthall installs on the new phone with **no decks and no matches** | **✅ 2026-08-23** — run with a real second phone |

An old Google Drive backup taken *before* 2026-08-22 may still sit on the account and is not
removed by any of this — clear it at Google One › Storage › Backups.

E4 is the gap `plugins/withDataExtractionRules.js` closes. The rules were provably present in the
shipped APK before this run — the manifest attribute resolves to the resource and all 18 exclusions
survive compilation — but **only E4 shows a real transfer honouring them**, and it is the sole
evidence that exists for that. Re-run it whenever the rules file, `allowBackup`, or the target SDK
changes; nothing else in this checklist can catch a regression there.

## F · Native chrome

New since `expo-system-ui` landed on 2026-08-23. Nothing here should look *different* — the app
paints its own surfaces and reads no colour scheme anywhere — so this section checks that forcing
dark mode changed nothing it should not have.

| | Check | Expected | Status |
|---|---|---|---|
| F1 | Put the phone in **light** mode, then launch | The app is unchanged. Still dark throughout | **✅ 2026-08-23** |
| F2 | Long-press a text field and open the selection menu | The menu is dark, not a white sheet on a dark screen | **✅ 2026-08-23** |
| F3 | Rotate, or resize in multi-window, with the app open | The background behind the app is charcoal, never white | **✅ 2026-08-23** |

## Recording the result

Add a dated entry under S1 in `ROADMAP.md` saying what passed, what failed, and what was not run.
**A failure is worth more than a pass** — both bugs this pass has ever found came from someone
saying plainly that something did not work.

Reset the statuses when the next build changes anything they cover. A ✅ is dated on purpose: it
attests to one build, not to the app.
