# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.18afeed7-8858-4f38-b278-0c883f7dc353
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 21:56:07 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 14983 | - | 48.92 | 2095 | 733 | 2828 |
| Narrator | Infron | `x-ai/grok-4.3` | 15967 | - | 52.17 | 1860 | 833 | 2693 |
| Postprocess | Infron | `x-ai/grok-4.3` | 18500 | - | 42 | 2581 | 777 | 3358 |

## 2026/05/11 GMT+8 22:03:40 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：直接走向座位并坐下

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 13862 | - | 74.52 | 2430 | 1033 | 3463 |
| Narrator | Infron | `x-ai/grok-4.3` | 19758 | - | 59.27 | 2227 | 1171 | 3398 |
| Postprocess | Infron | `x-ai/grok-4.3` | 26149 | - | 38.89 | 2831 | 1017 | 3848 |

## 2026/05/11 GMT+8 22:10:53 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：看着她系安全带并伸手触摸她的旗袍

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 11925 | - | 79.08 | 2685 | 943 | 3628 |
| Narrator | Infron | `x-ai/grok-4.3` | 14541 | - | 51.44 | 2491 | 748 | 3239 |
| Postprocess | Infron | `x-ai/grok-4.3` | 21591 | - | 49.6 | 3166 | 1071 | 4237 |
