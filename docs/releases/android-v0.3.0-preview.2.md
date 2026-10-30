# Leaflight Reader · Android 0.3.0-preview.2

2026-10-30 · Android 10（API 29）及以上 · 独立预览客户端

## 与 Mac 0.11.12 对应的共享书池（免 API Key 借阅与分享）

- **书架新增「共享书池」**：在书架顶部或空书架引导区点击「共享书池」，无需配置 Gemini API Key 即可按语言（English / 日本語）和等级（CEFR A2–C1 / JLPT N5–N1）筛选作品、展开「开篇试读」（支持日语振假名注音），并一键加入本地书架离线阅读。
- **内置 4 部双语分级种子小说 + GitHub 同步**：内置与 Mac 端一致的 4 部英日分级小说；点击「从 GitHub 同步最新」可通过原生 HTTPS 拉取仓库 `community-pool/index.json` 与社区投稿 Issue 中的最新免费小说。
- **脱敏分享与单书 JSON 互通**：在作品「目录与书签」中点击「分享到共享书池」，自动剥离个人进度与书签，支持「复制并打开 GitHub 提交 Issue」或「导出分享文件 (`.leaflight-story.json`)」；「导入 TXT / EPUB / 备份」同样支持直接导入 `.leaflight-story.json` 单书分享文件。
- **三语界面同步**：中、英、日三语界面词条完整覆盖共享书池筛选、试读、同步与分享弹窗。

## 下载与源码

- [Android Release](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.3.0-preview.2)
- APK：`Leaflight-Reader-0.3.0-preview.2-debug.apk`，versionCode 5；保留此前预览版的应用标识及调试签名，可覆盖安装。
- [安装、构建与平台功能表](../../android-reader/README.md)
- 附件提供 SHA-256 校验文件。旧版 Release 保留，不覆盖旧包。

## 验证与限制

- 12 项 Android 单元测试与 TypeScript / Vite 构建检查通过，覆盖共享书池种子作品转换、分享脱敏、单篇分享 JSON 导入、GitHub Issue 解析，以及原有的备份合并、连载信息、EPUB/TXT 导入等测试。
- 这是本机调试签名的预览包，尚未上架，没有自动更新。安装前建议导出备份；不要先卸载旧应用，以免丢失本机数据。
