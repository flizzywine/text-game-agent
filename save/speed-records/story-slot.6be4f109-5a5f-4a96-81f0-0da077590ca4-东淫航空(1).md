# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.6be4f109-5a5f-4a96-81f0-0da077590ca4
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 16:57:55 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"google/gemini-3.1-flash-lite","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 19811 | - | 51.89 | 3096 | 1028 | 4124 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 14290 | - | 78.94 | 3262 | 1128 | 4390 |
| Postprocess | Infron | `google/gemini-3.1-flash-lite` | 13245 | - | 50.51 | 3388 | 669 | 4057 |

## 2026/05/11 GMT+8 17:44:20 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"google/gemini-3.1-flash-lite","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 3837 | - | 95.39 | 3096 | 366 | 3462 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 11997 | - | 33.01 | 3280 | 396 | 3676 |
| Postprocess | Infron | `google/gemini-3.1-flash-lite` | 8285 | - | 29.09 | 3430 | 241 | 3671 |
