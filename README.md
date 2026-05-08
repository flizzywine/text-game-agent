# text-game-agent

文字游戏 agent MVP。

目标：把酒馆预设里的自然语言模块工程化：Initializer 负责故事首次加工；Director、Narrator、Postprocess 固定调用；文风、特殊格式、偏好是用户注入模块；人物、世界观、地点、剧情记忆是动态注入模块。干净输出、对话平衡、抗缺陷、通用禁用套话、禁用库、逻辑加强、自我辩证已经内化。

```text
默认模式：Director -> Narrator -> Postprocess
```

## Commands

```bash
npm install
npm test
npm run extract-user-config
npm run mvp-demo
npm run web
```

## Layout

- `src/promptPipeline.ts`：预设抽取与 Director / Narrator pipeline 构建。
- `scripts/extract-kedai-user-config.ts`：从可待预设抽取可复用的用户配置 Markdown。
- `scripts/roleplay-mvp-demo.ts`：生成 Director / Narrator 调用 demo。
- `scripts/web-server.ts`：本地网页和模型 API 代理。
- `web/`：文字游戏网页 UI。
- `prompts/system-hard-rules/`：系统硬规则、必读上/下。
- `prompts/initializer/`：故事初始化层 `prompt.md`。
- `prompts/director/`：导演层 `prompt.md`。
- `prompts/narrator/`：叙事者层 `prompt.md`。
- `prompts/postprocess/`：后处理层 `prompt.md`。
- `prompts/user-config/`：旧用户配置项目录；保留文件但运行时不扫描。
- `prompts/user-config-templates/`：当前用户配置目录；一个配置项就是一个 `.md` 文件，当前分为导演风格和叙事风格。
- `prompts/dynamic-loading/`：动态加载项说明；实际知识库来自角色卡、故事书、长期记忆和最近正文。
- `config/dynamic-loading/`：动态加载项元数据和后续检索配置。
- `story/`：故事初始化资料；导入人物卡、故事书、世界书时保留原文件，生成 Markdown，并固化程序初始化配置。
- `save/`：进度存档；保存当前故事、聊天记录、人物状态、上下文和当前选中故事。
- `data/roleplay-mvp/player-config.json`：玩家侧配置，当前用于启用用户注入模块。
- `data/roleplay-mvp/roleplay-pipeline-demo.json`：MVP 输出样例。

## Fixed Prompts

Initializer 不是 skill。它是故事导入后的初始化加工层，只在 `program-config` 不存在或 force 重建时调用。它把人物卡、故事书、世界书统一转换成程序格式：世界观、登场人物介绍、第一轮开场交互、初始玩家选项、人物状态 schema、初始人物状态、初始环境状态、规范化资料条目和初始全局上下文。初始化阶段不生成长期大纲和剧情线。固定 prompt 在 `prompts/initializer/prompt.md`。

Director 不是 skill。前置分析、全面小说创作指导、模块化剧情、描写发展链、伏笔、大纲、慢推进、玩家窗口都合并在 `prompts/director/prompt.md`。

Director 输出必须保持压缩：只给 Narrator 可执行的结构化结论，不输出 reason、长 checklist、完整推理报告，也不复述语言、人称、目标字数、轮次这类固定配置。剧情模块按数组顺序表达，不输出 `id`、`kind`、`targetWords`、`beatId`、`mode`、`chain`、`notes` 这类结构回声。伏笔 plant/delay/payoff/drop 由 Director 决定，程序负责合并。`stateUpdates`、后处理任务、身体/空间状态不由 Director 输出；状态交给 Postprocess，空间状态由程序直接作为“叙事空间输入”传给 Narrator。程序会在进入 Narrator / Postprocess 前再次压缩 Director plan，并使用无缩进 JSON 传递。

Narrator 也不是 skill。叙事前置执行、全面小说写作执行、正文生成职责、输出 schema 放在 `prompts/narrator/prompt.md`。

Narrator 不再放“静默自修”段落，只保留 OOC、物理姿势、玩家主导和正文纯净这类直接写作约束，方便测试生成耗时是否下降。

Editor 模块已删除。正文质量通过工程纪律约束：Director 只输出压缩计划并负责伏笔设置/回收，Narrator 内化 OOC、物理姿势、玩家主导、正文纯净和禁用套话规则，Postprocess 只更新状态、事实总结、候选项和 `qualityFeedback`，不改正文。

`qualityFeedback` 是长期写作负反馈：允许本轮正文有轻微偏差，但把“下一轮要避免什么”作为独立状态注入下一轮 Director / Narrator。不需要时可以清空或被新反馈覆盖，不写入长期剧情总结。

`sceneState` 是唯一环境状态字段：只保存一句会持续限制行动合法性的场景事实，由 Initializer 初始化、Postprocess 沿用或更新，下一轮注入 Director / Narrator。不要把它扩展成复杂状态机。

后续 Director 只能请求人物、世界、地点、剧情记忆等动态注入模块，不能请求 `director.*` / `narrator.*` 能力模块。

可待的“思维链前 / 中 / 后”不作为可见思维链输出，而是内化成短结构化导演字段、Narrator 的正文边界和空间约束、Postprocess 的状态更新和下一轮提示。

## Module Types

| 类型 | 例子 | 加载方式 |
|---|---|---|
| 固定模块 | Director、Narrator、Postprocess | 程序默认固定调用 |
| 用户配置模块 | 导演风格、叙事风格 | 玩家手动启用；导演风格注入 Director，叙事风格注入 Narrator |
| 动态注入模块 | 人物、世界观、地点、剧情记忆 | Director 请求后加载 |

## User Modules

文风、特殊格式、偏好这类配置放进 `userInjectionModuleIds`：

```json
{
  "userInjectionModuleIds": [
    "🔒🖊️基础文风"
  ]
}
```

运行 `npm run web` 后，程序只扫描 `prompts/user-config-templates/`。启用的用户配置模块按 `layer` 分层注入：`director` 进入 Director，`narrator` 进入 Narrator。Postprocess 不接收用户风格配置，只使用固定通用 prompt。网页里可以展开“查看内容”。

用户注入模块不再使用 JSON 引用 Markdown。一个配置项就是一个 Markdown 文件。旧文件继续放在 `prompts/user-config/`，但运行时当它不存在；后续只在 `prompts/user-config-templates/` 里增删改。

新配置推荐显式写 `layer`：

```yaml
layer: "director"  # 导演风格：剧情如何生长
layer: "narrator"  # 叙事风格：正文如何表达
```

```md
---
id: "第二人称"
name: "第二人称"
description: "以“你”的角度承接玩家输入。"
group: "叙事风格"
exclusiveGroup: "narrator-style"
layer: "narrator"
enabled: true
---
这里写实际注入内容。
```

后端每次处理 `/api/modules` 时都会重新扫描 `prompts/user-config-templates/*.md`。新增或删除配置项，直接在这个目录增删 `.md` 文件；网页刷新后生效。

导演风格和叙事风格都是单选：同一层存在多个 `enabled: true` 时，后端只保留排序后的第一个生效。

`干净输出` 和 `对话平衡` 不再作为用户注入模块：干净输出进入硬规则和 Narrator；对话平衡进入 Narrator。

`抗缺陷` 和 `通用禁用套话` 不再作为用户注入模块：抗缺陷进入 Narrator；通用禁用套话进入硬规则和 Narrator。

说明：`directSkillIds` 仍保留为旧配置兼容字段，新代码优先读取 `userInjectionModuleIds`。

## Web MVP

启动：

```bash
npm run web
```

默认：

```text
DeepSeek: https://api.deepseek.com
Fireworks: https://api.fireworks.ai/inference/v1
默认模型: accounts/fireworks/models/deepseek-v4-pro:priority
```

API Key 可在网页右上角 `API Key` 弹窗中配置，保存在当前浏览器本地。模型选 Official 时保存 DeepSeek key；模型选 Fireworks Priority 时保存 Fireworks key。也可以继续用服务端环境变量：

```bash
DEEPSEEK_API_KEY=你的key npm run web
FIREWORKS_API_KEY=你的key npm run web
```

打开：

```text
http://127.0.0.1:4173
```

网页功能：

- 人物状态面板。
- 右侧只显示人物状态和全局流水线；全局上下文仍由程序内部累积，不在前端手动编辑。
- 多故事切换；开始新游戏必须先选择故事资料，每个故事独立保存对话、人物状态、故事资料、上下文和选项。
- 顶部 `故事库` 是故事资料的独立入口：在这里导入人物卡 / 故事书 / 世界书，并手动点击初始化。
- 用户注入模块选择。
- 故事资料导入，支持 JSON / Markdown / txt / 酒馆 PNG 人物卡 / 世界书。
- 酒馆人物卡导入后会自动拆成“人物状态 + 角色设定 / 开场白 / 对话范例 / 角色书条目”。
- 世界书导入后会拆成可启用的动态资料条目，生成时注入当前故事。
- 导入素材会写入 `story/`：保留原始文件，生成同内容的 Markdown 资料；不会自动初始化。
- `program-config` 是故事书转程序格式后的固化配置，包含世界观、登场人物介绍、第一轮开场交互、初始玩家选项、人物状态 schema、初始人物状态、初始环境状态、规范化资料条目和初始全局上下文；初始化阶段不生成长期大纲和剧情线。
- 初始化必须在 `故事库` 手动触发，并通过 `/api/initialize-story-stream` 分阶段显示 Initializer 流水线。开始新游戏只列出已初始化故事；未初始化、初始化失败、缺少 API Key 或配置字段不完整时不能进入游戏。
- 每轮后处理会按该故事的人物状态 schema 输出完整最新人物状态，更新一句 `sceneState` 环境状态，并给出一条可废弃的写作负反馈。
- 点击发送后使用 `/api/generate-stream` 分阶段流式显示 Director / Narrator / Postprocess 的流水线输出；Narrator 正文先显示，Postprocess 后台更新人物状态、事实总结、写作负反馈和候选项。Postprocess 完成前不能发送下一轮。
- 如果正文已显示但 Postprocess 失败，可点击 `重试未完成阶段`，只补跑 Postprocess，不重写正文。
- 游玩进度会写入 `save/current-state.json`：保存聊天记录、人物状态、当前故事和上下文。
- 保存游戏直接写入本地 `save/current-state.json`，不下载文件；可从页面删除当前本地存档。
- 支持 DeepSeek V4 Pro Official 和 Fireworks DeepSeek V4 Pro Priority 切换；默认使用 Fireworks Priority。
- 每轮固定生成 3 个玩家候选项，点击后填入输入框，也可自由输入。
- 本地 Node 代理按模型调用 DeepSeek 或 Fireworks；网页配置的 API key 只保存在当前浏览器本地。

Postprocess 完成后，会基于最新状态和 3 个候选项提前生成下一轮 Director / Narrator 缓存。玩家输入新内容时会取消不匹配的后台预热；若命中正在预热的候选项，只短暂等待，超过 `PREWARM_WAIT_MS` 就转为前台生成，避免页面卡死。
