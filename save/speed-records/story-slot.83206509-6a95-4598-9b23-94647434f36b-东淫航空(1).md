# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.83206509-6a95-4598-9b23-94647434f36b
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 22:57:03 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 15257 | - | 59.05 | 1965 | 901 | 2866 |
| Narrator | Infron | `x-ai/grok-4.3` | 12828 | - | 66.88 | 2070 | 858 | 2928 |
| Postprocess | Infron | `x-ai/grok-4.3` | 13900 | - | 65.76 | 2503 | 914 | 3417 |

## 2026/05/11 GMT+8 22:59:17 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：跟着她走到座位前

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17650 | - | 55.58 | 2233 | 981 | 3214 |
| Narrator | Infron | `x-ai/grok-4.3` | 18128 | - | 51.19 | 2309 | 928 | 3237 |
| Postprocess | Infron | `x-ai/grok-4.3` | 15875 | - | 63.87 | 2816 | 1014 | 3830 |

## 2026/05/11 GMT+8 23:00:39 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：问她系安全带时会怎么特别服务

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16141 | - | 60.22 | 2567 | 972 | 3539 |
| Narrator | Infron | `x-ai/grok-4.3` | 11174 | - | 72.49 | 2631 | 810 | 3441 |
| Postprocess | Infron | `x-ai/grok-4.3` | 21766 | - | 55.73 | 3169 | 1213 | 4382 |
