[English](README.md) · [日本語](README.ja.md) · [中文](README.zh-CN.md)

# Leaflight

A local-first English and Japanese fiction reader, AI story studio, and writing practice tool.

[Mac v0.12.0](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0) · [Android 0.3.0-preview.7](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.7) · [Web reading preview](https://jayson-sheyue.github.io/Leaflight/)

## Read and learn

- Read imported TXT/EPUB novels offline, with themes, fonts, spacing, page effects, bookmarks, and saved reading positions. On Mac and Windows, **full window** hides the sidebar, page header, and system menu bar for the reader, editor, or review; Inbox and Exit full window stay available, and Esc restores the layout without moving the current text.
- Local imported books support **up to 5,000 chapters or reading parts**. Ordinary HTML/XHTML doctypes and common named entities are supported. Oversized chapters are split at paragraph or word boundaries, preserving the text and order.
- Generate English or Japanese fiction at a chosen learning level, genre, and length with your own Gemini key. Preview first, then archive chapters individually or in a batch; progress and results appear in the inbox.
- Practice independent writing on Mac, with English/Japanese prompts and AI feedback on grammar, vocabulary, logic, fluency, and optional expression polish. Science writing topics cover objective knowledge; story-generation themes can retain fiction and fantasy.
- Borrow community stories without a model key, or export your own work and backups. Interface languages: English, Japanese, Chinese.

## Install and start

**Mac:** download `Leaflight-0.12.0-arm64.dmg` from the [v0.12.0 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0), open it, and drag Leaflight to Applications. Apple Silicon only; declared minimum macOS 12. The app is ad-hoc signed, without Apple Developer ID/notarization, so Gatekeeper may block a downloaded copy. Read the [installation instructions](docs/macos-installation.md). Full-window reading and writing is in this package. No Intel or Linux installer is provided.

**Windows:** download `Leaflight-0.12.0-win-x64-setup.exe` from the [v0.12.0 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0). It is an unsigned 64-bit NSIS setup, so Windows may refuse to run it; do not turn off system protection to open it. You can choose a folder. Books stay in `%APPDATA%\novel-reading`. Writing practice and full-window mode match the Mac app. The file was built on GitHub Actions and was not launched on Windows. See [Windows installation](docs/windows-installation.md).

**Android:** download `Leaflight-Reader-0.3.0-preview.7-debug.apk` from the [Android preview release](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.7). Declared minimum Android 10 (API 29), target 36. This is a debug-signed preview. Update by installing over the existing app; uninstalling first removes its local data. Full-screen reading hides the page header, page controls, status bar, and navigation bar. The page stays clear; tap it to briefly show Inbox and Exit at the top right. Back leaves full screen first. See [Android setup and scope](android-reader/README.md). Android has reading, story generation, and the community pool; Mac/Windows writing review and difficulty calibration are not included.

**iOS:** download `Leaflight-Reader-0.1.0-preview.1-ios-unsigned.ipa` from the [v0.12.0 release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.0). It has the same reading, generation, and community-pool scope as Android, for iPhone and iPad on iOS 16 or later, in a separate app and data store. The IPA is unsigned and cannot be installed until you sign it with your own Apple Development identity. It was not launched on a device. See [iOS reader](ios-reader/README.md).

No API key is needed for local reading, offline samples, or browsing downloaded stories. On the library page, choose **Import TXT / EPUB** (Android: **Import TXT / EPUB / backup**) and select your file. Open the imported book, choose a chapter, and adjust typography or add bookmarks. Import creates a new local copy and leaves the original file unchanged.

## Long-book limits and backups

| Input or operation | Limit |
| --- | --- |
| Local imported book | 5,000 chapters/parts; 32 million text characters |
| TXT or EPUB file | 50 MiB |
| EPUB archive | 128 MiB total expanded resources; 64 MiB text resources; 20,000 entries |
| JSON library/reader backup | 128 MiB |
| AI-generated series | 100 planned chapters |
| Community-pool story | 100 chapters; ZIP 25 MiB; expanded JSON 30 MiB |

Reading limits are separate from AI-generation and public-sharing limits. The importer keeps text and available Japanese ruby readings; original page layout, images, fonts, and complex interactive content are not preserved. Encrypted resources and custom entity declarations are unsupported. Specific import errors identify invalid structure, size, chapter count, encryption, or encoding. Files beyond these limits should be split into volumes. See [long-book import and verification](docs/long-book-import.md).

Mac and Windows settings export a full library backup including books, writing drafts/reviews, bookmarks, and progress, without API keys. Android and iOS import those novels and can export a reader backup; reader backups restore on the same reader family and are not desktop full-library backups. Progress does not sync automatically between devices. Keep backups before updating; wait for background jobs to finish, quit, and replace the app in the same location. Updates are manual; no OTA is provided.

## Configure AI generation

In settings, choose the service where you created your key: **Google AI Studio** or **Vertex AI Express**. Key prefixes alone do not determine the service. Enter your key and a model ID supporting `generateContent` and structured JSON output. Mac and Windows use system credential encryption; Android uses the system Keystore; iOS uses the Keychain. Keys are excluded from backups.

Generation and review need Internet access and may incur API charges. Service availability, regions, permissions, model capabilities, and quotas depend on your Google account; neither a saved key nor a text connection proves all models or TTS are available. Requests do not fall back between services. See [API configuration and official references](docs/api-references.md).

The web preview uses browser storage and does not call Gemini or collect new model keys. Browser storage capacity is smaller than native storage; use a Mac, Windows, Android, or iOS app for long novels. Downloaded/imported text can be read offline; syncing the pool, submitting stories, and generating content need the corresponding network services. See [community-pool usage](docs/community-pool.md).

## Build and verify

Use Node.js 22+ and npm:

```sh
npm ci
npm test
node --test android-reader/tests/*.test.cjs
npm run build
npm start
```

Mac packaging runs on macOS: `npm run package:dmg`. Windows packaging: `npm run package:win` (NSIS x64; on macOS, Node must be able to download the Windows Electron binary). iOS packaging needs full Xcode: `node ios-reader/build.cjs`. Android uses JDK 21, Android SDK platform 36, and build-tools 36.1.0: `JAVA_HOME=/path/to/jdk21 node android-reader/build.cjs`. See the [Android build guide](android-reader/README.md) and [iOS reader](ios-reader/README.md). The GitHub Actions workflow [Installers](.github/workflows/installers.yml) can build the Windows setup and the unsigned iOS IPA when run manually.

The focused regression commands and platform boundaries are documented in [long-book import](docs/long-book-import.md). Release attachments identify the actual source commit, installer hashes, and verification scope. Physical Pad, minimum-system, and clean-machine results are not implied by browser tests or a successful build. No copyrighted novel is included in the test fixtures or installers.
