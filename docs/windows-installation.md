# Windows installation

Leaflight 0.12.4 for Windows is a 64-bit desktop app with the same reading, story generation, writing practice, spine-hinged paper-curl effect, and full-window mode as the Mac source. In paged mode, a two-finger horizontal trackpad scroll or the arrow keys turn one page, while press-and-drag selects text for copying. There is no 32-bit or ARM64 Windows package.

## Build

On Windows or macOS, from the repository root:

```sh
npm ci
npm run package:win
```

The published file is `Leaflight-0.12.4-win-x64-setup.exe` on the [v0.12.4 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.4). SHA-256: `69106c2f4be1327e49aad90d5b7dd9f2753c930815f24bebf3cacd766d3b7d3c`. It was built on GitHub Actions `windows-latest` from commit `fae04cb4863e7e0295877064634fe6b5e08ce202`. It is an NSIS installer, not a one-click package: you can choose the folder. It installs for the current user.

A local macOS build can fail while downloading Electron for Windows when Node does not trust the download certificate. That does not change the file attached to the release. Do not disable certificate checks to force a local build.

## Install and update

The setup file is unsigned. Windows may block it. Do not turn off SmartScreen, antivirus, or other system protection to force it open. A signed installer needs a code-signing certificate, which this release does not have.

Books, writing drafts, reviews, bookmarks, and progress are stored in `%APPDATA%\novel-reading`. API keys stay in the system credential store and are left out of backups. Before replacing the app, export a backup from Settings, wait until background jobs finish, and quit Leaflight. There is no in-app updater.

This package was not installed or launched on Windows. A successful build on a Windows runner does not by itself prove the first-run reading and writing flow on a clean PC.

## Full window

In the reader, editor, or review, choose the expand control. The sidebar, page header, and Windows menu bar hide, and the current area fills the screen. The page stays clear. Tap it and Inbox and Exit appear briefly at the top right. Esc closes a dialog first, then the inbox, then leaves the full window. The text position is kept.
