# Fanqie Character Benchmark For Episode Plan Lab

## Sources

- Chenggua explains Fanqie's `巅峰榜` as a TOP30 list selected from popularity,
  content quality, reputation score, reader interaction, spread value, and IP
  potential.
  - https://news.chenggua.com/detail/35807.html
- Time Weekly describes Fanqie-originated hot IPs as strongly plot-driven,
  high-density in character portrayal, modular in worldbuilding, and opening
  with immediate explosive hooks and continuous reversals.
  - https://www.time-weekly.com/post/328969
- Fanqie public ranking / discovery pages are used only for high-level theme
  orientation, not chapter text copying.
  - https://tt.sjmyzq.cn/

## Practical Reading

For our planner, "good character writing" should not mean long biography.
In fast webnovel openings, a character becomes memorable when the first 10-20
chapters repeatedly prove:

```text
label -> competence proof -> contradiction -> cost -> social reaction
```

Examples by commercial type:

- 749 containment protagonist:
  - label: 实习生，但敢贴脸收容怪物
  - competence proof: 第一只异常别人撤退，他主动处理
  - contradiction: 越想自由杀怪，越需要官方执照
  - cost: 被官方体系记录和考核
  - social reaction: 749从怀疑到吸纳

- game-opportunity protagonist:
  - label: 抢男女主机缘的未来情报掠夺者
  - competence proof: 第一隐藏职业先于原男主到手
  - contradiction: 越抢越强，也越公开暴露
  - cost: 系统公告把她推成公敌
  - social reaction: 原主角/公会/观察者同步反应

- borrowed-photo romance heroine:
  - label: 盗图骗局接盘者
  - competence proof: 第一场见面危机靠临场谎言活下来
  - contradiction: 想坦白求生，但坦白会死得更快
  - cost: 每拖一次，钱债/情债/暴露风险都加深
  - social reaction: 男主更感兴趣，舍友风险更近

- time-stop protagonist:
  - label: 只有一分钟的疯赌徒
  - competence proof: 用一分钟完成不可能反杀
  - contradiction: 能力越强，预算越短，越不能浪费
  - cost: 时停耗尽后的空窗
  - social reaction: 旁观者从嘲笑到承认

## Schema Upgrade

I added `character_threads[].characterPayload`:

```ts
characterPayload?: {
  hookLabel: string;
  surfaceMask: string;
  coreDrive: string;
  innerContradiction: string;
  competenceProof: string;
  vulnerabilityCost: string;
  readerDesireHook: string;
  relationshipLeverage: string;
  iconicBehavior: string;
  oocGuard: string;
}
```

Field intent:

- `hookLabel`: one-line reader memory hook.
- `surfaceMask`: what the character looks like from outside.
- `coreDrive`: what actually pushes them.
- `innerContradiction`: the contradiction that creates repeated pressure.
- `competenceProof`: first 1-3 events proving they deserve attention.
- `vulnerabilityCost`: what this character pays when they act.
- `readerDesireHook`: why readers want this character to appear again.
- `relationshipLeverage`: how they pressure or tempt another character.
- `iconicBehavior`: repeatable behavior readers can recognize.
- `oocGuard`: what they must not do, or the character collapses.

## Why This Matters

The previous `character_threads` could say:

```text
陆承砚线：被截胡与身份威胁
```

That is functional but thin. With `characterPayload`, the planner must answer:

```text
Why does the reader remember him?
What does he do on-page that proves his role?
How does he retaliate without becoming generic?
What behavior would be OOC?
```

This moves character planning from "cast role" to "reader-facing pressure
engine."

## Evaluator Change

The simple evaluator now warns when:

- a character thread lacks `characterPayload`
- the payload exists but key fields are too weak:
  - `hookLabel`
  - `innerContradiction`
  - `competenceProof`
  - `readerDesireHook`
  - `iconicBehavior`
  - `oocGuard`

This is intentionally still light. The final decision remains human review,
because whether a label is actually memorable is taste- and genre-dependent.
