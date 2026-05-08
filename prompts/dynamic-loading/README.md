# Dynamic Loading Prompts

用途：说明动态加载项的 prompt 归属。

什么时候用：人物卡、故事书、地点、世界观、剧情记忆等知识库内容被导入后，程序把启用条目渲染到运行时上下文。

怎么用：本目录不保存固定正文 prompt。动态内容来自用户导入和后处理生成，Director 只能请求这类知识库条目，不能请求 Director / Narrator 能力模块。

---

动态加载项不是固定 prompt。当前 MVP 暂时整体注入启用条目；后续改成 Director 输出 `load` 后二阶段加载。
