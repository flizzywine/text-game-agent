# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.6f9cb462-983f-4c09-8d3e-fdf067921c94
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/12 GMT+8 00:01:31 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 20892 | - | 57.82 | 2255 | 1208 | 3463 |
| Narrator | Infron | `x-ai/grok-4.3` | 21944 | - | 46.57 | 2167 | 1022 | 3189 |
| Postprocess | Infron | `x-ai/grok-4.3` | 24920 | - | 46.95 | 2664 | 1170 | 3834 |

## 2026/05/12 GMT+8 00:13:21 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：坐到座位上并让她继续系安全带

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 27542 | - | 37.76 | 2571 | 1040 | 3611 |
| Narrator | Infron | `x-ai/grok-4.3` | 15078 | - | 60.88 | 2497 | 918 | 3415 |

## 2026/05/12 GMT+8 00:13:46 · 每轮流水线

- 模式：postprocess-retry
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：坐到座位上并让她继续系安全带

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 25070 | - | 37.65 | 2996 | 944 | 3940 |
