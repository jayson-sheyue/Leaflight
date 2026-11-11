# Leaflight Reader 0.3.0-preview.9

VersionCode 12. Separates long-press text selection from horizontal swipe page turns in paged reading mode: holding a finger on the page (`>= 220ms`) or dragging an active selection lets Android WebView select strings for copy/paste while keeping the current page column locked in place; a quick horizontal swipe, external trackpad two-finger scroll, the bottom buttons, or unmodified arrow keys turn one page with the selected effect.

Gesture separation and `paper` transition handoff are covered by `android-reader/tests/reader.browser.cjs` and `tests/page-swipe.browser.cjs`. This build was verified with `apksigner verify` and was not installed on an emulator or physical Pad for this release.

Install over 0.3.0-preview.8 with the same debug signature. Uninstalling first deletes the local shelf. This is a debug-signed preview, not a store release. Minimum declared Android version remains 10 (API 29).

| File | SHA-256 |
| --- | --- |
| `Leaflight-Reader-0.3.0-preview.9-debug.apk` | `pending` |

iPhone and iPad use the [web preview](https://jayson-sheyue.github.io/Leaflight/).
