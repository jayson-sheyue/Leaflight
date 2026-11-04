# 共享书池：长篇投稿与离线借阅

适用：Mac 0.11.14、Android Reader 0.3.0-preview.3 及以后版本。

## 分享作品

1. 在作品的「分享 / 分享到书池」中选择「分享包投稿」。
2. 保存生成的 `.leaflight-share.zip`。客户端只打包作品正文、分级、署名及必要的故事设定，剔除本地书签、阅读进度、密钥、任务、写作草稿和评审。
3. 在自动打开的 GitHub 投稿页，选择或拖入刚保存的 ZIP。**等待附件上传完成**，看到文件链接后再提交。需要登录自己的 GitHub 账户，不需要提供 GitHub Token 或 Gemini API Key。
4. 机器人在同一条投稿下回复「已收录」或「暂未收录」。保存分享包或打开投稿页都不代表已经公开提交或成功收录。失败后按回复修改附件，并编辑保存原投稿以重试。

Android 使用系统文件选择器保存 ZIP，取消保存时不会自动打开投稿页。浏览器测试版会先下载 ZIP，再从消息盒子点击「打开投稿页」。Mac 保存后会在 Finder 中显示文件位置，便于拖入投稿。

作品及署名会公开给所有读者；投稿前确认内容适合公开。系统无法识别正文中自行写入的私人信息。更新同一作品的章节时，编辑原投稿并替换附件；一条投稿只保留一个 ZIP，不要为同一标识反复创建投稿。

## 借阅与离线阅读

- 点击「从 GitHub 同步 / 刷新」只拉取目录、简介、章节数和开篇试读，浏览不会预下载所有小说。
- 点击「加入书架」时才下载该作品全文，并检查文件大小、SHA-256、作品标识和章节格式。保存完成后可离线阅读；下载失败不创建空书、不覆盖现有书籍。
- 分享包准备和借阅结果在全局消息盒子中保留。GitHub 上的收录结果以投稿下的机器人回复为准。
- 断网时保留已缓存目录、内置完整作品和已加入书架的作品；只有目录而尚未下载的作品需要联网借阅。
- 已加入书架的版本不会随远端编辑自动覆盖，避免影响本地章节、书签与进度。若远端更新后出现校验失败，先刷新目录再借阅。

## 格式、兼容与规模

- ZIP 内仅有 `story.leaflight-story.json`，内容为既有 `leaflight-pool-story` / version 1。Mac 与 Android 使用同一格式；两端均可直接导入 ZIP 或原有单书 JSON。
- 旧版 Issue 中的 `leaflight-story` JSON 代码块仍可收录；Mac 的 Token 直传保留给短篇，正文超过预留上限时会在发送前提示改用 ZIP。
- 当前支持每部最多 100 章，每章正文少于 150,000 字符；ZIP 最大 25 MiB，解压后的 JSON 最大 30 MiB；目录最大 8 MiB / 1,000 部。超限会拒绝处理，不截断正文。GitHub 对普通附件的官方上限标为 25 MB，客户端接近上限的文件仍可能被上传端拒绝。
- 不支持加密、多文件、分卷或 ZIP64 压缩包。程序校验 ZIP 结构、实际解压字节数及 CRC，拒绝路径穿越和不受支持的附件下载地址。
- 旧客户端可以通过原有逐书路径读取新目录，但会预下载全文；长篇附件投稿需要升级客户端。

## 收录实现与验证

GitHub Actions 从 Issue 事件文件读取输入，仅下载 GitHub 附件及允许的 GitHub 文件存储重定向。作品通过白名单校验后写入 `community-pool/stories/<poolId>.json`，目录 version 2 仅保存元数据、相对路径、字节数与 SHA-256，并保留旧 Android 客户端读取所需的顶层 path。并发投稿提交前在最新分支上重建索引，并有界重试；成功反馈在归档推送成功后发送。相同作品标识不能被另一条投稿覆盖。

可重复执行：

```sh
npm test
node --test android-reader/tests/*.test.cjs
npm run build
LEAFLIGHT_TEST_MOCK_KEYCHAIN=1 node tests/pool-transfer.desktop.cjs
./node_modules/.bin/tsc --noEmit -p android-reader/tsconfig.json
./node_modules/.bin/vite build --config android-reader/vite.config.ts
node android-reader/tests/pool.browser.cjs
```

桌面测试用临时书库与受控网络；Android 浏览器测试覆盖 360px 手机及 800px 平板布局，不能代替真实 Android 系统文件选择器和 GitHub 线上附件验收。打包验收记录随对应 Release 提供。

官方依据：[GitHub 附件类型与大小](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)、[Issue 评论接口](https://docs.github.com/en/rest/issues/comments)、[Actions 并发](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。
