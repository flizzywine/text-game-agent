# text-game-agent

文字游戏 agent MVP。

目标：把酒馆预设里的自然语言模块工程化：Initializer 负责故事首次加工；Director、Narrator、Postprocess 默认固定调用；Editor 是可选精修层；文风、特殊格式、偏好是用户注入模块；人物、世界观、地点、剧情记忆是动态注入模块。干净输出、对话平衡、抗缺陷、通用禁用套话、禁用库、逻辑加强、自我辩证已经内化。

```text
快速模式：Director -> Narrator -> Postprocess
精修模式：Director -> Narrator -> Editor -> Postprocess
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

- `src/promptPipeline.ts`：预设抽取与三层 pipeline 构建。
- `scripts/extract-kedai-user-config.ts`：从可待预设抽取可复用的用户配置 Markdown。
- `scripts/roleplay-mvp-demo.ts`：生成三层调用 demo。
- `scripts/web-server.ts`：本地网页和 DeepSeek API 代理。
- `web/`：文字游戏网页 UI。
- `prompts/system-hard-rules/`：系统硬规则、必读上/下。
- `prompts/initializer/`：故事初始化层 `prompt.md`。
- `prompts/director/`：导演层 `prompt.md`。
- `prompts/narrator/`：叙事者层 `prompt.md`。
- `prompts/editor/`：编辑层 `prompt.md`。
- `prompts/postprocess/`：后处理层 `prompt.md`。
- `prompts/user-config/`：用户配置项目录；一个配置项就是一个 `.md` 文件。
- `prompts/dynamic-loading/`：动态加载项说明；实际知识库来自角色卡、故事书、长期记忆和最近正文。
- `config/dynamic-loading/`：动态加载项元数据和后续检索配置。
- `story/`：故事初始化资料；导入人物卡、故事书、世界书时保留原文件，生成 Markdown，并固化程序初始化配置。
- `save/`：进度存档；保存当前故事、聊天记录、人物状态、上下文和当前选中故事。
- `data/roleplay-mvp/player-config.json`：玩家侧配置，当前用于启用用户注入模块。
- `data/roleplay-mvp/roleplay-pipeline-demo.json`：MVP 输出样例。

## Fixed Prompts

Initializer 不是 skill。它是故事导入后的初始化加工层，只在 `program-config` 不存在或 force 重建时调用。它把人物卡、故事书、世界书统一转换成程序格式：世界观、登场人物介绍、第一轮开场交互、初始玩家选项、人物状态 schema、初始人物状态、规范化资料条目和初始全局上下文。初始化阶段不生成长期大纲和剧情线。固定 prompt 在 `prompts/initializer/prompt.md`。

Director 不是 skill。前置分析、全面小说创作指导、模块化剧情、描写发展链、伏笔、大纲、慢推进、玩家窗口都合并在 `prompts/director/prompt.md`。

Narrator 也不是 skill。叙事前置执行、全面小说写作执行、中段自检、正文生成职责、输出 schema 放在 `prompts/narrator/prompt.md`。

Editor 也不是 skill。后置审核、逻辑加强、自我审查、小说质量审核、风格修订、禁用项检查、输出 schema 放在 `prompts/editor/prompt.md`。默认关闭，网页开启“精修”后才调用。

后续 Director 只能请求人物、世界、地点、剧情记忆等动态注入模块，不能请求 `director.*` / `narrator.*` / `editor.*` 能力模块。

可待的“思维链前 / 中 / 后”不作为可见思维链输出，而是内化成三层结构化检查字段：Director 的 `preflight`、Narrator 的 `draftChecks`、Editor 的 `qualityAssessment` 和 `nextTurnGuidance`。

## Module Types

| 类型 | 例子 | 加载方式 |
|---|---|---|
| 固定模块 | Director、Narrator、Postprocess | 程序默认固定调用 |
| 可选固定模块 | Editor | 精修模式才调用 |
| 用户注入模块 | 语言、字数、人称、转述、抢话、主导权、剧情强度、推进速度、文风、强指令一致性、成人题材强度 | 玩家手动启用；快速模式注入 Director / Narrator，精修模式额外注入 Editor |
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

运行 `npm run web` 后，启用的用户注入模块会注入 Director / Narrator；开启精修时也会注入 Editor，不经过 Director 请求。网页里可以展开“查看内容”。

用户注入模块不再使用 JSON 引用 Markdown。一个配置项就是一个 Markdown 文件，放在 `prompts/user-config/`。

```md
---
id: "第二人称"
name: "第二人称"
description: "以“你”的角度承接玩家输入。"
group: "人称"
exclusiveGroup: "人称"
enabled: true
---
这里写实际注入内容。
```

后端每次处理 `/api/modules` 时都会重新扫描 `prompts/user-config/*.md`。新增或删除配置项，直接在这个目录增删 `.md` 文件；网页刷新后生效。

内置用户注入选项包括：语言、字数、人称、转述、抢话、主导权、剧情强度、推进速度、文风、强指令一致性和成人题材强度。语言、字数、人称、转述、抢话、主导权、剧情强度、推进速度、文风为互斥组，同组只保留一个启用项。

`干净输出` 和 `对话平衡` 不再作为用户注入模块：干净输出进入硬规则、Narrator 和 Editor；对话平衡进入 Narrator 和 Editor。

`抗缺陷` 和 `通用禁用套话` 不再作为用户注入模块：抗缺陷进入 Narrator 和 Editor；通用禁用套话进入硬规则和 Editor。

说明：`directSkillIds` 仍保留为旧配置兼容字段，新代码优先读取 `userInjectionModuleIds`。

## Web MVP

启动：

```bash
npm run web
```

默认：

```text
baseUrl: https://api.deepseek.com
model: deepseek-v4-pro
```

API Key 可在网页右上角 `API Key` 弹窗中配置，保存在当前浏览器本地。也可以继续用 `DEEPSEEK_API_KEY=你的key npm run web` 作为服务端环境变量。

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
- `program-config` 是故事书转程序格式后的固化配置，包含世界观、登场人物介绍、第一轮开场交互、初始玩家选项、人物状态 schema、初始人物状态、规范化资料条目和初始全局上下文；初始化阶段不生成长期大纲和剧情线。
- 初始化必须在 `故事库` 手动触发，并通过 `/api/initialize-story-stream` 分阶段显示 Initializer 流水线。开始新游戏只列出已初始化故事；未初始化、初始化失败、缺少 API Key 或配置字段不完整时不能进入游戏。
- 每轮后处理会按该故事的人物状态 schema 输出完整最新人物状态。
- 点击发送后使用 `/api/generate-stream` 分阶段流式显示 Director / Narrator / Editor / Postprocess 的流水线输出；最终事件返回后才写入正文。人物状态只由 Postprocess 阶段更新。
- 游玩进度会写入 `save/current-state.json`：保存聊天记录、人物状态、当前故事和上下文。
- 保存游戏直接写入本地 `save/current-state.json`，不下载文件；可从页面删除当前本地存档。
- 只支持 DeepSeek v4 pro；网页提供 API Key 配置，不提供模型切换。
- 默认快速模式不调用 Editor；开启“精修”后增加 Editor 调用。
- 每轮固定生成 3 个玩家候选项，点击后填入输入框，也可自由输入。
- 本地 Node 代理调用 DeepSeek；网页配置的 API key 只保存在当前浏览器本地。
