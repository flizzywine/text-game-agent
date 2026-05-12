# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.e6677d5b-2fb3-4a8e-ae6c-ecfbff321816
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/12 GMT+8 19:32:00 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 20252 | - | 41.63 | 2135 | 843 | 2978 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 32276 | - | 51.18 | 2082 | 1652 | 3734 |

## 2026/05/12 GMT+8 19:32:13 · 每轮流水线

- 模式：postprocess-retry
- 轮次：1
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 4636 | - | 50.26 | 1442 | 233 | 1675 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 8394 | - | 47.89 | 2231 | 402 | 2633 |

## 2026/05/12 GMT+8 19:35:31 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起手，轻轻抚上她绷紧的旗袍胸口，指尖沿着那饱满的弧线缓缓划过。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 21404 | - | 39.2 | 2772 | 839 | 3611 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 16401 | - | 52.5 | 2640 | 861 | 3501 |

## 2026/05/12 GMT+8 19:35:48 · 每轮流水线

- 模式：postprocess-retry
- 轮次：2
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起手，轻轻抚上她绷紧的旗袍胸口，指尖沿着那饱满的弧线缓缓划过。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 9731 | - | 47.37 | 1961 | 461 | 2422 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 6586 | - | 42.97 | 3058 | 283 | 3341 |

## 2026/05/12 GMT+8 19:38:22 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：等待飞机平稳飞行。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 17832 | - | 39.03 | 3306 | 696 | 4002 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 24797 | - | 53.6 | 3176 | 1329 | 4505 |

## 2026/05/12 GMT+8 19:38:39 · 每轮流水线

- 模式：postprocess-retry
- 轮次：3
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：等待飞机平稳飞行。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 3741 | - | 55.33 | 2703 | 207 | 2910 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 13575 | - | 41.47 | 4294 | 563 | 4857 |

## 2026/05/12 GMT+8 19:41:34 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 24545 | - | 44.98 | 4161 | 1104 | 5265 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 22865 | - | 43.04 | 4123 | 984 | 5107 |

## 2026/05/12 GMT+8 19:41:55 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 7492 | - | 45.11 | 3200 | 338 | 3538 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 13621 | - | 38.32 | 5509 | 522 | 6031 |

## 2026/05/12 GMT+8 20:31:36 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 21951 | - | 40.64 | 5110 | 892 | 6002 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 31975 | - | 52.48 | 4060 | 1678 | 5738 |

## 2026/05/12 GMT+8 20:32:06 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 10420 | - | 50 | 3439 | 521 | 3960 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 20131 | - | 49.53 | 5456 | 997 | 6453 |

## 2026/05/12 GMT+8 20:37:25 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 21425 | - | 43.92 | 5053 | 941 | 5994 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 27704 | - | 51.87 | 4017 | 1437 | 5454 |

## 2026/05/12 GMT+8 20:37:49 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 15131 | - | 56.11 | 3416 | 849 | 4265 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 8530 | - | 45.13 | 5347 | 385 | 5732 |

## 2026/05/12 GMT+8 20:41:01 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 14312 | - | 49.96 | 5053 | 715 | 5768 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 19478 | - | 57.65 | 3998 | 1123 | 5121 |

## 2026/05/12 GMT+8 20:41:18 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 4954 | - | 56.72 | 3181 | 281 | 3462 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 11906 | - | 48.29 | 5160 | 575 | 5735 |

## 2026/05/12 GMT+8 20:44:22 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 12409 | - | 51.17 | 5038 | 635 | 5673 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 26620 | - | 66.15 | 3975 | 1761 | 5736 |

## 2026/05/12 GMT+8 20:44:45 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 13399 | - | 56.5 | 3187 | 757 | 3944 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 9743 | - | 48.24 | 5120 | 470 | 5590 |

## 2026/05/12 GMT+8 20:46:46 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 19024 | - | 39.84 | 5041 | 758 | 5799 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 19595 | - | 57.82 | 3978 | 1133 | 5111 |

## 2026/05/12 GMT+8 20:47:07 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我抬起另一只手，直接探进她旗袍领口的缝隙，指尖触碰她乳房侧面温热的肌肤，低声问：‘什么服务都可以？’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 5375 | - | 49.86 | 3236 | 268 | 3504 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 15327 | - | 55.72 | 5175 | 854 | 6029 |

## 2026/05/12 GMT+8 20:50:44 · 每轮流水线

- 模式：generate
- 轮次：5
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我没有收回手，指尖沿着她的乳房侧面缓缓滑向乳尖，压低声音说：‘就在座位上，先帮我含一会。’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 18909 | - | 46.86 | 5941 | 886 | 6827 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 25937 | - | 45.92 | 4459 | 1191 | 5650 |

## 2026/05/12 GMT+8 20:51:06 · 每轮流水线

- 模式：postprocess-retry
- 轮次：5
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我没有收回手，指尖沿着她的乳房侧面缓缓滑向乳尖，压低声音说：‘就在座位上，先帮我含一会。’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 9228 | - | 54.29 | 3966 | 501 | 4467 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 12652 | - | 43.47 | 6173 | 550 | 6723 |

## 2026/05/12 GMT+8 20:54:55 · 每轮流水线

- 模式：generate
- 轮次：6
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我伸手按住她的后脑，指尖插入她发间，低声说：‘拉开拉链，直接含进去。’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 17891 | - | 42.59 | 7438 | 762 | 8200 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 26729 | - | 53.2 | 5664 | 1422 | 7086 |

## 2026/05/12 GMT+8 20:55:09 · 每轮流水线

- 模式：postprocess-retry
- 轮次：6
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我伸手按住她的后脑，指尖插入她发间，低声说：‘拉开拉链，直接含进去。’

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 5838 | - | 54.98 | 4502 | 321 | 4823 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 8372 | - | 56.26 | 6796 | 471 | 7267 |

## 2026/05/12 GMT+8 21:02:02 · 每轮流水线

- 模式：generate
- 轮次：7
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：脱下内裤，巨大的肉棒弹出。让她惊讶不已。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 17979 | - | 39.99 | 7462 | 719 | 8181 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 23401 | - | 44.1 | 5567 | 1032 | 6599 |

## 2026/05/12 GMT+8 21:02:24 · 每轮流水线

- 模式：postprocess-retry
- 轮次：7
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：脱下内裤，巨大的肉棒弹出。让她惊讶不已。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 9081 | - | 50.1 | 4838 | 455 | 5293 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 13062 | - | 44.1 | 7033 | 576 | 7609 |

## 2026/05/12 GMT+8 21:05:58 · 每轮流水线

- 模式：generate
- 轮次：8
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我收回手，让她自己掌握节奏，看她能含到什么程度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 16115 | - | 41.08 | 7915 | 662 | 8577 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 29270 | - | 39.49 | 5928 | 1156 | 7084 |

## 2026/05/12 GMT+8 21:06:22 · 每轮流水线

- 模式：postprocess-retry
- 轮次：8
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我收回手，让她自己掌握节奏，看她能含到什么程度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 7006 | - | 36.4 | 4997 | 255 | 5252 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 17454 | - | 38.96 | 7026 | 680 | 7706 |

## 2026/05/12 GMT+8 21:09:25 · 每轮流水线

- 模式：generate
- 轮次：8
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我收回手，让她自己掌握节奏，看她能含到什么程度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 17049 | - | 38.77 | 7845 | 661 | 8506 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 23781 | - | 46.72 | 5955 | 1111 | 7066 |

## 2026/05/12 GMT+8 21:09:53 · 每轮流水线

- 模式：postprocess-retry
- 轮次：8
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我收回手，让她自己掌握节奏，看她能含到什么程度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 7782 | - | 46.65 | 4866 | 363 | 5229 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 20481 | - | 46.97 | 6949 | 962 | 7911 |

## 2026/05/12 GMT+8 21:13:46 · 每轮流水线

- 模式：generate
- 轮次：9
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我拍拍她脸颊让她停下，扶着她肩膀让她站起身，换个姿势。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 18368 | - | 43.45 | 7233 | 798 | 8031 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 23698 | - | 43.76 | 5539 | 1037 | 6576 |

## 2026/05/12 GMT+8 21:14:11 · 每轮流水线

- 模式：postprocess-retry
- 轮次：9
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我拍拍她脸颊让她停下，扶着她肩膀让她站起身，换个姿势。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 10421 | - | 49.52 | 4935 | 516 | 5451 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 14313 | - | 40.24 | 6984 | 576 | 7560 |

## 2026/05/12 GMT+8 21:17:46 · 每轮流水线

- 模式：generate
- 轮次：10
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：站起身，揽住她的腰，把她推向大床区域。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 22732 | - | 40.96 | 7542 | 931 | 8473 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 23166 | - | 49.9 | 5850 | 1156 | 7006 |

## 2026/05/12 GMT+8 21:18:11 · 每轮流水线

- 模式：postprocess-retry
- 轮次：10
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：站起身，揽住她的腰，把她推向大床区域。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 14463 | - | 51.58 | 4588 | 746 | 5334 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 10203 | - | 42.54 | 6624 | 434 | 7058 |

## 2026/05/12 GMT+8 21:23:52 · 每轮流水线

- 模式：generate
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我在床边蹲下身，指尖沿着她丝袜包裹的小腿向上滑去，探入旗袍内部，那里已经湿成一片了。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 23501 | - | 42.17 | 7370 | 991 | 8361 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 36749 | - | 44.38 | 5705 | 1631 | 7336 |

## 2026/05/12 GMT+8 21:24:18 · 每轮流水线

- 模式：postprocess-retry
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我在床边蹲下身，指尖沿着她丝袜包裹的小腿向上滑去，探入旗袍内部，那里已经湿成一片了。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 10570 | - | 36.23 | 4765 | 383 | 5148 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 14644 | - | 35.92 | 6745 | 526 | 7271 |

## 2026/05/12 GMT+8 21:33:27 · 每轮流水线

- 模式：generate
- 轮次：12
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我保持蹲姿，指尖沿着那片湿润的缝隙缓缓划动，在她唇瓣间寻找入口的位置。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 20097 | - | 37.72 | 7459 | 758 | 8217 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 19318 | - | 44.36 | 5832 | 857 | 6689 |

## 2026/05/12 GMT+8 21:33:57 · 每轮流水线

- 模式：postprocess-retry
- 轮次：12
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我保持蹲姿，指尖沿着那片湿润的缝隙缓缓划动，在她唇瓣间寻找入口的位置。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 18713 | - | 45.05 | 4561 | 843 | 5404 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 11466 | - | 38.55 | 6733 | 442 | 7175 |

## 2026/05/12 GMT+8 22:10:23 · 每轮流水线

- 模式：generate
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：双手扒开她的大腿。嘴巴凑近蜜穴，舌头肆意搅动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 12869 | - | 40.48 | 7514 | 521 | 8035 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 22473 | - | 45.79 | 5705 | 1029 | 6734 |

## 2026/05/12 GMT+8 22:10:56 · 每轮流水线

- 模式：postprocess-retry
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：双手扒开她的大腿。嘴巴凑近蜜穴，舌头肆意搅动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 13317 | - | 43.55 | 4474 | 580 | 5054 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 19694 | - | 45.34 | 6583 | 893 | 7476 |

## 2026/05/12 GMT+8 22:21:53 · 每轮流水线

- 模式：generate
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：双手扒开她的大腿。嘴巴凑近蜜穴，舌头肆意搅动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 19533 | - | 41.72 | 7514 | 815 | 8329 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 21538 | - | 45.45 | 5843 | 979 | 6822 |

## 2026/05/12 GMT+8 22:22:16 · 每轮流水线

- 模式：postprocess-retry
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：双手扒开她的大腿。嘴巴凑近蜜穴，舌头肆意搅动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 8072 | - | 50.05 | 4452 | 404 | 4856 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 14613 | - | 37.71 | 6711 | 551 | 7262 |
