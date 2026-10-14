# Subscriptions

![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Jest-C21325?logo=jest&logoColor=white)
![Platform](https://img.shields.io/badge/platform-iOS-lightgrey?logo=apple)

A local-first subscription tracker for iPhone, built with React Native, Expo, and TypeScript. It has no accounts, no server, and no sync: every subscription, price, and setting lives on the device.

It answers one question without you having to think about it: **what am I paying for, and what is about to charge me?**

## Features

| Screen | What it shows |
|---|---|
| **Overview** | What's still leaving your account this month, the next charge, free trials about to convert, and a 30-day timeline of upcoming charges |
| **All** | Every subscription, searchable and sortable by next charge or real cost, with swipe to pause and swipe to delete |
| **Insights** | Yearly spend, charges by month, spending by category, the most expensive subscriptions, price rises, and anything marked as unused |
| **Settings** | Home currency, reminder timing, and JSON backup and restore |

- **Fast entry**: tap a logo, type the amount on a custom keypad, save.
- **87 brand logos** bundled offline, with official colours (Netflix, Spotify, Adobe, Xbox, ...).
- **Multi-currency support.** Each subscription keeps its own currency. Totals convert using exchange rates fetched daily and cached for offline use.
- **Renewal reminders**: local notifications a configurable number of days before each charge, plus separate warnings for free trials.
- **Backup and restore** to a JSON file, validated on import.
- **Versioned persistence** with schema migrations, so app updates never corrupt data already on the phone.

## Tech Stack

| Area | Tools |
|---|---|
| Framework | React Native 0.81 (New Architecture), Expo SDK 54, React 19 with React Compiler |
| Language | TypeScript 5.9 (strict) |
| Navigation | Expo Router (file-based, typed routes) |
| State | Zustand with AsyncStorage persistence |
| UI | react-native-svg (charts, logos), Reanimated, Gesture Handler, Expo Haptics |
| Platform APIs | Expo Notifications, Document Picker, File System, Sharing |
| Testing | Jest + ts-jest (300+ test cases) |
| CI/CD | GitHub Actions macOS workflow that builds an unsigned `.ipa` |

## Architecture

```
src/
├── app/         Routes only: thin wrappers around feature screens (Expo Router)
├── domain/      Pure TypeScript: money, dates, billing cycles, currency conversion, totals
├── data/        Persistent store, migrations, brand catalogue, exchange rates, settings
├── features/    Screens and their logic: dashboard, subscriptions, form, insights, reminders, settings
└── ui/          Design tokens, colour maths, primitives, charts, calendar, keypad
```

The **domain layer imports nothing from React or React Native**. That keeps the logic that has to be correct (money, dates, billing) fully unit-testable without a phone or an iOS toolchain. Each feature likewise keeps its pure logic (`grouping.ts`, `listing.ts`, `insights.ts`, `plan.ts`, `backup.ts`) separate from its screen component, and tests it directly.

### Correctness decisions

- **Money is stored as integer minor units.** `19.99` is stored as `1999`, because floating-point arithmetic silently corrupts running totals.
- **Dates are `YYYY-MM-DD` strings, never `Date` objects.** A billing date is a calendar date, not an instant, so time zones can't shift it.
- **Billing dates are computed from the original anchor date, never by stepping month to month.** Otherwise a subscription billed on the 31st would drift to the 28th forever after its first February.
- **Totals are rounded once, at the end.** Rounding each subscription before summing biases the headline figure.
- **Unconvertible amounts are reported, never dropped.** A total that quietly omits a subscription is worse than no total.
- **An "average per month" and "actually charged this month" are separate calculations.** A yearly plan contributes its whole price to one month and nothing to the others.

### Brand catalogue

Logos are generated, not hand-drawn. `scripts/generate-brands.mjs` extracts SVG paths and official colours from [simple-icons](https://simpleicons.org/), checking older releases for brands that have since been removed. The result is a committed, typed catalogue, and only the paths actually used end up in the app bundle.

## Getting Started

### Prerequisites

- Node.js 20+
- The [Expo Go](https://expo.dev/go) app on an iPhone (it must support SDK 54)

### Run in development

```sh
npm install
npm start        # scan the QR code with the iPhone camera to open it in Expo Go
```

`npm run web` runs it in a browser as well.

### Install as a standalone app

Development happens entirely on Windows, with no Mac and no Xcode. A **GitHub Actions workflow** compiles an unsigned `.ipa` on a free macOS runner. Sideloadly or AltStore then signs it with a free Apple ID at install time. This avoids the paid Apple Developer account that cloud signing would require.

See [SIDELOADING.md](SIDELOADING.md) for the step-by-step guide.

## Development

```sh
npm test                 # Jest over the domain, data and feature logic
npx tsc --noEmit         # typecheck
npm run lint             # ESLint (expo config)
npx expo export --platform ios --output-dir <tmp>   # verify the iOS bundle builds

node scripts/generate-brands.mjs   # regenerate the brand catalogue
python scripts/generate-icons.py   # regenerate app icons
```

> Expo SDK 54 is pinned deliberately: it's the newest version the installed Expo Go supports. Use `npx expo install <pkg>` rather than `npm install` for Expo and native packages, so versions stay compatible.

## Roadmap

- Home-screen widget for the next upcoming charge
- iCloud or file-based sync between devices
- Bank statement import to detect subscriptions automatically

## Legal

Brand names and logos are trademarks of their respective owners. They are used only to label subscriptions and do not imply endorsement. Logo data comes from simple-icons (CC0).
