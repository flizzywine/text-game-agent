# text-game-agent

文字游戏 agent。本文件是唯一项目说明；README 和设计文档已删除。遇到旧聊天记录、旧文档、旧字段冲突时，以当前代码、测试和本文件为准。

## 目标

把故事资料、人物状态、玩家输入转成可连续游玩的文字游戏闭环。优先保持系统短、小、可检查，避免为想象中的复杂问题提前加机制。

## 当前流水线

```text
Initializer -> 用户输入 + 当前状态 + 闭环反馈 + 剧情目标 -> Director -> Narrator -> Postprocess
                                                               ^                         |
                                                               |                         v
                          LongRangeDirector -> 剧情目标 --------+---- feedbackMemory <----+
```

- Initializer：故事导入后的初始化加工，只生成程序需要的初始结构。
- 用户输入：每轮玩家自由输入，是 Director 和 Narrator 的当前触发点。
- 最近正文：保留第 0 轮和最近 7 轮交互；第 0 轮会随着轮数推进被挤掉。提供给 Director 和 Narrator；Director 用于判断已发生细节和阶段顺序，Narrator 用于反重复。
- 闭环反馈：Postprocess 只产生拆分后的负反馈，程序保存为 `feedbackMemory`，只注入下一轮 Director 和 Narrator。
- 玩家负反馈：玩家手动维护的持久控制信号，广播给 Director、Narrator、Postprocess、LongRangeDirector；玩家清空输入框才删除，不写入 `feedbackMemory`。
- Director：只做本轮计划，输出压缩 JSON；不写正文，不输出推理报告。
- Narrator：按导演计划写玩家可见正文；不更新状态。
- Postprocess：正文显示后运行，只更新事实总结、人物状态补丁、三类负反馈、剧情目标状态和玩家候选项；不改正文。
- LongRangeDirector：只生成或修订当前剧情目标；剧情目标是 Director 的上层方向输入，用来控制多轮推进，不直接写正文。
- 剧情目标年龄：程序记录 `longRangeOutlineUpdatedTurn`。同一剧情目标持续 20 轮后，即使 Postprocess 仍判 `keep`，也强制触发 LongRangeDirector，以免粗目标长期不变。

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

- `narrativeConstraintFeedback`
- `narrativeRepetitionFeedback`
- `narrativePacingFeedback`
- `directorProgressFeedback`
- `directorPhysicalFeedback`

程序保存为 `feedbackMemory`，TTL 1 轮，下一轮注入 Director 和 Narrator。不要恢复合并版 `qualityFeedback` 状态字段。

未来可考虑“自动修订轮”：当 Postprocess 发现 Narrator 严重偏离物理约束、世界状态或出现明显质量问题时，不把偏差写成下一轮负反馈，而是立即触发一次修订生成。主要阻碍是时间成本；等模型 token 速度足够快后再引入。暂时不做；当前只保留跨轮有效的负反馈。

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

默认模型是官方 `deepseek-v4-flash`。网页右上角可配置 API Key，保存在当前浏览器本地；也可用环境变量。

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
