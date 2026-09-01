# Subscriptions

A personal subscription tracker for iPhone. One user, no accounts, no sync, no
server — every subscription, price and setting lives on the device.

It exists to answer one question without you having to think about it: **what am
I paying for, and what is about to charge me?**

## What it does

- **Overview** — what is still leaving your account this month, what charges
  next, and a 30-day timeline of upcoming charges
- **All** — every subscription, searchable, sortable by next charge or real
  cost, with swipe-to-pause and swipe-to-delete
- **Insights** — yearly spend, charges by month, where the money goes by
  category, what costs most, price rises, and what you have marked as unused
- **Settings** — home currency, reminders, and JSON backup/restore

Plus:

- **87 real brand logos**, bundled — Netflix, Spotify, Adobe, Xbox and the rest
- **Mixed currencies.** Each subscription keeps its own; totals convert using
  exchange rates fetched daily and cached for offline use
- **Renewal reminders** a configurable number of days before each charge, with
  separate warnings for free trials about to convert
- **Add a subscription in seconds** — tap a logo, type the amount, save

## Running it

Development happens on Windows; the app runs on the phone through Expo Go.

```sh
npm install
npm start        # scan the QR code with the iPhone camera
```

To install it as a standalone app with its own home-screen icon, see
[SIDELOADING.md](SIDELOADING.md).

## Development

```sh
npm test                 # Jest over the pure layers
npx tsc --noEmit         # typecheck
npm run lint
npx expo export --platform ios --output-dir <tmp>   # prove the iOS bundle builds
node scripts/generate-brands.mjs   # regenerate the brand catalogue
python scripts/generate-icons.py   # regenerate app icons
```

## How it is put together

```
src/app/         routes only — thin wrappers around a feature screen
src/domain/      pure TypeScript: money, dates, billing cycles, totals
src/data/        store, brand catalogue, exchange rates, settings
src/ui/          design tokens, colour maths, primitives, charts
src/features/    the screens themselves
```

The domain layer imports nothing from React or React Native. That is what makes
the money and date logic testable on a Windows machine with no iOS toolchain —
and it is where the decisions that must be correct live:

- **Money is integer minor units.** `19.99` is stored as `1999`. Float
  arithmetic silently corrupts running totals.
- **Dates are `YYYY-MM-DD` strings**, never `Date` objects. A billing date is a
  calendar date, not an instant.
- **Billing dates are computed from the original anchor**, never by stepping
  month to month — otherwise a subscription billed on the 31st degrades to the
  28th forever after its first February.
- **Totals round once, at the end.** Rounding each subscription before summing
  biases the headline figure.

See [CLAUDE.md](CLAUDE.md) for the full set of constraints.
