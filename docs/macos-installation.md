# macOS 安装、签名与“已损坏”提示

## v0.11.12 的已确认问题

从 GitHub 下载的 `Leaflight-0.11.12-arm64.dmg` 与发布摘要一致，`hdiutil verify` 也通过；但其中的 App 未正确重新封装签名资源，严格检查返回：

```text
code has no resources but signature indicates they must be present
```

因此本次修复的是 App 签名，不是重新上传相同的 DMG。v0.11.13 对主程序、Helper 和框架重新签名，封装 Info.plist 和资源，并在签名结束、复制到 DMG 暂存目录及最终挂载后检查。旧版安装包保留供追溯，请使用新版。

## 当前安装方式与限制

1. 从 [v0.12.1 Release](https://github.com/jayson-sheyue/Leaflight/releases/tag/v0.12.1) 下载 `Leaflight-0.12.1-arm64.dmg`。这是 Apple Silicon Mac 包；最低系统声明为 macOS 12.0，最低版本尚未实机验证。放大阅读、写作或评审区后不常驻按钮；轻点页面，右上角短暂出现「消息」和「退出」。
2. 如需核对下载完整性，运行 `shasum -a 256 Leaflight-0.12.1-arm64.dmg`，与 [v0.12.1 说明](releases/v0.12.1.md) 中的摘要比较。摘要一致只能证明下载一致，不能证明 Apple 已认可发布者。
3. 退出旧版，将 DMG 中的 Leaflight 拖到 Applications 并选择替换。先导出作品备份；保留 `~/Library/Application Support/novel-reading/`，不要先卸载或删除数据目录。
4. v0.12.1 使用完整 **ad-hoc 签名**，没有 Developer ID 和 Apple 公证。严格签名校验通过不等于默认 Gatekeeper 放行。本机构建的 App 经 `spctl --assess --type execute` 判定为 rejected。首次打开仍可能被系统阻止。
5. 只有确认来自本仓库的正式下载页、摘要一致且愿意信任此应用时，才按 [Apple 官方说明](https://support.apple.com/102445)，查看「系统设置 → 隐私与安全性」是否提供针对 Leaflight 的「仍要打开」入口。此入口并非在所有系统或管理策略下都可用。

如果仍显示“已损坏”、签名检查失败，或系统不提供允许入口，请保留完整报错、macOS 版本和芯片类型反馈给维护者。当前不能承诺所有 Mac 均可默认双击打开；完整解决默认信任问题仍需 Developer ID 签名及 Apple 公证。不要求用户关闭全局安全策略、移除隔离标记或自行重签名。若系统提示恶意软件或会损坏电脑，不要按普通未认证提示处理。

## 签名检查

```sh
codesign --verify --deep --strict --verbose=2 /Applications/Leaflight.app
```

新版应通过验证，显示 `valid on disk` 和 `satisfies its Designated Requirement`。构建流程也会拒绝未封装资源、版本不一致或签后文件被修改的包。

## 发布验证的含义

- `codesign`：代码与签名资源的完整性。本版可验证，但 ad-hoc 不提供 Apple 认证的开发者身份。
- `hdiutil verify`：磁盘映像完整性，不检查应用可信度。
- `spctl`：Gatekeeper 策略判定。本版未公证，拒绝判定如实记录，不作为已放行发布。
- 本机隔离数据的启动、阅读和保存测试：运行能力；不能代替干净 Mac 上经浏览器下载后的首次启动，也不能证明未测试的 macOS 版本可用。

官方依据：[Apple 应用签名与 Gatekeeper](https://support.apple.com/102445)、[Apple 公证流程](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)、[electron-builder v26 macOS 签名配置](https://www.electron.build/v26/docs/mac/)。核对日期：2026-11-03。

## 钥匙串与自动回归

签名身份修复后，macOS 可能要求重新确认 Leaflight 对既有钥匙串项目的访问；此授权由用户在系统窗口亲自处理，不需要在聊天中提供密码。升级校验保留数据库中的加密内容，但不能代替实际授权后解密验证。

本次桌面自动回归显式设置 `LEAFLIGHT_TEST_MOCK_KEYCHAIN=1`，仅在测试启动参数中使用 Electron 的 `--use-mock-keychain`，配合隔离目录和虚构密钥，避免访问个人钥匙串。发行程序启动不添加此参数。真实钥匙串的跨签名授权／解密仍需人工验收。参考 [Electron 官方测试说明](https://releases.electronjs.org/pr/53790)。
