# Getting Subscriptions onto your iPhone as a real app

Right now the app runs inside **Expo Go**. This turns it into a standalone app
with its own icon on your home screen, without a Mac and without paying Apple.

The whole thing is two steps: **build an `.ipa` in the cloud**, then **install it
from Windows**.

---

## The one thing to understand first

Sideloading tools (AltStore, Sideloadly) **install** an app — they do not
**build** one. Compiling iOS code requires Apple's toolchain, which only runs on
macOS. So the build happens on a rented Mac in Expo's cloud, and the install
happens on your PC.

Neither step needs you to own a Mac.

---

## Step 1 — Build the `.ipa`

There are two routes, and which one you take depends on one thing only: whether
you are willing to pay Apple.

### The free route — GitHub Actions (recommended to try first)

**EAS cannot do this for free.** Its "internal distribution" build requires a
paid Apple Developer account, because the ad hoc provisioning profile it needs
can only be issued by one. A free Apple ID cannot produce one. That is an Apple
restriction, not an Expo one.

The way around it is to compile **without signing at all**, and let Sideloadly
sign the result on your PC with your free Apple ID at install time — which is
exactly what those tools are for.

`.github/workflows/ios-unsigned-ipa.yml` does this on GitHub's free macOS
runners:

1. Push this repository to GitHub.
2. Open the **Actions** tab → **Build unsigned iOS .ipa** → **Run workflow**.
3. Wait ~15 minutes, then download the `Subscriptions-unsigned-ipa` artifact.

The build minutes: **public repositories are unlimited.** Private ones get 2,000
free minutes a month, but macOS is billed at a **10× multiplier**, so it is
really about 200 macOS minutes — roughly ten builds a month. Enough for a
personal app, but not unlimited.

### The paid route — EAS ($99/yr)

If you enrol in the Apple Developer Program, everything gets simpler:

```sh
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
```

EAS handles the certificate and provisioning profile itself, the app lasts a
year instead of seven days, and you can use TestFlight instead of sideloading
altogether.

| Profile in `eas.json` | What it builds |
|---|---|
| `preview` | `distribution: internal` — the sideloadable `.ipa`. Needs the paid account. |
| `simulator` | An `.app` for the iOS Simulator. No credentials needed, but useless without a Mac. |
| `production` | A store build. |

### Or: change nothing

Expo Go already runs this app on your phone, for free, with no expiry and no
build step. The only thing a standalone build buys you is a dedicated home
screen icon and not having to open Expo Go first. That is a real convenience,
but it is the *only* difference — weigh it against a 7-day re-signing chore.

---

## Step 2 — Install it from Windows

### First, a prerequisite

Install **iTunes from apple.com** — *not* the Microsoft Store version. The Store
build does not include the Apple Mobile Device Support drivers that sideloading
tools need to talk to your iPhone.

### Option A — Sideloadly (simplest)

1. Download from [sideloadly.io](https://sideloadly.io) and install.
2. Connect your iPhone by USB and trust the computer.
3. Drag the `.ipa` into Sideloadly.
4. Enter your Apple ID. It signs the app with your free account and installs it.
5. On the phone: **Settings → General → VPN & Device Management** → trust your
   developer certificate.

The app now has its own icon and opens without Expo Go.

### Option B — AltStore (handles the 7-day refresh for you)

1. Install **AltServer** from [altstore.io](https://altstore.io) on your PC.
2. AltServer installs **AltStore** onto your iPhone.
3. Open AltStore on the phone → **My Apps → +** → pick the `.ipa`.

The advantage: while AltServer is running and both devices are on the same
Wi-Fi, it **re-signs the app automatically in the background**, so the 7-day
expiry mostly stops being your problem.

---

## The 7-day expiry, honestly

With a free Apple ID, Apple only issues 7-day certificates. After a week the app
refuses to open until it is re-signed.

- **AltStore** refreshes it automatically over Wi-Fi when your PC is on.
- **Sideloadly** requires you to re-run the install manually.
- **$99/yr** removes the problem entirely — certificates last a year.

Free Apple IDs are also capped at **3 sideloaded apps** at a time.

> **This is why the backup feature exists.** A failed refresh can take the app's
> storage with it. Export a backup from **Settings → Backup** occasionally and
> keep the JSON file somewhere safe. Restoring it puts every subscription,
> price history entry and setting back exactly as it was.

---

## Updating the app later

Change the code, then re-run whichever build route you used — the GitHub Action,
or `eas build --platform ios --profile preview` — and reinstall the new `.ipa`
the same way. Your data survives a reinstall over
the top; it does **not** survive deleting the app first. Export a backup before
any reinstall you are unsure about.

---

## If you decide to pay the $99

Nothing in the code changes. You would:

1. Enrol at [developer.apple.com](https://developer.apple.com).
2. Run the same `eas build` command and let EAS manage credentials.
3. Optionally use `eas submit` to push builds through TestFlight instead of
   sideloading at all.

The only thing you buy is the removal of the weekly refresh.
