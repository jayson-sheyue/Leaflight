# Windows installation

Leaflight 0.12.1 for Windows is a 64-bit desktop app with the same reading, story generation, writing practice, and full-window mode as the Mac source. There is no 32-bit or ARM64 Windows package.

## Build

On Windows or macOS, from the repository root:

```sh
npm ci
npm run package:win
```

The published file is `Leaflight-0.12.1-win-x64-setup.exe` on the [v0.12.1 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.1). SHA-256: `d114fc254b6e2d59c78eca816b96772a655bcf939ead36434a13ec0d787df26c`. It was built on GitHub Actions `windows-latest` from commit `70c11c34304e1b0115791eb40a1cb9ab231b7516`. It is an NSIS installer, not a one-click package: you can choose the folder. It installs for the current user.

A local macOS build can fail while downloading Electron for Windows when Node does not trust the download certificate. That does not change the file attached to the release. Do not disable certificate checks to force a local build.

## Install and update

The setup file is unsigned. Windows may block it. Do not turn off SmartScreen, antivirus, or other system protection to force it open. A signed installer needs a code-signing certificate, which this release does not have.

Books, writing drafts, reviews, bookmarks, and progress are stored in `%APPDATA%\novel-reading`. API keys stay in the system credential store and are left out of backups. Before replacing the app, export a backup from Settings, wait until background jobs finish, and quit Leaflight. There is no in-app updater.

This package was not installed or launched on Windows. A successful build on a Windows runner does not by itself prove the first-run reading and writing flow on a clean PC.

## Full window

In the reader, editor, or review, choose the expand control. The sidebar, page header, and Windows menu bar hide, and the current area fills the screen. The page stays clear. Tap it and Inbox and Exit appear briefly at the top right. Esc closes a dialog first, then the inbox, then leaves the full window. The text position is kept.
