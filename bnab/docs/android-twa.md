# Android Trusted Web Activity (TWA)

Ship **https://bnab.bogza.ro** as a Play Store / sideload Android wrapper using a Trusted Web Activity (Chrome Custom Tabs in fullscreen). The web app remains the source of truth (PWA manifest + service worker).

## Prerequisites

- Live HTTPS site: `https://bnab.bogza.ro`
- PWA: `/manifest.webmanifest`, icons, `/sw.js` (see [deploy.md](./deploy.md))
- Google Play developer account (for store listing) or local APK via Bubblewrap

## Digital Asset Links

TWA verification requires [Digital Asset Links](https://developers.google.com/digital-asset-links) at:

```
https://bnab.bogza.ro/.well-known/assetlinks.json
```

Repo template (placeholder — replace before store release):

[`bnab/public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json)

1. Create the Android app (Bubblewrap or Android Studio) and note **package name** + **SHA-256** of the signing cert (Play App Signing cert for store builds).
2. Fill `package_name` and `sha256_cert_fingerprints` in the JSON.
3. Deploy so the URL above returns `Content-Type: application/json` (Next serves `public/` as static files).
4. Verify with Google’s [statement list generator](https://developers.google.com/digital-asset-links/tools/generator) or:

```bash
curl -sI https://bnab.bogza.ro/.well-known/assetlinks.json
```

## Bubblewrap (recommended)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://bnab.bogza.ro/manifest.webmanifest
bubblewrap build
```

Use `start_url` / scope consistent with the web manifest (`/plan?source=pwa` is fine).

### Optional `package.json` script note

From `bnab/`, you can add a reminder script (not required in-repo):

```json
"android:twa": "echo See docs/android-twa.md — use Bubblewrap against https://bnab.bogza.ro/manifest.webmanifest"
```

## WebView alternative

A plain WebView is **not** a TWA: no Digital Asset Links fullscreen chrome, worse cookie / SSO behavior. Prefer TWA for store packaging; keep the in-app **Install on Android** PWA path for users who do not need Play.

## Auth / cookies

TWA uses the same Chrome profile cookies as the browser for that origin. Cross-subdomain SSO (`.bogza.ro`) follows [deploy.md](./deploy.md) — no special Android cookie code in BNAB.
