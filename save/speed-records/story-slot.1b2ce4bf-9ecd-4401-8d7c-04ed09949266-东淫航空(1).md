# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.1b2ce4bf-9ecd-4401-8d7c-04ed09949266
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 18:02:49 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"google/gemini-3.1-flash-lite","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 14980 | - | 24.43 | 3096 | 366 | 3462 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 4591 | - | 87.13 | 3280 | 400 | 3680 |
| Postprocess | Infron | `google/gemini-3.1-flash-lite` | 3542 | - | 54.49 | 3437 | 193 | 3630 |

## 2026/05/11 GMT+8 18:03:13 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"google/gemini-3.1-flash-lite","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 5275 | - | 61.42 | 3096 | 324 | 3420 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 10617 | - | 34 | 3238 | 361 | 3599 |
| Postprocess | Infron | `google/gemini-3.1-flash-lite` | 4372 | - | 45.29 | 3356 | 198 | 3554 |
