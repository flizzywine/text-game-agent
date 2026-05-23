# text-game-agent

文字游戏 agent。本文件是项目内工作约束；README 面向用户说明。遇到旧聊天记录、旧文档、旧字段冲突时，以当前代码、测试和本文件为准。

## 目标

把故事资料、人物状态、玩家输入转成可连续游玩的文字游戏闭环。优先保持系统短、小、可检查，避免为想象中的复杂问题提前加机制。

## 当前流水线

```text
Initializer -> 人物状态 / 世界观 / 开场正文 / 初始选项

主链路：玩家输入或剧情方向选择 + 上轮承接锚点 + `longTermState` + 上轮反馈提醒 + 已完成召回缓存 -> Director(内置审查) -> Narrator -> OptionStrategist -> 返回正文和候选项
                                                                                                      |
                                                                                                      v
后台链路：SummaryQueue -> Summary

旁路链路：RecallWorker -> recall-cache.json
```

- Initializer：故事导入后的初始化加工，只生成程序需要的初始结构。
- 用户输入：每轮玩家自由输入，是 Director 和 Narrator 的当前触发点。
- 最近正文：保留第 0 轮和最近 5 轮交互；第 0 轮会随着轮数推进被挤掉。Director 读取最近正文只做场景审查：判断是否拖沓、重复、已经兑现，不得被文面惯性牵引成原地续写。Narrator 读取较完整最近正文，用于承接近处细节和反重复。
- 上轮反重复提醒：Director 内置审查产生整改字段，程序保存少量反馈为 `feedbackMemory`，只注入下一轮 Director。`feedbackMemory` 属于 L0.5 临时状态，不是 L1 长期事实总结。
- 物理约束：Director 和 Narrator 只读取 `longTermState.physicalConstraints`，不得更新它；Summary 根据最终正文输出新的 `physicalConstraints`，程序合并回 `longTermState`。
- 用户反馈：`playerFeedback` 属于 L0.5 人工反馈状态，不是 L2 世界设定，也不是 L1 历史事实；可持续生效，但用户可随时修改。
- RecallWorker：旁路运行，不阻塞 Director、Narrator 或 Summary。它在正文输出后、Summary 完成后被触发，读取最近上下文、长历史和 `longTermState`，判断下轮是否需要回看较早正文，并锁定最多两轮旧正文轮次；程序加载这些轮次的完整 `story.txt` 正文摘录，写入 `recall-cache.json`。下一轮 Director 和 Narrator 只读取已经完成的旧正文缓存；缓存没准备好就当作无召回。不写剧情建议，不做一致性检查，不生成问答答案。
- Director：只做方向执行、场景审查、过渡依据和写法种子，输出压缩 JSON；不写正文，不输出推理报告。当前核心字段是 `sceneTransition / sceneOutcome / narrativeStyle`，并内置 `文字细节重复 / 剧情设计重复 / 剧情速度拖沓 / 叙事整改要求`。候选项已经框定宏观剧情方向，Director 不再重新设计未来剧情，只把用户实际选中的那一条宏观方向落成本轮可写计划；未选中的候选方向不进入 Director。不要恢复独立 Feedback 调用，也不要恢复 `recallTurns`、`plotGoal`、`plotDrive`、`plotStep`、`plotFrame`、`writingPlan`、`mainPresentation`、`supportingPresentation`、`beat1/beat2/beat3/ending`，也不要让 Director 输出 `physicalConstraints`。
- Narrator：按导演计划和 Director 内置审查写玩家可见正文；不更新状态；不生成候选项；可以在 `draftText` 内少量使用 Markdown 强调，前端直接渲染，不再使用 `renderAnnotations` 原文匹配。正文生成后前端定位到最新一轮正文开头，不跳到全文末尾。
- OptionStrategist：在 Narrator 之后运行，读取本轮正文、Director 计划、Director 内置审查、长历史和长期变量，只生成 `playerOptions`。它是真正的高层方向源，必须看到更远的关系线和阶段变化。它不写正文，不更新状态；每轮固定给出 5 条中层剧情方向，类型只允许 `推进`、`转折`、`跳过`，每项只包含 `type` 和 `direction`。候选项不是角色台词、动作、即时回应或完整下一幕情节；`direction` 可以点明矛盾类型、关系变化、信息压力或节奏去向，但不能替下一轮正文预设具体执行方式。用户点击后提交的是 `【剧情方向选择】` 元指令，只有被选中的这一条进入下一轮 Director，不直接进入正文。`跳过` 必须支持一笔带过、快速跳跃或快速跳到下一个场景。
- Summary：正文显示后进入独立队列，只看玩家输入、最终正文和 `longTermState`，更新本轮事实总结、人物状态、关键信息和物理约束；总结模块看得最近，只总结本轮实际发生的内容，不把远处旧事实重新写成本轮事实；不做反馈，不改正文。
- `sceneTransition` 是从上一轮到本轮的场景切换/过渡依据；`sceneOutcome` 是本轮结束时必须成立的新局面；`narrativeStyle` 只提供写法种子，不能重新变成呈现方式清单。
- Director 必须判断场景价值是否已经兑现。当前场景的主要信息、关系变化或阻力已经成立时，优先用 `一笔带过` 快进到入睡、第二天、下一个地点或下一个剧情节点；不得为了延续上一轮气氛继续加码同一场景。

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
- 故事世界里没有“玩家”这个人物。玩家不是控制单一角色，而是控制整个世界的叙事方向；运行时保留旧字段 `controlledCharacterName` 兼容存档，但语义是“当前焦点人物 / 初始焦点人物”，不是永久主角。
- Initializer 输出 `playableCharacters`，开局时用户从重要人物里选择初始焦点人物；`playableCharacters/statusRoster/statusState` 都只写具体人物名，不写“玩家”。
- 前端必须展示当前焦点人物。叙事人称固定为 `全知第三人称`；正文使用人物名、称谓或“她/他”，不使用“我”。叙述者可以展示每个角色的行动与心理，当前焦点可随剧情切换；角色自身仍受知识边界限制，不能因为叙述者全知而知道不该知道的信息。
- 默认 roster 内人物都 active。
- Summary 只输出 `turnSummary`、`statusSchemaPatch`、`statusRosterPatch`、`statusStatePatch`、`itemStatePatch`。
- 前端人物状态栏直接显示 JSON，不格式化成卡片。
- 不恢复 `statusPanel`、`statusPanelSchema`、`statusSubject`。

## Director 内置审查

独立 Feedback 已合并进 Director。Director 只保留三个审查字段，并额外生成本轮 `叙事整改要求`：

- `文字细节重复`
- `剧情设计重复`
- `剧情速度拖沓`

`文字细节重复` 只承担文面、句式、动作、感官词和同类描写的反重复提醒，注入本轮 Narrator，并保存给后续 Director。`剧情设计重复` 对照最近正文和用户输入，提醒本轮避开已经写出来的重复装置。`剧情速度拖沓` 检查最近正文是否继续停留在低价值过渡、寒暄、等待、移动、解释、重复反应、原地对峙，缺少新信息、新压力、新关系变化、场景阶段变化或可行动的新局面；拖沓时 Director 必须在计划里加快剧情速度，使用 `一笔带过` 或直接引入新压力/新信息/新场景阶段，不得继续原场景对峙。

候选项由 OptionStrategist 生成，因为候选项才是真正的高层导演：它决定下一轮剧情往哪个方向走，Director 只是执行被选中的方向。候选项是后续用户输入的主要来源，而 Director 必须按照用户输入来演绎，所以真正把控剧情方向和速度的关键不在 Director，而在候选项。候选项不能被 Narrator 刚写完正文后的当前场景惯性拖住。每轮固定五条，但不是当前场景的顺手动作，也不是给角色的具体回应，更不能是完整下一幕情节；类型只允许：`推进`、`转折`、`跳过`。用户选择的是未来剧情方向，不是角色控制输入。剧情拖沓时，首要加速对象是候选项本身：五条方向都必须服务于加速收束，不给继续等待、试探、原地对峙的选项。但离散不等于硬切，候选项必须保留上一轮的情绪余波、信息后果、关系后果或压力来源，让 Director 和 Narrator 有因果桥可接。

反馈提醒存入 `feedbackMemory`，只保留 1 轮，最多 6 条，超过后顶掉最早的一条。禁词表直接注入 Narrator，当轮约束正文，不再交给反馈器延迟处理。剧情拖沓的具体加速方向直接写入 `剧情速度拖沓`。不要恢复独立 Feedback 模块、合并版 `qualityFeedback` 状态字段，也不要恢复 `违背约束`、`节奏不足`、`导演推进不足`、`导演物理违背` 等反馈字段。

未来目标：模型速度足够快后，再把质量检查和修订做成每轮必做。当前 Director 内置审查只做事前审查，不做正文修订；更完整的未来流水线：

```text
Director -> Narrator -> Critic -> Revision -> Memory
```

- `Critic`：只检查质量，输出可执行质量提醒；重点看本轮是否完成 `sceneTransition` 和 `sceneOutcome`、叙事是否违反物理约束或世界状态、是否重复、太短、太水、文风漂移。
- `Revision`：每轮默认运行，立即吸收 `Critic` 的提醒，只修正文，不更新状态。
- `Memory`：只负责长期总结、人物状态补丁、剧情方向骨架更新。
- 后续如果速度足够，可以把质量检查和记忆更新拆成 `Critic` / `Memory`。

当前暂时不做；只把它作为速度提升后的下一阶段架构目标。

当前结论：`plotGoal` 和 `plotDrive` 都已删除。剧情加速不再通过独立推动力枚举管理，而是通过 `sceneTransition`、`sceneOutcome`、`narrativeStyle` 和 `剧情速度拖沓` 审查推动。`一笔带过` 是略写平淡过程，允许合理快进到第二天、下一个地点或下一个剧情节点，但不能省略必要因果。

Director beat 已废弃。当前思路是：长期连贯性由世界观、人物状态、最近正文、长期总结、物理约束提供；前后轮承接由 `sceneTransition` 约束；本轮落成的新局面由 `sceneOutcome` 约束；写法种子由 `narrativeStyle` 提供。具体情节、细节、节奏落点交给 Narrator 自由组织，避免 Director 重新变成细纲生成器。

## 故事库与配置

故事库里的 Program Config JSON 主要是“新游戏初始化模板”。其中稳定配置字段会在下一轮生成时自动回读并生效：`worldview`、`openingSummary`、`directorStyle`、`narratorStyle`。运行态字段不回灌。

严禁在保存故事卡 JSON 后同步覆盖当前游戏的：

- `statusSchema`
- `statusRoster`
- `statusState`
- `openingText`

人物状态、状态字段和长期变量只能通过开始新游戏、玩家输入后的 Summary、存档读取或明确的状态编辑功能改变。不要恢复把整个 Program Config 直接覆盖当前运行态的同步函数。

后处理异步化已经落地为 SummaryQueue。正文生成完成后立即返回给玩家，同时把本轮正文放入后台队列：

```text
主链路：玩家输入 -> Director(内置审查) -> Narrator -> OptionStrategist -> 返回正文和候选项
后台链路：SummaryQueue -> Summary 更新长期总结/人物状态
旁路链路：RecallWorker 更新 recall-cache.json
```

- 最近正文作为热记忆同步保存；上轮 L1 总结提供给 Director 做承接锚点，较完整最近正文提供给 Director 做场景审查，并提供给 Narrator 做近处承接。
- L1 每轮事实总结和当前状态作为冷记忆异步更新，允许滞后一轮或几轮。当前状态统一为 `longTermState`，包含 `characterStatus`、`keyInfo`、`physicalConstraints`；旧字段 `statusState`、`itemState`、`physicalConstraints` 保留为存档兼容和前端同步字段。`planFeedback`、`feedbackMemory`、`playerFeedback` 都是 L0.5，但不并入 `longTermState`。
- Summary 失败只停在队列里等待重试，不阻塞玩家继续游戏。
- 每轮完成后入队一个 summary job；后台按顺序消费，避免旧总结覆盖新状态。
- 反馈提醒只持续 1 轮；Director 每轮都会重新生成内置审查，旧反馈不应长期形成惯性噪音。

L1 每轮事实索引文件不删除、不覆盖。它保持 `第X轮：总结内容` 的轮次定位。每隔 10 轮，SummaryL2 把对应 10 条 L1 压成一条 `turn-summaries-l2.txt` 里的 L2 区间总结。第 25 轮开始，程序层在 `longHistoricalSummary` 中用 `第1-10轮` L2 替换 1-10 轮 L1；第 35 轮替换 11-20 轮；之后每隔 10 轮推进一次。L1/L2 文件都保留，替换只发生在 prompt 渲染层。RecallWorker 和 Director 读取替换后的长历史；Narrator 只读取短 L1 窗口，默认不看远；最近 5 轮由最近正文承担，不进入旧正文召回范围。

导演粒度粗化是未来实验，不直接写进当前 prompt。目标是减少无意义的小选择：要求每轮至少产生一个比较明显的局面变化或信息状态变化，并允许 Director 代劳玩家的合理连续行动，直到产生新变化再停。但这次直接写入 Director / Narrator 后质量下降，后续要用更小范围 A/B 测试，不要一次性替换当前稳定 prompt。

旧世界书召回暂时不做。场景模块也已删除，不要恢复。

- 不做实体提名、别名匹配、词条限量、向量检索或独立世界书索引。
- 不维护 `prompts/scene-modules`，不提供场景模块 UI，不恢复 `selectedSceneModules`。

召回已经从 Director 和前台主链路拆出。当前实现是旁路 `RecallWorker`：它读取最近上下文、长历史和 `longTermState`，判断是否需要回看较早正文，并从 L1/L2 历史里锁定最多两轮旧轮次；程序加载这些轮次的完整 `story.txt` 正文摘录，写入 `recall-cache.json`。下一轮 Director 和 Narrator 只读取已完成旧正文缓存，不等待召回现场运行。最近 5 轮不进入旧正文召回范围。每次 RecallWorker 完成或报错都要写入 `recall-worker-events.jsonl`，前端全局流水线轮询展示这些 JSON；刷新页面会先读取已完成事件，当前轮缺事件时会请求后端重新触发 RecallWorker，避免刷新或服务器重启后断连。

多次召回是否必要是未来待办，当前不实现。某些旧细节可能需要多轮递进：第一轮只发现缺历史证据，第二轮根据新问题扩大检索，后续再按人物、地点、物品、承诺、伤势、关系变化或伏笔继续追查。暂时保持一次 RecallWorker，先观察命中质量；未来再评估是否支持连续召回、召回查询改写和召回结果去重，避免一次性塞入过多上下文。

如果轮数增长到 L1 也过长，再考虑三层记忆和两次召回：先在更高层粗召回候选时间段或章节，再用 L1 精召回具体 L0 轮次。这个方案复杂度明显更高，当前不做，只作为远期待办。

整本小说的分级记忆树是未来待办，当前不实现。L0 保留原始正文切块，L1 每隔约 1500 字压缩一次，L2 每 10 份 L1 再压缩一次，继续向上堆成树。摘要层负责压缩和导航，不视为无损记忆；真正可逆的是节点指针，必须保留 children/source_l0，让系统能从高层下钻到 L0 原文，也能从原文回溯到上层节点。后续如果做检索 LLM，应在 Director/Narrator 缺失细节时先查高层定位候选区间，再下钻读取对应 L0，把原文证据注入下一轮；不要只相信摘要回答细节、原话、动机、因果和矛盾问题。

关键道具状态已删除。当前不维护 `keyItems`，也不追踪普通物品归属；相关事实只在确实长期重要时写入 `keyInfo`，避免不可控物品系统拖累正文。

状态层裁剪是未来待办，当前不实现。后续可以把 L0.5 的人物状态按当前场景裁剪：只加载在场人物和当前交互相关人物。目标是减少上下文，而不是建立完整场景索引；不要引入复杂实体检索或向量检索。

`longTermState.keyInfo` 关键信息状态已进入当前实现。它属于 L0.5，不是 L1；由 Summary 自行维护，用来保存跨轮持续重要但不适合写进人物状态或逐轮 L1 的信息，例如当前隐含目标、关键误会、关系暗线、场景内未解决的重要事实。它应随正文变化增删改，避免无限增长。

Prompt 去重精简是未来待办，当前不实现。现在各模块 prompt 里混入了较多重复约束，后续应系统审查 `prompts/*.md`，合并重复规则、删除过时约束、把跨模块共识沉到更短的共享原则里。目标是减少上下文噪音，不改变当前流水线行为；精简前先保存当前可用版本，精简后跑契约测试和实际生成对照。

人物称呼视角是未来待办，当前不实现。同一角色需要区分内部标准名和当前焦点人物视角下的称谓，例如角色名是“由依子”，但当前焦点人物应称她为“妈妈”，正文和对话不应机械使用标准名。

情节库和高级导演是未来路线图，当前不做。高级导演定位已经明确：它接在当前 Director 前面，看得比 Director 更远、更粗，只负责宏观剧情方向，不负责本轮细节。未来主链路可以是 `HighLevelDirector -> Director(内置审查) -> Narrator`，召回继续作为旁路缓存。

未来高级导演模块：读取更远的 L1/L2、少量宏观 L0.5 状态，以及可选剧情库；判断当前处于哪个长期阶段、是否需要切换剧情大段、哪条关系线或冲突线应该推进、是否需要引入新的剧情压力。它不读取 L0 原文，不写正文，不输出细节 beat，只给低级 Director 一个宏观方向。低级 Director 继续负责把这个方向落成本轮 `sceneTransition`、`sceneOutcome` 和 `narrativeStyle`；旧 L0 由 RecallWorker 旁路预取给 Narrator。

剧情引导是未来待办，当前不做。用户可写入希望剧情靠近的方向，作为一个可修改的软约束输入给 Director，例如关系修复、揭露阴谋、离开当前场景、推进某条人物线。它不是玩家本轮输入，也不是硬性剧情目标；作用是防止剧情长期滑向用户不想看的方向，让导演在每轮动态计划中逐步靠拢。

当前不要实现抽取器、情节索引、向量检索、剧情召回接口、高级导演调用链，也不要让 Director 直接输出情节库条目；先保留为后续剧情驱动能力的路线图。

## Prompt 规则

Prompt 文件直接在 `prompts/` 上层：

- `initializer.md`
- `director.md`
- `narrator.md`
- `summary.md`

风格绑定在故事配置 JSON 里：

- `directorStyle`
- `narratorStyle`

要改风格，直接改故事库里的 Program Config JSON。代码层不再动态加载用户配置模块，不提供 `/api/modules`，前端也不再有“注入配置”。

风格 prompt 文件只作为参考模板保留，不参与运行时注入：

- `prompts/导演风格/*.md`
- `prompts/叙事风格/*.md`

输入变量用 `{{变量名}}`。变量顺序按稳定性排序：越稳定、越不需要每轮重新理解的内容越靠前；当前玩家输入和最终正文靠后。世界观很短但信息密度高，可以作为短 L2 导向给 Narrator、OptionStrategist、Summary；Summary 仍不接收长历史或召回 L0，只看本轮输入、最终正文、当前状态和短世界观。

运行时只维护根目录 `prompts/*.md` 这一份 prompt。不要恢复 `基准` / `繁花` profile 目录、`active-profile.txt`、prompt 版本切换 API 或前端选择器。

所有实际 LLM 请求都不发送 `system` role。Prompt 模板中的 `# System Message` 段会并入同一条 `user` 消息，避免不同 profile 在 role 层面产生不可控差异。

Hard Rule 删除是未来待办，当前不实现。用户观察到 `prompts/hard-rule.md` 效果可能不明显，后续应先保存当前可用版本，再删除 hard rule 注入、删除/改写对应 prompt 契约测试，最后验证生成质量和内容拦截表现。不要在未保存版本的情况下直接删。

## 模型策略

当前模型层使用“供应商注册表 + 模型目录”。默认主模型固定为官方 DeepSeek `deepseek-v4-flash`。

- 当前可选模型：官方 `deepseek-v4-flash`、官方 `deepseek-v4-pro`、Infron `google/gemini-3.1-flash-lite`。
- 新增供应商时先扩展模型目录和 provider 配置，不要散落硬编码分支。
- API Key 按供应商保存；Key 只保存在浏览器本地或本机 `.env.local`，不提交到 Git。

模型管理默认是一个“当前模型”打完整条流水线。允许用户给 Initializer / Director / Narrator / OptionStrategist / Summary 单独覆盖模型；留空表示跟随当前模型。不要暗中把某个阶段切到 Pro。

模型管理显示叙事人称：`全知第三人称`。这是写作视角，不是世界内人物；不要把它写入人物状态。

速度测试和内容拦截测试继续 append 到记录文件，作为后续判断不同模型的依据，避免凭感觉切换模型。

## 内容过滤规避经验

当前结论：DeepSeek v4 flash + 单一 prompt 是默认策略。除非重新实测，不要恢复“把繁花 hard rule 放入 system”或“弱 system + 强 user”的旧规避方案。当前统一 user-only 输入，减少 role 差异带来的排查成本。

## 当前待办

继续未完成的阶段断点需要补齐。当前实现主要复用已完成的 Director 计划，Narrator、OptionStrategist、Summary、RecallWorker 的中间结果没有完整断点缓存。后续应做成按阶段恢复：已经完成的阶段可见保存，刷新、重启或失败后从下一个未完成阶段继续。

这个断点缓存只用于同一轮故障恢复，不是隐藏 LLM 结果缓存，不做跨轮命中复用，不跳过正常新一轮调用。保存内容必须能在全局流水线或调试状态中看到，便于排查。

前端右侧“上轮反重复提醒”展示需要删除。`feedbackMemory` 仍作为内部状态注入下一轮 Director，但不应常驻显示在右侧栏，避免挤占人物状态和关键信息等更重要的排查空间。

整本小说的分级记忆树需要作为远期方案保留。L0 是原文，L1/L2/L3 是逐级摘要树；摘要只做路标，L0 才是事实证据。检索 LLM 负责在信息不足时从高层定位，再下钻到 L0 原文，不要把这个方案改成普通向量库或把摘要当作可还原原文。

## 不要恢复

- Director / Narrator / OptionStrategist / Summary 缓存。
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
