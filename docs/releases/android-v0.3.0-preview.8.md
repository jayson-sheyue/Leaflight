# Leaflight Reader 0.3.0-preview.8

VersionCode 11. Updates the shared **Paper curl · 纸页** (`paper`) transition to use spine-hinged physical book geometry: turning forward lifts the bottom-right corner and sweeps the crease cleanly to the left spine with mirrored ink show-through, clipped curvature highlight, and directional overhang/spine shadows across light and dark themes; turning backward unfolds the previous page from the left spine onto the right edge.

The updated `paper` transition and handoff are covered by `android-reader/tests/reader.browser.cjs` and `tests/page-swipe.browser.cjs`. This build was verified with `apksigner verify` and was not installed on an emulator or physical Pad for this release.

Install over 0.3.0-preview.7 with the same debug signature. Uninstalling first deletes the local shelf. This is a debug-signed preview, not a store release. Minimum declared Android version remains 10 (API 29).

| File | SHA-256 |
| --- | --- |
| `Leaflight-Reader-0.3.0-preview.8-debug.apk` | `43823b9e302ad1bbec54405f10338cb8df34ce882c2ee4962b6c6889bd978fe1` |

iPhone and iPad use the [web preview](https://jayson-sheyue.github.io/Leaflight/).
