# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.9f66cbfb-d6d6-4540-bd79-aa563197830a
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/12 GMT+8 01:58:02 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 19436 | - | 57.78 | 2004 | 1123 | 3127 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 10384 | - | 69.72 | 2029 | 724 | 2753 |

## 2026/05/12 GMT+8 01:58:10 · 每轮流水线

- 模式：postprocess-retry
- 轮次：1
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 8018 | - | 70.09 | 2727 | 562 | 3289 |

## 2026/05/12 GMT+8 01:59:39 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我靠在座椅上，闭上眼睛，等待飞机滑行。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 16750 | - | 55.64 | 2464 | 932 | 3396 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 20631 | - | 63.06 | 2436 | 1301 | 3737 |

## 2026/05/12 GMT+8 01:59:48 · 每轮流水线

- 模式：postprocess-retry
- 轮次：2
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我靠在座椅上，闭上眼睛，等待飞机滑行。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 8336 | - | 65.86 | 3507 | 549 | 4056 |

## 2026/05/12 GMT+8 02:02:33 · 每轮流水线

- 模式：generate
- 轮次：3
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我调整了一下坐姿，解开衬衫最上面的扣子，靠在座椅上闭目养神，但脑海里全是她旗袍开叉处的反光。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 13976 | - | 53.66 | 3293 | 750 | 4043 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 23517 | - | 61.62 | 3267 | 1449 | 4716 |

## 2026/05/12 GMT+8 02:02:45 · 每轮流水线

- 模式：postprocess-retry
- 轮次：3
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我调整了一下坐姿，解开衬衫最上面的扣子，靠在座椅上闭目养神，但脑海里全是她旗袍开叉处的反光。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 12517 | - | 66.31 | 4470 | 830 | 5300 |

## 2026/05/12 GMT+8 14:57:44 · 每轮流水线

- 模式：generate
- 轮次：4
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我手指勾住丝袜裆部边缘，用力向两侧撕开，露出里面湿润的阴唇，指尖沿着裂缝轻轻滑动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 20567 | - | 57.18 | 4362 | 1176 | 5538 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 19421 | - | 70.59 | 4331 | 1371 | 5702 |

## 2026/05/12 GMT+8 14:58:01 · 每轮流水线

- 模式：postprocess-retry
- 轮次：4
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我手指勾住丝袜裆部边缘，用力向两侧撕开，露出里面湿润的阴唇，指尖沿着裂缝轻轻滑动。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 16574 | - | 61.24 | 5381 | 1015 | 6396 |

## 2026/05/12 GMT+8 15:04:30 · 每轮流水线

- 模式：generate
- 轮次：5
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我解开皮带，让裤子完全滑落，然后从后面贴近她，龟头抵住丝袜破口处的阴唇，但没有插入，只是停在那里感受她身体的温度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 38794 | - | 34.54 | 5109 | 1340 | 6449 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 40654 | - | 33.13 | 4958 | 1347 | 6305 |

## 2026/05/12 GMT+8 15:04:45 · 每轮流水线

- 模式：postprocess-retry
- 轮次：5
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我解开皮带，让裤子完全滑落，然后从后面贴近她，龟头抵住丝袜破口处的阴唇，但没有插入，只是停在那里感受她身体的温度。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 14484 | - | 58.62 | 5952 | 849 | 6801 |

## 2026/05/12 GMT+8 15:12:16 · 每轮流水线

- 模式：generate
- 轮次：6
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我没有继续深入，而是停在那里，手指探入她旗袍领口，揉捏她的乳房，感受她乳尖在指尖变硬。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 21703 | - | 21.61 | 5768 | 469 | 6237 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 30585 | - | 51.53 | 5623 | 1576 | 7199 |

## 2026/05/12 GMT+8 15:12:46 · 每轮流水线

- 模式：postprocess-retry
- 轮次：6
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我没有继续深入，而是停在那里，手指探入她旗袍领口，揉捏她的乳房，感受她乳尖在指尖变硬。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 30170 | - | 42.59 | 6648 | 1285 | 7933 |

## 2026/05/12 GMT+8 15:45:38 · 每轮流水线

- 模式：generate
- 轮次：7
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我握住她按在阴阜上的手，同时挺腰将阴茎完全插入，感受她阴道深处的温度和紧致。开始有节奏的抽插起来。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 106783 | - | 8.01 | 6325 | 855 | 7180 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 27563 | - | 51.23 | 5998 | 1412 | 7410 |

## 2026/05/12 GMT+8 15:46:12 · 每轮流水线

- 模式：postprocess-retry
- 轮次：7
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我握住她按在阴阜上的手，同时挺腰将阴茎完全插入，感受她阴道深处的温度和紧致。开始有节奏的抽插起来。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 33909 | - | 13.6 | 6696 | 461 | 7157 |

## 2026/05/12 GMT+8 15:48:28 · 每轮流水线

- 模式：generate
- 轮次：8
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我没有回答，而是直接抽出阴茎，将她转过身来面对我，让她双腿环住我的腰，准备换个姿势继续。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 26381 | - | 39.01 | 6612 | 1029 | 7641 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 28340 | - | 45.2 | 6383 | 1281 | 7664 |

## 2026/05/12 GMT+8 15:48:53 · 每轮流水线

- 模式：postprocess-retry
- 轮次：8
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我没有回答，而是直接抽出阴茎，将她转过身来面对我，让她双腿环住我的腰，准备换个姿势继续。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 24854 | - | 58.7 | 7028 | 1459 | 8487 |

## 2026/05/12 GMT+8 16:00:44 · 每轮流水线

- 模式：generate
- 轮次：9
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我低头吻住她的嘴唇，舌尖撬开她的牙关，同时手指沿着她小腹滑向阴蒂，用指腹轻轻按压。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `deepseek/deepseek-v4-flash` | 109414 | - | 8.71 | 6391 | 953 | 7344 |
| Narrator | Infron | `deepseek/deepseek-v4-flash` | 80667 | - | 15.77 | 6166 | 1272 | 7438 |

## 2026/05/12 GMT+8 16:02:07 · 每轮流水线

- 模式：postprocess-retry
- 轮次：9
- 选择模型：`deepseek/deepseek-v4-flash`
- 分级模型：`{"director":"deepseek/deepseek-v4-flash","narrator":"deepseek/deepseek-v4-flash","postprocess":"deepseek/deepseek-v4-flash","initializer":"deepseek/deepseek-v4-flash"}`
- 玩家输入：我低头吻住她的嘴唇，舌尖撬开她的牙关，同时手指沿着她小腹滑向阴蒂，用指腹轻轻按压。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 82447 | - | 8.54 | 7109 | 704 | 7813 |

## 2026/05/12 GMT+8 16:08:48 · 每轮流水线

- 模式：generate
- 轮次：10
- 选择模型：`deepseek-v4-flash`
- 分级模型：`{"director":"deepseek-v4-pro","narrator":"deepseek-v4-pro","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-pro"}`
- 玩家输入：我没有回答，而是重新吻住她，同时挺腰开始快速抽插，用行动回应她的问题。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-pro` | 154247 | - | 5.5 | 6291 | 848 | 7139 |
| Narrator | DeepSeek | `deepseek-v4-pro` | 58295 | - | 25.63 | 5976 | 1494 | 7470 |

## 2026/05/12 GMT+8 16:09:41 · 每轮流水线

- 模式：postprocess-retry
- 轮次：10
- 选择模型：`deepseek-v4-flash`
- 分级模型：`{"director":"deepseek-v4-pro","narrator":"deepseek-v4-pro","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-pro"}`
- 玩家输入：我没有回答，而是重新吻住她，同时挺腰开始快速抽插，用行动回应她的问题。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | DeepSeek | `deepseek-v4-flash` | 10479 | - | 42.18 | 7041 | 442 | 7483 |

## 2026/05/12 GMT+8 16:29:55 · 每轮流水线

- 模式：generate
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 18232 | - | 42.23 | 6526 | 770 | 7296 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 30417 | - | 47.37 | 6057 | 1441 | 7498 |

## 2026/05/12 GMT+8 16:30:11 · 每轮流水线

- 模式：postprocess-retry
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | DeepSeek | `deepseek-v4-flash` | 16339 | - | 49.45 | 7054 | 808 | 7862 |

## 2026/05/12 GMT+8 17:41:52 · 每轮流水线

- 模式：generate
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 30309 | - | 42.23 | 6721 | 1280 | 8001 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 35121 | - | 42.91 | 6468 | 1507 | 7975 |

## 2026/05/12 GMT+8 17:42:10 · 每轮流水线

- 模式：postprocess-retry
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | DeepSeek | `deepseek-v4-flash` | 18067 | - | 48.71 | 7540 | 880 | 8420 |

## 2026/05/12 GMT+8 17:54:38 · 每轮流水线

- 模式：generate
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 35423 | - | 41.39 | 6709 | 1466 | 8175 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 34491 | - | 46.27 | 6276 | 1596 | 7872 |

## 2026/05/12 GMT+8 17:54:52 · 每轮流水线

- 模式：postprocess-retry
- 轮次：11
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：在气流到来前的最后时刻，加快抽插速度，带她一起进入高潮释放

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Postprocess | DeepSeek | `deepseek-v4-flash` | 13799 | - | 48.12 | 7466 | 664 | 8130 |

## 2026/05/12 GMT+8 18:51:36 · 每轮流水线

- 模式：generate
- 轮次：12
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我停留在她体内，感受高潮余韵中阴道壁的持续轻颤，手指沿着她脊柱向下滑入旗袍下摆，抚摸她汗湿的后腰。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 27267 | - | 45.29 | 7233 | 1235 | 8468 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 24435 | - | 49.93 | 7140 | 1220 | 8360 |

## 2026/05/12 GMT+8 18:52:04 · 每轮流水线

- 模式：postprocess-retry
- 轮次：12
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我停留在她体内，感受高潮余韵中阴道壁的持续轻颤，手指沿着她脊柱向下滑入旗袍下摆，抚摸她汗湿的后腰。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 10909 | - | 49.96 | 1411 | 545 | 1956 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 16781 | - | 53.93 | 7182 | 905 | 8087 |

## 2026/05/12 GMT+8 19:12:18 · 每轮流水线

- 模式：generate
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我把手掌从她后腰滑向她臀缝边缘，指尖隔着丝袜的破口触到阴蒂，轻轻画圈

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | DeepSeek | `deepseek-v4-flash` | 26953 | - | 54.87 | 7148 | 1479 | 8627 |
| Narrator | DeepSeek | `deepseek-v4-flash` | 29201 | - | 63.56 | 7247 | 1856 | 9103 |

## 2026/05/12 GMT+8 19:12:45 · 每轮流水线

- 模式：postprocess-retry
- 轮次：13
- 选择模型：`deepseek-v4-flash`
- 流水线模型：`{"director":"deepseek-v4-flash","narrator":"deepseek-v4-flash","postprocess":"deepseek-v4-flash","initializer":"deepseek-v4-flash"}`
- 玩家输入：我把手掌从她后腰滑向她臀缝边缘，指尖隔着丝袜的破口触到阴蒂，轻轻画圈

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| PostprocessSummary | DeepSeek | `deepseek-v4-flash` | 13777 | - | 53.13 | 5966 | 732 | 6698 |
| PostprocessFeedback | DeepSeek | `deepseek-v4-flash` | 12674 | - | 48.84 | 7563 | 619 | 8182 |
