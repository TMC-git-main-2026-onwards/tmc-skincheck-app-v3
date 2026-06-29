# TMC SkinCheck — store readiness audit

> Generated 2026-06-29 from a multi-agent audit of the actual codebase
> (5 dimensions, 37 findings, verified against source). Re-run before
> submission as the code changes.

**Verdict: Not submittable to TestFlight or Play internal testing as-is — seven hard blockers.**

The most serious is not a config gap but a **truthfulness problem**: the app tells
users in five places that their skin photo and location "stay on your device" /
are "never transmitted to our servers or third parties," while the code
base64-encodes the captured forearm photo and POSTs it to a Cloudflare Worker
(`index.html:1225-1229`) that forwards the raw image to Anthropic's API in the US
(`worker.js:23-34`), and sends precise coordinates to Open-Meteo, OpenStreetMap
and postcodes.io. There is no working privacy policy (the only link is a dead
`<a href="#">`), so the App Privacy / Data safety forms cannot be completed
truthfully, and the GDPR consent gating a special-category health photo is neither
informed nor explicit. Plus: three account/identity verifications with multi-day
to multi-week lead times, two placeholder/missing values in the iOS pipeline,
unbranded placeholder icons, and `targetSdk 34` below Play's API-35 floor.

Fix the copy + privacy policy first (it unblocks the store forms), start the
account verifications in parallel today, then close the build-config items.

---

## 🚫 Blockers (must fix before you can submit)

1. **Privacy claims are false — the skin photo leaves the device to Anthropic (US) while the app says it never does.** Special-category health data under UK GDPR; self-evident to a reviewer since the same screens advertise "powered by Claude AI." *Apple §5.1.1(i)/5.1.2; Google User Data / Health policy.*
   **Action:** Rewrite all on-device claims to the truth — photo is sent securely to an AI provider (Anthropic, via TMC's proxy) for mole-count/skin-tone estimation, not retained, never sold. Fix `index.html:1434`, `1479`, and `Info.plist:49`. Confirm zero-retention in the Anthropic DPA. Re-run `npm run sync:web`. *(evidence: `index.html:1225-1229`; `worker.js:23-34`; `index.html:1434,1479`; `Info.plist:49`)*

2. **Location copy falsely says coordinates never leave the device** — lat/lon go to Open-Meteo, Nominatim/OSM and postcodes.io. (The *travel-history* store really is device-local; only the UV/geocode lookups transmit.)
   **Action:** Correct `index.html:1671,1678,1700` and `Info.plist:51` to disclose approximate location/postcode is sent to UV/weather and mapping providers, not stored on TMC servers. Re-sync. *(evidence: `index.html:630-631,639,647,655-656,1671,1678,1700`; `Info.plist:51`)*

3. **No reachable privacy policy.** The only reference is a dead `<a href="#">Privacy policy</a>` with no handler — gating mandatory consent on a policy the user cannot open. Required both in-app and in the store listing.
   **Action:** Publish a real HTTPS policy covering the photo→Worker→Anthropic flow, US transfer, health-data lawful basis, retention, and every third party (Cloudflare, Anthropic, Open-Meteo, OSM/Nominatim, postcodes.io). Wire `index.html:1468` via the existing `openExternal(...)` helper. Enter the same URL in App Store Connect and Play Console. *(evidence: `index.html:1468,1762,833,2011`)*

4. **Store privacy disclosures cannot be filed truthfully until the copy is fixed.** App Privacy / Data safety must declare Health (photo + answers, *shared* with Anthropic), Photos, Contact Info (name/email), Precise Location (*shared*). Filing "no data collected" to match the current UI would be a false attestation (account-level risk).
   **Action:** After #1–#2, complete App Store Connect App Privacy and Play Data safety: Health + Photos = collected and shared; Location = shared; all encrypted in transit. Confirm Anthropic doesn't use images for ads/training. *(evidence: `index.html:399-451,1447-1449,1225`; `worker.js:30`)*

5. **iOS export compliance not declared — every TestFlight build stalls in "Missing Compliance."** `ITSAppUsesNonExemptEncryption` is absent and CI auto-submits, so each build silently hangs. App uses only standard HTTPS = exempt.
   **Action:** Add `ITSAppUsesNonExemptEncryption = false` to `Info.plist`. *(evidence: `Info.plist`; `codemagic.yaml:96`)* — **✅ fixed in this pass.**

6. **iOS publish target is a placeholder.** `APP_STORE_APPLE_ID:"0000000000"` — the build has no App Store Connect record to attach to.
   **Action:** Create the app record (bundle `co.uk.themoleclinic.skincheck`), copy its numeric Apple ID into `codemagic.yaml:65`, confirm the `tmc_app_store` integration. *(evidence: `codemagic.yaml:50-66`)*

7. **Account/identity verification — longest lead time, gates everything above.**
   **Action:** Start today, in parallel. Apple: enrol The Mole Clinic as an Organisation (check dnb.com for an existing D-U-N-S first; days–2 weeks). Google: complete identity + payments verification; register as Organisation. *(evidence: `docs/mobile-deploy.md:86-89`)*

---

## ⚠️ Required before submission

- **GDPR Art. 9 explicit consent for the health photo is missing.** Consent at `index.html:1466-1469` is generic and collected *before* the camera step, and links to a non-existent policy (so not "informed"). **Action:** add a granular, explicit consent immediately before capture naming the recipient (Anthropic, US) and purpose; document lawful basis (Art. 9(2)(a)) + IDTA/SCCs; declining must still allow the existing manual-tone path.
- **`targetSdk 34` is below Play's API-35 floor** (required for new submissions since Aug 2025) — Console rejects the AAB at upload. **Action:** bump `compileSdkVersion`/`targetSdkVersion` to 35 in `android/variables.gradle`, `cap:sync`, rebuild.
- **App icons are default Capacitor placeholders.** Apple rejects placeholder icons (§4.0/2.3.7); Play needs a real 512×512. **Action:** add branded `assets/icon.png` (1024²), `npx @capacitor/assets generate`, commit, rebuild.
- **Android signing keystore + Play service account referenced in CI but secrets must exist in Codemagic.** **Action:** generate the release keystore (and back it up — loss = cannot update the app), upload as `tmc_keystore`, add `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`, enrol in Play App Signing.
- **Play App content + listing minimums not evidenced** (content rating/IARC, category Medical vs Health & Fitness, contact email, descriptions, Data safety, target audience).
- **App Store Connect listing minimums** — category, age-rating questionnaire, support URL + contact.
- **Health/medical framing.** On-screen disclaimers are adequate and visible (`index.html:1433,1922,1969,2175`) — keep them. Soften AI wording at `1429/1490` so "analysis" reads as risk-profiling, not a clinical reading. Prepare App Review notes; confirm whether MHRA medical-device classification applies before public (non-beta) release.

---

## ✅ Recommended

- **`allowBackup="true"`** lets the cached skin photo + risk profile auto-back-up to Google Drive. **Action:** set `allowBackup="false"` (or exclude the WebView localStorage). — **✅ fixed in this pass.**
- **`ACCESS_FINE_LOCATION` likely exceeds need** (UV + city-scale clinic). **Action:** drop to coarse, or justify FINE in the Play declaration.
- **Open proxy: wildcard CORS, no auth, server-side paid API key.** Anyone can push images through TMC's Anthropic key. **Action:** restrict CORS to the app origin, add a shared-secret/attestation + rate limiting, confirm zero-retention + no image logging. *(`worker.js:3-8,13,23-25`)*
- **Notifications onboarding advertises a non-existent feature** ("coming in a future update") — §2.1 completeness ding. **Action:** remove or reframe as the "add to home screen" tip. *(`index.html:1712,1718`)*
- **Two future-dated 2026 citations** back medical risk weighting; "Gadare et al., MIT (2026)" has no DOI. **Action:** verify they resolve to real publications or remove the claims. *(`index.html:1999,2004`)*
- **Loose free third-party endpoints** (Nominatim custom UA, postcodes.io, Open-Meteo, Google Fonts). **Action:** confirm provider terms permit production use; self-host the Inter font; verify UV fallback on a real device.
- **Document the mailto results flow for Beta App Review** (user-composed draft, no server send). Start TestFlight on an internal group (no Beta App Review).

---

## 💡 Nice-to-have

- **Dev toolbar** behind `?dev=1` (`index.html:2013`) — strip from the production/beta bundle via a build flag.
- **Email results travel via unencrypted `mailto:`** — add a one-line note that email isn't a secure channel.
- **Version/build monotonicity** — ensure CI supplies a strictly increasing `PROJECT_BUILD_NUMBER`; never upload a locally built artifact.

---

## Suggested order of operations

1. **Accounts (start today — longest lead time, parallel to everything).** Apple Organisation enrolment (check for existing D-U-N-S) + Google Play identity/payments verification.
2. **Truthful copy + privacy policy + consent.** Fix on-device claims in `index.html` + `Info.plist`; publish + wire the privacy policy; add explicit pre-camera health-photo consent; `npm run sync:web`. Unblocks the store privacy forms.
3. **Icons + native config.** Branded icons; `ITSAppUsesNonExemptEncryption=false` ✅; `targetSdk/compileSdk` 35; `allowBackup="false"` ✅; drop FINE location if unused.
4. **Store records + listings.** Create both app records; fill `APP_STORE_APPLE_ID`; complete App Privacy / Data safety, content rating, category, descriptions, support contacts; attach privacy policy URL.
5. **CI signing.** Generate + upload + back up `tmc_keystore`; add the Play service-account JSON; connect `tmc_app_store`; enrol in Play App Signing.
6. **First beta build.** `android-beta` → Play internal track (tester list + opt-in link); `ios-beta` → TestFlight internal group; harden the Worker + strip the dev toolbar first.

> Note: the `verify:technical-config` agent returned a degenerate result; its
> findings (icons, encryption flag, target SDK) were independently corroborated
> by the apple-review, google-play and beta-mechanics dimensions, so coverage
> holds. Treat the technical-config detail as cross-checked rather than
> single-sourced.
