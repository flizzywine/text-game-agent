# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.73fe813d-c3cf-435d-af22-cf7c13ab09da
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 23:09:31 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 10952 | - | 81.72 | 2031 | 895 | 2926 |
| Narrator | Infron | `x-ai/grok-4.3` | 16192 | - | 46.63 | 2121 | 755 | 2876 |
| Postprocess | Infron | `x-ai/grok-4.3` | 13777 | - | 52.41 | 2564 | 722 | 3286 |

## 2026/05/11 GMT+8 23:11:16 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：直接坐到座位上，让她系安全带

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 18811 | - | 51.46 | 2313 | 968 | 3281 |
| Narrator | Infron | `x-ai/grok-4.3` | 16795 | - | 46.44 | 2380 | 780 | 3160 |
| Postprocess | Infron | `x-ai/grok-4.3` | 20707 | - | 56.6 | 2891 | 1172 | 4063 |

## 2026/05/11 GMT+8 23:12:23 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：让她先系好安全带，然后观察窗外情况

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 18115 | - | 49.3 | 2658 | 893 | 3551 |
| Narrator | Infron | `x-ai/grok-4.3` | 11507 | - | 78.56 | 2760 | 904 | 3664 |
| Postprocess | Infron | `x-ai/grok-4.3` | 19758 | - | 59.32 | 3285 | 1172 | 4457 |
