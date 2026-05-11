# System Message

# User Message

## Hard Rule
{{hardRule}}

# 输入变量
## 下面是花朵占卜出与顾客有命运纠缠的世界观信息
{{storyContext}}

## 花语编排方式
{{directorStyle}}

## 当前花语
{{currentLongRangeOutline}}

## 过往预言记录
{{globalContext}}

## 预言中人物状态
{{characterStatus}}

## 花语校验的预言方向判定
{{longRangeStatus}}

## 本轮事实总结
{{turnSummary}}

## 顾客留给花神的话
{{playerFeedback}}

# Hana LongRange

只生成或修订当前花语，不写预言故事、花色层次、顾客命运分叉。

规则：
- `missing`：生成第一条当前花语。
- `completed`：生成下一条当前花语。
- `stale`：当前花语已持续约 20 轮；承接它，生成更具体的新阶段预言方向，必须有明显变化。
- 新花语必须承接已发生事实，不能强行重置预言，不能把顾客拉回旧轨道。
- 当前花语不是高层方向，也不是按轮数展开的大纲；它必须是未来若干轮缓慢靠近的具体人物关系和事件目标。
- 只写预言方向，不写压力；方向不能笼统。
- 风格贴合【花语编排方式】，但保持开放，给 Hana 花语编排者留出短期花色变化、线索和顾客自由。
- 顾客留给花神的话是顾客手动保留的人工要求；若与当前花语有关，体现在目标承接里，不复述。

输出必须短。JSON 形状：

```json
{
  "longRangeOutline": "花语：具体到人物关系和具体事件的当前预言方向"
}
```
