# cursor-browser-apk

Expo SDK 57 TypeScript scaffold for this repository. It is a starting point for a native Android/iOS app, not a packaged copy of the Cursor website.

## Official Android path today

Cursor does not publish an Android APK. The supported mobile surfaces are:

- **iOS:** native [Cursor for iOS](https://cursor.com/docs/cloud-agent/mobile) (App Store)
- **Android:** [cursor.com/agents](https://cursor.com/agents) in Chrome, then **Install app** / Add to Home screen (official PWA)
- **Desktop:** Cursor IDE

The web surface is Cloud Agents (start / follow / review), not a full VS Code-style IDE.

## Wrapping cursor.com in Expo WebView: not recommended

A WebView or TWA that loads `cursor.com` / `cursor.com/agents` is a poor fit:

1. **Terms:** Cursor ToS §1.5 restricts reproducing, modifying, or creating derivative works of the Service, and unofficial clients that wrap private surfaces have been treated as ToS violations.
2. **Framing:** `cursor.com/agents` sends `X-Frame-Options: SAMEORIGIN`.
3. **Auth:** Login goes through `authenticator.cursor.sh` (Cloudflare). Google and GitHub OAuth commonly block embedded WebViews (`disallowed_useragent`).
4. **TWA / Digital Asset Links:** A Play Store TWA of `cursor.com` requires Cursor to host `assetlinks.json` for *your* package name. Third parties cannot complete that verification.
5. **Product mismatch:** Mobile web is an agent console. It is not a phone IDE, and WebView will not turn it into one.

Use the official PWA, or wait for the planned Android app.

## Local development

```bash
npm ci
npm run typecheck
npx expo start
```

EAS / local Android SDK credentials are not part of this Cloud Agent environment. APK production builds need your Expo account and signing keys on your machine or EAS.
