# Leaflight Reader for iOS

Version **0.1.0-preview.1**. This is a separate iPhone and iPad app. It packages the Android reader's web bundle and adds a small native shell. Reading, story generation, and the community pool match Android Reader 0.3.0-preview.5. Writing review and difficulty calibration stay on Mac and Windows.

Minimum system: iOS 16.0. Bundle id: `local.leaflight.reader.ios`. The app does not share data with Mac, Windows, or Android. Progress is not synced. Keys are stored in the Keychain and are not written into backups.

## What the shell does

The page is served on `127.0.0.1` so the reader gets a normal page origin for IndexedDB and the EPUB import worker. The server accepts only loopback connections and only files inside the bundled `web` directory. Gemini, pool, and export calls go through the native bridge to the same Google endpoints as Android. The web view does not navigate to other sites.

## Build

Full Xcode is required. Command Line Tools cannot compile an iOS app.

```sh
npm ci
node ios-reader/build.cjs
```

The script typechecks the Android reader, builds `ios-reader/build/web`, then runs `xcodebuild`. The IPA is `ios-reader/build/Leaflight-Reader-0.1.0-preview.1-ios-unsigned.ipa`. It is unsigned. iOS will not install an unsigned IPA on a device. Sign the Xcode project with your own Apple Development identity, then run it on your iPhone or iPad. This repository does not include a signing certificate, and this Mac has no iOS SDK, so no IPA was created here.

GitHub Actions workflow `.github/workflows/installers.yml` can build that unsigned IPA on `macos-15` when started manually. An unsigned artifact from that workflow is still not a device installer.

## Not verified

No iOS Simulator or device has launched this app. Import, generation, Keychain, document export, and the loopback page have not been exercised on iOS. Do not treat the source project as a finished App Store or device release.
