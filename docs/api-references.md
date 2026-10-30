# API 与本地数据

当前版本：Mac Leaflight v0.11.11；Android Reader 0.3.0-preview.1。

## Gemini

应用直接调用 Google 官方 REST 接口，不使用 Gemini SDK，也不支持 OpenAI 兼容地址：

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
x-goog-api-key: 用户配置的 API Key
```

在「系统设置」填写模型 ID 和 Key 后点击「保存设置」（API Key 可前往 Google 官方平台 [Google AI Studio (`https://aistudio.google.com/apikey`)](https://aistudio.google.com/apikey) 登录 Google 账号后点击 `Create API key` 获取）。模型 ID 可手动修改，必须支持 `generateContent` 与 JSON 结构化输出；应用使用 `responseMimeType: application/json` 和 `responseSchema`。默认配置值不保证该模型在每个账户中可用。

生成故事会发送用户设定及相关故事设定、摘要、连续性记忆和近期正文。写作评审会发送提交时的草稿、题目、材料及反馈语言。Key 不放入 URL、导出文件或源码；通过 Electron `safeStorage` 加密后保存在本机数据库，macOS 加密密钥由系统 Keychain 保护。作品数据库本身不是全库加密。

生成需要联网，费用与免费额度由 Google 账户和模型决定。Mac 展示服务返回的 token 用量，两端均不估算账单；用户主动重试会再次发起请求。Mac 与 Android 的「连续生成多章」按顺序每章调用一次，沿用任务开始时的 Key 和所选模型，每章成功后立即归档。失败会停止后续请求，不会自动重试；手动继续仅补原定范围内尚未保存的章节。停止或退出不会撤销已发出的服务端请求，仍可能计费；应用重启后不会自动继续生成。已保存的作品、草稿与评审可离线阅读。AI 建议、科学表述与难度判断均可能有误，不代表官方考试评级或完整教材。

安卓版通过原生 HTTPS 访问同一 Gemini 接口，密钥使用 Android Keystore 加密；任务开始时在原生内存保留密钥快照，前端和备份不接触密钥。Android 的连载试读与逐章请求同样支持停止及手动补齐，客户端进程退出后不会自动恢复。两端作品进度不自动同步，平台差异见 [Android 说明](../android-reader/README.md)。

官方参考（2026-10-27 核对）：

- [Gemini generateContent REST](https://ai.google.dev/api/generate-content)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## 共享书池（GitHub 公共书池同步与分享）

共享书池提供免 Gemini API Key 的双语分级小说借阅与社区分享能力：

- **本地种子与缓存**：客户端内置 4 部精选英日分级故事（`electron/pool-seed.json`），首次打开无需联网即可阅读并加入本地书架。
- **从 GitHub 同步最新**：点击「从 GitHub 同步最新」时，应用向本仓库发起只读请求：
  - `GET https://raw.githubusercontent.com/jayson-sheyue/Leaflight/main/community-pool/index.json`（及对应的 `community-pool/stories/{poolId}.json`）
  - `GET https://api.github.com/repos/jayson-sheyue/Leaflight/issues?state=open&per_page=30`（提取带有 `story-pool` 标签或 `leaflight-story` 代码块的社区投稿）
  所有拉取的数据均经过本地 `validatePoolStory` 字段与长度校验后缓存在本地 SQLite 设置中。
- **分享脱敏与上传方式**：
  - 点击「分享到书池」时，`sanitizeForPool` 会剥离阅读进度（`progress`）、书签（`bookmarks`）、难度反馈（`feedback`）与任务记录（`generationJobId`），仅保留故事标题、简介、大纲、分级设定与章节正文/假名注音。
  - **免 Token · 浏览器一键投稿**：将格式化后的 Issue Markdown 与 `leaflight-story` JSON 复制到系统剪贴板，并在默认浏览器打开 GitHub 新建 Issue 页面，由用户手动提交。
  - **客户端直传（可选 GitHub Token）**：若用户或开发者填写了具备 Issues 写入权限的 GitHub Personal Access Token，应用使用 Electron `safeStorage` 加密保存在本机（全库备份不包含该 Token），并通过 `POST https://api.github.com/repos/jayson-sheyue/Leaflight/issues` 直接发布。

## 安装与更新边界

当前提供 Apple Silicon macOS DMG，采用手动下载安装；没有应用内检查更新、更新清单或 OTA 安装功能。包未做 Apple 开发者签名与公证，SHA-256 文件只能核对下载完整性。安全自动更新与干净系统安装仍是未完成的分发条件，不能将本次发布理解为 OTA 已验证。

升级前建议在系统设置导出备份，等待后台任务完成，退出后替换应用。用户数据目录为 `~/Library/Application Support/novel-reading/`，不在应用包内。备份不包含 API Key；迁移到其他电脑时需重新配置。
