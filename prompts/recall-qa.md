## Hard Rule
{{hardRule}}

# 输入变量
## 世界观
{{storyContext}}

## 长期变量
{{longTermState}}

## 历史总结
{{longHistoricalSummary}}

## 最近正文
{{recentTurns}}

## 用户输入
{{playerInput}}

# Recall

判断是否需要回看较早正文。

## 任务

- 从【历史总结】里的“第 N 轮”选择旧轮次。
- 最多 2 轮。
- 最近 5 轮不要选。
- 不输出正文、答案、剧情建议或解释。

## 输出

只输出 JSON：

```json
{"turnIndexes":[1,8]}
```

不需要召回时：

```json
{"turnIndexes":[]}
```
