# text-game-agent

文字游戏 agent。本文件是唯一项目说明；README 和设计文档已删除。遇到旧聊天记录、旧文档、旧字段冲突时，以当前代码、测试和本文件为准。

## 目标

把故事资料、人物状态、玩家输入转成可连续游玩的文字游戏闭环。优先保持系统短、小、可检查，避免为想象中的复杂问题提前加机制。

## 当前流水线

```text
Initializer -> 初始剧情目标 / 人物状态 / 世界观

主链路：玩家输入 + 最近正文 + 当前状态 + 剧情目标 + 上轮反重复提醒 + 上轮物理约束 -> Director -> Narrator -> 返回正文
                                                                                              |
                                                                                              v
后台链路：PostprocessQueue -> PostprocessSummary / PostprocessFeedback
```

- Initializer：故事导入后的初始化加工，只生成程序需要的初始结构。
- 用户输入：每轮玩家自由输入，是 Director 和 Narrator 的当前触发点。
- 最近正文：保留第 0 轮和最近 5 轮交互；第 0 轮会随着轮数推进被挤掉。提供给 Director、Narrator、PostprocessFeedback；Director 用于判断已发生细节和阶段顺序，Narrator 用于反重复，PostprocessFeedback 只用于理解上下文，不能并入本轮总结。
- 上轮反重复提醒：PostprocessFeedback 只产生少量下一轮参考，程序保存为 `feedbackMemory`，注入下一轮 Director / Narrator；它不是当轮修订闭环。
- 上轮物理约束：Director 每轮接收上一轮 `physicalConstraints`，继承仍成立的纯物理限制，输出本轮新的 `physicalConstraints` 供下一轮使用。
- 玩家负反馈：玩家手动维护的持久提醒，广播给 Director、Narrator、Postprocess；玩家清空输入框才删除，不写入 `feedbackMemory`。
- Director：只做本轮计划，输出压缩 JSON；不写正文，不输出推理报告。`goalStep` 是本轮向剧情目标靠近的显式桥，`beat1/beat2/beat3/ending` 是具体执行骨架。
- Narrator：按导演计划写玩家可见正文；不更新状态。
- PostprocessSummary：正文显示后进入独立队列，只看最终正文、玩家输入和当前人物状态，更新本轮事实总结、人物状态字段补丁、人物名单补丁、人物状态补丁；不做反馈，不改正文。
- PostprocessFeedback：在 Summary 之后运行，接收世界观、长期总结、剧情目标、最近正文、最近 5 轮 Director 计划、本轮 Director 计划和玩家负反馈，只更新 `plotGoal`、`文字细节重复`、`剧情设计重复`、`可选扰动源`；不维护人物状态，不改正文。
- 剧情目标：Initializer 生成初始 `plotGoal`。`plotGoal` 不是 if/else 变量，而是连接短期正文和未来几轮方向的骨架；PostprocessFeedback 必须尽可能保持不变，只有正文已经明显完成、偏离、打断或使当前目标无法继续时才微调或替换。

## 当前状态设计

长期变量不是程序状态机，也不是 if/else 变量，而是记忆种子和承前启后的骨架。它的作用是让文本流保留前因、接住后果、维持方向，连接短期正文和长期走势；不是让 LLM 像执行代码一样精确服从规则。不要用长期变量管理世界，只用它给下一轮生成提供必要锚点。

程序不是 LLM 的 harness 或 controller，而是 backbone。程序只收集 LLM 的输出，压缩必要部分，再回灌给后续轮次；目标是让文本前后连续、一致、有承接，不是控制 LLM 精确服从。

人物状态只保留三块：

```json
{
  "statusSchema": ["位置", "姿势", "外显状态"],
  "statusRoster": ["玩家", "NPC名"],
  "statusState": {
    "玩家": {"位置": "车内"}
  }
}
```

- `statusRoster` 只保存名字，不保存 `id/name/active` 对象。
- 默认 roster 内人物都 active。
- PostprocessSummary 只输出 `statusSchemaPatch`、`statusRosterPatch`、`statusStatePatch`。
- 前端人物状态栏直接显示 JSON，不格式化成卡片。
- 不恢复 `statusPanel`、`statusPanelSchema`、`statusSubject`。

## 反重复提醒设计

PostprocessFeedback 只保留两个反重复提醒字段：

- `文字细节重复`
- `剧情设计重复`
- `可选扰动源`

`文字细节重复` 只承担文面、句式、动作、感官词和同类描写的反重复提醒，注入下一轮 Director 和 Narrator。禁词表直接注入 Narrator，当轮约束正文，不再交给 PostprocessFeedback 延迟处理。`剧情设计重复` 对照最近 5 轮 Director 计划，提醒 Director 避免反复使用同类剧情装置，只注入下一轮 Director。`可选扰动源` 默认必须为空，只有剧情变钝、重复或缺少入口时才给 Director 一个低频变化种子，Narrator 不接收。不要恢复合并版 `qualityFeedback` 状态字段，也不要恢复 `违背约束`、`节奏不足`、`导演推进不足`、`导演物理违背` 等反馈字段。

当前结论：大多数负反馈约束作用很小。约束不住时无效，约束住时会削弱文本灵动感。没有修订轮时，反重复提醒不能立刻改变已经输出的正文；如果要当轮生效，需要额外 Critic + Revision 调用，时间成本暂时不接受。主要连贯性依赖世界观、人物状态、人物性格、最近正文、长期总结和物理约束。只保留反重复相关反馈，因为成本低、方向清楚。

未来目标：模型速度足够快后，再把质量检查和修订做成每轮必做。当前已经把后处理拆成 Summary / Feedback，但 Feedback 仍只影响下一轮；更清楚的未来流水线：

```text
Director -> Narrator -> Critic -> Revision -> Memory
```

- `Critic`：只检查质量，输出可执行质量提醒；重点看导演是否推进剧情目标、叙事是否违反物理约束或世界状态、是否重复、太短、太水、文风漂移。
- `Revision`：每轮默认运行，立即吸收 `Critic` 的提醒，只修正文，不更新状态。
- `Memory`：只负责长期总结、人物状态补丁、剧情方向骨架更新。
- Postprocess 这个名字后续可以消失，或拆成 `Critic` / `Memory`。

当前暂时不做；只把它作为速度提升后的下一阶段架构目标。

剧情目标跳变是未来实验，暂时不做。思路是程序随轮数增加逐步提高触发概率；一旦触发，只给当轮 PostprocessFeedback 追加一条临时指令：通过引入外部事件、合乎逻辑的角色诉求改变，或放大前文细微线索，引发较大程度的 `plotGoal` 改变。目的不是随机毁线，而是在已有正文、人物状态和世界观允许的范围内，引入低频惊喜或惊吓，打破长期目标过稳导致的路径依赖。触发后由 PostprocessFeedback 输出新的 `plotGoal`，下一轮 Director 再自然靠近新目标。

导演 beat 改造是未来实验，暂时不做。当前 Director 已能稳定给出剧情骨架，但 beat 容易偏动作、外在反应和环境描写，导致 Narrator 即使被要求补充对话和心理，也会被 beat 框住。后续可把 beat 的“描写对象”从 `氛围 / 人物 / 行为` 改成更接近写法的展开方式，例如 `动作推进 / 对话推进 / 心理承压 / 环境压迫 / 人物反应 / 玩家描写`，让 Director 不写正文，只给 Narrator 留出对话、心理和玩家状态描写的展开口。

## 场景模块

场景模块是可开关的 skill 式场景增强包，用来按场景加载少量知识、写法和连续性提醒，不承担剧情控制。模块文件放在 `prompts/scene-modules/*.md`，用 frontmatter 声明 `name`、`description`，正文只写短场景细节和连续性提醒。

运行方式：

```text
前端弹窗勾选并确认启用模块 -> 启用模块索引注入 PostprocessFeedback -> PostprocessFeedback 输出 selectedSceneModules -> selectedSceneModules 保存为下一轮 Director 和 Narrator 的本轮场景模块
```

- 前端未启用的模块不进入 Director 候选列表；选择必须在弹窗中点“确定”才保存。
- 场景模块对外只使用中文名，不维护额外 id；PostprocessFeedback 每轮最多选择 2 个 `selectedSceneModules`，无相关场景时必须空数组。
- PostprocessFeedback 本轮选中的模块影响下一轮 Director 和 Narrator；Director 不负责选择场景模块，只接收已选模块作为场景参考。
- 下一轮 PostprocessFeedback 会重新选择，不自动沿用。
- 程序丢弃无效名称，并强制最多 2 个，避免模块系统变成 prompt 堆积。

后处理异步化已经落地为 PostprocessQueue。正文生成完成后立即返回给玩家，同时把本轮正文放入后台队列：

```text
主链路：玩家输入 -> Director -> Narrator -> 返回正文
后台链路：PostprocessQueue -> PostprocessSummary 更新长期总结/人物状态 -> PostprocessFeedback 更新反重复提醒/剧情目标
```

- 最近正文作为热记忆同步保存，继续提供给下一轮 Director 和 Narrator。
- 长期总结、人物状态、反重复提醒和剧情目标作为冷记忆异步更新，允许滞后一轮或几轮。
- Postprocess 失败只停在队列里等待重试，不阻塞玩家继续游戏。
- 每轮完成后入队一个 postprocess job；后台按顺序消费，每个 job 内部分成 Summary 和 Feedback 两次调用，避免旧总结覆盖新状态。
- 反重复提醒异步后最多持续 3 轮；这是当前速度和质量之间的明确取舍。

导演粒度粗化是未来实验，不直接写进当前 prompt。目标是减少无意义的小选择：要求每轮至少产生一个比较明显的局面变化或信息状态变化，并允许 Director 代劳玩家的合理连续行动，直到产生新变化再停。但这次直接写入 Director / Narrator 后质量下降，后续要用更小范围 A/B 测试，不要一次性替换当前稳定 prompt。

世界书召回暂时不做，优先用 skill 式场景模块替代。世界书召回会把问题变成实体提名、别名匹配、词条限量和噪音控制；场景模块更简单：用户先勾选允许使用的模块，PostprocessFeedback 每轮按当前局面挑选最多 2 个，下一轮注入 Director 和 Narrator。

- 目标是减少整段世界观常驻输入，让模型只拿到本轮真正相关的场景锚点。
- 模块内容可以承载局部世界观、地点规则、组织氛围、道具用法、场景写法和禁用套路。
- 不让 Director 输出实体列表，不做向量检索，不维护独立世界书索引，除非后续场景模块无法覆盖需求。

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

当前文游默认主模型固定为官方 DeepSeek `deepseek-v4-flash`。当前判断是：去掉/弱化后处理后，速度可接受，文字质量优于 Grok 4.3。

- 速度不如 Grok/Gemini，但在当前流水线下不是不可接受。
- 文字质量更好，更适合默认游玩。
- Grok 4.3 保留为备用和测试对照。

模型管理只认一个“当前模型”。不要再恢复 Initializer / Director / Narrator / Postprocess 分层路由；用户在模型管理里保存哪个模型，整条流水线就都用哪个模型。全局流水线展示也必须显示这一点，不能暗中把 Director / Narrator / Initializer 切到 Pro。

其他模型保留在模型管理和测试列表里，只作为连通性、速度和内容拦截对照，不作为默认推荐。后续切换默认模型必须看速度记录、内容拦截记录和实际文字质量，不要只凭单次成功切换。

速度测试和内容拦截测试继续 append 到记录文件，作为后续换模型的依据，避免凭感觉切换模型。

## 内容过滤规避经验

旧经验：Gemini TPS 高，但内容过滤强；繁花式 prompt 可以通过语义改写降低触发概率，但并不稳定。

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

默认模型是官方 DeepSeek `deepseek-v4-flash`。网页右上角可配置 API Key，保存在当前浏览器本地；也可用环境变量。

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
