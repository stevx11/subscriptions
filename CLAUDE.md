# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first: the SDK version is pinned, and it is not the latest

This project is on **Expo SDK 54** (React Native 0.81.5, React 19.1, TypeScript 5.9) — deliberately, and it must stay there.

**Do not upgrade the Expo SDK.** The user's iPhone runs an iOS version old enough that the App Store only offers them an Expo Go build supporting **up to SDK 54**. Anything newer simply refuses to open on their phone. `npx expo install --fix` and "upgrade to latest" advice will break the only way this app can be run. If an upgrade ever becomes desirable, confirm what their Expo Go supports *first*.

The APIs here have also moved from what older training data suggests — `setNotificationHandler` takes `shouldShowBanner`/`shouldShowList` (not `shouldShowAlert`), triggers are typed via `SchedulableTriggerInputTypes`, routes live in `src/app/`, and the New Architecture is on.

**Check the versioned docs before writing Expo code from memory:** https://docs.expo.dev/versions/v54.0.0/

## What this is

A personal subscription tracker for one person's iPhone. Single user, no accounts, no login, no sync, no backend — all data lives on the device. The whole point is that it answers "what am I paying for, and what's about to charge me" without the user having to think about it, so **UX quality is the primary requirement**, not a nice-to-have.

## Environment: Windows, no Mac

Development happens entirely on Windows. There is no Mac and no Xcode — that is a hard constraint, not a preference, and it is why this is an Expo project rather than the SwiftUI app that used to live here (see commit `4825b43`).

- **During development** the app runs in **Expo Go** on the user's iPhone. `npm start`, scan the QR, changes appear in about a second.
- **For the finished app** a cloud build produces an `.ipa` that gets sideloaded via AltStore/Sideloadly with a free Apple ID. The $99/yr Apple Developer Program is optional (it removes the 7-day re-sign cycle) and requires no code changes.

## Commands

```sh
npm start                  # dev server + QR code for Expo Go
npm run web                # run in a browser — the main way to check work on Windows
npx tsc --noEmit           # typecheck
npm run lint               # expo lint
npx expo export --platform ios --output-dir <tmp>   # prove the iOS bundle builds
npx expo install <pkg>     # ALWAYS use this, not `npm install`, for expo/native packages
```

`npx expo install` is not interchangeable with `npm install` — it pins versions compatible with the installed SDK. Using plain `npm install` for a native package will eventually produce a runtime mismatch in Expo Go.

## Verification — what can actually be tested here

This matters more than usual, because it is easy to write React Native that looks fine and is broken on device.

**Testable on Windows (do this before handing anything over):**
- `npx tsc --noEmit` — typecheck
- `npm test` — Jest over `src/domain/` (the money and date logic)
- `npm run web` — run the real app in a browser and look at it
- `npx expo export --platform ios` — proves the iOS bundle actually builds

**Only testable on the user's phone:** how it *feels* (spacing, animation timing, gestures), notifications firing while the app is closed, haptics, real-device performance.

Never claim on-device behaviour has been verified from a Windows-side check. Say which of the two lists the evidence came from.

## Architecture

```
src/app/            Expo Router screens (file-based routing; typedRoutes is on)
src/domain/         PURE TypeScript — no React imports. The tested core.
  money.ts          integer minor units
  cycle.ts          billing-cycle math, next-billing-date computation
  normalize.ts      any cycle → monthly equivalent
  fx.ts             currency conversion + cached rates
src/data/           Zustand store persisted to AsyncStorage, schema + migrations
  brands.ts         curated brand catalog (SVG path, brand colour, category)
src/ui/             design tokens and primitives
src/features/       screen-level components grouped by feature
```

**Rules that matter:**

- **Money is stored as integer minor units** (`19.99` → `1999`), never floating point. Float arithmetic silently corrupts totals. Every conversion in and out goes through `src/domain/money.ts`.
- **`src/domain/` must never import React or anything from `react-native`.** That purity is what makes it runnable under Jest on Windows, which is the only way the financial logic gets verified at all. Keep business rules there, not in components.
- **Each subscription stores its own currency.** Totals convert to a user-switchable home currency using cached FX rates, so the app still works offline.
- **Brand logos are bundled locally**, not fetched — offline-safe, no API key, immune to a logo service changing terms. Unknown brands fall back to a generated monogram tile.

## Design seed

The original Xcode project's accent colour was a dark slate blue — `#1D3549` light / `#3D596D` dark. That carries over as the starting point, but the visual direction is chosen explicitly in Phase 3; don't treat it as settled.

## Git workflow

The repository lives on the `main` branch. **Commit regularly and in small, self-contained steps** rather than batching a session's work into one large commit — the git history is the running record of what has been built, so a reader should be able to follow the app's construction from the log alone.

- Commit as soon as a coherent unit is complete: a domain module, a screen, a bug fix, a refactor. Do not leave finished work uncommitted while moving on to the next thing.
- Keep unrelated changes in separate commits.
- Message format: a short imperative subject line ("Add billing-cycle math", not "added stuff"), then a blank line and a body explaining *what* changed and *why* whenever the subject alone is not self-explanatory.
- Never write a message asserting that something works on device when it was only checked on Windows.

`.gitattributes` pins LF line endings. The generated `/ios` and `/android` folders are gitignored — EAS regenerates them, they are never committed.

## Build plan

The project is being built in phases, one at a time, each ending with something the user can try on their phone. The full plan is at `C:\Users\Stevo\.claude\plans\crystalline-snacking-pinwheel.md`. Current status: **Phase 0** — scaffold builds on Windows; awaiting on-device confirmation from the user.

`src/app/index.tsx` is currently a throwaway Phase 0 diagnostic screen and gets replaced in Phase 1.
