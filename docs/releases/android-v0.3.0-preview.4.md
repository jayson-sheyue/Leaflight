# Leaflight Reader 0.3.0-preview.4

- Gemini 设置新增 AI Studio／Vertex AI Express 来源选择；旧设置继续使用 AI Studio，接受旧式及带点授权 Key。
- 原生固定 Google HTTPS 端点与请求头鉴权；Express 使用 `v1beta1/publishers/google/models`，请求保持 user 角色及 JSON schema。
- 系统密钥库保存 Key；任务开始时快照密钥和来源，保存设置时留空 Key 会保留原有密钥。模型 ID 可带 `models/` 前缀，保存时规范化。
- 保留阅读、共享书池、连载、书签和备份兼容性；模型权限与配额由所选服务决定，不自动跨服务重试。

APK：`Leaflight-Reader-0.3.0-preview.4-debug.apk`，versionCode 7。Mac 对应 v0.11.15。

10 项 Android 单元检查、原生 Java 网关契约与构建已通过；最终 APK 设置、重启及旧版升级范围见 Release 附件。没有真实 AQ 密钥线上调用、实体 Pad 或最低系统版本实机验收。预览签名保持一致，升级请覆盖安装，不要先卸载；没有自动更新。

[配置和数据边界](../api-references.md) · [Android 说明](../../android-reader/README.md)
