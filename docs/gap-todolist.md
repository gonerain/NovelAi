# 未闭环与回流缺口 — 优先级 Todolist

> 统计时间：2026-05-06  
> 基于实测：检查了 data/projects/0417 的实际 JSON 输出，非推测

---

## P1 — 直接影响生成质量（高优先）

### 1. `protagonistGain` 从未被填充
- **位置**：`ChapterScenePlan.protagonistGain`（类型里有，P15加的）
- **实测**：ch1-24 所有 scene plans 该字段均 MISSING
- **后果**：opening-arc pairing rule（每对章节至少1个非null gain）完全失效，加了等于没加
- **修复**：检查 `src/prompts/scene-decomposer.ts` 的 schema 输出样例，确认 `protagonistGain` 在 JSON schema 中是必填而非可选

### 2. `arcShiftRef` 从未被填充  
- **位置**：`ChapterScenePlan.arcShiftRef`（类型里有，schema 里有）
- **实测**：ch1-24 所有 scene plans 该字段均 MISSING
- **后果**：scene plan 无法绑定到具体的弧线转折点；planner 不知道"这章应推进 shift_escape_01"，只能靠 expectedChapterRange 软提示
- **修复**：scene-decomposer prompt 中明确 arcShiftRef 是必填输出；若章节不在任何 shift 的 range 内则填 null

### 3. `scaffoldRole` 概念在 scene plans 中不存在
- **位置**：`ChapterScenePlan`（类型里无此字段）
- **现状**：8章共用一个 beatGoal，scene decomposer 没有被要求先分配章节角色（发现/验证/转折/巩固/…）
- **后果**：8章都选择"再试一次"，是 ch1-6 同质化的根本原因
- **修复**：`ChapterScenePlan` 加 `scaffoldRole: "discovery" | "escalation" | "pivot" | "consolidation" | "bridge" | "payoff"`；scene decomposer 先分配角色再填内容，prompt 要求同一 beat 内角色不重复

### 4. Supporting character shift 为软约束，无硬性执行
- **位置**：`src/prompts/planner.ts`（shifts 确实传入了，但仅为 prompt 文本提示）
- **实测后果**：ch10/ch14/ch16/ch19 陆承砚内心脆弱提前暴露，chapter-plan-audit 明确指出
- **根因**：planner 看到 `shift_escape_lu_01: expectedChapterRange=9-16, oldDefault=保持压迫源`，但这只是 prompt 文字，LLM 仍可忽略
- **修复**：planner prompt 加硬性规则："若当前章节 < shift.expectedChapterRange.start，角色的 newChoice/costPaid 内容**禁止**出现在正文中；只允许 oldDefault 行为模式"

### 5. `chapter-plan-audit` 无结构化回流
- **位置**：`src/v1-audit.ts` → `auditChapterPlan()`
- **现状**：输出 markdown 散文，无机器可读的修复指令
- **后果**：每次诊断都是人工死胡同；发现"ch10洗白过早"需要人工判断如何 invalidate + 怎么改 scene plan
- **修复**：审计输出加结构化字段：`fixActions: Array<{chapterNumber, action: "invalidate"|"patch_scene_plan", reason, suggestion}>`；对应加 `chapter:apply-audit-fixes` 命令

---

## P2 — 数据完整性 / 中影响

### 6. `arc.beatIds` 与 `beat:regen` 后的实际 beat ID 不一致
- **实测**：`arc_escape.beatIds = ["beat_arc_escape_1/2/3/4"]`，实际 beat IDs = `["beat_escape_001/002/003"]`
- **现状**：功能代码用 `arcId` filter 而非 `beatIds` 查找 beats，所以不 block 生成，但数据已损坏
- **修复**：`beat:regen` 完成后同步更新 `arc.beatIds`；或在 `decomposeChapterScenesForProject` 里加启动校验

### 7. Planner 收到全部 arc shifts 但不知道当前章节"应推进哪个 shift"
- **位置**：`src/prompts/planner.ts`（已传入所有 shifts + expectedChapterRange）
- **现状**：planner 需要自己推断"ch10 应推进 shift_escape_lu_01"，依赖 LLM 正确关联 range
- **修复**：在调用 planner 前，主调代码根据 `chapterNumber` 匹配 `expectedChapterRange`，显式传入 `activeShifts: ArcShift[]`（当前章节所在 range 的 shifts），而非全量 shifts

### 8. `beat:audit-pacing --apply-fixes` 存在但从未使用
- **位置**：`src/v1-audit.ts` → `applyFixes` 参数
- **现状**：功能已实现（会把 rewrittenBeats 写回 beat-outlines.json），但 `v1.ts` 的 `beat:audit-pacing` handler 未传 `--force` → `applyFixes`
- **修复**：`beat:audit-pacing --apply` 映射到 `applyFixes: true`（1行改动）

### 9. `outline:inspect-reveals` 未纳入 beat:regen 后的常规检查流程
- **现状**：beat 重生后 revealItems 的 dueChapter 可能失效，但没有自动触发 inspect
- **修复**：`beat:regen` 完成后自动打印 `inspect-reveals` 摘要

---

## P3 — 架构改进（低紧迫，高长期价值）

### 10. Scene plans 无 `generatedFrom` + `contentHash`
- **现状**：beat 改了不知道哪些 scene plans 是 stale
- **修复**：`ChapterScenePlan` 加 `generatedFrom: {beatId, beatHash}` + `stale?: true`

### 11. Chapter plans 无版本追踪
- **现状**：scene plan 改了不知道哪些 chapter plans 是 stale
- **修复**：`ChapterPlan` 加 `generatedFrom: {scenePlanHash}` + `stale?: true`

### 12. 无级联失效传播
- **现状**：beat → scene plan → chapter plan 三层，任一层改动不会向下传播 stale 标记
- **修复**：`invalidateFromChapter` 扩展为 `propagateStaleness(entityType, entityId)`，从 beat 一路标记到 chapter plan

### 13. 缺少 arcShift compliance reviewer（Tier 4）
- **现状**：chapter 生成后有 3 个 reviewer（missing / fact / role-driven），但无人检查"这章是否推进了应推进的 arcShift"
- **修复**：加第 4 个 reviewer：`arc-shift-compliance-review`，输入当前章节的 activeShifts，检查草稿是否兑现了 newChoice / costPaid

### 14. Memory-updater 无回流到 scene plans
- **现状**：writer 如果偏离了 scene plan，scene plan 不会被更新
- **影响**：低（scene plan 只是指导，不是约束）
- **修复**：memory-updater 结果里加 `scenePlanDeviation?: string`，供下次 decompose 参考

---

## 统计

| 优先级 | 数量 | 核心主题 |
|--------|------|----------|
| P1 | 5项 | 字段未填充 / 约束形同虚设 / 审计死胡同 |
| P2 | 4项 | 数据不一致 / 软约束强化 / 工具未接通 |
| P3 | 5项 | 版本追踪 / 级联失效 / 架构完善 |

**最高杠杆的单项修复**：P1#3（加 `scaffoldRole`）+ P1#4（hardening supporting character shifts）  
这两项解决的是"同质化"和"洗白过早"两个最明显的生成质量问题，且都只需改 prompt + schema，不需要重构架构。
