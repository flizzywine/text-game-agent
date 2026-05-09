# text-game-agent 交接说明

本项目当前目标是先稳定运行，不做提前优化。后续 agent 必须以当前代码、测试和本文件为准，不要继承旧对话里的废弃方案。

## 当前架构真相

主流程只保留：

```text
Director -> Narrator -> Postprocess
```

- Director：规划本轮剧情结构、节奏、伏笔动作、玩家窗口，输出压缩 JSON。
- Narrator：根据 Director 计划写玩家可见正文，只输出正文草稿，不更新人物状态。
- Postprocess：在正文已显示后更新状态、历史总结、候选项、写作负反馈和长期剧情判定，不修改正文。
- LongRangeDirector：只在 Postprocess 判定 `longRangeStatus` 为 `missing` 或 `completed` 时调用，用来生成或修订当前长期剧情。
- Evaluator：只做人工辅助评估，不自动改 prompt，不自动改正文。

## 明确不要恢复的方案

以下方案已经废弃，不要重新引入，除非用户明确重新要求：

- 不使用 Director / Narrator / Postprocess 缓存。
- 不使用下一轮预热。
- 不使用 `director-prewarm`、`prewarm-cancel` 接口。
- 不使用 `bypassGenerationCache`、`prewarmEpoch`、`preferEmergencyDirectorFallback` 一类状态字段。
- 不使用 Editor 独立精修层。
- 不使用“应急导演计划”绕过 Director。
- 不做复杂状态机式物理模拟。

当前测试已经保护这些删除项，见 `src/__tests__/frontendLayout.test.ts`。

## 目录职责

- `scripts/web-server.ts`：本地 HTTP 服务、模型调用、三层流水线、故事导入初始化、存档接口。
- `web/`：前端页面、状态展示、故事库、配置、生成交互。
- `prompts/director/prompt.md`：固定 Director prompt。
- `prompts/narrator/prompt.md`：固定 Narrator prompt。
- `prompts/postprocess/prompt.md`：固定 Postprocess prompt。
- `prompts/long-range-director/prompt.md`：长期剧情生成/修订 prompt。
- `prompts/evaluator/prompt.md`：人工评估 prompt。
- `prompts/user-config-templates/`：用户可选注入模块。当前只分导演风格和叙事风格，Postprocess 不接收用户风格。
- `story/`：故事书、导入原文、初始化后的故事配置。
- `save/`：本地存档。不要再放生成缓存。
- `debug/`：LLM 原始返回、评估材料和评估报告。
- `docs/design.md`：历史设计记录，可能含旧方案；遇到冲突时以本文件和当前代码为准。

## 当前数据流

1. 玩家输入。
2. 前端构造请求：故事状态、人物状态、当前物理环境、历史总结、长期剧情、伏笔、用户启用模块、最近正文。
3. 服务端调用 Director。
4. 服务端调用 Narrator。
5. Narrator 正文通过 `visible_text` 事件先显示给玩家。
6. 服务端继续调用 Postprocess。
7. Postprocess 完成后，前端更新人物状态、历史总结、当前剧情、伏笔、候选项、写作负反馈。
8. 若 Postprocess 失败，玩家不能进入下一轮；点击“继续未完成”只补跑 Postprocess。

## 存档与故事

- 新游戏必须先选择故事书。
- 故事导入后要初始化，初始化只生成程序需要的结构化故事配置，不提前锁死长期剧情。
- 当前长期剧情应在第一轮正式玩家输入后由 Director / Postprocess / LongRangeDirector 机制产生。
- 保存游戏直接写本地 `save/current-state.json`，不走下载。

## 工程纪律

- 修 bug 先读当前代码、当前状态、当前错误，不靠聊天历史猜。
- 一次只改一个问题，不顺手优化。
- 优先恢复可运行，再谈体验和性能。
- 删除功能必须删干净：代码、测试、状态字段、UI 文案、本地残留文件一起处理。
- 多次更新功能后，必须回头清理冗余代码、旧测试、旧文档和本地残留，保持当前架构干净。
- 新增复杂机制前必须先确认已有简单方案已经跑通并暴露真实瓶颈。
- 如果用户说“越来越复杂”，优先减法，不加抽象。

## 验证命令

每次改完至少跑：

```bash
npx tsc --noEmit
npm test
curl --max-time 5 -s -o /tmp/text-game-agent-index.html -w '%{http_code} %{size_download}\n' http://127.0.0.1:4173/
```

预期：

- 类型检查通过。
- 测试通过。
- 本地页面返回 `200`。
