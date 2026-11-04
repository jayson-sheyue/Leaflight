# Leaflight Reader 0.3.0-preview.3

- 与 Mac 0.11.14 同步长篇 ZIP 分享：系统文件选择器保存分享包后打开 GitHub 投稿页，上传附件并提交，收录结果在投稿下回复。
- 共享书池刷新只获取目录与试读；点击加入书架时才下载并校验全文。成功后离线可读，失败不创建空书。
- 消息盒子保留分享和借阅结果；兼容单书 JSON、旧备份和 ZIP 分享包导入。
- 保留独立的 Android 数据、应用标识和预览签名，可覆盖旧预览版升级。不要先卸载，以免删除本地书库。

APK：`Leaflight-Reader-0.3.0-preview.3-debug.apk`，versionCode 6。仍为本机调试签名的预览包，未上架、没有自动更新。

[操作、格式和上限](../community-pool.md) · [Android 构建及限制](../../android-reader/README.md)。实际验收范围与产物校验值见 Release 附件；浏览器排版测试不代替实机验证。

已执行 10 项 Android 单元检查、TypeScript / Vite / 原生构建、浏览器长篇流程与窄屏排版，以及 Android 16 ARM64 专用模拟器的旧版升级、SAF ZIP 保存／取消、完整 24 章解压互通及消息持久化。使用隔离测试数据，没有付费模型调用；实体 Pad 与 Android 10 最低版本未实机验收。

2026-11-04 线上补充：通过 GitHub 页面上传超过 Issue 正文上限的 24 章合成测试 ZIP，[投稿 #2](https://github.com/jayson-sheyue/Leaflight/issues/2) 已自动收录并返回成功反馈。最终 APK 从公开目录借阅，原生 HTTPS 下载并校验，重启后 24 章正文与上传作品逐章一致。已关闭测试投稿并移除测试书，保留验证记录。公开 APK 回下载的 SHA-256 与签名证书一致。Release 新增 `verification-live-20261104.json` 和截图，原始记录、APK 与 tag 保持不变。
