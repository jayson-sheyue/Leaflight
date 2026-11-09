[English](README.md) · [日本語](README.ja.md) · [中文](README.zh-CN.md)

# Leaflight

A local-first English and Japanese fiction reader, AI story studio, and writing practice tool.

[Mac v0.11.16](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.11.16) · [Android 0.3.0-preview.5](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.5) · [Web reading preview](https://jayson-sheyue.github.io/Leaflight/)

## Read and learn

- Read imported TXT/EPUB novels offline, with themes, fonts, spacing, page effects, bookmarks, and saved reading positions.
- Local imported books support **up to 5,000 chapters or reading parts**. Ordinary HTML/XHTML doctypes and common named entities are supported. Oversized chapters are split at paragraph or word boundaries, preserving the text and order.
- Generate English or Japanese fiction at a chosen learning level, genre, and length with your own Gemini key. Preview first, then archive chapters individually or in a batch; progress and results appear in the inbox.
- Practice independent writing on Mac, with English/Japanese prompts and AI feedback on grammar, vocabulary, logic, fluency, and optional expression polish. Science writing topics cover objective knowledge; story-generation themes can retain fiction and fantasy.
- Borrow community stories without a model key, or export your own work and backups. Interface languages: English, Japanese, Chinese.

## Install and start

**Mac:** download `Leaflight-0.11.16-arm64.dmg`, open it, and drag Leaflight to Applications. Apple Silicon only; declared minimum macOS 12. The app is ad-hoc signed, without Apple Developer ID/notarization, so Gatekeeper may block a downloaded copy. Read the [installation instructions](docs/macos-installation.md). No Intel, Windows, or Linux installer is provided.

**Android:** download `Leaflight-Reader-0.3.0-preview.5-debug.apk`. Declared minimum Android 10 (API 29), target 36. This is a debug-signed preview. Update by installing over the existing app; uninstalling first removes its local data. See [Android setup and scope](android-reader/README.md). Android has reading, story generation, and the community pool; Mac-only writing review and difficulty calibration are not included.

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

Mac settings export a full library backup including books, writing drafts/reviews, bookmarks, and progress, without API keys. Android imports Mac novels and can export a reader backup; Android reader backups restore on Android and are not Mac full-library backups. Progress does not sync automatically between devices. Keep backups before updating; wait for background jobs to finish, quit, and replace the app in the same location. Updates are manual; no OTA is provided.

## Configure AI generation

In settings, choose the service where you created your key: **Google AI Studio** or **Vertex AI Express**. Key prefixes alone do not determine the service. Enter your key and a model ID supporting `generateContent` and structured JSON output. Mac uses system credential encryption; Android uses the system Keystore. Keys are excluded from backups.

Generation and review need Internet access and may incur API charges. Service availability, regions, permissions, model capabilities, and quotas depend on your Google account; neither a saved key nor a text connection proves all models or TTS are available. Requests do not fall back between services. See [API configuration and official references](docs/api-references.md).

The web preview uses browser storage and does not call Gemini or collect new model keys. Browser storage capacity is smaller than native storage; use a native app for long novels. Downloaded/imported text can be read offline; syncing the pool, submitting stories, and generating content need the corresponding network services. See [community-pool usage](docs/community-pool.md).

## Build and verify

Use Node.js 22+ and npm:

```sh
npm ci
npm test
node --test android-reader/tests/*.test.cjs
npm run build
npm start
```

Mac packaging runs on macOS: `npm run package:dmg`. Android uses JDK 21, Android SDK platform 36, and build-tools 36.1.0: `JAVA_HOME=/path/to/jdk21 node android-reader/build.cjs`. See the [Android build guide](android-reader/README.md).

The focused regression commands and platform boundaries are documented in [long-book import](docs/long-book-import.md). Release attachments identify the actual source commit, installer hashes, and verification scope. Physical Pad, minimum-system, and clean-machine results are not implied by browser tests or a successful build. No copyrighted novel is included in the test fixtures or installers.
