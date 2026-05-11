# text-game-agent

文字游戏 agent。本文件是唯一项目说明；README 和设计文档已删除。遇到旧聊天记录、旧文档、旧字段冲突时，以当前代码、测试和本文件为准。

## 目标

把故事资料、人物状态、玩家输入转成可连续游玩的文字游戏闭环。优先保持系统短、小、可检查，避免为想象中的复杂问题提前加机制。

## 当前流水线

```text
Initializer -> 用户输入 + 当前状态 + 闭环反馈 + 剧情目标 -> Director -> Narrator -> 返回正文
                                                               ^                         |
                                                               |                         v
                          LongRangeDirector -> 剧情目标 --------+---- PostprocessQueue -> feedbackMemory / 状态 / 总结
```

- Initializer：故事导入后的初始化加工，只生成程序需要的初始结构。
- 用户输入：每轮玩家自由输入，是 Director 和 Narrator 的当前触发点。
- 最近正文：保留第 0 轮和最近 5 轮交互；第 0 轮会随着轮数推进被挤掉。提供给 Director、Narrator、Postprocess；Director 用于判断已发生细节和阶段顺序，Narrator 用于反重复，Postprocess 只用于理解上下文，不能并入本轮总结。
- 闭环反馈：Postprocess 只产生拆分后的负反馈，程序保存为 `feedbackMemory`，只注入下一轮 Director 和 Narrator。
- 玩家负反馈：玩家手动维护的持久控制信号，广播给 Director、Narrator、Postprocess、LongRangeDirector；玩家清空输入框才删除，不写入 `feedbackMemory`。
- Director：只做本轮计划，输出压缩 JSON；不写正文，不输出推理报告。`goalStep` 是本轮向剧情目标靠近的显式桥，`beat1/beat2/beat3/ending` 是具体执行骨架。
- Narrator：按导演计划写玩家可见正文；不更新状态。
- Postprocess：正文显示后进入独立队列，只更新事实总结、人物状态补丁、负反馈和剧情目标状态；不阻塞下一轮输入，不改正文，不生成玩家候选项。
- LongRangeDirector：只生成或修订当前剧情目标；剧情目标是 Director 的上层方向输入，用来控制多轮推进，不直接写正文。
- 剧情目标年龄：程序记录 `longRangeOutlineUpdatedTurn`。同一剧情目标持续 8 轮后小概率触发 LongRangeDirector，15 轮后提高概率，20 轮硬触发；触发后生成或修订更具体的当前剧情目标，以免粗目标长期不变。

## 当前状态设计

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
- Postprocess 只输出 `statusSchemaPatch`、`statusRosterPatch`、`statusStatePatch`。
- 前端人物状态栏直接显示 JSON，不格式化成卡片。
- 不恢复 `statusPanel`、`statusPanelSchema`、`statusSubject`。

## 负反馈设计

Postprocess 输出拆分反馈：

- `违背约束`
- `存在重复`
- `节奏不足`
- `导演推进不足`
- `导演物理违背`

程序保存为 `feedbackMemory`，只注入下一轮 Director 和 Narrator。不要恢复合并版 `qualityFeedback` 状态字段。

未来目标：把负反馈和修订做成每轮必做。当前 Postprocess 同时承担总结归纳、状态维护、负反馈输出，是慢模型下为了压缩调用次数的妥协。模型速度足够快后，拆成更清楚的流水线：

```text
LongRangeDirector -> Director -> Narrator -> Critic -> Revision -> Memory
```

- `Critic`：只检查质量，输出可执行负反馈；重点看导演是否推进剧情目标、叙事是否违反物理约束或世界状态、是否重复、太短、太水、文风漂移。
- `Revision`：每轮默认运行，立即吸收 `Critic` 的负反馈，只修正文，不更新状态。
- `Memory`：只负责长期总结、人物状态补丁、剧情目标触发信号。
- Postprocess 这个名字后续可以消失，或只保留为内部总称。

当前暂时不做；只把它作为速度提升后的下一阶段架构目标。

总结异步化已经落地为 PostprocessQueue。正文生成完成后立即返回给玩家，同时把本轮正文放入后台总结队列：

```text
主链路：玩家输入 -> Director -> Narrator -> 返回正文
后台链路：TurnSummaryQueue -> Memory -> 更新长期总结/人物状态/剧情目标触发信号
```

- 最近正文作为热记忆同步保存，继续提供给下一轮 Director 和 Narrator。
- 长期总结和人物状态作为冷记忆异步更新，允许滞后一轮或几轮。
- Summary 失败只停在队列里等待重试，不阻塞玩家继续游戏。
- 每轮完成后入队一个 summary job；后台按顺序消费，避免旧总结覆盖新状态。
- 负反馈是否同步另行判断；总结天然适合异步化。

导演粒度粗化是未来实验，不直接写进当前 prompt。目标是减少无意义的小选择：要求每轮至少产生一个比较明显的局面变化或信息状态变化，并允许 Director 代劳玩家的合理连续行动，直到产生新变化再停。但这次直接写入 Director / Narrator 后质量下降，后续要用更小范围 A/B 测试，不要一次性替换当前稳定 prompt。

滚动剧情链也是未来实验，暂时不做。思路是把 `goalStep` 改名为 `currentStep`，并新增持久 `stepChains`：

```json
{
  "currentStep": "本轮要执行的剧情链第一步",
  "stepChains": [
    "未来第 1 个剧情推进点",
    "未来第 2 个剧情推进点",
    "未来第 3 个剧情推进点"
  ]
}
```

- `stepChains` 长期保存，每轮重新回灌给 Director。
- Director 每轮取链路第一条作为 `currentStep`，再输出 beat 骨架给 Narrator。
- 本轮结束后，Director 可根据最近正文新增、删除、重排或修改 `stepChains`，保持 3-5 条短链。
- 目标是让低级导演不只看抽象剧情目标，而是维护一条可滚动的剧情链路。
- 如果滚动剧情链验证稳定，可以删除 LongRangeDirector 和剧情目标体系：不再维护 `longRangeOutline`、`longRangeStatus`、`longRangeOutlineUpdatedTurn`，不再保留 8/15/20 轮刷新逻辑，也不再需要 `high-level-director.md`。
- 前提是 `stepChains` 能承担中期方向，而不只是短动作列表；它必须同时解决目标漂移、重复推进和局面过碎的问题。
- 风险是变成大纲奴役、降低临场感；后续必须小范围实验，不要直接替换当前稳定结构。

## Prompt 规则

Prompt 文件直接在 `prompts/` 上层：

- `initializer.md`
- `director.md`
- `narrator.md`
- `postprocess.md`
- `high-level-director.md`

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

当前文游主力模型固定为 Infron 的 `x-ai/grok-4.3`，不是 xAI 官方接口。它在当前实测中同时满足三项要求：

- 速度足够快，能支撑多层流水线和后续修订轮。DeepSeek速度太慢，让体验极差。
- 能力足够强，能执行 Director / Narrator / Postprocess 的复杂上下文任务。如GPT-120b-oss，能力不足以理解任务指令。
- 内容通过率最好；在当前 prompt 下也能稳定工作，不需要依赖 prompt 术语壳做规避。其他模型即使做了 prompt 来绕过，仍然不稳定。

其他模型保留在模型管理和测试列表里，只作为连通性、速度和内容拦截对照，不作为默认推荐。不要因为单次成功就把默认模型切回 Gemini、DeepSeek、MiMo、Qwen 或 GLM；必须先用速度记录和内容拦截记录验证。

速度测试和内容拦截测试继续 append 到记录文件，作为后续换模型的依据，避免凭感觉切换模型。

## 内容过滤规避经验

旧经验：Gemini TPS 高，但内容过滤强；繁花式 prompt 可以通过语义改写降低触发概率，但并不稳定。

当前结论：Grok 4.3 + 单一 prompt 更均衡。除非重新实测，不要恢复“把繁花 hard rule 放入 system”或“弱 system + 强 user”的旧规避方案。当前统一 user-only 输入，减少 role 差异带来的排查成本。

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

默认模型是 Infron `google/gemini-3.1-flash-lite`。网页右上角可配置 API Key，保存在当前浏览器本地；也可用环境变量。

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
