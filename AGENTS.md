# text-game-agent

文字游戏 agent。本文件是唯一项目说明；README 和设计文档已删除。遇到旧聊天记录、旧文档、旧字段冲突时，以当前代码、测试和本文件为准。

## 目标

把故事资料、人物状态、玩家输入转成可连续游玩的文字游戏闭环。优先保持系统短、小、可检查，避免为想象中的复杂问题提前加机制。

## 当前流水线

```text
Initializer -> 人物状态 / 世界观 / 开场正文 / 初始选项

主链路：玩家输入 + 最近正文 + 当前状态 + 上轮反馈提醒 + 上轮物理约束 -> Director -> PlanFeedback -> Narrator -> 返回正文和候选项
                                                                                                      |
                                                                                                      v
后台链路：PostprocessQueue -> PostprocessSummary
```

- Initializer：故事导入后的初始化加工，只生成程序需要的初始结构。
- 用户输入：每轮玩家自由输入，是 Director 和 Narrator 的当前触发点。
- 最近正文：保留第 0 轮和最近 5 轮交互；第 0 轮会随着轮数推进被挤掉。提供给 Director、PlanFeedback、Narrator；Director 用于判断已发生细节和阶段顺序，PlanFeedback 用于提前发现拖沓和重复，Narrator 用于反重复。
- 上轮反重复提醒：PlanFeedback 产生本轮整改要求，程序同时保存少量反馈为 `feedbackMemory`，只注入下一轮 Director。
- 上轮物理约束：Director 每轮接收上一轮 `physicalConstraints`，继承仍成立的纯物理限制，输出本轮新的 `physicalConstraints` 供下一轮使用。
- Director：只做本轮计划，输出压缩 JSON；不写正文，不输出推理报告。当前核心字段是 `plotDrive / sceneOutcome / mainPresentation / supportingPresentation / narrativeStyle / physicalConstraints`。不要恢复 `plotGoal`、`plotStep`、`plotFrame`、`writingPlan`、`beat1/beat2/beat3/ending`。
- PlanFeedback：在 Narrator 前运行，接收世界观、长期总结、最近正文和本轮 Director 计划，输出 `文字细节重复`、`剧情设计重复`、`剧情速度拖沓` 和 `叙事整改要求`；不接收最近 Director 计划，不把旧导演意图当成叙事事实；不维护人物状态，不写正文，不生成候选项。
- Narrator：按导演计划和 PlanFeedback 写玩家可见正文；不更新状态；生成候选项；可以在 `draftText` 内少量使用 Markdown 强调，前端直接渲染，不再使用 `renderAnnotations` 原文匹配。正文生成后前端定位到最新一轮正文开头，不跳到全文末尾。
- PostprocessSummary：正文显示后进入独立队列，只看最终正文、玩家输入和当前人物状态，更新本轮事实总结、人物状态字段补丁、人物名单补丁、人物状态补丁；不做反馈，不改正文。
- `plotDrive` 是当前唯一剧情推动字段。它同时承担“剧情为什么会动”和“如何推动”的作用。可选值包括：`欲望追求`、`阻力碰撞`、`信息落差`、`关系张力`、`外部压力`、`价值抉择`、`因果回响`、`身份错位`、`危机逼近`、`资源争夺`、`一笔带过`。不要恢复独立 `plotGoal`。

## 当前状态设计

长期变量不是程序状态机，也不是 if/else 变量，而是记忆种子和承前启后的骨架。它的作用是让文本流保留前因、接住后果、维持方向，连接短期正文和长期走势；不是让 LLM 像执行代码一样精确服从规则。不要用长期变量管理世界，只用它给下一轮生成提供必要锚点。

程序不是 LLM 的 harness 或 controller，而是 backbone。程序只收集 LLM 的输出，压缩必要部分，再回灌给后续轮次；目标是让文本前后连续、一致、有承接，不是控制 LLM 精确服从。

人物状态只保留三块：

```json
{
  "statusSchema": ["位置", "姿势", "外显状态"],
  "statusRoster": ["人物名", "NPC名"],
  "statusState": {
    "人物名": {"位置": "车内"}
  }
}
```

- `statusRoster` 只保存名字，不保存 `id/name/active` 对象。
- 故事世界里没有“玩家”这个人物。玩家只是操控来源，运行时只保存 `controlledCharacterName`，表示用户当前操控的具体人物。
- Initializer 输出 `playableCharacters`，开局时用户从重要人物里选择操控谁；`playableCharacters/statusRoster/statusState` 都只写具体人物名，不写“玩家”。
- 前端必须展示当前操控人物。叙事人称是前端可选配置，默认 `第一人称限知`；切到 `第三人称限知` 时才用人物名/她/他叙述当前操控人物。无论哪种人称，单轮正文不得在“我”和人物名/她/他之间来回切换。
- 默认 roster 内人物都 active。
- PostprocessSummary 只输出 `statusSchemaPatch`、`statusRosterPatch`、`statusStatePatch`。
- 前端人物状态栏直接显示 JSON，不格式化成卡片。
- 不恢复 `statusPanel`、`statusPanelSchema`、`statusSubject`。

## 反馈提醒设计

PlanFeedback 只保留三个反馈字段，并额外生成本轮 `叙事整改要求`：

- `文字细节重复`
- `剧情设计重复`
- `剧情速度拖沓`

`文字细节重复` 只承担文面、句式、动作、感官词和同类描写的反重复提醒，注入本轮 Narrator，并保存给后续 Director。`剧情设计重复` 只对照最近正文和本轮 Director 计划，提醒 Narrator 本轮避开已经写出来的重复装置；最近 Director 计划不再输入 PlanFeedback，旧导演意图不算事实。`剧情速度拖沓` 检查最近正文和本轮 Director 计划是否继续停留在低价值过渡、寒暄、等待、移动、解释、重复反应、原地对峙，缺少新信息、新压力、新关系变化、场景阶段变化或可行动的新局面；拖沓时提示本轮必须加快剧情速度，使用 `一笔带过` 或直接引入新压力/新信息/新场景阶段，不得继续原场景对峙。

候选项由 Narrator 生成，因为 Narrator 已经接收 PlanFeedback，能让选项配合本轮整改后的正文。每轮固定三条：延续当前场景但必须产生变化；玩家操控人物主动推动当前场景尽快收束；引入第三方或外部变化来迫使当前场景结束或进入新阶段。剧情拖沓时，三条都必须服务于加速收束，不给继续等待、试探、原地对峙的选项。

反馈提醒存入 `feedbackMemory`，只保留 1 轮，最多 6 条，超过后顶掉最早的一条。禁词表直接注入 Narrator，当轮约束正文，不再交给反馈器延迟处理。剧情拖沓的具体加速方向直接写入 `剧情速度拖沓`。不要恢复合并版 `qualityFeedback` 状态字段，也不要恢复 `违背约束`、`节奏不足`、`导演推进不足`、`导演物理违背` 等反馈字段。

当前结论：反馈放在 Narrator 之后会滞后一轮，无法立刻修正拖沓。现在把反馈前移成 PlanFeedback，让它审查 Director 计划后直接注入 Narrator；这样不增加修订轮，也能让本轮正文吸收速度、重复和细节密度提醒。

未来目标：模型速度足够快后，再把质量检查和修订做成每轮必做。当前 PlanFeedback 只做事前审查，不做正文修订；更完整的未来流水线：

```text
Director -> Narrator -> Critic -> Revision -> Memory
```

- `Critic`：只检查质量，输出可执行质量提醒；重点看导演是否通过 `plotDrive` 推动局面、叙事是否违反物理约束或世界状态、是否重复、太短、太水、文风漂移。
- `Revision`：每轮默认运行，立即吸收 `Critic` 的提醒，只修正文，不更新状态。
- `Memory`：只负责长期总结、人物状态补丁、剧情方向骨架更新。
- Postprocess 这个名字后续可以消失，或拆成 `Critic` / `Memory`。

当前暂时不做；只把它作为速度提升后的下一阶段架构目标。

当前结论：`plotGoal` 和 `plotDrive` 实测重复，已删除 `plotGoal`。剧情加速不再通过 `plotGoal` 管理，而是通过 `plotDrive=一笔带过`、`sceneOutcome` 和 `剧情速度拖沓` 反馈推动。`一笔带过` 是略写平淡过程，不是硬跳时间。

Director beat 已废弃。当前思路是：长期连贯性由世界观、人物状态、最近正文、长期总结、物理约束提供；短期推动由 `plotDrive` 提供；本轮落成的新局面由 `sceneOutcome` 约束；表现方式由 `mainPresentation / supportingPresentation / narrativeStyle` 提供。具体情节、细节、节奏落点交给 Narrator 自由组织，避免 Director 重新变成细纲生成器。

## 故事库与配置

故事库里的 Program Config JSON 是“新游戏初始化模板”，不是当前游玩状态。编辑故事卡 JSON 只影响 `story/<asset>/program-config.json` 和后续新开局/重新初始化，不得修改当前正在游玩的故事。

严禁在保存故事卡 JSON 后同步覆盖当前游戏的：

- `statusSchema`
- `statusRoster`
- `statusState`
- `worldview`
- `openingText`
- `directorStyle`
- `narratorStyle`

当前游玩状态只能通过开始新游戏、玩家输入后的 PostprocessSummary、存档读取或明确的状态编辑功能改变。不要恢复 `applyProgramConfigToCurrentStory` 这类同步函数。

后处理异步化已经落地为 PostprocessQueue。正文生成完成后立即返回给玩家，同时把本轮正文放入后台队列：

```text
主链路：玩家输入 -> Director -> PlanFeedback -> Narrator -> 返回正文和候选项
后台链路：PostprocessQueue -> PostprocessSummary 更新长期总结/人物状态
```

- 最近正文作为热记忆同步保存，继续提供给下一轮 Director 和 Narrator。
- 长期总结和人物状态作为冷记忆异步更新，允许滞后一轮或几轮。
- Postprocess 失败只停在队列里等待重试，不阻塞玩家继续游戏。
- 每轮完成后入队一个 postprocess job；后台按顺序消费，每个 job 内部分成 Summary 和 Feedback 两次调用，避免旧总结覆盖新状态。
- 反馈提醒只持续 1 轮；PlanFeedback 每轮都会重新生成，旧反馈不应长期形成惯性噪音。

长期总结压缩规则：最近 5 轮不进入历史总结上下文。历史总结达到 20 条时触发压缩，但只压缩第 1-10 条为 2 条摘要；第 11-20 条原样保留。压缩后结构为：`2 条摘要 + 原第 11-20 条`。

导演粒度粗化是未来实验，不直接写进当前 prompt。目标是减少无意义的小选择：要求每轮至少产生一个比较明显的局面变化或信息状态变化，并允许 Director 代劳玩家的合理连续行动，直到产生新变化再停。但这次直接写入 Director / Narrator 后质量下降，后续要用更小范围 A/B 测试，不要一次性替换当前稳定 prompt。

世界书召回暂时不做。场景模块也已删除，不要恢复。

- 不做实体提名、别名匹配、词条限量、向量检索或独立世界书索引。
- 不维护 `prompts/scene-modules`，不提供场景模块 UI，不让 PostprocessFeedback 选择 `selectedSceneModules`。

情节库和高级导演是未来路线图，当前不做。思路是从完整小说中抽取可复用的情节单元，形成情节库，再用类似 skill 的机制按当前局面动态加载少量剧情参考，引导后续剧情推进。它提供事件结构、冲突推进、角色关系变化和阶段性转折。

未来高级导演模块：初始化阶段预先生成剧情库，每个剧情单元包含准入条件、剧情大纲正文、结束条件。后处理判断当前是否需要新的剧情大纲；需要时调用高级导演查阅剧情库，选出或生成下一个剧情大纲，再注入低级 Director。低级 Director 只负责把高级剧情大纲落到本轮动态叙事计划。

当前不要实现抽取器、情节索引、向量检索、剧情召回接口、高级导演调用链，也不要让 Director 直接输出情节库条目；先保留为后续剧情驱动能力的路线图。

## Prompt 规则

Prompt 文件直接在 `prompts/` 上层：

- `initializer.md`
- `director.md`
- `narrator.md`
- `postprocess-summary.md`
- `postprocess-feedback.md`

风格绑定在故事配置 JSON 里：

- `directorStyle`
- `narratorStyle`

要改风格，直接改故事库里的 Program Config JSON。代码层不再动态加载用户配置模块，不提供 `/api/modules`，前端也不再有“注入配置”。

风格 prompt 文件只作为参考模板保留，不参与运行时注入：

- `prompts/导演风格/*.md`
- `prompts/叙事风格/*.md`

输入变量用 `{{变量名}}`。变量顺序按稳定性排序：越稳定、越不需要每轮重新理解的内容越靠前；当前玩家输入和最终正文靠后。Postprocess 必须接收世界观，因为合理性判断依赖世界观。

运行时只维护根目录 `prompts/*.md` 这一份 prompt。不要恢复 `基准` / `繁花` profile 目录、`active-profile.txt`、prompt 版本切换 API 或前端选择器。

所有实际 LLM 请求都不发送 `system` role。Prompt 模板中的 `# System Message` 段会并入同一条 `user` 消息，避免不同 profile 在 role 层面产生不可控差异。

## 模型策略

当前模型层使用“供应商注册表 + 模型目录”。默认主模型固定为官方 DeepSeek `deepseek-v4-flash`。

- 当前可选模型：官方 `deepseek-v4-flash`、官方 `deepseek-v4-pro`、Infron `google/gemini-3.1-flash-lite`。
- 新增供应商时先扩展模型目录和 provider 配置，不要散落硬编码分支。
- API Key 按供应商保存；Key 只保存在浏览器本地或本机 `.env.local`，不提交到 Git。

模型管理默认是一个“当前模型”打完整条流水线。允许用户给 Initializer / Director / Narrator / Postprocess 单独覆盖模型；留空表示跟随当前模型。不要暗中把某个阶段切到 Pro。

模型管理同时承载叙事人称选择：`第一人称限知` / `第三人称限知`。这是写作视角，不是世界内人物；不要把它写入人物状态。

速度测试和内容拦截测试继续 append 到记录文件，作为后续判断不同模型的依据，避免凭感觉切换模型。

## 内容过滤规避经验

当前结论：DeepSeek v4 flash + 单一 prompt 是默认策略。除非重新实测，不要恢复“把繁花 hard rule 放入 system”或“弱 system + 强 user”的旧规避方案。当前统一 user-only 输入，减少 role 差异带来的排查成本。

## 不要恢复

- Director / Narrator / Postprocess 缓存。
- 下一轮预热。
- `director-prewarm`、`prewarm-cancel` 接口。
- 任何隐藏的 LLM 结果缓存、命中复用、后台预取或失败 fallback。省下的十几秒不值得牺牲排查确定性；每轮都应重新调用模型，并把请求、返回和错误落到可检查日志。
- Editor 独立精修层。
- 应急 Director fallback。
- 动态加载 prompt 机制。
- `system-hard-rules`、`story-curator`、`user-config-templates` 旧目录。
- 运行时用户配置模块、`/api/modules`、`userModules`、`moduleEnabled`、注入配置 UI。
- 独立伏笔队列。
- `currentPhysicalEnvironment`、`normalizedEntries`、`statusPanel*`、`qualityFeedback` 等已删状态字段。
- 复杂物理状态机。

## 目录

- `scripts/web-server.ts`：本地 HTTP 服务、模型调用、流水线、故事导入初始化、存档接口。
- `web/`：前端页面、状态展示、故事库、配置、生成交互。
- `prompts/`：固定 prompt 和风格参考模板。
- `story/`：故事资料和初始化后的 `program-config`。
- `save/`：本地存档。
- `debug/`：LLM 原始请求和返回。
- `src/__tests__/`：当前架构保护测试。

## 运行

```bash
npm install
npm run web
```

默认地址：

```text
http://127.0.0.1:4173
```

重启服务时不要用一次性后台命令，例如 `nohup npm run web ... &` 后立刻退出 shell；在当前 Codex 环境里它可能打印了启动地址但进程马上消失，导致浏览器打不开。正确做法是用保持运行的前台会话启动 `npm run web`，再验证：

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
curl --max-time 5 -s -o /tmp/text-game-agent-index.html -w '%{http_code}\n' http://127.0.0.1:4173/
```

只有同时看到端口监听和 `200`，才算重启成功。

默认模型是官方 DeepSeek `deepseek-v4-flash`。网页右上角可配置不同供应商的 API Key，保存在当前浏览器本地；也可用环境变量。

## 验证

改完至少跑：

```bash
npm test
npx tsc --noEmit
curl --max-time 5 -s -o /tmp/text-game-agent-index.html -w '%{http_code} %{size_download}\n' http://127.0.0.1:4173/
```

## 工程纪律

- 先读当前代码和测试，不靠旧对话猜。
- 一次只解决一个问题。
- 优先减法，少加抽象。
- 删除功能必须删干净：prompt、代码、测试、状态字段、UI 文案、本地残留、文档一起处理。
- 多次更新功能后，回头清理冗余代码和旧测试。
- 如果用户说“越来越复杂”，先删，不先设计新机制。
