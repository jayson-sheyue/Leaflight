# Windows installation

Leaflight 0.12.0 for Windows is a 64-bit desktop app with the same reading, story generation, writing practice, and full-window mode as the Mac source. There is no 32-bit or ARM64 Windows package.

## Build

On Windows or macOS, from the repository root:

```sh
npm ci
npm run package:win
```

The file is `release/Leaflight-0.12.0-win-x64-setup.exe`. It is an NSIS installer, not a one-click package: you can choose the folder. It installs for the current user. The GitHub Actions workflow `.github/workflows/installers.yml` builds the same target on `windows-latest` when started manually.

Node on this Mac could not complete the download of the Windows Electron binary because a certificate in that download chain is not in Node's trust store. The installer was therefore not produced on this machine. Do not treat a missing file as a published Windows release.

## Install and update

The setup file is unsigned. Windows may block it. Do not turn off SmartScreen, antivirus, or other system protection to force it open. A signed installer needs a code-signing certificate, which this release does not have.

Books, writing drafts, reviews, bookmarks, and progress are stored in `%APPDATA%\novel-reading`. API keys stay in the system credential store and are left out of backups. Before replacing the app, export a backup from Settings, wait until background jobs finish, and quit Leaflight. There is no in-app updater.

This package was not installed or launched on Windows here. A successful build on a Windows runner does not by itself prove the first-run reading and writing flow on a clean PC.

## Full window

In the reader, editor, or review, choose the expand control. The sidebar, page header, and Windows menu bar hide, and the current area fills the screen. Inbox and Exit full window remain at the top left. Esc closes a dialog first, then the inbox, then leaves the full window. The text position is kept.
