# 项目 Pipeline 架构图

> 生成时间：2026-05-06

---

## 一、整体 Pipeline（从构思到正文）

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 0 — 故事设计（人工主导）                                        │
│                                                                     │
│  project:interview  ──→  project:bootstrap                          │
│                              ↓                                      │
│                      story-outline.json                             │
│                      theme-bible.json                               │
│                      world-facts.json  ← [人工加 minRevealArc]      │
│                      cast-outlines.json                             │
│                      author-profile.json                            │
│                      style-bible.json                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 1 — 弧线与节拍（LLM生成，人工审核）                            │
│                                                                     │
│  outline:generate-stack                                             │
│    ├→ arc-outlines.json    [5个弧，每个含 protagonistArc.shifts]    │
│    └→ beat-outlines.json   [19个节拍，每个含 revealTargets]         │
│                                                                     │
│  beat:audit-pacing [--arc] ──→ audits/beat-pacing-audit_*.md       │
│  beat:regen [--arc]        ──→ beat-outlines.json (覆写目标弧)      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 2 — 场景分解（每 beat → 8个章节场景计划）                       │
│                                                                     │
│  outline:decompose-chapters [--beat beat_xxx]                       │
│    读取: beat-outlines.json                                         │
│    ✗ 未读取: arc-outlines.protagonistArc.shifts  ← ⚠️ 断路          │
│    ✗ 未读取: arc-outlines.supportingCharacterArcs ← ⚠️ 断路        │
│    写入: scene-plans.json                                           │
│                                                                     │
│  每个 ChapterScenePlan 含:                                          │
│    chapterNumber, beatId, scaffoldRole, microShift,                 │
│    keyAction, protagonistGain (新增)                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3 — 章节计划（每章 ~1次LLM调用）                               │
│                                                                     │
│  chapter:generate-first [--count N]                                 │
│    读取: scene-plans.json + beat-outlines.json                      │
│    读取: 前N章的 story-memories (记忆系统)                           │
│    ✗ 未读取: arc shifts的 expectedChapterRange  ← ⚠️ 断路           │
│    写入: chapter-plans.json (append)                                │
│                                                                     │
│  outline:audit [--from N --count M]                                 │
│    → audits/chapter-plan-audit_*.md  (只读，无回流)  ← ⚠️ 死胡同    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 4 — 章节生成（每章 4~7次LLM调用）                              │
│                                                                     │
│  chapter:generate [--chapter N]  或  chapter:generate-first         │
│    ├─ [1] episode:plan    → episode_packet.json (场次拆分)           │
│    ├─ [2] planner         → chapter-plans.json (详细计划)            │
│    ├─ [3] writer          → draft.md                                │
│    ├─ [4] reviewer×3      → missing / fact / role-driven            │
│    ├─ [5] rewriter?       → draft.md (如reviewer发现问题)            │
│    ├─ [6] memory-updater  → story-memories.json (更新记忆)           │
│    └─ [7] threads:update  → narrative-threads.json                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、实体关系图（数据模型）

```
story-outline (1)
    │ majorArcIds[]
    ▼
arc-outline (5)
    │ beatIds[]        ← ⚠️ 生产的beat IDs与beat文件里的ID不一致（regen后失效）
    │ protagonistArc
    │   └─ shifts[]   ← ⚠️ 从未流入下游
    │ supportingCharacterArcs[]
    │   └─ shifts[]   ← ⚠️ 从未流入下游
    ▼
beat-outline (19)
    │ arcId ──────────────────────────→ arc-outline
    │ worldFactIds[]
    │   └─────────────────────────────→ world-fact
    │ chapterRangeHint {start, end}
    │ revealItems[]
    │   └─ dueChapter
    ▼
scene-plan / ChapterScenePlan (8 per beat = 152 total)
    │ beatId ─────────────────────────→ beat-outline
    │ chapterNumber
    │ protagonistGain? (新增)
    │
    │ ⚠️ 无 generatedFrom hash
    │ ⚠️ 无 stale 标记
    ▼
chapter-plan / ChapterPlan (N)
    │ chapterNumber
    │ arcId ──────────────────────────→ arc-outline
    │ beatId ─────────────────────────→ beat-outline
    │ mustHitConflicts[]
    │ searchIntent
    │
    │ ⚠️ 无 generatedFrom hash
    │ ⚠️ 无 stale 标记
    ▼
chapter-artifact / ChapterArtifact (per chapter dir)
    ├─ draft.md
    ├─ episode_packet.json
    ├─ result.json         (plannerResult + writerResult)
    ├─ relationship_shift.json
    ├─ consequence_edges.json
    ├─ decision_log.json
    ├─ thread_update_report.json
    └─ memory_update_validation.json

world-fact (8)
    │ minRevealArc ───────────────────→ arc-outline  (A约束)
    │ labelVocabulary[]               (beat生成时的禁词)
    └─ relatedCharacterIds[]

story-memory (累积)
    │ 每章生成后由 memory-updater 追加
    └─ 供下一章的 writer 读取
```

---

## 三、章节生成内部流程（Tier 4 详细）

```
输入: chapterNumber N
      ├─ chapter-plans.json [N]
      ├─ scene-plans.json [N]
      ├─ beat-outlines.json [current beat]
      ├─ arc-outlines.json [current arc]
      ├─ story-memories.json [最近M条]
      ├─ character-states.json
      └─ narrative-threads.json

        ↓
  [episode:plan]  ── 把chapter plan拆成3-5个场次
        ↓
  episode_packet.json

        ↓
  [planner]  ── 生成详细章节计划
    读取: episode_packet + scene_plan + beat + arc + memories
    ✗ 未读取: arc protagonistArc.shifts  ← ⚠️
    输出: mustHitConflicts[], searchIntent, commercialPlan
        ↓
  chapter-plans.json (更新)

        ↓
  [writer]  ── 生成正文草稿
    读取: 完整 chapter plan + context pack (memories + character states)
    输出: draft (~3000字)
        ↓
  draft.md (v1)

        ↓
  ┌─────────────────────────────────┐
  │  [reviewer × 3] 并行           │
  │  ├─ missing-resource-review     │
  │  ├─ fact-consistency-review     │
  │  └─ role-driven-review         │
  └──────────────┬──────────────────┘
                 ↓
         blocking issues?
         YES ─→ [rewriter] → draft.md (v2)
         NO  ─→ 跳过

        ↓
  [memory-updater]  ── 更新记忆
    读取: draft + chapter plan
    写入: story-memories.json (append)
          character-states.json (diff)

        ↓
  [threads:update]  ── 更新叙事线程
        ↓
  thread_update_report.json

输出: chapters/chapter-NNN/
  draft.md, result.json, episode_packet.json,
  relationship_shift.json, consequence_edges.json,
  decision_log.json, memory_update_validation.json
```

---

## 四、当前断路图（问题地图）

```
                        已有 ✓        断路 ✗        死胡同 ↩
                        ────────────────────────────────────

arc-outline.protagonistArc.shifts
    └─ expectedChapterRange {1-8}
    └─ pressureTrigger
    └─ newChoice / costPaid
         ✗ ──────────────────→  scene-decomposer   (shifts从未传入)
         ✗ ──────────────────→  planner            (shifts从未传入)

arc-outline.supportingCharacterArcs.shifts
    └─ 陆承砚: ch9-16保持压迫源 (不洗白)
         ✗ ──────────────────→  planner            (未传入，导致ch10/14/16洗白)

beat-outline (regen后)
    └─ id: "beat_escape_001"
         ✗ ──────────────────→  arc-outline.beatIds (仍是旧ID，已失效)

beat-pacing-audit
    └─ 输出: audits/beat-pacing-audit_*.md
         ↩ ──────────────────→  beat-outlines.json  (有--apply-fixes但未用)

chapter-plan-audit
    └─ 输出: audits/chapter-plan-audit_*.md (详细诊断)
         ↩  (无任何自动回流)
         ↩  (人工才能根据诊断决定invalidate哪些章节)

scene-plan / chapter-plan
    └─ 无 generatedFrom + contentHash
         ✗  (beat改了不知道哪些scene-plan要重生成)
         ✗  (scene-plan改了不知道哪些chapter-plan要重生成)
```

---

## 五、命令速查（按功能分层）

| 层级 | 命令 | 作用 |
|------|------|------|
| 故事设计 | `project:interview` | 生成故事前提访谈 |
| | `project:bootstrap` | 初始化所有基础文件 |
| | `bible:fill-decision-profiles` | 填充角色决策画像 |
| | `bible:derive-arc-shifts` | 导出弧线转折 |
| | `bible:bind-world-facts` | 绑定世界设定 |
| 弧线/节拍 | `outline:generate-stack` | 生成 arc + beat |
| | `beat:regen --arc <id>` | 重新生成某弧节拍 |
| | `beat:audit-pacing --arc <id>` | 节拍节奏审计 |
| | `outline:inspect-reveals` | 检查信息释放时间线 |
| 场景分解 | `outline:decompose-chapters [--beat <id>] [--force]` | beat → 场景计划 |
| 章节计划 | `chapter:generate-first [--count N]` | 批量生成章节计划 |
| | `outline:audit --from N --count M [--no-drafts]` | 章节计划审计 |
| 章节生成 | `chapter:generate --chapter N` | 生成单章正文 |
| | `chapter:rewrite --chapter N` | 重写某章 |
| | `chapter:inspect --chapter N` | 查看章节详情 |
| 无效化 | `chapter:invalidate-from --chapter N` | 从第N章起清空计划 |

---

## 六、三条最重要的断路（优先修复顺序）

| 优先级 | 断路 | 影响 | 修复方式 |
|--------|------|------|----------|
| P1 | `arc shifts → scene-decomposer / planner` | 全部120章的角色弧线不受控 | 数据流改造：传入 protagonistArc.shifts + supportingCharacterArcs.shifts |
| P2 | `chapter-plan-audit → fix` | 审计永远是死胡同 | 审计输出结构化 fix actions，支持 invalidate + regen |
| P3 | `entity版本追踪缺失` | 上游改了不知道下游哪些要重生` | 每个实体加 `generatedFrom[]` + `contentHash` + `stale` 字段 |
