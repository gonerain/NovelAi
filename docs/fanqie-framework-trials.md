# Fanqie Theme Trials With Episode Plan Lab

This is a framework trial, not a text archive. It uses hot-novel public themes,
official synopses, chapter titles, and opening-container patterns to test
whether the 5-product `episode-plan-lab` structure can model different
commercial webnovel openings.

The 5 products are:

```text
episode_outline
character_threads
world_rule_tracks
event_pool
episode_chapter_plan_set
```

## Trial A: 749 Monster Containment Opening

Reference theme: college internship unexpectedly enters an abnormal containment
system. Public chapter-title progression suggests: golden finger finally usable,
first containment reward, 749 arrival, joining / assessment, arena dominance,
first formal mission.

### episode_outline

```json
{
  "id": "trial-749-onboarding",
  "title": "大一实习生的749入职考",
  "chapterRange": { "start": 1, "end": 12 },
  "externalEventContainer": "工地异常物出土后，749机构介入，主角从旁观学生被推入异常收容体系，并在入职考核中证明自己不是普通人。",
  "centralPressure": "他想要一个能使用二十年金手指的机会，749想判断他是可吸纳人才还是危险异常。",
  "factions": ["主角", "749调查员", "候选实习生/考核者", "第一批异常怪物"],
  "readerPromises": ["第一章就遇怪", "杀伐果断", "收容即奖励", "官方体系承认主角实力"],
  "escalationLadder": ["工地怪物出土", "主角主动上前", "收容奖励兑现", "749上门", "福利诱惑", "考核碾压", "正式任务"],
  "doNotResolveYet": ["金手指完整机制", "749高层真实目的", "异常源头"]
}
```

### character_threads

- `thread-protagonist-validation`: 主角从“等了二十年没机会”转成“终于有怪可杀”，读者问题是他到底能不能被官方体系承认。
- `thread-749-institution`: 749既是资源入口也是控制压力，读者问题是机构会奖励他还是约束他。
- `thread-peer-comparison`: 同期考核者/正式调查员用来衬托主角速度和狠度。

### world_rule_tracks

- `world-rule-containment-reward`: 怪物不是纯威胁，收容/击杀会兑换能力、术法或身份。
- `world-rule-official-license`: 749证件把暴力合法化，也把主角纳入制度考核。
- `world-rule-abnormal-taxonomy`: 每个怪物有规则和弱点，越早展示越能制造后续期待。

### event_pool

| id | type | stage | event |
| --- | --- | --- | --- |
| e1 | discovery | 工地出土 | 工地挖出流血石头，其他人逃，主角靠近 |
| e2 | confrontation | 第一收容 | 主角用粗暴方式处理异常，触发金手指 |
| e3 | payoff | 奖励兑现 | 第一个能力/术法到账，证明杀怪有收益 |
| e4 | encounter | 749到场 | 官方人员确认现场，注意到主角 |
| e5 | rule_pressure | 入职邀请 | 749给出待遇、风险、约束 |
| e6 | test | 入职考核 | 主角要求立刻考核 |
| e7 | payoff | 考场碾压 | 他用新能力压过同届/标准 |
| e8 | arrival | 正式任务 | 第一个任务派发，进入更大怪物网络 |

### episode_chapter_plan_set

| chapter | goal | collision | payoff | end hook |
| --- | --- | --- | --- | --- |
| 1 | 工地见怪 | 所有人逃，主角主动上前 | 怪物真实存在 | 石头流血并回应他 |
| 2 | 第一次收容 | 普通工具 vs 异常规则 | 金手指终于能用 | 奖励提示出现 |
| 3 | 第二只怪验证 | 证明不是偶然 | 能力可叠加 | 749车队到场 |
| 4 | 官方介入 | 主角行为被质询 | 体系入口出现 | 749开出条件 |
| 5 | 入职选择 | 自由杀怪 vs 受制度管理 | 福利/证件诱惑 | 主角要求马上考 |
| 6 | 考核开场 | 考官低估他 | 爽点：反压考场 | 难度升级 |
| 7 | 考核乱杀 | 标准流程挡不住他 | 取得官方承认 | 第一个任务急调 |
| 8 | 任务出发 | 新队友怀疑他 | 主角拿到执照/权限 | 任务现场更危险 |
| 9-12 | 第一任务 | 怪物规则逐层揭开 | 收容第二轮奖励 | 更大异常组织/源头露头 |

### Framework Verdict

The framework works well here because the opening naturally has a strong
container: `official onboarding + assessment`. The key schema field that matters
most is `world_rule_tracks`: without reward / license / taxonomy, the plan
degrades into ordinary打怪.

## Trial B: Game Invasion / Stealing Opportunities

Reference theme: protagonist knows future/book plot, enters a limited beta or
early game window, steals resources from canon protagonists before game invasion.

### episode_outline

```json
{
  "id": "trial-game-beta-opportunity-race",
  "title": "十日内测抢机缘",
  "chapterRange": { "start": 1, "end": 16 },
  "externalEventContainer": "游戏入侵现实前的短期内测窗口，隐藏职业、首杀、道具和地图资源都存在首次归属，主角必须赶在男女主和公会前抢走关键机缘。",
  "centralPressure": "每个资源都有原定主人；主角抢得越多，未来优势越大，仇恨也越早形成。",
  "factions": ["重生/穿书主角", "原男主", "原女主/女二", "公会势力", "游戏系统"],
  "readerPromises": ["未来信息变现", "连续截胡", "资源归属反转", "原主角崩盘"],
  "escalationLadder": ["觉醒身份", "识别第一个机缘", "抢隐藏职业", "抢首杀", "创造记录", "误导男主", "公会寻仇"],
  "doNotResolveYet": ["游戏入侵真相", "神明/系统最终目的", "主角是否会成为新反派"]
}
```

### character_threads

- `thread-opportunity-predator`: 主角从炮灰/恶毒身份转成机会掠夺者。
- `thread-canon-male-lead-loss`: 原男主失去资源后的反应，是持续压力来源。
- `thread-guild-retaliation`: 公会/玩家社会把个人抢机缘扩大成公共冲突。

### world_rule_tracks

- `world-rule-first-claim`: 首杀、隐藏职业、地图首通有唯一性。
- `world-rule-future-compound`: 内测收益会在游戏入侵现实后复利。
- `world-rule-system-record`: 系统公告让隐秘行为变成公共名声。

### event_pool

| id | type | stage | event |
| --- | --- | --- | --- |
| e1 | discovery | 穿书醒悟 | 主角确认自己是炮灰/反派 |
| e2 | rule_pressure | 十日内测开启 | 有限时间窗口开始 |
| e3 | attempt | 抢隐藏职业 | 主角赶往原男主机缘点 |
| e4 | payoff | 职业到手 | 原男主未来路线被截断 |
| e5 | confrontation | 首杀竞争 | 主角争夺首杀/记录 |
| e6 | payoff | 系统公告 | 名字暴露，声望/仇恨同时上升 |
| e7 | betrayal | 误导男主 | 利用剧情知识让男主走错路 |
| e8 | encounter | 女主机缘 | 第二条资源线开启 |
| e9 | crisis | 公会围堵 | 私人截胡升级为组织压力 |
| e10 | payoff | 反包围 | 主角把围堵变成刷资源场 |

### episode_chapter_plan_set

| chapter | goal | collision | payoff | end hook |
| --- | --- | --- | --- | --- |
| 1 | 确认穿书/重生 | 自己是炮灰，未来会死 | 未来知识到账 | 内测倒计时 |
| 2 | 第一机缘定位 | 原男主也在靠近 | 抢到隐藏入口 | 系统提示唯一职业 |
| 3 | 完成职业试炼 | 规则克制当前能力 | 职业觉醒 | 原男主错过窗口 |
| 4 | 首杀准备 | 资源不足/时间不足 | 用未来知识绕过流程 | Boss刷新 |
| 5 | 首杀争夺 | 其他玩家插手 | 首杀公告 | 名字上榜 |
| 6 | 记录创造 | 系统公开他的异常速度 | 奖励加倍 | 公会锁定他 |
| 7 | 针对男主 | 男主开始察觉不对 | 成功误导 | 男主获得错误线索 |
| 8 | 第二机缘 | 女主/女二线介入 | 再次截胡 | 原剧情彻底偏移 |
| 9-12 | 公会围堵 | 私人优势变成群体敌意 | 反围剿/新技能 | 更高级地图开启 |
| 13-16 | 更大地图 | 资源争夺升级 | 建立新名号 | 游戏入侵现实信号 |

### Framework Verdict

The framework exposes a useful missing field: `ownershipTransfer`. For this
genre, each event should say: expected owner, actual owner, retaliation created.
This should likely become an optional `event_pool` field later.

## Trial C: Borrowed-Photo Wealthy-Heir Romance

Reference theme:穿书女主 inherits a borrowed-photo online romance scam. The
male lead wants to meet; money debt, identity debt, and death-fate pressure
force her to keep delaying.

### episode_outline

```json
{
  "id": "trial-photo-romance-deadline",
  "title": "网恋照片要线下见面",
  "chapterRange": { "start": 1, "end": 12 },
  "externalEventContainer": "网恋对象提出见面，女主发现原主盗用舍友照片骗了财阀继承人，既不能立刻坦白，也很难立刻还钱，只能在见面倒计时中不断拖延和补谎。",
  "centralPressure": "见面越近，照片身份、钱债、原书死亡结局越同时逼近。",
  "factions": ["穿书女主", "财阀继承人", "被盗照片的舍友", "原书剧情", "校园社交圈"],
  "readerPromises": ["高压谎言喜剧", "钱债诱惑", "男主可能早知道", "每次拖延都更危险"],
  "escalationLadder": ["醒来收到见面信息", "确认盗图骗钱", "死亡结局压迫", "决定拖延", "钱款继续到账", "舍友照片风险", "第一次近距离错身", "男主露出知道的迹象"],
  "doNotResolveYet": ["男主到底知道多少", "真实身份何时暴露", "舍友会不会发现"]
}
```

### character_threads

- `thread-heroine-delay`: 女主从接盘债务到主动经营拖延策略。
- `thread-heir-hunter`: 男主表面被哄，实际可能控制节奏。
- `thread-roommate-photo-owner`: 舍友作为身份原件，随时可能让谎言塌方。

### world_rule_tracks

- `world-rule-book-fate`: 原书死亡结局给每个选择加死亡倒计时。
- `world-rule-online-identity`: 照片、聊天记录、转账记录构成脆弱身份。
- `world-rule-wealth-power`: 财阀继承人的资源不只是钱，也是追踪和惩罚能力。

### event_pool

| id | type | stage | event |
| --- | --- | --- | --- |
| e1 | discovery | 宿舍醒来 | 女主醒来看到见面消息 |
| e2 | discovery | 原书记忆 | 确认自己活不过三章 |
| e3 | rule_pressure | 转账债务 | 聊天记录和转账记录证明钱还不上 |
| e4 | attempt | 第一次拖延 | 编病/忙碌理由拖住见面 |
| e5 | payoff | 新转账到账 | 缓解债务但加深骗局 |
| e6 | crisis | 舍友照片风险 | 舍友出现，照片身份可能撞车 |
| e7 | encounter | 近距离错身 | 男主来到学校/附近 |
| e8 | confrontation | 试探消息 | 男主抛出只有真人才知道的问题 |
| e9 | setback | 谎言补丁 | 女主临场补谎成功但留下漏洞 |
| e10 | reveal | 他可能知道 | 男主的反应暗示他并非完全被骗 |

### episode_chapter_plan_set

| chapter | goal | collision | payoff | end hook |
| --- | --- | --- | --- | --- |
| 1 | 醒来接盘 | 对方要求见面 | 高压设定立住 | 男主又转账 |
| 2 | 梳理死局 | 钱债、盗图、死亡结局叠压 | 女主决定先拖 | 见面时间被定下 |
| 3 | 第一次拖延 | 理由太假可能穿帮 | 短暂逃过 | 男主说要来学校 |
| 4 | 照片原主出现 | 舍友和照片高度绑定 | 校园身份风险 | 舍友看见聊天头像 |
| 5 | 钱的诱惑 | 还钱无路，继续骗有风险 | 喜剧性继续糊弄 | 新礼物寄到宿舍 |
| 6 | 近距离错身 | 男主到校，女主不能露脸 | 心跳错位/躲藏爽点 | 男主停在她背后 |
| 7 | 在线试探 | 男主问细节 | 女主补谎成功 | 男主露出异常笑意 |
| 8 | 舍友危机 | 舍友要借手机/看照片 | 女主护住谎言 | 舍友接到陌生电话 |
| 9-12 | 第一次半见面 | 见面不可避免 | 男主确认某个线索 | 他可能已经知道 |

### Framework Verdict

The framework also works for female-oriented comedy romance, but the definition
of payoff changes. Payoff is not victory; it is "survived one more lie, debt got
worse, attraction increased." The evaluator should not require combat/resource
reward for every genre.

## Trial D: Time-Stop Wasteland

Reference theme: protagonist has one minute of daily time stop in a dangerous
future wasteland. Public chapter-title progression emphasizes ability limit,
gambling with bullets, public madness, becoming extraordinary, crisis, and
ability limitation.

### episode_outline

```json
{
  "id": "trial-time-stop-first-proof",
  "title": "一分钟时停的第一次公开证明",
  "chapterRange": { "start": 1, "end": 16 },
  "externalEventContainer": "废土小镇危机中，主角用每天一分钟的时停能力完成看似不可能的赌博、救场和反杀，让旁观者从嘲笑转为恐惧和承认。",
  "centralPressure": "一分钟很强，但远远不够；每次使用都必须换来最大收益，否则下一秒就会死。",
  "factions": ["主角", "镇上普通人", "废土敌人", "观察者/导师", "超凡体系"],
  "readerPromises": ["能力强但限制清楚", "用脑子放大一分钟", "疯狂选择带来反转", "公开承认主角不是普通人"],
  "escalationLadder": ["能力展示", "子弹赌局", "轮盘/命运测试", "战斗救场", "限制暴露", "灭镇危机", "成为超凡者"],
  "doNotResolveYet": ["时停来源", "更高阶时间系能力", "废土大灾变真相"]
}
```

### character_threads

- `thread-one-minute-gambler`: 主角用危险选择证明一分钟能换命。
- `thread-observer-recognition`: 旁观者从轻视到承认，提供社会验证。
- `thread-wasteland-threat`: 外部敌人不断制造一分钟不够用的局面。

### world_rule_tracks

- `world-rule-time-budget`: 每天一分钟，是否可累积，如何消耗。
- `world-rule-public-power`: 废土社会只承认可见战绩。
- `world-rule-extraordinary-entry`: 成为超凡者要经历公开危险证明。

### event_pool

| id | type | stage | event |
| --- | --- | --- | --- |
| e1 | discovery | 能力确认 | 主角确认时停只有一分钟 |
| e2 | test | 子弹赌局 | 他用时停处理枪械/子弹风险 |
| e3 | attempt | 命运轮盘 | 以规则漏洞赢下高风险测试 |
| e4 | confrontation | 废土冲突 | 敌人逼迫他当众使用能力 |
| e5 | payoff | 公开反杀 | 众人看见不可能的结果 |
| e6 | setback | 限制暴露 | 一分钟耗尽，主角陷入后手危机 |
| e7 | crisis | 灭镇危机 | 外部威胁远超个人能力 |
| e8 | payoff | 成为超凡 | 他用计划而非纯能力过关 |
| e9 | reveal | 能力边界 | 读者理解时停限制和后续升级方向 |

### episode_chapter_plan_set

| chapter | goal | collision | payoff | end hook |
| --- | --- | --- | --- | --- |
| 1 | 展示能力 | 一分钟既强又短 | 设定清楚 | 今天的一分钟用完怎么办 |
| 2 | 子弹赌局 | 死亡风险公开化 | 第一次巧用时停 | 有人注意到异常 |
| 3 | 轮盘测试 | 规则看似随机 | 主角找到必胜法 | 对手怀疑作弊 |
| 4 | 街头冲突 | 不能暴露全部能力 | 小规模反杀 | 更强敌人出现 |
| 5 | 公开战斗 | 一分钟不够解决全部敌人 | 用布置弥补能力限制 | 倒计时耗尽 |
| 6 | 能力空窗 | 没有时停也要活 | 主角用心理战撑过 | 危机扩大到小镇 |
| 7 | 灭镇压力 | 个人能力不够救所有人 | 读者看到代价 | 必须做取舍 |
| 8 | 第一次承认 | 观察者确认他是超凡苗子 | 身份提升 | 新规则开放 |
| 9-16 | 升级试炼 | 更强敌人与更严限制 | 新能力边界 | 更大组织/灾变入口 |

### Framework Verdict

This test shows `world_rule_tracks` must be phrased as constraints, not lore.
"Time stop" alone is not a rule track. "Only one minute, wrong usage means
death" is the rule track.

## Cross-Trial Result

The 5-product framework holds across these four genres, but each genre stresses
a different missing detail:

| Genre | Strongest required field | Missing future field |
| --- | --- | --- |
| 749 containment | institution/status gate | `statusGate` |
| game invasion | resource ownership transfer | `ownershipTransfer` |
| borrowed-photo romance | deception deadline | `lieState` / `exposureRisk` |
| time-stop wasteland | rule constraint and cost | `abilityBudget` |

## Prompt Implications

The current prompt should keep the 5 core products, but `event_pool` should later
allow optional genre-specific metadata:

```ts
event_pool[].genrePayload?: {
  statusGate?: string;
  ownershipTransfer?: {
    expectedOwner: string;
    actualOwner: string;
    retaliationCreated: string;
  };
  lieState?: {
    currentLie: string;
    exposureRisk: string;
    debtIncreased: string;
  };
  abilityBudget?: {
    resourceName: string;
    budgetBefore: string;
    budgetAfter: string;
    costIfMisused: string;
  };
}
```

I am not adding this to the TypeScript schema yet because the current request was
to keep schema minimal. But the benchmark strongly suggests this is the next
small extension after you approve the direction.
