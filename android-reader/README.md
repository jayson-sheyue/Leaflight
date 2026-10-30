# Leaflight Reader · Android 平板阅读预览

当前版本 **0.2.1-preview.1**。安卓端独立于 Mac v0.11.9，使用独立的应用标识、用户数据、构建目录和签名。安卓版和 Mac 的数据及构建相互独立。

## 在 Pad 上阅读

1. 从 [Android 预览 Release](https://github.com/jayson-sheyue/Leaflight/releases/tag/android-v0.2.1-preview.1) 下载并安装 `Leaflight-Reader-0.2.1-preview.1-debug.apk`。这是开发签名的预览包，尚未上架应用商店。
2. 在 Mac 版的「系统设置 → 导出备份」导出 JSON，通过 USB 或你自己的文件传输方式复制到 Pad。
3. 在安卓版点击「导入 TXT / EPUB / 备份」，用系统文件选择器选中 JSON。只导入小说、章节、书签和阅读位置；不导入写作草稿、评审或 API Key。
4. 打开作品阅读。已导入内容完全离线可用，阅读无需联网。应用仅为 Gemini 生成申请联网权限，不申请账户或全盘存储权限。

也可以点击「体验离线示例」，不用传书即可试读固定的三章英文示例。

## 功能

- 英文和日文正文、日语注音、目录与章节跳转。
- 分页和滚动阅读；分页支持横向滑动与前后按钮。
- 8 种翻页特效及关闭动画选项，尊重系统减少动态效果设置。
- 10 套主题、4 类系统字体、字号、行距和正文宽度。
- 阅读专注模式，中／英／日界面；横竖屏重排和重新打开时保留文字位置。
- 书签添加、取消和列表删除；旧的同位置重复记录在导入时合并。
- 本机保存与阅读备份导出；删除 Pad 上的作品不会修改 Mac。

**再次导入**：同 ID 作品保留 Pad 的进度与书签，仅追加正文前缀相同的新章节。较旧或正文冲突的副本跳过，不覆盖当前版本。新设备导入安卓版阅读备份时可恢复阅读设置。

## 边界与数据

- 支持在安卓版使用 Gemini 生成**一篇完整独立短篇**，选择英文/日文、难度、题材、篇幅及自定义想法；暂不支持续写、章节连载、写作与评审。安卓和 Mac 的生成能力并非完全一致。
- 点击「生成故事 → Gemini 设置」填写自己的 API Key 和模型；密钥使用 Android Keystore 加密存储，不包含在阅读备份中。联网生成可能产生 API 费用。生成时可以继续阅读，结果和失败显示在「生成消息」。系统结束进程时任务可能中断，不会自动重试；中断的请求仍可能产生费用。
- 两端没有自动同步；Android 阅读备份用于安卓版恢复，不能作为 Mac 全库备份导入。
- 支持 UTF-8 TXT 和未加密的常见 EPUB 文字章节导入；不保证保留排版、图片或复杂结构。单篇文件无法恢复原始书签、进度与生成设定；完整迁移应使用 JSON 备份。不支持 PDF 和加密 EPUB。
- JSON 备份上限 30 MB；TXT/EPUB 上限 20 MB，EPUB 解压内容上限 8 MB。最多 500 本、每本最多 100 章。没有生成章节的作品需先在 Mac 生成。
- 数据在本应用的私有 WebView IndexedDB 中，不依赖 Mac 在线。卸载应用会丢失本机数据，先导出备份；外部 JSON 本身未加密。
- Android 10（API 29）及以上，需要较新的 Android System WebView。字体使用设备实际提供的字体，四种类别不等于额外捆绑四套字库。
- 此包使用本机调试签名；后续更换签名可能需要先备份，再重新安装。没有应用内自动更新；尚未完成实体 Pad 和最低 Android 版本实机验收。

## 构建

复用仓库锁定的 Vite / TypeScript，不向 Mac 项目添加 Android 运行依赖。原生壳仅使用 Android 平台 API，无第三方原生运行库。

需要 Node、JDK 21、Android SDK Platform 36 和 Build Tools 36.1.0。已有 SDK 通过 `ANDROID_SDK_ROOT` 指定；脚本不自动安装 SDK 或接受许可。

在仓库根目录执行：

```sh
npm ci
export JAVA_HOME=/path/to/jdk-21
export ANDROID_SDK_ROOT=/path/to/android-sdk
node android-reader/build.cjs
```

输出位于 `android-reader/build/`，包括 APK 与 SHA-256 校验文件。使用官方 `aapt2 → javac → d8 → zipalign → apksigner` 工具链；安装后无需任何开发工具。调试签名保存在 `android-reader/.local/`，已从 Git 排除。跨构建保留这份签名才能覆盖安装同一预览应用。

正式签名可通过 `READER_KEYSTORE`、`READER_KEY_ALIAS`、`READER_STORE_PASSWORD` 和 `READER_KEY_PASSWORD` 配置，密码以环境变量传给签名器。正式模式关闭 WebView 调试。不要把私钥或密码提交到 Git。

## 验证

```sh
node_modules/.bin/tsc --noEmit -p android-reader/tsconfig.json
node --test android-reader/tests/storage.test.cjs
node_modules/.bin/vite build --config android-reader/vite.config.ts
node android-reader/tests/reader.browser.cjs
node android-reader/tests/generation.browser.cjs
npm test
```

浏览器测试使用隔离数据，覆盖真实 Mac 备份导入、恶意 HTML 转义、损坏备份不覆盖、再次导入、横竖屏／字体重排、翻页与书签、重启恢复、日语注音、主题和备份导出。浏览器验证不能代替实际 APK、系统文件选择器或实体 Pad 测试。上述为自动化验证，具体 APK 的测试范围请以本次交付说明为准。

上一版已在 Android 16 ARM64 平板模拟器验证覆盖升级、密钥库、系统文件导入／导出和阅读。新版 TXT/EPUB 与翻页修复的具体验证结果以本次交付说明为准。生成请求使用模拟 Gemini 响应进行验证，尚未使用真实 API 调用。实体 Pad 与 Android 10 最低版本尚未实机验证。

原生测试默认对当前 APK 执行安装与同签名重装；需要指定旧版升级来源时设置 `READER_UPGRADE_FROM=/path/to/previous-same-signed.apk`。重复原生验收需安装官方 Playwright Android 驱动（`node_modules/.bin/playwright install android`），准备名为 `LeaflightTablet` 的专用模拟器并启动 adb，再运行 `node android-reader/tests/reader.android.cjs`。该测试会清空此专用模拟器中阅读器的测试数据，脚本拒绝在实体设备或其他名称的模拟器执行。

## 官方技术依据

- [Android：加载应用内 Web 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)——资源随 APK 打包，固定可信 HTTPS 来源；原生壳提供本地资源并阻止其他导航。
- [Android：Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files)——用户选择具体文档导入／导出，无需全盘存储权限。
- [Android：AAPT2](https://developer.android.com/tools/aapt2) 与 [命令行构建及签名](https://developer.android.com/build/building-cmdline)——APK 打包、调试与发布签名的边界。

- [Gemini：文本生成](https://ai.google.dev/gemini-api/docs/text-generation)——使用用户密钥、模型与结构化 JSON。
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore)——密钥材料由系统密钥库保护。

以上官方页面于 2026-10-28 核对。
