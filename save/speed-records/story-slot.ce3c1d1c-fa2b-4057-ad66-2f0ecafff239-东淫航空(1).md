# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.ce3c1d1c-fa2b-4057-ad66-2f0ecafff239
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/12 GMT+8 01:19:48 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 18777 | - | 64.81 | 2335 | 1217 | 3552 |
| Narrator | Infron | `x-ai/grok-4.3` | 10089 | - | 87.82 | 2157 | 886 | 3043 |

## 2026/05/12 GMT+8 01:20:03 · 每轮流水线

- 模式：postprocess-retry
- 轮次：1
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 14442 | - | 68.9 | 2661 | 995 | 3656 |

## 2026/05/12 GMT+8 01:22:49 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：坐下，等她系安全带。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 18619 | - | 46.89 | 2612 | 873 | 3485 |
| Narrator | Infron | `x-ai/grok-4.3` | 22741 | - | 45.42 | 2410 | 1033 | 3443 |

## 2026/05/12 GMT+8 01:23:10 · 每轮流水线

- 模式：postprocess-retry
- 轮次：2
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：坐下，等她系安全带。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 21271 | - | 50.59 | 2937 | 1076 | 4013 |

## 2026/05/12 GMT+8 01:26:02 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手触摸她的旗袍开叉处

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 14352 | - | 63.48 | 2826 | 911 | 3737 |
| Narrator | Infron | `x-ai/grok-4.3` | 10588 | - | 93.41 | 2811 | 989 | 3800 |

## 2026/05/12 GMT+8 01:26:15 · 每轮流水线

- 模式：postprocess-retry
- 轮次：3
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：伸手触摸她的旗袍开叉处

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 12661 | - | 73.06 | 3258 | 925 | 4183 |

## 2026/05/12 GMT+8 01:27:59 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：手掌深入她的旗袍内，摸了一把湿润的下体，说道：飞机平稳后再来服务吧。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 11496 | - | 86.9 | 3128 | 999 | 4127 |
| Narrator | Infron | `x-ai/grok-4.3` | 12145 | - | 76.49 | 3010 | 929 | 3939 |

## 2026/05/12 GMT+8 01:28:25 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：手掌深入她的旗袍内，摸了一把湿润的下体，说道：飞机平稳后再来服务吧。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 25685 | - | 46.88 | 3526 | 1204 | 4730 |

## 2026/05/12 GMT+8 01:33:14 · 每轮流水线

- 模式：generate
- 轮次：5
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：把她抱到自己腿上，手掌自然探入旗袍内部，说道：“湿的好厉害呀”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 13084 | - | 66.26 | 3488 | 867 | 4355 |
| Narrator | Infron | `x-ai/grok-4.3` | 13825 | - | 76.6 | 3261 | 1059 | 4320 |

## 2026/05/12 GMT+8 01:33:25 · 每轮流水线

- 模式：postprocess-retry
- 轮次：5
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：把她抱到自己腿上，手掌自然探入旗袍内部，说道：“湿的好厉害呀”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 11138 | - | 95.71 | 3883 | 1066 | 4949 |

## 2026/05/12 GMT+8 01:34:31 · 每轮流水线

- 模式：generate
- 轮次：6
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：让她用嘴清理手上的湿液，同时解开裤子

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 11734 | - | 68.43 | 3778 | 803 | 4581 |
| Narrator | Infron | `x-ai/grok-4.3` | 9935 | - | 78.41 | 3477 | 779 | 4256 |

## 2026/05/12 GMT+8 01:34:43 · 每轮流水线

- 模式：postprocess-retry
- 轮次：6
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：让她用嘴清理手上的湿液，同时解开裤子

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 12111 | - | 87.94 | 4128 | 1065 | 5193 |

## 2026/05/12 GMT+8 01:36:24 · 每轮流水线

- 模式：generate
- 轮次：7
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：一只手抚摸她的乳房，一只手扶着阴茎在顶住她的小穴

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 13474 | - | 74.29 | 3846 | 1001 | 4847 |
| Narrator | Infron | `x-ai/grok-4.3` | 12757 | - | 93.05 | 3573 | 1187 | 4760 |

## 2026/05/12 GMT+8 01:36:42 · 每轮流水线

- 模式：postprocess-retry
- 轮次：7
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：一只手抚摸她的乳房，一只手扶着阴茎在顶住她的小穴

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 18686 | - | 66.36 | 4329 | 1240 | 5569 |

## 2026/05/12 GMT+8 01:38:41 · 每轮流水线

- 模式：generate
- 轮次：8
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：抓住她的腰，让她继续往下沉一点

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 15777 | - | 58.88 | 3995 | 929 | 4924 |
| Narrator | Infron | `x-ai/grok-4.3` | 11700 | - | 95.73 | 3696 | 1120 | 4816 |

## 2026/05/12 GMT+8 01:38:53 · 每轮流水线

- 模式：postprocess-retry
- 轮次：8
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：抓住她的腰，让她继续往下沉一点

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 11765 | - | 78.45 | 4314 | 923 | 5237 |

## 2026/05/12 GMT+8 01:46:13 · 每轮流水线

- 模式：generate
- 轮次：9
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：解开安全带，开始吮吸她浑圆的胸部，同时开始高速揉搓阴蒂。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16402 | - | 53.53 | 3957 | 878 | 4835 |
| Narrator | Infron | `x-ai/grok-4.3` | 20270 | - | 44.06 | 3711 | 893 | 4604 |

## 2026/05/12 GMT+8 01:46:33 · 每轮流水线

- 模式：postprocess-retry
- 轮次：9
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：解开安全带，开始吮吸她浑圆的胸部，同时开始高速揉搓阴蒂。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 19265 | - | 57.88 | 4502 | 1115 | 5617 |

## 2026/05/12 GMT+8 01:50:35 · 每轮流水线

- 模式：generate
- 轮次：10
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：反而主动拔出了阴茎，手扶着阴茎，在穴口反复磨蹭。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17243 | - | 35.55 | 4055 | 613 | 4668 |
| Narrator | Infron | `x-ai/grok-4.3` | 12288 | - | 77.72 | 3654 | 955 | 4609 |

## 2026/05/12 GMT+8 01:50:51 · 每轮流水线

- 模式：postprocess-retry
- 轮次：10
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：反而主动拔出了阴茎，手扶着阴茎，在穴口反复磨蹭。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 15834 | - | 47.11 | 4403 | 746 | 5149 |

## 2026/05/12 GMT+8 01:52:03 · 每轮流水线

- 模式：generate
- 轮次：11
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：低声问她现在最想被怎么操

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16216 | - | 46.68 | 4014 | 757 | 4771 |
| Narrator | Infron | `x-ai/grok-4.3` | 18444 | - | 57.2 | 3645 | 1055 | 4700 |

## 2026/05/12 GMT+8 01:52:30 · 每轮流水线

- 模式：postprocess-retry
- 轮次：11
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：低声问她现在最想被怎么操

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 26103 | - | 42.14 | 4429 | 1100 | 5529 |

## 2026/05/12 GMT+8 01:53:40 · 每轮流水线

- 模式：generate
- 轮次：12
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：扣住她的腰，让她一次性坐到底

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17234 | - | 56.46 | 4051 | 973 | 5024 |
| Narrator | Infron | `x-ai/grok-4.3` | 12014 | - | 60.76 | 3633 | 730 | 4363 |

## 2026/05/12 GMT+8 01:53:53 · 每轮流水线

- 模式：postprocess-retry
- 轮次：12
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：扣住她的腰，让她一次性坐到底

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 13248 | - | 68.46 | 4408 | 907 | 5315 |

## 2026/05/12 GMT+8 01:55:31 · 每轮流水线

- 模式：generate
- 轮次：13
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：和她热切接吻，粗暴蹂躏乳房，猛力抽插起来。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 16890 | - | 61.63 | 4063 | 1041 | 5104 |
| Narrator | Infron | `x-ai/grok-4.3` | 18715 | - | 55.89 | 3629 | 1046 | 4675 |

## 2026/05/12 GMT+8 01:55:48 · 每轮流水线

- 模式：postprocess-retry
- 轮次：13
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：和她热切接吻，粗暴蹂躏乳房，猛力抽插起来。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 16761 | - | 64.49 | 4467 | 1081 | 5548 |

## 2026/05/12 GMT+8 01:56:34 · 每轮流水线

- 模式：generate
- 轮次：14
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：让她自己扭腰加速撞击子宫口

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `x-ai/grok-4.3` | 17864 | - | 53.24 | 4022 | 951 | 4973 |
| Narrator | Infron | `x-ai/grok-4.3` | 18617 | - | 54.04 | 3576 | 1006 | 4582 |

## 2026/05/12 GMT+8 01:56:47 · 每轮流水线

- 模式：postprocess-retry
- 轮次：14
- 选择模型：`x-ai/grok-4.3`
- 分级模型：`{"director":"x-ai/grok-4.3","narrator":"x-ai/grok-4.3","postprocess":"x-ai/grok-4.3","initializer":"x-ai/grok-4.3"}`
- 玩家输入：让她自己扭腰加速撞击子宫口

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `x-ai/grok-4.3` | 12647 | - | 74.64 | 4436 | 944 | 5380 |
