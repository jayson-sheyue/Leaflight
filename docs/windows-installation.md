# Windows installation

Leaflight 0.12.0 for Windows is a 64-bit desktop app with the same reading, story generation, writing practice, and full-window mode as the Mac source. There is no 32-bit or ARM64 Windows package.

## Build

On Windows or macOS, from the repository root:

```sh
npm ci
npm run package:win
```

The published file is `Leaflight-0.12.0-win-x64-setup.exe` on the [v0.12.0 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0). SHA-256: `e299d71f3f9d1120e42fa0698c23e26515156394ebf48ffb912d48edc8e588a8`. It was built on GitHub Actions `windows-latest` from commit `67e79172eddda0af5fc717c3d153cd433c253b2d`. It is an NSIS installer, not a one-click package: you can choose the folder. It installs for the current user.

A local macOS build can fail while downloading Electron for Windows when Node does not trust the download certificate. That does not change the file attached to the release. Do not disable certificate checks to force a local build.

## Install and update

The setup file is unsigned. Windows may block it. Do not turn off SmartScreen, antivirus, or other system protection to force it open. A signed installer needs a code-signing certificate, which this release does not have.

Books, writing drafts, reviews, bookmarks, and progress are stored in `%APPDATA%\novel-reading`. API keys stay in the system credential store and are left out of backups. Before replacing the app, export a backup from Settings, wait until background jobs finish, and quit Leaflight. There is no in-app updater.

This package was not installed or launched on Windows. A successful build on a Windows runner does not by itself prove the first-run reading and writing flow on a clean PC.

## Full window

In the reader, editor, or review, choose the expand control. The sidebar, page header, and Windows menu bar hide, and the current area fills the screen. Inbox and Exit full window remain at the top left. Esc closes a dialog first, then the inbox, then leaves the full window. The text position is kept.
