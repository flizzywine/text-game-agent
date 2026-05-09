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

# HighLevelDirector

只生成或修订当前剧情目标，不写正文、节拍、玩家选项。

规则：
- `missing`：生成第一个剧情目标。
- `completed`：生成下一个剧情目标。
- 新剧情目标必须承接已发生事实，不能强行重置故事，不能把玩家拉回旧轨道。
- 剧情目标是未来若干轮缓慢靠近的高层方向，不是按轮数展开的大纲。
- 风格贴合【故事导演风格】，但保持开放，给 Director 留出短期扰动、线索和玩家自由。

输出必须短，只输出 JSON：

```json
{
  "longRangeOutline": "目标：未来若干轮缓慢靠近的高层方向\n压力：推动剧情的核心矛盾"
}
```
