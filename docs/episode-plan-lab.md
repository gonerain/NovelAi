# Episode Plan Lab

## 最小现状审计

当前正式链路仍是：

1. `outline generate-stack`
   - 入口：`src/outline-lib.ts`
   - 产物：`story-outline.json`、`cast-outlines.json`、`arc-outlines.json`、`beat-outlines.json`
   - 问题：`beat-outlines.json` 仍承担章节区间脚手架职责。

2. `chapter generate`
   - 入口：`src/v1-chapter-generation.ts`
   - 逻辑：按章节号选 `arc/beat`，生成 `EpisodePacket`，再让 planner 生成单章 `ChapterPlan`
   - 问题：章节计划是每章即时产物，不是篇章级核心产物。

3. `chapter-plans.json`
   - 保存点：章节生成成功后追加/替换
   - 问题：它记录单章 planner 结果，但没有先验的“篇章章节计划组”。

本实验链路不替换上述正式链路，只新增独立探索入口。

## 最小核心产物

本轮只定义 5 个产物：

1. `episode_outline`
   - 篇章级叙事容器
   - 必须有外部事件容器、中心压力、多方势力、读者承诺、升级阶梯

2. `character_threads`
   - 人物线
   - 每条线必须说明它如何被篇章外部事件逼迫、碰撞、转向

3. `world_rule_tracks`
   - 世界观规则线
   - 世界规则必须制造剧情压力，不能只是解释设定

4. `event_pool`
   - 可写事件池
   - 事件来自“篇章容器 + 人物线 + 世界规则线”的碰撞

5. `episode_chapter_plan_set`
   - 篇章章节计划组
   - 每章从事件池取事件，必须有 hook、collision、turn、payoff、cost、endHook

## 运行方式

先 build：

```bash
npm run build
```

只导出 prompt，不调用 LLM：

```bash
npm run episode-plan-lab -- --project demo_project --from 1 --to 8 --dry-run
```

调用 LLM 生成实验产物：

```bash
npm run episode-plan-lab -- --project demo_project --from 1 --to 8
```

用爆款题材 preset 试验，不改项目原文件：

```bash
npm run episode-plan-lab -- --project demo_project --from 1 --to 10 --episode game-v1 --theme-preset game_invasion_opportunity --max-tokens 16000
```

长篇章输出被截断时可以提高输出上限：

```bash
npm run episode-plan-lab -- --project demo_project --from 1 --to 8 --max-tokens 16000
```

只刷新已有结果的自动评估和人评报告，不重新调用 LLM：

```bash
npm run episode-plan-lab -- --project demo_project --from 1 --to 8 --eval-only
```

输出目录：

```text
data/projects/<project-id>/episode-plan-lab/<episode-id>/
```

核心输出：

- `prompt.json`
- `episode-plan-lab.result.json`
- `episode-plan-lab.eval.json`
- `human-review.md`

## 评估策略

自动评估先保持简单，只做结构初筛：

- 章节计划是否为空
- 章节号是否重复
- 每章是否引用事件池
- 事件、人物线、世界规则线引用是否存在
- 人物 id、世界规则 id 是否能对回当前项目
- 事件类型是否过于单一
- stage 是否过于抽象，缺少外部事件阶段感
- eventType 是否落在建议集合内
- `genrePayload.readerSettlement` 是否覆盖事件商业结算
- 题材是否有至少一种专用账本：`statusGate` / `ownershipTransfer` / `lieState` / `abilityBudget`
- 每章是否有开章钩子和章末钩子
- 中心碰撞和可见爽点是否具体
- 人物线、世界规则线、事件池数量是否明显不足

真正质量判断交给人评：

- 篇章外部事件是否足够清楚、有压迫感
- 人物线是否真的和事件/规则碰撞
- 世界规则是否制造剧情，而不是信息说明
- 每章是否像可写场景，不是摘要
- 多数网文读者是否会想继续看下一章
