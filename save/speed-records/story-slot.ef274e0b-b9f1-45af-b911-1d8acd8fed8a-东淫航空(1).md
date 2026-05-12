# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.ef274e0b-b9f1-45af-b911-1d8acd8fed8a
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/12 GMT+8 00:31:04 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","longRangeDirector":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 29236 | - | 47.13 | 2325 | 1378 | 3703 |
| Narrator | Infron | `x-ai/grok-4.3` | 23399 | - | 53.04 | 2152 | 1241 | 3393 |

## 2026/05/12 GMT+8 00:39:53 · 每轮流水线

- 模式：postprocess-retry
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 36282 | - | 32.25 | 2598 | 1170 | 3768 |

## 2026/05/12 GMT+8 00:40:04 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17750 | - | 61.92 | 2462 | 1099 | 3561 |
| Narrator | Infron | `x-ai/grok-4.3` | 17058 | - | 58.45 | 2277 | 997 | 3274 |

## 2026/05/12 GMT+8 00:40:15 · 每轮流水线

- 模式：postprocess-retry
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 10877 | - | 58.84 | 2636 | 640 | 3276 |

## 2026/05/12 GMT+8 00:42:04 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：直接坐到指定座椅上

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17681 | - | 58.31 | 2872 | 1031 | 3903 |
| Narrator | Infron | `x-ai/grok-4.3` | 24253 | - | 33.85 | 2500 | 821 | 3321 |

## 2026/05/12 GMT+8 00:42:22 · 每轮流水线

- 模式：postprocess-retry
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：直接坐到指定座椅上

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 18708 | - | 54.52 | 2913 | 1020 | 3933 |

## 2026/05/12 GMT+8 00:49:16 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手触摸她的丝袜大腿

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16082 | - | 67.9 | 3145 | 1092 | 4237 |
| Narrator | Infron | `x-ai/grok-4.3` | 20307 | - | 50.52 | 2819 | 1026 | 3845 |

## 2026/05/12 GMT+8 00:49:49 · 每轮流水线

- 模式：postprocess-retry
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手触摸她的丝袜大腿

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 32515 | - | 31.52 | 3325 | 1025 | 4350 |

## 2026/05/12 GMT+8 00:50:26 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：询问她是否允许解开旗袍领口提供更多视觉刺激

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 15273 | - | 74.71 | 3475 | 1141 | 4616 |
| Narrator | Infron | `x-ai/grok-4.3` | 25290 | - | 35.11 | 3019 | 888 | 3907 |

## 2026/05/12 GMT+8 00:50:40 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：询问她是否允许解开旗袍领口提供更多视觉刺激

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 13245 | - | 67.2 | 3438 | 890 | 4328 |

## 2026/05/12 GMT+8 00:51:23 · 每轮流水线

- 模式：generate
- 轮次：5
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手抚摸她敞开的胸部

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 15212 | - | 69.55 | 3796 | 1058 | 4854 |
| Narrator | Infron | `x-ai/grok-4.3` | 12396 | - | 58.81 | 3332 | 729 | 4061 |

## 2026/05/12 GMT+8 00:51:40 · 每轮流水线

- 模式：postprocess-retry
- 轮次：5
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手抚摸她敞开的胸部

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 16854 | - | 51.2 | 3803 | 863 | 4666 |

## 2026/05/12 GMT+8 00:52:35 · 每轮流水线

- 模式：generate
- 轮次：6
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：继续揉捏她的乳房并询问是否能解开更多旗袍

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17970 | - | 57.54 | 4058 | 1034 | 5092 |
| Narrator | Infron | `x-ai/grok-4.3` | 14015 | - | 59.22 | 3605 | 830 | 4435 |

## 2026/05/12 GMT+8 00:52:49 · 每轮流水线

- 模式：postprocess-retry
- 轮次：6
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：继续揉捏她的乳房并询问是否能解开更多旗袍

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 13496 | - | 72.98 | 4255 | 985 | 5240 |

## 2026/05/12 GMT+8 00:56:30 · 每轮流水线

- 模式：generate
- 轮次：7
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：要求她把旗袍完全拉到腰部以下并继续揉捏

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16811 | - | 56.69 | 4324 | 953 | 5277 |
| Narrator | Infron | `x-ai/grok-4.3` | 14054 | - | 64.04 | 3761 | 900 | 4661 |

## 2026/05/12 GMT+8 00:56:47 · 每轮流水线

- 模式：postprocess-retry
- 轮次：7
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：要求她把旗袍完全拉到腰部以下并继续揉捏

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 16836 | - | 59.04 | 4432 | 994 | 5426 |

## 2026/05/12 GMT+8 00:58:16 · 每轮流水线

- 模式：generate
- 轮次：8
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：要求她用手引导你触摸更深处

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 15527 | - | 54.36 | 4521 | 844 | 5365 |
| Narrator | Infron | `x-ai/grok-4.3` | 16654 | - | 70.07 | 3906 | 1167 | 5073 |

## 2026/05/12 GMT+8 00:58:27 · 每轮流水线

- 模式：postprocess-retry
- 轮次：8
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：要求她用手引导你触摸更深处

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 10923 | - | 80.84 | 4477 | 883 | 5360 |
