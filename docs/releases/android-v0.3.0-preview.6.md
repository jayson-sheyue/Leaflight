# Leaflight Reader 0.3.0-preview.6

VersionCode 9. Full-screen reading hides the reader header, the page controls, and the Android status and navigation bars. Inbox and Exit full screen stay at the top left. The system Back button leaves full screen before leaving the book. A swipe from the screen edge can show the system bars briefly; they hide again.

The page behavior is covered by `android-reader/tests/reader.browser.cjs`. This build was not installed on an emulator or a physical device, so the native system-bar change has not been seen on Android.

Install over 0.3.0-preview.5 with the same debug signature. Uninstalling first deletes the local shelf. This is a debug-signed preview, not a store release. Minimum declared Android version remains 10 (API 29).

| File | SHA-256 |
| --- | --- |
| `Leaflight-Reader-0.3.0-preview.6-debug.apk` | `d0850f2eeaa551fcf5ed1968c9ab561eaf8b20f79a59b14b64dba81e6c9677cd` |

The unsigned iOS archive was later removed from the v0.12.0 release. iPhone and iPad use the web preview.
