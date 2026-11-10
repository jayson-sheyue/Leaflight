# Leaflight Reader 0.3.0-preview.7

VersionCode 10. Full-screen reading no longer keeps two filled buttons over the text. The page stays clear. Tap the page and “Inbox” and “Exit” appear briefly at the top right, then hide again. Another tap hides them sooner. The system Back button still leaves full screen before leaving the book.

The page behavior is covered by `android-reader/tests/reader.browser.cjs`. This build was not installed on an emulator or a physical device, so the native system-bar change has not been seen on Android.

Install over 0.3.0-preview.6 with the same debug signature. Uninstalling first deletes the local shelf. This is a debug-signed preview, not a store release. Minimum declared Android version remains 10 (API 29).

| File | SHA-256 |
| --- | --- |
| `Leaflight-Reader-0.3.0-preview.7-debug.apk` | `d4cc46a5dc9bf883f3a35db0ea412022664283eab5c5c15fa0a1292da39afcde` |

The unsigned iOS archive was later removed from the v0.12.0 release. iPhone and iPad use the web preview.
