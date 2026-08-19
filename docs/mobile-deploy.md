# TMC SkinCheck — mobile deployment runbook

How the web app becomes a native iOS + Android app and reaches beta testers.
Written for a Windows machine with no Mac and no Android toolchain installed.

## The shape of it

The app is your existing web app (`index.html` + `logic.js` + `icons.js`),
wrapped in a native shell by **[Capacitor](https://capacitorjs.com/)**. The
web code runs unchanged inside a native WebView; Capacitor gives it an app
icon, a place in the app stores, and native permission prompts for camera and
location. There is **one codebase** — you never write the app twice.

Builds run on **[Codemagic](https://codemagic.io/)** (cloud CI), not on this
machine. That is deliberate:

- iOS apps can *only* be compiled and signed on macOS (Apple's rule — true for
  Flutter and React Native too, not a Capacitor limitation). Codemagic rents a
  Mac in the cloud for the iOS build.
- Android needs a ~5 GB Android Studio install we'd otherwise add locally.
  Codemagic has it preinstalled.

So: edit the web app on Windows as you always have → push to git → Codemagic
builds both apps → they land in TestFlight (iOS) and Play internal testing
(Android).

## What's already wired up (done)

- `package.json` + Capacitor 6 (`@capacitor/core/cli/android/ios`, plus
  `@capacitor/app` and `@capacitor/browser`).
- `capacitor.config.json` — app id **`co.uk.themoleclinic.skincheck`**, name
  **"TMC SkinCheck"**, web dir `www`.
- `scripts/sync-web.mjs` — copies the web files into `www/` (the payload
  Capacitor bundles). Run via `npm run sync:web`; `npm run cap:sync` does that
  then syncs both native projects. The repo root stays the source of truth;
  `www/` is generated and git-ignored.
- `android/` and `ios/` native projects, committed.
- **Permissions**: Android `CAMERA` + location in `AndroidManifest.xml`; iOS
  `NSCameraUsageDescription` + `NSLocationWhenInUseUsageDescription` in
  `Info.plist`. The app needs both to function.
- External links + booking now open via the Capacitor Browser plugin in-app
  (with a plain-web fallback); `mailto:` is handled natively by Capacitor.
- `android/app/build.gradle` — release signing reads from CI env vars;
  `versionCode` auto-increments from the CI build number; `versionName 0.4.0`.
- `codemagic.yaml` — `android-beta` and `ios-beta` workflows.

## Installable web app (PWA) — both platforms, no store, no accounts

The web app is now a **Progressive Web App**: `manifest.webmanifest` + `sw.js`
(service worker) + icons under `assets/icons/`, wired into `index.html`. Served
over HTTPS (e.g. the GitHub Pages deployment), it installs to the home screen
as "SkinCheck" with the TMC icon, runs full-screen, and opens offline (the app
shell is cached; UV/geocoding calls still need signal). Verified in Chrome:
service worker registers, activates, controls the page, and caches the shell.

**How a tester installs it**
- **Android (Chrome):** open the app URL → menu → "Add to Home screen" (Chrome
  may offer an Install banner on its own).
- **iPhone (Safari):** open the URL → Share → "Add to Home Screen". Camera in
  home-screen web apps needs iOS 13.4+ — fine for any modern fleet.

**Company-phone (MDM) distribution without any store**
- **iOS:** push a **web clip** (home-screen icon pointing at the app URL) via
  the company's MDM — no Apple Developer account required.
- **Android:** push the debug/release APK directly via MDM, or pin the web app.

**Update model:** bump `VERSION` in `sw.js` when releasing — clients fetch the
new bundle on their next online navigation.

Note the service worker is web-only: inside the Capacitor native shell it is
deliberately not registered (the bundle is already local).

## Testing the Android app right now (no store account needed)

A working debug APK has already been built and is in `dist/`
(`tmc-skincheck-v0.4.0-debug.apk`, ~3.8 MB). You can install it on any Android
phone today — store accounts are only needed for *store* distribution, not for
direct testing.

**Install it:**
1. Copy the `.apk` to the phone (USB, email it to yourself, or a cloud drive).
2. On the phone, tap the file. Android will warn it's from an "unknown
   source" — allow installation for your file manager / browser when prompted.
3. The app installs as **TMC SkinCheck**. Launch it; you'll get native camera
   and location permission prompts on first use.

This is a **debug** build (signed with the throwaway Android debug key) — fine
for hands-on testing, not for the Play Store. Store builds are release-signed
`.aab` files produced by Codemagic (below).

### Rebuilding the Android APK (build in Azure)

The APK was built on a temporary Azure VM (no Android toolchain needed
locally), and that process is captured in `scripts/azure-android-build.sh`. To
rebuild after changing the app:

```
bash scripts/azure-android-build.sh
```

It provisions a throwaway Ubuntu VM in the **TMC Azure Sandbox and Testing**
subscription (ukwest), installs JDK + Android SDK + Node, builds the debug APK,
copies it to `dist/`, and **deletes the VM** afterwards (pass `--keep` to leave
it running for repeat builds). Takes ~6–8 minutes end to end and costs pennies.
Requires `az` logged in (`az login`). iOS cannot be built this way — it needs a
macOS host + Apple account (that's the Codemagic `ios-beta` workflow).

## What you need to do (prerequisites — these are the real blockers)

### 1. Store developer accounts (start these first; Apple can take 1–2 days)

- **Apple Developer Program** — https://developer.apple.com/programs/ — £79/yr.
  Enrol as **The Mole Clinic** (an Organization account needs a D-U-N-S number;
  an Individual account is faster if acceptable for now). Required for
  TestFlight.
- **Google Play Console** — https://play.google.com/console/signup — £20
  one-time. Required for internal testing.

### 2. Create the app records

- **App Store Connect** → My Apps → **+** → New App. Bundle ID
  `co.uk.themoleclinic.skincheck`, name "TMC SkinCheck". Note the numeric
  **Apple ID** it assigns → put it in `codemagic.yaml`
  (`APP_STORE_APPLE_ID`).
- **Play Console** → Create app → package name
  `co.uk.themoleclinic.skincheck`.

### 3. Codemagic signing setup (one-time, in the Codemagic UI)

- Sign in to Codemagic with the GitHub account that holds this repo; add the
  repo as an app.
- **Android**:
  - Generate a release keystore (once) and keep it safe — losing it means you
    can never update the app:
    ```
    keytool -genkey -v -keystore tmc-skincheck.keystore \
      -alias tmc -keyalg RSA -keysize 2048 -validity 10000
    ```
  - Codemagic → app settings → **Code signing identities → Android** → upload
    `tmc-skincheck.keystore`, reference name **`tmc_keystore`**.
  - Create a Google Play service account (Play Console → Setup → API access),
    download its JSON, and add it as env var
    **`GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`** in an environment group named
    **`google_play`**.
- **iOS**:
  - Codemagic → **Integrations → App Store Connect** → add an API key,
    integration name **`tmc_app_store`**.

### 4. App icon + splash (before store review)

Stores require a real app icon (the scaffold ships a placeholder). Drop a
1024×1024 PNG at `assets/icon.png` (and optionally `assets/splash.png`,
2732×2732), then run:
```
npx @capacitor/assets generate
```
This generates every icon/splash size for both platforms. Commit the result.

## Triggering a beta build

Once the prerequisites are done:

1. `git push` to the branch Codemagic watches (or hit **Start new build** in
   the Codemagic UI).
2. Pick the workflow — `android-beta` or `ios-beta`.
3. On success the build is uploaded automatically:
   - **Android** → Play Console → Testing → Internal testing. Add tester
     emails, share the opt-in link.
   - **iOS** → App Store Connect → TestFlight. Add testers / a public link.
     (First TestFlight build needs a short Beta App Review.)

## Local development (no build, just preview)

The web app still runs standalone — open `index.html` in a browser, or use the
Launch preview. Camera/geolocation work over `localhost`/`https`. You don't
need any native tooling for day-to-day UI work; native builds happen in CI.

## Things to verify on a real device during first beta

- Camera permission prompt appears and capture works (WebView `getUserMedia`).
- Location permission prompt appears; UV/clinic lookups resolve.
- Booking buttons open the booking site in an in-app browser and return cleanly.
- "Email my results" opens the device mail app with the summary prefilled.
- Safe-area insets look right on a notched device.

## Open decisions (deferred)

- **Bundle id** is `co.uk.themoleclinic.skincheck` (changeable until the first
  store upload, then permanent).
- **iOS build host** — Codemagic cloud Mac is assumed. A physical Mac would
  also work with the same project; the `ios-beta` workflow would just move to
  Xcode locally.
