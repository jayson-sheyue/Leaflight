# Long-book import / 长篇导入 / 長編の読み込み

Mac v0.12.0 and Android Reader 0.3.0-preview.5 share the same TXT/EPUB parser and local-reading limits. The iOS reader packages the Android web bundle, so a built iOS app uses the same limits. Local imports are separate from AI generation and the community pool. See [English](../README.md), [日本語](../README.ja.md), [中文](../README.zh-CN.md).

## Import and preserve a novel

1. In the library choose **Import TXT / EPUB**; Android also accepts JSON backups and sharing ZIP files.
2. Select an unencrypted EPUB or UTF-8 TXT. An importing indicator appears; archive inflation runs in a worker, and document parsing yields between batches. Repeated import clicks are ignored until the current import finishes.
3. A successful import creates a new book. Use the contents list to open later chapters; bookmarks and positions survive restart.
4. Use a JSON backup to preserve reading state. EPUB/TXT exports transfer text, without bookmarks or other application data. Mac full backups restore on Mac; Android reads Mac novels and its own reader backups. Android reader backups are not Mac full-library backups.
5. A failed import leaves existing books unchanged. Correct the reported issue and select a file again. Import never edits the source file.

Limits: 5,000 chapters/parts, 32 million characters per imported book; 50 MiB input; EPUB 128 MiB total expanded resources, 64 MiB candidate text resources, 20,000 ZIP entries. JSON backups are limited to 128 MiB. Ordinary HTML/XHTML doctypes are stripped before parsing; external DTDs are never fetched and custom/internal entities are rejected. Common named HTML entities are decoded as characters. Images/fonts are not inflated or displayed. Oversized single chapters are split at paragraph/word boundaries into numbered reading parts; normal chapter order, subheadings, paragraphs, and available ruby readings are retained.

AI series remain limited to 100 planned chapters. The public pool retains its separate 100-chapter, 25 MiB ZIP / 30 MiB expanded-JSON contract. A local long novel is not automatically eligible for public sharing. Browser-preview capacity depends on browser storage; quota failures report that native apps should be used for long books.

## Reproduce the focused checks

```sh
npm test
node --test android-reader/tests/*.test.cjs
npm run build
node tests/story-import.desktop.cjs
node tests/long-import.desktop.cjs
./node_modules/.bin/vite build --config android-reader/vite.config.ts
node android-reader/tests/long-import.browser.cjs
```

Set `LEAFLIGHT_IMPORT_EPUB=/absolute/path/to/your.epub` when running a long-import test to add the supplied novel to the temporary test library. The current optional reference-book assertions target the reported Battle Through the Heavens sample: 314 original chapter files plus its front matter/index. No novel content is checked into the repository or uploaded by these tests. The sample remains local. Synthetic fixtures exercise 5,000 chapters, error → success, long single-chapter splitting, named entities, ordinary/external XHTML doctypes, encrypted/custom-entity rejection, tail navigation/bookmarks, restart, and backup/restore.

Browser tests cover Android UI at 320/800 pixels. Native APK tests run only on the named disposable LeaflightTablet emulator; they may clear that emulator's test app data. Packaged Mac tests use isolated profiles and mock test credentials. The actual release verification lists executed tests, artifact hashes, upgrade coverage, and unverified physical/minimum-system/clean-machine environments. These focused checks do not claim exhaustive testing of every application feature or arbitrary concurrent sequence.
