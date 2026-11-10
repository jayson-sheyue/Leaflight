# Leaflight Reader for iOS

Version **0.1.0-preview.1**. This is a separate iPhone and iPad app. It packages the Android reader's web bundle and adds a small native shell. The published IPA was built from the Android reader web bundle at 0.3.0-preview.5. Android 0.3.0-preview.6 full-screen reading is not in that IPA. Writing review and difficulty calibration stay on Mac and Windows.

Minimum system: iOS 16.0. Bundle id: `local.leaflight.reader.ios`. The app does not share data with Mac, Windows, or Android. Progress is not synced. Keys are stored in the Keychain and are not written into backups.

## What the shell does

The page is served on `127.0.0.1` so the reader gets a normal page origin for IndexedDB and the EPUB import worker. The server accepts only loopback connections and only files inside the bundled `web` directory. Gemini, pool, and export calls go through the native bridge to the same Google endpoints as Android. The web view does not navigate to other sites.

## Build

Full Xcode is required. Command Line Tools cannot compile an iOS app.

```sh
npm ci
node ios-reader/build.cjs
```

The script typechecks the Android reader, builds `ios-reader/build/web`, then runs `xcodebuild`. The IPA is `ios-reader/build/Leaflight-Reader-0.1.0-preview.1-ios-unsigned.ipa`. It is unsigned. iOS will not install an unsigned IPA on a device. Sign the Xcode project with your own Apple Development identity, then run it on your iPhone or iPad. This repository does not include a signing certificate.

The [v0.12.0 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0) contains `Leaflight-Reader-0.1.0-preview.1-ios-unsigned.ipa`, built on GitHub Actions `macos-15` from commit `67e79172eddda0af5fc717c3d153cd433c253b2d`. SHA-256: `89eb1ed4bdd812a2baa9e8c1b4048f333681e6841441e8fd53587a3fc1e2fbb1`. The archive includes the reader web bundle. `codesign` reports that the app is not signed. It is not a device installer.

## Not verified

No iOS Simulator or device has launched this app. Import, generation, Keychain, document export, and the loopback page have not been exercised on iOS. Do not treat the source project as a finished App Store or device release.
