# Text Game Agent 设计

## 目标

把酒馆预设里的自然语言模块工程化：

```text
系统硬规则
导演
叙事者
编辑
后处理
用户配置项
动态加载项
```

除此之外不再保留其他 prompt 分类。

## Prompt 目录

```text
prompts/
  system-hard-rules/
    hard-rules.md
    must-read-top.md
    must-read-bottom.md
  director/
    prompt.md
  narrator/
    prompt.md
  editor/
    prompt.md
  postprocess/
    prompt.md
  user-config/
    *.md
  dynamic-loading/
    README.md
```

各 prompt 文件统一格式：

```text
用途：这个 prompt 负责什么
什么时候用：在哪一层、哪一步调用
怎么用：程序如何读取和注入
---
实际发送给模型的 prompt 正文
```

程序只读取 `---` 之后的正文。

## 固定流水线

每轮默认生成三次调用：

```text
Director -> Narrator -> Postprocess
```

开启精修模式时插入 Editor：

```text
Director -> Narrator -> Editor -> Postprocess
```

| 层 | 文件 | 职责 |
|---|---|---|
| Director | `prompts/director/prompt.md` | 剧情规划、模块化剧情、描写发展链、伏笔、节奏、玩家窗口 |
| Narrator | `prompts/narrator/prompt.md` | 根据导演计划写正文草稿 |
| Editor | `prompts/editor/prompt.md` | 精修模式启用；审核 OOC、全知、时间线、世界观、重复、禁用项、推进过快 |
| Postprocess | `prompts/postprocess/prompt.md` | 生成总结、长期上下文补丁、伏笔、逻辑提醒、人物状态更新、玩家选项 |

这四层都是固定模块，不是 skill。Editor 默认关闭，用于节省一次模型调用；精修模式才开启。

## 系统硬规则

`prompts/system-hard-rules/` 保存全局硬规则：

- `must-read-top.md`：包裹每层 prompt 的上边界。
- `must-read-bottom.md`：包裹每层 prompt 的下边界。
- `hard-rules.md`：每层注入的不可覆盖规则。

`必读上` 和 `必读下` 不混入普通硬规则，而是包裹每层完整 prompt。

## 用户配置项

用户配置项是玩家手动启用的偏好，不由 Director 动态请求。

```text
prompts/user-config/*.md
```

一个配置项就是一个 Markdown 文件。文件头保存元数据，分隔线之后保存实际注入内容：

```md
---
id: "散文文风"
name: "散文文风"
description: "更舒展、细腻、带有抒情感。"
group: "文风"
exclusiveGroup: "文风"
enabled: false
---
这里写实际注入内容。
```

后端每次处理 `/api/modules` 时都会重新扫描 `prompts/user-config/*.md`。新增或删除配置项，直接增删这个目录里的 `.md` 文件；网页刷新后生效。

启用后默认注入：

```text
Director
Narrator
Postprocess 前的运行上下文
```

精修模式开启时也会注入 Editor。

当前用户配置项包括语言、字数、人称、转述、玩家代行、剧情主导、剧情强度、剧情速度、文风、质量控制、输出格式、场景教学、禁用库扩展、指令一致性、成人题材强度。

同组互斥项使用 `exclusiveGroup`，避免多开互相冲突。

## 动态加载项

动态加载项是真正可由 Director 请求加载的知识库内容。

来源：

- 酒馆人物卡 JSON / PNG
- 故事书 JSON / Markdown / txt
- 世界书 / World Info JSON
- 手动新增故事条目
- Postprocess 生成的长期剧情总结
- 最近正文窗口

当前 MVP 运行方式：

```text
前端导入内容
-> 存入当前故事槽 / localStorage
-> 生成时把启用条目发给 /api/generate
-> 后端渲染为【已加载动态注入模块】
```

每个故事槽独立保存人物状态、故事资料、全局上下文、最近正文、用户模块开关和候选项。保存存档会导出当前故事 JSON；加载存档会把 JSON 作为新故事加入并切换过去。

Director 现在会看到轻量 registry，也可以输出 `loadModuleIds`。程序暂时还没有执行二阶段按需加载；当前仍是“启用条目整体注入”。

下一步动态加载目标：

```text
Director 先看 registry
-> 输出 loadModuleIds
-> 程序只加载被请求的知识库条目
-> Narrator 使用精简后的动态内容；精修模式下 Editor 也使用同一批动态内容
```

## 可待能力内化

| 可待能力 | 工程位置 |
|---|---|
| 要求强化 | Director 规划，Narrator 执行，Editor 审核 |
| 全面小说创作指导 | Director / Narrator / Editor 分层内化 |
| 模块化剧情 | Director `sceneBeats` / `endingBeat` |
| 描写发展链 | Director `descriptionPlans` |
| 推进规范 | Director 控节奏，Editor 防快进 |
| 伏笔、大纲 | Director 规划，Postprocess 记录 |
| 实时总结 | Postprocess 固定输出 |
| 逻辑加强 | Editor 精修审核 |
| 自我辩证 | Editor 精修质量复盘 |
| 禁用库 | Editor 精修审核内化，用户可额外扩展 |
| 文生图 | 保留为 Postprocess 扩展点 |

不要求模型输出完整思维链，只保留结构化检查字段和最终可用数据。
