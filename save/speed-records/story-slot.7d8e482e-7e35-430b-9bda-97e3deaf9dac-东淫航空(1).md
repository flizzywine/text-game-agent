# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.7d8e482e-7e35-430b-9bda-97e3deaf9dac
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 17:55:00 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"google/gemini-3.1-flash-lite","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 17499 | - | 19.89 | 3096 | 348 | 3444 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 13397 | - | 30.38 | 3262 | 407 | 3669 |
| Postprocess | Infron | `google/gemini-3.1-flash-lite` | 11738 | - | 17.04 | 3429 | 200 | 3629 |
