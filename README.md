# Novel AI Agent

面向长篇网文创作的项目型写作原型。

当前重点不是 UI，而是一个可跑的命令行 pipeline：

- 项目初始化
- 作者配置生成
- 大纲生成
- 单章生成
- reviewer 审校
- memory 回写

## 运行环境

- Node.js 22+
- Windows PowerShell 或 Ubuntu Bash
- 已安装依赖：
  - Windows：`cmd /c npm install`
  - Ubuntu：`npm install`
- `.env` 中至少配置一个可用模型，目前默认走 `DeepSeek`

## 环境变量

在项目根目录创建 `.env`：

```env
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_VERSION=2023-06-01

OLLAMA_BASE_URL=http://localhost:11434

GLM_API_KEY=
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

当前默认任务路由在 [src/llm/config.ts](./src/llm/config.ts)。
如需启用 GLM，可将任务路由改为：`provider: "glm"`，模型例如 `glm-4.5`。

## 启动方式

不要直接依赖全局 `npm` 或全局 `tsx`。

项目已经提供入口脚本：

- Windows:
  - [run-v1.ps1](./run-v1.ps1)
  - [run-demo.ps1](./run-demo.ps1)
- Ubuntu:
  - [run-v1.sh](./run-v1.sh)
  - [run-demo.sh](./run-demo.sh)

它们会：

1. 使用本地 `tsc` 编译
2. 用 `node --env-file=.env` 运行编译后的 `dist/*.js`

## 最小检查

安装依赖：

```powershell
cmd /c npm install
```

```bash
npm install
```

类型检查：

```powershell
cmd /c npm run check
```

```bash
npm run check
```

跑 demo：

```powershell
.\run-demo.ps1
```

```bash
chmod +x ./run-v1.sh ./run-demo.sh
./run-demo.sh
```

## 项目模型

系统按 `project` 运转。

一个项目就是一套独立的：

- 作者配置
- 大纲
- memory
- 章节状态

也就是：

`一个项目 = 一套独立作者配置 + 一套独立大纲 + 一套独立 memory + 一套独立章节产物`

## 常用命令

### 1. 初始化项目

```powershell
.\run-v1.ps1 project bootstrap --project demo-project
```

作用：

- 初始化项目目录
- 生成或补齐默认配置文件
- 生成作者配置与基础 packs
- 写入默认 theme/style/setup

### 2. 查看项目摘要

```powershell
.\run-v1.ps1 project inspect --project demo-project
```

输出内容包括：

- premise
- 作者配置
- story outline 是否存在
- arc / beat 数量
- memory 数量
- chapter plan 数量

### 3. 查看项目文件路径

```powershell
.\run-v1.ps1 project paths --project demo-project
```

适合手动编辑 JSON/Markdown 时先定位文件。

### 4. 查看当前 outline

```powershell
.\run-v1.ps1 outline inspect --project demo-project
```

会输出：

- story outline
- arc outlines
- beat outlines

### 4.1 校验 outline 完整性

```bash
./run-v1.sh outline validate --project demo-project
```

会检查：

- story / arc / beat 是否齐全
- arc 章节范围是否连续覆盖
- beat 是否按 arc 连续覆盖且顺序合法

### 5. 生成分层大纲

```powershell
.\run-v1.ps1 outline generate-stack --project demo-project --count 250
```

当前实现会按四层生成：

1. `StoryOutline`
2. `CastExpansion`
3. `ArcOutline`
4. `BeatOutline`

产物会保存到项目目录：

- `story-outline.json`
- `cast-outlines.json`
- `arc-outlines.json`

### 6. 生成指定章节

```powershell
.\run-v1.ps1 chapter generate --project demo-project --chapter 1
```

当前单章链路是：

`Planner -> Context Builder -> Writer -> Missing Resource Reviewer -> Fact Consistency Reviewer -> MemoryUpdater`

### 7. 连续生成前 N 章

```powershell
.\run-v1.ps1 chapter generate-first --project demo-project --count 3
```

适合跑一个最小连续写作验证。

### 8. 查看某一章结果

```powershell
.\run-v1.ps1 chapter inspect --project demo-project --chapter 1
```

输出内容包括：

- chapter plan
- summary
- reviewer finding 数量
- draft 路径
- result 路径

## 推荐使用流程

### 流程 A：从零初始化到写第一章

```powershell
.\run-v1.ps1 project bootstrap --project my-novel
.\run-v1.ps1 project inspect --project my-novel
.\run-v1.ps1 outline inspect --project my-novel
.\run-v1.ps1 chapter generate --project my-novel --chapter 1
```

### 流程 B：先做长篇总纲，再写章节

```powershell
.\run-v1.ps1 project bootstrap --project my-novel
.\run-v1.ps1 outline generate-stack --project my-novel --count 250
.\run-v1.ps1 outline inspect --project my-novel
.\run-v1.ps1 chapter generate --project my-novel --chapter 1
```

### 流程 C：连续生成前几章做 smoke test

```powershell
.\run-v1.ps1 project bootstrap --project smoke-project
.\run-v1.ps1 chapter generate-first --project smoke-project --count 3
.\run-v1.ps1 chapter inspect --project smoke-project --chapter 1
```

## 项目目录

项目默认保存在：

```text
data/projects/<project-id>/
```

典型目录结构：

```text
data/projects/demo-project/
  author-profile.json
  theme-bible.json
  style-bible.json
  story-setup.json
  story-outline.json
  cast-outlines.json
  arc-outlines.json
  beat-outlines.json
  character-states.json
  world-facts.json
  story-memories.json
  chapter-plans.json
  derived/
    author-profile-packs.json
  chapters/
    chapter-001/
      draft.md
      result.json
```

## 当前已实现

- 项目型存储
- 作者采访器与 `AuthorProfile`
- `planner / writer / reviewer / memory updater`
- 分层 outline 生成实验
- 命令层
- 本地文件持久化

## 当前未实现或未闭环

- `Rewriter`
- 完整 `StoryOutline -> ArcOutline -> BeatOutline -> ChapterPlan` 自动链路
- opening mode 专门优化
- memory 去噪与回滚
- UI

## 相关文件

核心入口：

- [src/v1.ts](D:\Code\NovelAi\src\v1.ts)
- [src/v1-lib.ts](D:\Code\NovelAi\src\v1-lib.ts)

命令脚本：

- [run-v1.ps1](D:\Code\NovelAi\run-v1.ps1)
- [run-demo.ps1](D:\Code\NovelAi\run-demo.ps1)

存储层：

- [src/storage/project-repository.ts](D:\Code\NovelAi\src\storage\project-repository.ts)
- [src/storage/file-project-repository.ts](D:\Code\NovelAi\src\storage\file-project-repository.ts)

大纲实验：

- [src/outline-lib.ts](D:\Code\NovelAi\src\outline-lib.ts)
- [src/prompts/story-outline.ts](D:\Code\NovelAi\src\prompts\story-outline.ts)
- [src/prompts/cast-expansion.ts](D:\Code\NovelAi\src\prompts\cast-expansion.ts)
- [src/prompts/arc-outline.ts](D:\Code\NovelAi\src\prompts\arc-outline.ts)

卖点与爽感设计：

- [docs/payoff-patterns.md](D:\Code\NovelAi\docs\payoff-patterns.md)
- [docs/male-power-patterns.md](D:\Code\NovelAi\docs\male-power-patterns.md)
