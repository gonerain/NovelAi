# Novel AI

# Novel AI

Novel AI 是一个 CLI-first 的长篇网文生成引擎原型。

它不是 one-shot 小说生成器，而是把长篇小说创作拆成可持久化、可检索、可审校、可失效、可重写的工程 pipeline。

核心目标是支持 100+ 章级别的连续创作：分层大纲、章节规划、混合检索、review / rewrite、memory 回写、impact 分析与 retrieval eval。

一条可运行、可回溯、可改稿的命令行 pipeline：

- 项目初始化
- 作者配置生成
- 分层大纲生成
- 章节生成
- memory / retrieval
- reviewer / rewriter
- 局部失效、重写、续写

## 当前状态

这个仓库现在已经有一条能跑通的主链：

- `project -> outline -> chapter -> memory -> retrieval -> rewrite`
- 支持项目级独立配置
- 支持 impact / rewrite-plan / invalidate / regenerate
- 支持章节草稿 sidecar 重写、版本化保存、指定版本 promote
- 支持 retrieval eval 回归检查

它已经不是“只会写一章”的 demo，但也还不是完整产品。当前更接近一个 CLI-first 的小说 agent 基座。

## 环境要求

- Node.js 20+，推荐 22+
- Windows PowerShell 或 Linux/macOS Bash
- 本地安装依赖：`npm install`

## 安装

Windows:

```powershell
cmd /c npm install
```

Linux / macOS:

```bash
npm install
```

## 环境变量

在仓库根目录创建 `.env`。

最小可用配置：

```env
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

当前默认任务路由是 DeepSeek，见 [config.ts](D:/Code/NovelAi/src/llm/config.ts)。
默认模型是 `deepseek-v4-flash`。

可选 provider 配置示例：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_VERSION=2023-06-01

OLLAMA_BASE_URL=http://localhost:11434

GLM_API_KEY=
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

可选 embedding 配置：

```env
NOVELAI_EMBEDDING_MODE=openai_compatible
NOVELAI_EMBEDDING_API_KEY=
NOVELAI_EMBEDDING_BASE_URL=https://api.openai.com/v1
NOVELAI_EMBEDDING_MODEL=text-embedding-3-small
```

不配 embedding 时，系统会自动回退到本地语义检索。

## 启动方式

不要依赖全局 `tsc` 或全局 `tsx`。

项目已提供封装脚本：

- Windows: [run-v1.ps1](D:/Code/NovelAi/run-v1.ps1)
- Linux / macOS: [run-v1.sh](D:/Code/NovelAi/run-v1.sh)

它们会：

1. 使用本地 TypeScript 编译到 `dist/`
2. 自动读取 `.env`
3. 运行 `dist/v1.js`

## 基础检查

类型检查：

```powershell
cmd /c npm run check
```

```bash
npm run check
```

构建：

```powershell
cmd /c npm run build
```

```bash
npm run build
```

## 核心概念

### 1. Project

系统按项目运行。

一个项目就是一套独立的：

- 作者配置
- 世界与设定
- 大纲
- memory
- chapters

所有项目数据都保存在：

```text
data/projects/<project-id>/
```

### 2. Outline Gate

章节生成默认要求细纲已审批。

也就是说，正常流程不是直接 `chapter generate`，而是：

1. 生成 outline stack
2. 导出 markdown 草稿
3. 人工审阅
4. approve detail
5. 再开始生成章节

### 3. Canonical vs Sidecar

系统里有两类章节产物：

- 正式产物：`draft.md` / `result.json`
- sidecar 产物：`draft_rewrite.*` / `draft_rewrite_versions/*`

`rewrite-draft` 不会直接改正式稿，只有 `apply-draft-rewrite` 才会 promote。

## 技术架构

当前实现是一个 `CLI orchestration layer + file repository + LLM task router + memory/retrieval subsystem` 的组合。

### 1. 命令层

命令入口在：

- [v1.ts](D:/Code/NovelAi/src/v1.ts)
- [v1-lib.ts](D:/Code/NovelAi/src/v1-lib.ts)

职责拆分：

- `v1.ts`
  - 解析命令行参数
  - 做最外层命令分发
  - 承担 outline approval gate
- `v1-lib.ts`
  - 组织项目 bootstrap、章节生成、改稿、impact、regenerate
  - 负责把多个 domain 子系统串成一条完整 pipeline

也就是说，`v1.ts` 更像 shell，`v1-lib.ts` 更像 application service。

### 2. 存储层

当前存储是 file-first repository：

- [project-repository.ts](D:/Code/NovelAi/src/storage/project-repository.ts)
- [file-project-repository.ts](D:/Code/NovelAi/src/storage/file-project-repository.ts)

特点：

- canonical state 直接落在项目目录
- JSON 负责结构化数据
- Markdown 负责正文草稿
- sidecar 文件负责 debug / eval / validation / rewrite snapshots

当前没有数据库事务，所以一致性依赖：

- 写入顺序控制
- 失效时重建 memory artifacts
- promote 前备份 canonical files

### 3. LLM 路由层

默认任务路由在：

- [config.ts](D:/Code/NovelAi/src/llm/config.ts)

当前默认：

- provider: `deepseek`
- model: `deepseek-v4-flash`

任务粒度是按 `task` 切的，不是整个项目只绑一个模型。当前已经区分：

- `author_interview`
- `story_outline`
- `cast_expansion`
- `arc_outline`
- `beat_outline`
- `planner`
- `writer`
- `rewriter`
- `review_missing_resource`
- `review_fact`
- `review_commercial`
- `memory_updater`

这样后面要做多模型优化时，不需要改命令层，只需要调 task route。

### 4. Domain 层

当前最重要的 domain 模块有：

- [memory-system.ts](D:/Code/NovelAi/src/domain/memory-system.ts)
- [memory-updater.ts](D:/Code/NovelAi/src/domain/memory-updater.ts)
- [retrieval-eval.ts](D:/Code/NovelAi/src/domain/retrieval-eval.ts)
- [change-impact.ts](D:/Code/NovelAi/src/domain/change-impact.ts)

它们分别负责：

- `memory-system`
  - chapter cards
  - ledgers
  - exact search
  - semantic recall
  - graph expansion
  - hybrid rerank
- `memory-updater`
  - 章节写后 memory patch
  - new memory draft
  - writeback sanitization
  - evidence snippet validation
- `retrieval-eval`
  - planted-fact eval set
  - chapter-level pass/fail report
  - regression compare
- `change-impact`
  - target -> impacted memories / chapters / arcs / beats
  - rewrite-plan 前置分析

## 章节流水线

当前正式章节生成不是单次 `writer` 调用，而是一条多阶段链路：

```text
Planner
-> Context Builder
-> Writer
-> Missing Resource Review
-> Fact Consistency Review
-> Commercial Review
-> Rewriter (conditional)
-> Final Reviews
-> Memory Updater
-> Memory Validation
-> Save Artifact / Retrieval Debug / Memory Outputs
```

### Planner

输入：

- author pack
- theme / style bible
- story outline
- current arc / beat
- current situation
- recent consequences
- recent commercial history

输出的关键不是只有 `chapterGoal`，还包括：

- `searchIntent`
- `commercial`
- `requiredCharacters`
- `requiredMemories`
- `mustHitConflicts`
- `disallowedMoves`

这决定了后面的 retrieval 和 writer 不是盲写。

### Context Builder

当前 writer/reviewer 吃到的上下文不是全量 memory，而是压缩后的 retrieval pack。

核心来源：

- relevant ledgers
- relevant chapter cards
- relevant world facts
- retrieval signals

writer 和 reviewer 吃的 pack 不一样，reviewer 还会再叠 specialized views。

### Reviews

当前 reviews 已拆成三个专科：

- `review_missing_resource`
- `review_fact`
- `review_commercial`

它们不是简单重复看同一坨上下文，而是分别强调：

- 资源和伏笔漏用
- 事实与设定一致性
- hook / payoff / scanability / 章末拉力

### Rewriter

rewriter 不是每章必跑，而是按 review 结果选择模式：

- `repair_first`
- `hybrid_upgrade`
- `commercial_tune`
- `quality_boost`

当前 writer-like 输出路径对 DeepSeek 的空输出会自动重试一次，避免 `rewrite-draft` 或 rewriter 偶发直接炸掉。

### Memory Updater

MemoryUpdater 负责把章节结果投影成：

- `chapterSummary`
- `nextSituation`
- `memoryPatches`
- `newMemories`
- `carryForwardHints`

写回前还会再过一层 validation：

- unknown memory patch 会被丢弃
- duplicate patch 会合并
- 无效角色 id 会清洗
- new memory 会做去重和字段收敛
- 会尝试从正文里抽 evidence snippets

每章都会落：

- `memory_update_validation.json`

## Memory / Retrieval 细节

### 1. Memory Artifacts

当前 memory 输出已经拆分成稳定工件：

- `chapter-cards.json`
- `ledgers/resources.json`
- `ledgers/promises.json`
- `ledgers/injuries.json`
- `ledgers/foreshadows.json`
- `ledgers/relationships.json`
- `ledgers/timeline.json`
- `retrieval/entity-chapter-map.json`
- `retrieval/semantic-index.json`
- `graph/story-graph.json`
- `digests/active-threads.json`

这是后面数据库化的预备结构。

### 2. Retrieval 路数

当前 retrieval 不是单路相似度搜索，而是多路组合：

- exact search
- ledger-first hard recall
- semantic recall
- graph expansion
- hybrid rerank

这是系统最关键的工程点之一。

#### Exact Search

命中对象包括：

- memory
- ledger
- chapter card
- relationship
- character

当前主要靠：

- id
- title
- summary
- tags / notes / trigger conditions
- entity ids

#### Semantic Recall

有两条路径：

- 本地 provider-free 语义索引
- OpenAI-compatible embeddings

默认不配 embedding 时，走本地语义路径。
配了 `NOVELAI_EMBEDDING_MODE=openai_compatible` 时，会优先走远程 embedding，并缓存到：

- `memory/retrieval/embedding-cache.json`

#### Graph Expansion

当前 story graph 还是 lightweight graph，边类型包括：

- `character_memory`
- `character_card`
- `memory_card`
- `character_character`

它的职责不是单独做图推理，而是给 hybrid candidate 加一条多跳召回来源。

#### Hybrid Rerank

当前结果不是“哪路分高就直接用”，而是先并候选，再重排。

reasons 里会记录类似：

- `exact_ledger`
- `semantic_memory`
- `graph_card`
- `requested_ledger_type`
- `high_priority`

这样后续调召回时，至少能解释“为什么这条被选进来了”。

### 3. Specialized Reviewer Retrieval

reviewer 还会吃专科视图：

- `resourceCandidates`
- `relationshipCandidates`

这让 reviewer 不只是看 writer 那一份通用 retrieval pack。

### 4. Retrieval Debug

每章会落一个 retrieval sidecar，帮助排查上下文命中问题：

- `memory/retrieval/chapter-XXX.json`

里面包含：

- `searchIntent`
- `commercial`
- exact hits
- semantic hits
- graph hits
- relevant ledger entries
- relevant chapter cards

## Impact / Rewrite / Regenerate 语义

### 1. Impact

`project impact` 只是分析，不改数据。

输出：

- impacted characters
- impacted memories
- impacted chapters
- impacted arcs
- impacted beats

### 2. Rewrite Plan

`project rewrite-plan` 把 impact 变成操作建议。

核心是：

- 建议从哪一章开始 invalidation
- 哪些章节受影响
- 推荐执行命令

### 3. Invalidate

`chapter invalidate-from` 和 `chapter invalidate-target` 会改 canonical state：

- 删除章节 artifact
- 回滚 chapter plans
- 从 seed memories + 保留章节重新构建 story memories
- 重建 memory outputs

也就是说它不是只删文件，而是会做 memory rebuild。

### 4. Regenerate

`project regenerate-from-target` 是项目级闭环：

```text
impact -> rewrite-plan -> invalidate -> generate -> eval
```

它更适合结构性改动，不适合单纯润色。

## Sidecar Rewrite 机制

### 1. rewrite-draft

`chapter rewrite-draft` 不动 canonical artifact。

它会：

- 读取现有正式章节
- 用当前 plan 和上下文重跑 review / rewriter
- 生成 latest sidecar
- 同时生成 versioned snapshot

### 2. versioned snapshots

每次 `rewrite-draft` 都会生成：

- `draft_rewrite.md`
- `draft_rewrite.json`
- `draft_rewrite_versions/<version>.md`
- `draft_rewrite_versions/<version>.json`

所以 latest 只是兼容入口，历史版是保留的。

### 3. apply-draft-rewrite

`apply-draft-rewrite` 默认 promote latest，也可以指定 `--version`。

promote 之前会先备份：

- `draft_before_promote.md`
- `result_before_promote.json`

当前 promote 只做：

- title
- draft
- writer notes 附加 promote 记录

当前不会自动：

- 改 memory
- 重新跑 reviewer
- 重新跑 retrieval eval

这是一种有意保守的设计，避免“文笔试稿”意外污染 canonical memory。

### 4. compare/select

当前 compare/select 已经有命令层：

- `chapter list-draft-rewrites`
- `chapter inspect-draft-rewrite`
- `chapter apply-draft-rewrite --version`

但还没有 richer diff UI。现在的 inspect 只提供摘要：

- exact match
- first difference line
- line delta
- char delta
- objective

## Retrieval Eval 机制

当前 retrieval eval 是 file-based regression gate。

命令：

- `memory eval-seed`
- `memory eval-run`

用途：

- 生成 planted facts 测试集
- 验证 retrieval 对关键事实的召回
- 对比前后版本的 regression / improvement

章节生成时也可以顺手跑：

- `--with-eval`
- `--strict-eval`

`strict-eval` 会在评测不过时直接失败。

## 一致性与限制

当前系统已经能处理很多实际工作流，但有几个边界要明确：

- `rewrite-draft` 不是事实修正命令，它默认服务于文本迭代
- `apply-draft-rewrite` promote 后不会自动刷新 memory
- `chapter rewrite` 会动 canonical artifact，但只重写该章，不自动重写后续章
- 真正的结构性修改仍然应该走 `regenerate-from-target`
- retrieval 虽然是混合式，但 semantic / graph 仍然是初级版，不该把它们当成绝对真相源

## 推荐工作流

### 工作流 A：从零开始到首章

```powershell
.\run-v1.ps1 project bootstrap --project my-novel
.\run-v1.ps1 outline generate-stack --project my-novel --count 120
.\run-v1.ps1 outline generate-drafts --project my-novel
.\run-v1.ps1 outline approve-detail --project my-novel --approver your-name --note "ok"
.\run-v1.ps1 chapter generate --project my-novel --chapter 1
```

### 工作流 B：连续生成前几章

```powershell
.\run-v1.ps1 chapter generate-first --project my-novel --count 3 --with-eval
```

### 工作流 C：结构性改动后续写

```powershell
.\run-v1.ps1 project regenerate-from-target --project my-novel --target protagonist --count 4 --with-eval
```

### 工作流 D：单章正式重写

```powershell
.\run-v1.ps1 chapter rewrite --project my-novel --chapter 5 --with-eval
```

### 工作流 E：单章草稿迭代

```powershell
.\run-v1.ps1 chapter rewrite-draft --project my-novel --chapter 5
.\run-v1.ps1 chapter list-draft-rewrites --project my-novel --chapter 5
.\run-v1.ps1 chapter inspect-draft-rewrite --project my-novel --chapter 5
.\run-v1.ps1 chapter apply-draft-rewrite --project my-novel --chapter 5
```

## 常用命令

### 项目

初始化项目：

```powershell
.\run-v1.ps1 project bootstrap --project demo_project
```

列出作者预设：

```powershell
.\run-v1.ps1 project profiles
```

基于问答生成作者配置：

```powershell
.\run-v1.ps1 project interview --project demo_project --answers A,B,C,A,B,C
```

查看项目摘要：

```powershell
.\run-v1.ps1 project inspect --project demo_project
```

查看关键路径：

```powershell
.\run-v1.ps1 project paths --project demo_project
```

分析某个 target 的影响范围：

```powershell
.\run-v1.ps1 project impact --project demo_project --target protagonist
```

生成重写计划：

```powershell
.\run-v1.ps1 project rewrite-plan --project demo_project --target protagonist
```

按 target 自动失效并续写：

```powershell
.\run-v1.ps1 project regenerate-from-target --project demo_project --target protagonist --count 4 --with-eval
```

### 大纲

查看 outline：

```powershell
.\run-v1.ps1 outline inspect --project demo_project
```

生成分层大纲：

```powershell
.\run-v1.ps1 outline generate-stack --project demo_project --count 120
```

导出 markdown 草稿：

```powershell
.\run-v1.ps1 outline generate-drafts --project demo_project
```

审批细纲：

```powershell
.\run-v1.ps1 outline approve-detail --project demo_project --approver your-name --note "ok"
```

校验 outline：

```powershell
.\run-v1.ps1 outline validate --project demo_project
```

### 章节生成

生成指定章节：

```powershell
.\run-v1.ps1 chapter generate --project demo_project --chapter 1
```

连续生成前 N 章：

```powershell
.\run-v1.ps1 chapter generate-first --project demo_project --count 3
```

查看章节摘要：

```powershell
.\run-v1.ps1 chapter inspect --project demo_project --chapter 1
```

从某章开始失效：

```powershell
.\run-v1.ps1 chapter invalidate-from --project demo_project --chapter 5
```

按 target 自动失效：

```powershell
.\run-v1.ps1 chapter invalidate-target --project demo_project --target protagonist
```

重置全部章节：

```powershell
.\run-v1.ps1 chapter reset-all --project demo_project
```

### 章节改稿

正式重写单章：

```powershell
.\run-v1.ps1 chapter rewrite --project demo_project --chapter 5 --with-eval
```

非破坏性重写草稿：

```powershell
.\run-v1.ps1 chapter rewrite-draft --project demo_project --chapter 5
```

列出草稿重写版本：

```powershell
.\run-v1.ps1 chapter list-draft-rewrites --project demo_project --chapter 5
```

查看某个草稿重写版本：

```powershell
.\run-v1.ps1 chapter inspect-draft-rewrite --project demo_project --chapter 5 --version <version-id>
```

promote 某个草稿重写版本：

```powershell
.\run-v1.ps1 chapter apply-draft-rewrite --project demo_project --chapter 5 --version <version-id>
```

### Retrieval Eval

生成 eval 集：

```powershell
.\run-v1.ps1 memory eval-seed --project demo_project
```

运行 eval：

```powershell
.\run-v1.ps1 memory eval-run --project demo_project
```

章节生成时顺手跑 eval：

```powershell
.\run-v1.ps1 chapter generate --project demo_project --chapter 9 --with-eval
```

严格模式：

```powershell
.\run-v1.ps1 chapter generate --project demo_project --chapter 9 --strict-eval
```

## 目录结构

典型项目目录：

```text
data/projects/demo_project/
  author-profile.json
  theme-bible.json
  style-bible.json
  story-setup.json
  story-outline.json
  arc-outlines.json
  beat-outlines.json
  cast-outlines.json
  character-states.json
  world-facts.json
  story-memories.json
  chapter-plans.json
  detailed-outline.md
  detailed-outline-approved.json
  memory/
    chapter-cards.json
    ledgers/
    retrieval/
      entity-chapter-map.json
      semantic-index.json
      embedding-cache.json
      chapter-001.json
    graph/
      story-graph.json
    digests/
      active-threads.json
    eval/
      retrieval-eval-set.json
      retrieval-eval-report.json
  impact/
    protagonist.json
    protagonist.rewrite-plan.json
  chapters/
    chapter-001/
      draft.md
      result.json
      memory_update_validation.json
      draft_rewrite.md
      draft_rewrite.json
      draft_rewrite_versions/
      draft_before_promote.md
      result_before_promote.json
```

## Memory / Retrieval

当前 memory 框架已经包括：

- `story-memories.json` 作为长程记忆源
- chapter cards
- structured ledgers
- entity-chapter index
- semantic index
- story graph
- retrieval debug sidecar
- retrieval eval

当前 retrieval 是混合式：

- exact search
- ledger-first deterministic recall
- semantic recall
- graph expansion
- hybrid rerank

当前仍然是 file-first，不是数据库版。

## 改稿与重写

当前有三条不同语义的改稿路径：

### 1. `chapter rewrite`

正式重写。

行为：

- 从该章开始 invalidation
- 只重生成这一章
- 会影响 canonical artifact

适合：

- 当前正式稿本身要被替换
- 这章的 memory 和 chapter result 都应该跟着刷新

### 2. `chapter rewrite-draft`

草稿 sidecar 重写。

行为：

- 不删正式稿
- 不改 canonical memory
- 只生成 sidecar
- 自动保留版本快照

适合：

- 文笔优化
- 商业化节奏微调
- 多版尝试

### 3. `project regenerate-from-target`

结构性重写。

行为：

- 先做 impact
- 再做 rewrite-plan
- 再失效
- 再续写指定章数

适合：

- 角色设定改动
- 关键记忆改动
- 大纲节点改动

## 已实现能力

- 项目级独立配置
- 作者 interview / preset
- 分层 outline
- chapter planning / writing / review / rewrite
- memory updater
- memory writeback validation v1
- retrieval eval
- impact / rewrite-plan / invalidate / regenerate
- 版本化 rewrite-draft + apply/promote

## 仍然是初级版的部分

当前这些功能虽然能用，但还是 v1：

- memory writeback evidence review 仍然是规则型
- semantic retrieval 还没做更强 batch / fallback
- graph expansion 还是 lightweight graph
- retrieval eval 还是 seeded CLI regression
- storage 还是 file-first，不是 SQLite canonical store

详细 roadmap 见：

- [memory-roadmap.md](D:/Code/NovelAi/docs/memory-roadmap.md)

## 相关文件

主入口：

- [v1.ts](D:/Code/NovelAi/src/v1.ts)
- [v1-lib.ts](D:/Code/NovelAi/src/v1-lib.ts)

存储层：

- [project-repository.ts](D:/Code/NovelAi/src/storage/project-repository.ts)
- [file-project-repository.ts](D:/Code/NovelAi/src/storage/file-project-repository.ts)

大纲与章节链路：

- [outline-lib.ts](D:/Code/NovelAi/src/outline-lib.ts)
- [planner.ts](D:/Code/NovelAi/src/prompts/planner.ts)
- [writer.ts](D:/Code/NovelAi/src/prompts/writer.ts)
- [rewriter.ts](D:/Code/NovelAi/src/prompts/rewriter.ts)

memory / retrieval：

- [memory-system.ts](D:/Code/NovelAi/src/domain/memory-system.ts)
- [memory-updater.ts](D:/Code/NovelAi/src/domain/memory-updater.ts)
- [retrieval-eval.ts](D:/Code/NovelAi/src/domain/retrieval-eval.ts)
- [change-impact.ts](D:/Code/NovelAi/src/domain/change-impact.ts)

商业化节奏：

- [payoff-patterns.md](D:/Code/NovelAi/docs/payoff-patterns.md)

## 注意事项

- 章节生成默认要求细纲已审批
- `rewrite-draft` 不会自动修改正式稿，必须显式 `apply-draft-rewrite`
- `apply-draft-rewrite` 当前只 promote 文本和标题，不自动重写 memory
- `--strict-eval` 会在 retrieval eval 未全通过时直接报错
- DeepSeek 偶发空 writer-like 输出时，当前 writer / rewriter 路径会自动重试一次
