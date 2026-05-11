# 每轮模型速度记录

- 故事：东淫航空(1)
- Story ID：story-slot.6a3b4f34-4927-428f-9ce1-8e4c07e74b9a
- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。
- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。

## 2026/05/11 GMT+8 19:24:29 · 每轮流水线

- 模式：generate
- 轮次：1
- 选择模型：`xiaomi/mimo-v2.5`
- 分级模型：`{"director":"xiaomi/mimo-v2.5","longRangeDirector":"xiaomi/mimo-v2.5","narrator":"xiaomi/mimo-v2.5","postprocess":"xiaomi/mimo-v2.5","initializer":"xiaomi/mimo-v2.5"}`
- 玩家输入：“澹台矜，名字很好听。麻烦带我进去吧。”

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `xiaomi/mimo-v2.5` | 23247 | 11075 | 206.82 | 3293 | 4808 | 8101 |
| Narrator | Infron | `xiaomi/mimo-v2.5` | 16482 | - | 201.37 | 3095 | 3319 | 6414 |
| Postprocess | Infron | `xiaomi/mimo-v2.5` | 14316 | - | 174.91 | 3173 | 2504 | 5677 |

## 2026/05/11 GMT+8 19:26:30 · 每轮流水线

- 模式：generate
- 轮次：2
- 选择模型：`xiaomi/mimo-v2.5`
- 分级模型：`{"director":"xiaomi/mimo-v2.5","longRangeDirector":"xiaomi/mimo-v2.5","narrator":"xiaomi/mimo-v2.5","postprocess":"xiaomi/mimo-v2.5","initializer":"xiaomi/mimo-v2.5"}`
- 玩家输入：手掌直接探入她的旗袍，摸上湿润的小穴

| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Director | Infron | `xiaomi/mimo-v2.5` | 16663 | - | 93.14 | 3279 | 1552 | 4831 |
| Narrator | Infron | `xiaomi/mimo-v2.5` | 32334 | - | 203.9 | 3552 | 6593 | 10145 |
| Postprocess | Infron | `xiaomi/mimo-v2.5` | 20144 | - | 181.89 | 3378 | 3664 | 7042 |
