# API 与本地数据

当前版本：Leaflight v0.11.6。

## Gemini

应用直接调用 Google 官方 REST 接口，不使用 Gemini SDK，也不支持 OpenAI 兼容地址：

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
x-goog-api-key: 用户配置的 API Key
```

在「系统设置」填写模型 ID 和 Key 后点击「保存设置」。模型 ID 可手动修改，必须支持 `generateContent` 与 JSON 结构化输出；应用使用 `responseMimeType: application/json` 和 `responseSchema`。默认配置值不保证该模型在每个账户中可用。

生成故事会发送用户设定及相关故事设定、摘要、连续性记忆和近期正文。写作评审会发送提交时的草稿、题目、材料及反馈语言。Key 不放入 URL、导出文件或源码；通过 Electron `safeStorage` 加密后保存在本机数据库，macOS 加密密钥由系统 Keychain 保护。作品数据库本身不是全库加密。

生成需要联网，费用与免费额度由 Google 账户和模型决定。应用展示服务返回的 token 用量，但不估算账单；用户主动重试会再次发起请求。已保存的作品、草稿与评审可离线阅读。AI 建议、科学表述与难度判断均可能有误，不代表官方考试评级或完整教材。

官方参考（2026-10-27 核对）：

- [Gemini generateContent REST](https://ai.google.dev/api/generate-content)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## 安装与更新边界

当前提供 Apple Silicon macOS DMG，采用手动下载安装；没有应用内检查更新、更新清单或 OTA 安装功能。包未做 Apple 开发者签名与公证，SHA-256 文件只能核对下载完整性。安全自动更新与干净系统安装仍是未完成的分发条件，不能将本次发布理解为 OTA 已验证。

升级前建议在系统设置导出备份，等待后台任务完成，退出后替换应用。用户数据目录为 `~/Library/Application Support/novel-reading/`，不在应用包内。备份不包含 API Key；迁移到其他电脑时需重新配置。
