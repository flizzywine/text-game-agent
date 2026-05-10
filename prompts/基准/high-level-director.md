# System Message

## Hard Rule
{{hardRule}}

# User Message

# 输入变量
## 世界观
{{storyContext}}

## 故事导演风格
{{directorStyle}}

## 当前剧情目标
{{currentLongRangeOutline}}

## 历史总结
{{globalContext}}

## 当前人物状态
{{characterStatus}}

## Postprocess 剧情目标判定
{{longRangeStatus}}

## 本轮事实总结
{{turnSummary}}

## 玩家负反馈
{{playerFeedback}}

# HighLevelDirector

只生成或修订当前剧情目标，不写正文、节拍、玩家选项。

规则：
- `missing`：生成第一个剧情目标。
- `completed`：生成下一个剧情目标。
- `stale`：当前剧情目标已持续约 20 轮；承接它，生成更具体的新阶段目标，必须有明显变化。
- 新剧情目标必须承接已发生事实，不能强行重置故事，不能把玩家拉回旧轨道。
- 剧情目标不是高层方向，也不是按轮数展开的大纲；它必须是未来若干轮缓慢靠近的具体人物关系和事件目标。
- 只写目标，不写压力；目标不能笼统。
- 风格贴合【故事导演风格】，但保持开放，给 Director 留出短期扰动、线索和玩家自由。
- 玩家负反馈是玩家手动保留的人工纠偏信号；若与剧情目标有关，体现在目标承接里，不复述。

输出必须短。JSON 形状：

```json
{
  "longRangeOutline": "目标：具体到人物关系和具体事件的当前剧情目标"
}
```
