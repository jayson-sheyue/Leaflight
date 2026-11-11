[English](README.md) · [日本語](README.ja.md) · [中文](README.zh-CN.md)

# Leaflight

英語・日本語の小説をオフラインで読むためのリーダー、AI物語生成、作文練習ツールです。

[Mac v0.12.2](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.2) · [Android 0.3.0-preview.7](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.7) · [Webプレビュー](https://jayson-sheyue.github.io/Leaflight/)

## 主な機能

- TXT/EPUB小説を読み込み、テーマ・字体・行間・ページ効果を調整。しおりと読書位置を端末に保存します。ページモードでは本文を左右にスワイプ、ドラッグ、またはトラックパッドで横スクロールすると1ページ送れ、選んだページ効果を再生します。ボタンと方向キーも使えます。操作中に本文は追従しません。視差効果を減らす設定でもページは送れますが、効果は再生しません。Mac、Windows、Webプレビューの「全画面」はサイドバー、ページ見出し、システムメニューバーを隠し、読書・執筆・レビューを画面全体に表示します。横向きでも縦向きでもボタンは常時置きません。ページをタップすると右上に「メッセージ」と「終了」がしばらく出ます。Escで文章位置を保ったまま戻ります。
- ローカル作品は最大 **5000章・分割**。通常のHTML/XHTMLの文書型宣言と一般的な文字参照に対応し、長すぎる章は段落や単語の境界で分割して本文と順序を保ちます。
- 自分のGeminiキーで、学習レベル・ジャンル・長さを指定して英日小説を生成。試読後に連載を作成し、1章ずつ、または複数章を続けて保存できます。状況はメッセージボックスで確認できます。
- Macでは作文課題を選び、自分で書いてから文法・語彙・論理・流暢さの評価と表現改善の提案を受けられます。科学の作文課題は客観的な知識を扱い、物語生成では幻想文学などの楽しさも選べます。
- 共有書庫の読書にはモデルのキーが不要です。作品・バックアップを書き出せます。表示言語は英語・日本語・中国語です。

## インストールと使い始め

**Mac:** [v0.12.2 Release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.2)の`Leaflight-0.12.2-arm64.dmg`をダウンロードし、アプリをApplicationsへ移動します。Apple Silicon向け、宣言上の最低OSはmacOS 12です。ad-hoc署名のみでDeveloper ID署名・Apple公証はなく、ダウンロード後にGatekeeperで起動を止められる場合があります。[インストール手順](docs/macos-installation.md)をご確認ください。全画面ではボタンを常時置きません。ページをタップすると右上に「メッセージ」と「終了」がしばらく出ます。Intel版とLinux版はありません。

**Windows:** [v0.12.2 Release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.2)の`Leaflight-0.12.2-win-x64-setup.exe`を使います。未署名の64-bit NSISインストーラーで、Windowsが起動を止めることがあります。システム保護を無効にしないでください。フォルダを選べます。作品は`%APPDATA%\novel-reading`に保存されます。作文と全画面はMac版と同じです。GitHub Actionsでビルドし、Windows上での起動確認はしていません。[Windowsの手順](docs/windows-installation.md)。

**Android:** [Androidプレビュー](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.7)の`Leaflight-Reader-0.3.0-preview.7-debug.apk`を使用します。最低Android 10（API 29）、target 36のデバッグ署名プレビューです。既存アプリに上書きインストールし、先にアンインストールしないでください。全画面読書では見出し、ページ操作、ステータスバー、ナビゲーションバーを隠し、本文の上にボタンを常時置きません。ページをタップすると右上に「メッセージ」と「終了」がしばらく出ます。戻る操作は先に全画面を終了します。[Androidの説明](android-reader/README.md)を参照してください。読書・物語生成・共有書庫に対応し、Mac/Windowsの作文評価や難易度調整テストは含みません。

**iPhone / iPad:** [Webプレビュー](https://jayson-sheyue.github.io/Leaflight/)を開きます。iOSインストーラーはありません。全画面は横向きでも縦向きでもサイドバーと見出しを隠し、ボタンを常時置きません。ページをタップすると右上に「メッセージ」と「終了」がしばらく出ます。読書データはブラウザーに保存され、容量はMac、Windows、Androidより小さくなります。

ローカル読書・保存済み作品・オフライン見本にはAPIキーが不要です。本棚の「TXT / EPUBを読み込む」（Androidはバックアップも選択可能）からファイルを選び、作品を開いて章・字体・しおりを操作します。読み込みでは新しい端末内コピーを作り、元ファイルは変更しません。

## 長編・バックアップの制限

| 対象 | 上限 |
| --- | --- |
| ローカル作品 | 5000章・分割、本文3200万文字 |
| TXT / EPUB | 50 MiB |
| EPUB展開後 | 全リソース128 MiB、文字リソース64 MiB、20000ファイル |
| JSONバックアップ | 128 MiB |
| AI連載 | 計画100章 |
| 共有書庫 | 100章、ZIP 25 MiB、展開JSON 30 MiB |

読書・生成・公開共有の上限は別々です。本文と利用可能な日本語ルビを取り込みますが、元の組版・画像・フォント・複雑なインタラクティブ内容は保持しません。暗号化リソースと独自の実体宣言は未対応です。上限を超える作品は分巻してください。構造・サイズ・章数・暗号化・文字コードの問題は読み込みエラーで区別します。[長編の説明](docs/long-book-import.md)。

MacとWindowsの全体バックアップは小説・作文・評価・しおり・進捗を含み、APIキーは含みません。Androidはデスクトップの小説を読み込み、リーダー用のバックアップを書き出せます。リーダーのバックアップはAndroidで復元し、デスクトップの全体バックアップとしては使えません。端末間の進捗は自動同期されません。

更新前にバックアップを作成し、生成タスクが終了してからアプリを終了して同じ場所へ置き換えてください。更新は手動で、OTA機能はありません。

## AIの設定

キーを作成した **Google AI Studio / Vertex AI Express** を設定で選び、キーと`generateContent`・構造化JSON出力に対応するモデルIDを入力します。キーの接頭辞だけでは接続先を決定できません。MacとWindowsはシステムの認証情報暗号化、AndroidはKeystoreを利用し、キーをバックアップに含めません。

生成と評価には通信が必要で、API料金が生じる場合があります。地域・モデル・権限・利用枠はGoogleアカウントに依存します。キーの保存やテキスト接続の成功は、全モデルやTTSの動作保証ではありません。異なるサービスへの自動再試行は行いません。[API設定と公式資料](docs/api-references.md)。

Webプレビューはブラウザー保存を使い、Geminiを呼び出したり新しいモデルキーを収集したりしません。保存容量に制約があるため、長編にはMac、Windows、またはAndroid版を使用してください。iPhoneとiPadはこのWebプレビューを使います。保存済み本文はオフラインで読めますが、共有書庫の更新・投稿・AI生成には対応する通信先への接続が必要です。[共有書庫の説明](docs/community-pool.md)。

## ビルドと検証

Node.js 22以降とnpmを使用します。

```sh
npm ci
npm test
node --test android-reader/tests/*.test.cjs
npm run build
npm start
```

Macでのパッケージ作成は`npm run package:dmg`。Windowsは`npm run package:win`（NSIS x64。macOS上ではWindows用Electronのダウンロードが必要です）。AndroidはJDK 21、Android SDK platform 36、build-tools 36.1.0を用意し、`JAVA_HOME=/path/to/jdk21 node android-reader/build.cjs`を実行します。[Androidの手順](android-reader/README.md)。GitHub Actionsの[Installers](.github/workflows/installers.yml)は手動実行でWindowsインストーラーをビルドできます。

[長編回帰テスト](docs/long-book-import.md)とRelease添付資料に、対象コミット・ハッシュ・実際の検証範囲を記録します。ブラウザーテストやビルド成功だけで実機Pad・最低OS・クリーン環境での動作を保証しません。テスト用データと配布物に著作権付き小説の本文は含めません。
