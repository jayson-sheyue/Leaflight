<div align="center">

# 🍃 Leaflight

**让故事适合此刻的你 —— 本地优先的英日分级小说创作工坊、沉浸式仿真阅读器、科学 × 奇幻跨学科伴学与四维 AI 写作教练**

*A Local-First English (CEFR A2–C1) & Japanese (JLPT N5–N1) AI Fiction Studio, Tactile Graded Reader, Science × Fantasy Learning Companion, and 4D Writing Coach for macOS.*

[![Release](https://img.shields.io/badge/Release-v0.11.4-2d5a46?style=for-the-badge)](../../releases/tag/v0.11.4)
[![Platform](https://img.shields.io/badge/macOS-Apple%20Silicon%20(arm64)-1d1d1f?style=for-the-badge&logo=apple)](../../releases/tag/v0.11.4)
[![Storage](https://img.shields.io/badge/Local--First-SQLite%20%2B%20Keychain-0f4c5c?style=for-the-badge)](#5-本地优先隐私安全与非阻塞后台消息盒子)
[![Languages](https://img.shields.io/badge/Bilingual-English%20CEFR%20A2--C1%20%7C%20Japanese%20JLPT%20N5--N1-8c4a27?style=for-the-badge)](#1-英日双语分级故事工坊-cefr-a2c1--jlpt-n5n1)

<br />

<img src="docs/assets/leaflight-overview.gif" alt="Leaflight 全流程核心功能动图演示" width="100%" />

<p align="center">
  <sub>▲ <b>Leaflight 核心功能一镜预览</b>：暖纸与深海玻璃主题书架 → 三步式新建故事 → 科学 × 奇幻阅读预设 → 英/日仿真阅读器与假名注音 → 零幻觉「科学手记」 → 独立写作台（真实图表渲染 + 四维 AI 批改） → 非阻塞后台消息盒子</sub>
</p>

</div>

---

## 🌟 为什么会有 Leaflight？（30 秒看懂项目定位）

许多外语学习者与跨学科读者都面临同一个痛点：
- **原版小说太难**，生词密集、长难句劝退，翻两页就变成了查词典苦旅；
- **传统分级读物太幼稚**，剧情单薄乏味，缺乏让人忍不住想翻下一页的连载张力；
- **阅读与写作长期割裂**，读完故事没有输出反馈，备考雅思（IELTS）、日本留学试验（EJU）或练习学术/创意写作时缺少针对性的逐句诊断。

**Leaflight（叶光书房）** 是一款运行在 macOS 本地桌面端的**私人外语故事书房与读写伴学工作站**。它将 **大语言模型结构化连载生成（Gemini Structured Output）**、**严谨的语言分级与启发式难度校验**、**英国教育部 DfE / 日本文部科学省 MEXT / NASA 真实科学课程知识库** 以及 **拟真电子书排版与四维写作批改** 融为一体：

| 核心场景 | Leaflight 提供的解决方案 |
| :--- | :--- |
| **📖 想读引人入胜、难度刚好的外语小说** | 支持 **英语（CEFR A2 / B1 / B2 / C1）** 与 **日语（JLPT N5 / N4 / N3 / N2 / N1）**。自选悬疑、科幻、奇幻、日常治愈等 8 大题材，按章连载并维持长达 60 章的人物与伏笔记忆。 |
| **🔬 想在读小说中自然理解科学原理** | 内置 **24 个跨学段科学单元** 与 **48 个「科学 × 奇幻」故事预设**。把光学折射、电磁感应、DNA 遗传、天体轨道等真实科学原理化作推动剧情解谜的关键机制，并配发零幻觉的章节 **「科学手记」**。 |
| **✍️ 想练就扎实的外语与科学写作能力** | 内置 **132 道英日结构化写作题库**（涵盖小学至大学进阶、**IELTS 雅思真题级渲染图表**、**EJU 日本留学试验**、以及 **96 道科学探究写作任务**），提供 **结构 / 语言 / 词汇 / 科学概念** 四维评分与原文精确摘录批改。 |
| **🎨 追求安静、护眼、有质感的阅读体验** | 提供 **10 套全局高对比度材质主题**（5 套暖纸 + 5 套通透玻璃拟态，阅读正文对比度全部通过 WCAG ≥ 7:1 校验）、**8 种仿真翻页动效**、**12 套本地精选字体栈** 与 **中/日/英三语界面**。 |
| **🔒 重视本地隐私与流畅响应** | **Local-First 架构**：所有故事、阅读书签、生词测试、写作草稿全部保存在本地 `SQLite` 数据库；API Key 经由 macOS 系统钥匙串（`safeStorage`）加密；后台任务队列支持边生成边阅读。 |

---

## ✨ 核心亮点与界面展示

### 1. 英日双语分级故事工坊（CEFR A2–C1 & JLPT N5–N1）

- **三步式向导创作**：仅需选择「语言与等级」→「题材或科学融合预设」→「篇幅与主角设定」，即可开启专属连载。
- **同剧情跨级直观对比**：内置同一故事场景在不同等级（如 `A2 vs C1`、`N5 vs N1`）下的句法与用词对照，选定难度前心中有数。
- **双重难度守门员**：生成章节时不仅注入严格的考纲约束，更通过本地启发式分析（平均句长、长词占比、日语句末形态与汉字密度）自动复核难度，超标时自动修正。
- **读后体感校准**：每章读完可一键反馈「偏难 / 刚好 / 偏轻松」，下一章自动微调句式复杂度。

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/story-studio.png" alt="三步式新建故事向导" />
      <p align="center"><sub><b>三步式创作工坊</b>：清晰选择语言、分级、题材与章节规模</sub></p>
    </td>
    <td width="50%">
      <img src="docs/assets/difficulty-comparison.png" alt="同剧情跨级对比预览" />
      <p align="center"><sub><b>同剧情跨级对比</b>：直观感受 A2 与 C1 在词汇与句法上的差异</sub></p>
    </td>
  </tr>
</table>

---

### 2. 拟真翻页阅读器与 10 套全局材质主题

- **8 种拟真翻页动效**：支持 `Paper Curl（仿真卷页）`、`Cube In（内立方翻转）`、`Cube Out（外立方翻转）`、`Carousel（旋转木马）`、`Flip（中轴对折）`、`Bounce（弹性回跃）`、`Slide（平滑推页）` 与 `Fade（呼吸淡入）`。
- **双栏精排与自适应布局**：大屏自动开启仿纸书双栏对称排版，小屏或窄窗自动切换单栏流式阅读；翻页严格锁定章节边界，绝不跨章串页。
- **日语振假名注音（Furigana）**：针对 JLPT `N5–N3` 章节自动渲染标准 `<ruby>漢字<rt>かんじ</rt></ruby>` 假名注音，并在正文下方提炼核心语法句型。
- **本章词汇表与 3 题即时理解小测**：每章附带带词性与双语释义的重点词汇卡，以及 3 道检验情节理解的互动选择题。

<div align="center">
  <img src="docs/assets/page-turn-showcase.gif" alt="8种仿真翻页动效与10套材质主题演示" width="92%" />
  <p align="center"><sub>▲ <b>8 种仿真翻页动效 & 10 套全局材质主题</b>（Paper / Rose / Mist / Sand / Bamboo 纸感 + Ocean / Violet / Dusk / Jade / Night 玻璃拟态）</sub></p>
</div>

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/reader-english.png" alt="英语分级阅读器" />
      <p align="center"><sub><b>英语沉浸式阅读器</b>：目录抽屉、字号/行距调节与页码进度</sub></p>
    </td>
    <td width="50%">
      <img src="docs/assets/reader-japanese.png" alt="日语分级阅读器与假名注音" />
      <p align="center"><sub><b>日语阅读与三语 UI</b>：支持 N5–N3 汉字振假名与语法要点解析</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/assets/bookshelf-paper.png" alt="暖纸主题书架" />
      <p align="center"><sub><b>暖纸护眼主题（Warm Paper）</b>：温润纸张肌理，适合长时阅读</sub></p>
    </td>
    <td width="50%">
      <img src="docs/assets/bookshelf-ocean.png" alt="深海冷光玻璃主题书架" />
      <p align="center"><sub><b>深海冷光主题（Ocean Glass）</b>：高对比毛玻璃拟态，支持透光度调节</sub></p>
    </td>
  </tr>
</table>

---

### 3. 科学 × 奇幻主线融合 & 零幻觉「科学手记」

Leaflight 独创了 **Science × Fantasy（科学 × 奇幻/科幻/悬疑）** 伴学模式，拒绝生硬说教，让科学原理成为主角破局的钥匙：

- **24 个跨学段真实科学单元**：覆盖 **小学（Primary）→ 初中（Middle）→ 高中（High）→ 大学通识（University）** 四大阶段，涵盖物理与工程、生物与医学、化学与材料、地球与空间四大领域。
- **48 个双语科学故事预设**：例如在《雾港钟楼的回声》中利用「声波反射与介质传播」破解密室回声，或在《深海发光实验室》中借助「生物荧光与酶催化」追踪失落样本。
- **零幻觉本地「科学手记（Science Notebook）」**：阅读完融合章节后，点击展开「科学手记」——其中的**核心原理解释、常见误区澄清、现实生活映射、2 道自测问答及官方权威来源链接**（直连 [England National Curriculum DfE](https://www.gov.uk/government/collections/national-curriculum)、[日本文部科学省 MEXT 学習指導要領](https://www.mext.go.jp/a_menu/shotou/new-cs/index.htm)、[NASA Science](https://science.nasa.gov/)）全部由**本地经过校验的结构化知识库直接渲染**，100% 杜绝大模型科学事实幻觉。

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/science-preset.png" alt="科学×奇幻阅读预设选择" />
      <p align="center"><sub><b>科学 × 奇幻故事预设</b>：按学段与学科挑选感兴趣的科学解谜主线</sub></p>
    </td>
    <td width="50%">
      <img src="docs/assets/science-notebook.png" alt="零幻觉章节科学手记" />
      <p align="center"><sub><b>章节「科学手记」</b>：原理拆解、误区纠偏与英/日/美官方课程权威来源</sub></p>
    </td>
  </tr>
</table>

---

### 4. 独立写作台与四维 AI 写作教练（132 道内置题库）

无需先读完小说，随时可进入左侧导航的 **「我的写作」** 开启针对性训练；也可以在读完任意故事章节后一键进入 **「读后感 / 故事续写 / 科学观察手记」**。

- **132 道内置高仿真题库**：
  - **雅思题型训练（IELTS Academic Task 1 & Task 2）**：Task 1 内置**真实可视化柱状图、数据表与流程图组件**，完整还原图表作文审题场景；
  - **日本留学试验（EJU 日本語記述問題）**：贴合日本大学入试学术议论文要求；
  - **小学 → 初中 → 高中 → 大学进阶训练**：覆盖记叙、书信、议论与学术思辨；
  - **96 道科学写作专项任务**：涵盖 **科学观察手记（Field Note）**、**奇幻设定科学拆解（Mechanism Analysis）**、**实验与证据报告（Evidence Report）**、**科技伦理议论文（Ethics Essay）**，每道题均配备分步脚手架（Step-by-step Prompts）与高分范文片段。
- **四维 AI 批改与原文精确摘录验证**：
  - 从 **结构与任务回应（Structure）**、**语法与句式（Language）**、**词汇丰富度（Vocabulary）** 及 **科学概念准确性（Science Concept Accuracy）** 四个维度独立打分；
  - 每一条逐句润色建议都必须通过本地 `originalQuote` 原文子串校验，确保 AI 批改 100% 锚定你真实写下的句子，绝不凭空捏造错句。

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/writing-chart.png" alt="雅思图表作文真实可视化渲染" />
      <p align="center"><sub><b>IELTS 图表作文真实渲染</b>：内置可视化柱状图与流程材料，告别干瘪纯文本题干</sub></p>
    </td>
    <td width="50%">
      <img src="docs/assets/science-writing-review.png" alt="四维AI写作教练与科学概念批改" />
      <p align="center"><sub><b>四维 AI 写作教练</b>：结构/语言/词汇/科学概念四维评分 + 原文摘录对照润色</sub></p>
    </td>
  </tr>
</table>

---

### 5. 本地优先、隐私安全与非阻塞后台消息盒子

- **非阻塞后台任务队列（消息盒子）**：新建故事、续写下一章或提交长文批改时，任务自动进入后台运行。你可以随时回到书架继续阅读其他作品，完成后顶部胶囊与左侧「消息盒子」会实时通知并支持一键跳转。
- **开箱即用离线体验**：首次打开无需配置 API Key 即可阅读内置的 3 章完整双语示范连载（*Letters from the Quiet Sea*），并体验完整翻页、词汇、测验与题库浏览。
- **支持导出与备份**：支持将任意完结或连载中的故事导出为标准 **EPUB 3 电子书**（兼容 Apple Books / Kindle / Kobo）或 **TXT 纯文本**，并支持全库 JSON 一键备份与恢复。

<div align="center">
  <img src="docs/assets/background-inbox.png" alt="非阻塞后台消息盒子" width="85%" />
  <p align="center"><sub>▲ <b>非阻塞后台任务队列（消息盒子）</b>：AI 生成章节与批改在后台静默完成，阅读与写作零等待</sub></p>
</div>

---

## 📦 下载安装与快速上手

### 方式一：直接安装 macOS 桌面端（推荐）

1. 前往本仓库的 [**Releases 页面**](../../releases/tag/v0.11.4)，下载最新安装包：
   - 🍎 **`Leaflight-0.11.4-arm64.dmg`**（适用于 Apple Silicon M1 / M2 / M3 / M4 芯片 Mac）
2. 双击打开 `.dmg`，将 **Leaflight.app** 拖入 `Applications（应用程序）` 文件夹。
3. 首次打开即可直接阅读内置示范故事；如需使用 AI 生成新章节或 AI 写作批改：
   - 点击左下角 **「系统设置 / 模型与设置」**；
   - 选择服务商（推荐使用 **Google Gemini 官方接口** 如 `gemini-2.5-flash`，或兼容 OpenAI 的接口），粘贴你的 API Key 并点击「测试连接」。

> 💡 **macOS 首次打开提示**：由于应用未附加 Apple 付费开发者公证签名，若 macOS 提示“无法验证开发者”，请在「访达（Finder）」中**按住 Control 键点击 Leaflight.app → 选择「打开」**，或在终端执行：
> ```bash
> xattr -cr /Applications/Leaflight.app
> ```

---

### 方式二：从源码本地运行与构建

#### 环境要求
- **操作系统**：macOS 13.0+（推荐 Apple Silicon）
- **Node.js**：`v20.x` 或 `v22.x`

#### 启动开发环境
```bash
# 1. 克隆仓库
git clone https://github.com/jayson-sheyue/Leaflight.git
cd Leaflight

# 2. 安装依赖
npm install

# 3. 启动桌面端热重载开发模式
npm run dev
```

#### 常用脚本与打包指令
```bash
# 类型检查与前端构建
npm run build

# 生成 macOS .app 与 .dmg 安装包（输出至 release/ 目录）
npm run package:dmg

# 运行完整自动化测试套件（含单元测试 + 13 项真实桌面端 Electron E2E 验证）
npm test
npm run test:desktop
```

---

## 🏗️ 技术架构与工程设计

Leaflight 采用严格的进程隔离与本地优先架构，确保桌面端轻量、安全且易维护：

```text
Leaflight/
├── electron/
│   ├── main.cjs                # Electron 主进程：窗口生命周期、Keychain (safeStorage) 加密与安全 IPC 注册
│   ├── preload.cjs             # ContextBridge 白名单桥接（禁用 nodeIntegration）
│   ├── store.cjs               # 本地持久化存储、Schema 迁移、阅读锚点与回收站/JSON 备份
│   ├── gemini.cjs              # Gemini 原生 responseSchema 结构化输出 + 启发式难度复核与科学手记合并
│   ├── jobs.cjs                # 非阻塞后台任务队列（消息盒子）调度引擎
│   ├── science.cjs             # 24 个科学单元、48 个科学×奇幻预设与零幻觉官方知识库加载器
│   ├── writing.cjs             # 四维 AI 写作批改与原文精确摘录 (originalQuote) 校验
│   ├── writing-topics.cjs      # 132 道英日分级写作题库与 96 道科学写作专项任务引擎
│   ├── difficulty.cjs          # 英日分级约束（CEFR A2–C1 / JLPT N5–N1）与启发式复杂度检测
│   └── export.cjs              # 标准 EPUB 3 与 TXT 电子书打包导出器
├── src/
│   ├── main.ts                 # 应用主视图状态机、阅读器、创作工坊与后台消息盒子交互
│   ├── writing.ts              # 独立写作台、IELTS 可视化图表渲染与四维批改报告视图
│   ├── science.ts              # 科学×奇幻预设选择与章节「科学手记」抽屉组件
│   ├── materials.ts            # 10 套全局材质与毛玻璃主题、12 套字体栈控制器
│   ├── page-transitions.ts     # 8 种拟真 3D 翻页动效控制器与章节边界锚点保护
│   └── i18n.ts                 # 简体中文 / 日本語 / English 完整界面国际化字典
├── scripts/
│   └── create-dmg.cjs          # macOS Apple Silicon (.app & .dmg) 自动化打包脚本
└── tests/                      # Node.js 单元测试 + Playwright Electron 真实桌面端 E2E 测试套件
```

### 核心工程保障
1. **100% 确定性结构化输出**：对 Gemini 官方接口直接启用 `responseMimeType: "application/json"` 与严格 `responseSchema`，并对章节正文、词汇表、理解题、剧情记忆增量与四维批改报告执行深度 Schema 校验与原文字段核验。
2. **WCAG 视觉无障碍合规**：所有 10 套主题（含 5 套毛玻璃主题）的正文阅读区与卡片均通过自动化对比度审计（正文对比度 `≥ 7.0:1`，杜绝半透明底色导致文字发虚）。
3. **端到端自动化验证**：内置 `tests/` 涵盖题库完整性、科学课程官方外链校验、启发式难度评估以及真实 Electron 窗口下的全链路 E2E 测试。

---

## 📋 版本演进摘要（Changelog）

- **`v0.11.4`（当前版本）**：新增 **科学 × 奇幻跨学科伴学体系**（24 个科学单元、48 个双语阅读预设、零幻觉章节「科学手记」直连英/日/美官方课程标准、96 道科学写作任务与科学概念准确性第 4 维度批改）。
- **`v0.11.3`**：新增 **非阻塞后台任务队列（消息盒子）**、IELTS 图表题真实可视化渲染、同剧情跨级难度对比预览与读后难度体感校准。
- **`v0.11.1` – `v0.11.2`**：重构 **10 套全局材质与毛玻璃主题系统**、**8 种拟真 3D 翻页动效**、**12 套本地精选字体栈** 与 **中/日/英三语 UI**，全面通过 WCAG 对比度审计。
- **`v0.10.0`**：新增 **日语分级阅读与写作支持（JLPT N5–N1）**、汉字 `<ruby>` 振假名注音与 EJU 日本留学试验写作训练。
- **`v0.1.0` – `v0.9.0`**：完成本地 SQLite + Keychain 基础架构、英语 CEFR A2–C1 多章连载记忆引擎、独立写作台与 EPUB 3 导出。

---

## 📄 开源协议 (License)

本项目基于 [MIT License](LICENSE) 开源。欢迎 Star ⭐、Fork 或提交 Issue 与 Pull Request！
