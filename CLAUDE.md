# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

An iOS subscription-tracking app ("Subscriptions"), currently an **empty scaffold**: the Xcode project, asset catalog, and directory tree exist, but there is not a single `.swift` file yet — app entry point, models, services, and tests all still need to be written. Treat the directory layout below as the intended architecture rather than as documentation of existing code.

## Environment constraint

The working directory is on **Windows** (`D:\programiranje\SubscriptionApp`), and no Swift toolchain is installed here — `xcodebuild`, `swift`, and `swiftlint` are all absent. Code can be written and edited here, but **nothing can be compiled, run, or tested on this machine**. Never claim a change builds or that tests pass; say explicitly that verification requires macOS.

## Git workflow

The repository lives on the `main` branch. **Commit regularly and in small, self-contained steps** rather than batching a session's work into one large commit — the git history is the running record of what has been built, so a reader should be able to follow the app's construction from the log alone.

- Commit as soon as a coherent unit is complete: a model type, a service, one screen, a bug fix, a refactor. Do not leave finished work uncommitted while moving on to the next thing.
- Keep unrelated changes in separate commits.
- Message format: a short imperative subject line ("Add Subscription model", not "added stuff"), then a blank line and a body explaining *what* changed and *why* whenever the subject alone is not self-explanatory.
- Because the code cannot be compiled on this machine, a commit means "this is a complete, reviewable unit of work," not "this is verified to build." Never write a message asserting that something builds or that tests pass.
- Pushing to a remote is a separate, explicit decision — ask before pushing or creating one.

`.gitattributes` pins LF line endings for everything, since files are authored on Windows but consumed by Xcode on macOS. Note that git does not track empty directories, so the scaffold folders under `Views/` exist only in this working tree until they hold real files.

## Build & test (on a macOS machine)

```sh
xcodebuild -project SubscriptionApp.xcodeproj -scheme SubscriptionApp \
  -destination 'platform=iOS Simulator,name=iPhone 16' build

xcodebuild -project SubscriptionApp.xcodeproj -scheme SubscriptionApp \
  -destination 'platform=iOS Simulator,name=iPhone 16' test

# single test case or single test class
xcodebuild ... test -only-testing:SubscriptionAppTests/SubscriptionTests/testMonthlyCostNormalization
xcodebuild ... test -only-testing:SubscriptionAppTests/SubscriptionTests
```

No shared scheme is checked in (`xcshareddata/xcschemes/` is empty), so the `SubscriptionApp` scheme is autocreated by Xcode on first open. If a scheme is ever shared, commit it so command-line builds work from a clean checkout.

## Adding files

The project uses `PBXFileSystemSynchronizedRootGroup` (Xcode 16, `objectVersion = 77`) for both `SubscriptionApp/` and `SubscriptionAppTests/`. Files are picked up from disk automatically — **create `.swift` files in the right directory and stop there**. Do not hand-edit `project.pbxproj` to register sources; its `Sources` build phases are intentionally empty and adding file references there would fight the synchronized groups.

## Target configuration

- iOS 18.0 deployment target, Swift 5.0 language mode, SwiftUI with previews enabled.
- iPhone only (`TARGETED_DEVICE_FAMILY = 1`), all orientations.
- Bundle ID `com.personal.SubscriptionApp`; display name `Subscriptions`.
- Generated Info.plist (`GENERATE_INFOPLIST_FILE = YES`) — new plist keys go in build settings as `INFOPLIST_KEY_*`, not in a hand-written plist.
- No SPM or other package dependencies; the frameworks build phases are empty. Prefer Apple frameworks (SwiftUI, SwiftData/Core Data, Charts, UserNotifications) over adding third-party packages.
- String catalogs are preferred for localization (`LOCALIZATION_PREFERS_STRING_CATALOGS = YES`).
- `SubscriptionAppTests` is a **hosted** unit-test bundle (`TEST_HOST` points at the app), so tests run inside the app process and can touch app-level state.

## Intended structure

```
SubscriptionApp/
  App/            app entry point (@main App, root scene)
  Models/         domain types (subscription, billing cycle, category)
  Services/       persistence, notifications, currency/renewal logic
  Utilities/      formatters, date math, extensions
  Views/
    Dashboard/  Subscriptions/  SubscriptionDetail/
    AddSubscription/  Analytics/  Settings/
    Components/   shared reusable views
  Assets.xcassets AccentColor (a dark plum, with a lighter dark-mode variant); AppIcon slot is empty
```

The `Views/` split by feature plus a shared `Components/` folder implies view code stays feature-local, and anything reused across two or more features moves to `Components/`. Business logic (renewal-date math, cost normalization across billing cycles, totals) belongs in `Services/` or `Utilities/` where it is testable without a hosted UI, not inside view bodies.
