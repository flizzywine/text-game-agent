# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.33e4de51-5c2a-4819-becf-6a5c5b2f470d
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 14:15:26 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`google/gemini-3.1-flash-lite`
- 分级模型：`{"director":"google/gemini-3.1-flash-lite","longRangeDirector":"google/gemini-3.1-flash-lite","narrator":"google/gemini-3.1-flash-lite","postprocess":"deepseek/deepseek-v4-flash","initializer":"google/gemini-3.1-flash-lite"}`
- 玩家输入：直接把手伸入旗袍，手指探入小穴，直接捅入湿润的阴道，猛力揉搓阴蒂。

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `google/gemini-3.1-flash-lite` | 12576 | - | 25.92 | 3775 | 326 | 4101 |
| Narrator | Infron | `google/gemini-3.1-flash-lite` | 7001 | - | 53.14 | 4030 | 372 | 4402 |
| Postprocess | Infron | `deepseek/deepseek-v4-flash` | 72458 | - | 17.9 | 3632 | 1297 | 4929 |
