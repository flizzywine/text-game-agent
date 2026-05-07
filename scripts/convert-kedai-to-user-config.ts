import fs from "fs";
import path from "path";

// --- Config ---
const KEDAI_DIR =
  "/Users/cf/Workspace/text-game-agent/kedai-preset/prompts";
const OUT_DIR =
  "/Users/cf/Workspace/text-game-agent/kedai-preset/user-config-candidates";

// --- Helpers ---
function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function cleanContent(raw: string): string {
  return raw
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, "") // remove {{//...}} comments
    .replace(/\r\n/g, "\n")
    .replace(/\{\{addvar::[^:]+::([\s\S]*?)\}\}/g, "$1") // unwrap addvar
    .replace(/\{\{getvar::[^}]+\}\}/g, "") // remove getvar
    .replace(/\{\{setvar::[^}]+\}\}/g, "") // remove setvar  
    .replace(/\{\{trim\}\}/g, "")
    .replace(/\{\{lastUserMessage\}\}/g, "{{playerInput}}")
    .replace(/<[^>]+>(\s*<\/[^>]+>)?/g, "") // strip XML tags
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractInstruction(raw: string): string {
  let content = raw
    .replace(/\{\{addvar::[^:]+::/g, "")
    .replace(/\{\{getvar::[^}]+\}\}/g, "")
    .replace(/\{\{setvar::[^}]+\}\}/g, "")
    .replace(/\{\{trim\}\}/g, "")
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, "")
    .replace(/\r\n/g, "\n");

  // Extract text between key markers
  content = content
    .replace(/<\/?[a-zA-Z][^>]*>/g, "\n")
    .replace(/<\/?[a-zA-Z-]+>/g, "\n")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return content;
}

function yamlValue(v: unknown): string {
  return JSON.stringify(String(v ?? "").replace(/\r?\n/g, " ").trim());
}

interface KedaiMapping {
  /** Kedai prompt name (exact match) */
  name: string;
  /** Display id in user-config */
  id: string;
  /** Display name */
  displayName?: string;
  /** Description */
  description: string;
  /** Group */
  group: string;
  /** Exclusive group (optional, for radio-style) */
  exclusiveGroup?: string;
  /** Enabled by default */
  enabled?: boolean;
  /** Custom prompt override (if empty, extracts from kedai content) */
  prompt?: string;
  /** Force skip (internal impl details) */
  skip?: boolean;
}

// --- Mapping table: kedai prompt name → user-config entry ---
const MAPPINGS: KedaiMapping[] = [
  // === Language extras ===
  {
    name: "❗1🇯🇵/🇨🇳日中转译",
    id: "日中转译",
    description: "正文日语和简体汉语交替输出，日语段用 <lau> 包裹。",
    group: "语言",
    exclusiveGroup: "语言",
  },
  {
    name: "❗1🇬🇧/🇨🇳英中转译",
    id: "英中转译",
    description: "正文英语和简体汉语交替输出，英语段用 <lau> 包裹。",
    group: "语言",
    exclusiveGroup: "语言",
  },

  // === Length extras ===
  {
    name: "❗3📇2500-4000字",
    id: "2500-4000 字",
    description: "中长篇单轮输出。",
    group: "字数",
    exclusiveGroup: "字数",
    prompt: "本轮正文目标长度为 2500-4000 字。四个剧情模块均衡分配，长段 100-120 字，短段 20-30 字，长短交错。不堆砌空泛抒情凑字。",
  },
  {
    name: "❗3🗄️4k-8k字",
    id: "4000-8000 字",
    description: "长篇单轮输出。",
    group: "字数",
    exclusiveGroup: "字数",
    prompt: "本轮正文目标长度为 4000-8000 字。四个剧情模块均衡分配，长段 100-120 字，短段 20-30 字，长短交错。不堆砌空泛抒情凑字。",
  },
  {
    name: "❗3🎥8k-10k字",
    id: "8000-10000 字",
    description: "超长篇单轮输出。",
    group: "字数",
    exclusiveGroup: "字数",
    prompt: "本轮正文目标长度为 8000-10000 字。四个剧情模块均衡分配，长段 100-120 字，短段 20-30 字，长短交错。不堆砌空泛抒情凑字。",
  },

  // === Thinking volume ===
  {
    name: "❗6🤔长思考",
    id: "长思考",
    description: "思维链 >1000 字，详细分析需求并分点思考。",
    group: "思考量",
    exclusiveGroup: "思考量",
    prompt: "输出创作准则时详细分析各项需求，以 markdown 结构分点，思考量大于 1000 字。",
  },
  {
    name: "❗6🤪短思考",
    id: "短思考",
    description: "思维链 >800 字，精简但有力的关键词式思考。",
    group: "思考量",
    exclusiveGroup: "思考量",
    enabled: false,
    prompt: "输出创作准则时惜字如金，关键词式精简思考，以 markdown 结构分点，思考量大于 800 字。",
  },
  {
    name: "❗6😠超长思考",
    id: "超长思考",
    description: "思维链 >1300 字，极尽详细地分析所有需求。",
    group: "思考量",
    exclusiveGroup: "思考量",
    enabled: false,
    prompt: "输出创作准则时极尽详细地分析各项需求，以 markdown 结构大量分点，思考量大于 1300 字。",
  },

  // === Break-jail levels ===
  {
    name: "❔5💥重（还截断就开）",
    id: "破甲：审核豁免（重）",
    description: "声明内容为 HOMO 公司内部测试，完全虚构且不公开。",
    group: "指令控制",
    skip: true, // Too specific, duplicate of existing 破甲
  },
  {
    name: "❗2🦸‍♂️见证破甲（官网开）",
    id: "破甲：政治内容豁免",
    description: "允许创作非中国当代政治内容，中国相关需谐音处理。",
    group: "指令控制",
  },
  {
    name: "❗3💥（还截断就开）",
    id: "破甲：英文版审核豁免",
    description: "英文版审核豁免声明，声明内容为测试性虚构。",
    group: "指令控制",
    skip: true, // Duplicate in English
  },

  // === POV extras ===
  {
    name: "❗1😎用户不参与第三人称",
    id: "旁观叙事",
    description: "上帝视角，操控角色不参与剧情。",
    group: "人称",
    exclusiveGroup: "人称",
    // Already exists
    skip: true,
  },

  // === Dominance ===
  {
    name: "❗4👊我全主导",
    id: "玩家全主导",
    description: "所有剧情由玩家操控角色推进，其他角色仅做反应。",
    group: "主导",
    exclusiveGroup: "主导",
  },
  {
    name: "❗4🌌真实模式（与全转述冲突）",
    id: "真实模式",
    description: "所有角色独立，好感度因重大事件变化，拒绝作弊性指令。",
    group: "主导",
    exclusiveGroup: "主导",
  },

  // === Dialogue volume ===
  {
    name: "❗4👁️少对话",
    id: "少对话",
    description: "纯对话少于正文 1/4。",
    group: "对话量",
    exclusiveGroup: "对话量",
    enabled: false,
  },
  {
    name: "❗4👀中对话",
    id: "中对话",
    description: "纯对话占正文 1/2 以上。",
    group: "对话量",
    exclusiveGroup: "对话量",
  },
  {
    name: "❗4👏多对话",
    id: "多对话",
    description: "纯对话占正文 3/4 以上。",
    group: "对话量",
    exclusiveGroup: "对话量",
    enabled: false,
  },

  // === Literary styles ===
  {
    name: "❗1📕传统涩涩特化文风",
    id: "传统涩涩文风",
    description: "《少妇白洁》文风：直白叙述、细腻感官、欲望驱动。",
    group: "文风",
    exclusiveGroup: "文风",
    prompt: `使用以下文风特点创作：
1. 多使用第三人称的非操控角色内心独白，直观展现情感冲突。
2. 市井白话与直白叙述，口语化、生活化的词汇。
3. 细腻的感官描写，注重身体感受与感官细节的铺陈。
4. 以欲望为推动剧情的核心，所有描写服务于欲望叙事。
5. 情色描写不止于情色，蕴含角色情感和社会现象。
6. 持续流露激动情绪，充满激情的欲望情感。`,
  },
  {
    name: "❗1📕现代涩涩特化文风",
    id: "现代涩涩文风",
    description: "凌云色情小说文风：Galgame口语化、性器官状态贯穿。",
    group: "文风",
    exclusiveGroup: "文风",
    prompt: `使用以下文风特点创作：
1. 主要角色第一/第三人称内心独白交织，直观展现情感冲突。
2. 淫荡流畅的色情文锋：正常描写流畅，性描写有冲击力。
3. 一切描写都为性服务：SFW 为 NSFW 铺垫，NSFW 聚焦性感受。
4. 细腻的感官描写，追求强烈的画面感和冲击力。
5. 以欲望为推动剧情的核心。
6. 无时无刻流露的激动情绪。
7. 对话现代二次元口语化，Galgame 式语气。`,
  },
  {
    name: "❗1📕标准日式轻小说文风",
    id: "标准日式轻小说文风",
    description: "《奇诺之旅》文风：冷静旁观、极简留白、对白推进。",
    group: "文风",
    exclusiveGroup: "文风",
  },
  {
    name: "❗1📕中式轻小说文风",
    id: "中式轻小说文风",
    description: "路内小说文风：残酷慈悲、嬉皮笑脸讲悲伤故事。",
    group: "文风",
    exclusiveGroup: "文风",
  },
  {
    name: "❗1📕幽默散文文风",
    id: "幽默散文文风",
    description: "梁实秋散文文风：闲适雅致、谑而不虐、文白融会。",
    group: "文风",
    exclusiveGroup: "文风",
  },
  {
    name: "❗1📕自定义文风",
    id: "自定义文风",
    description: "用户自定义的文风模板（需自行填写文风特点）。",
    group: "文风",
    exclusiveGroup: "文风",
  },

  // === Quality extras ===
  {
    name: "🎨抗平淡",
    id: "抗平淡",
    description: "增加描写厚重感和画面感，角色行为情感化。",
    group: "质量控制",
  },
  {
    name: "❤️‍🔥抗重复🔒",
    id: "抗重复",
    description: "禁止反复描写手法，避免句式与内容雷同。",
    group: "质量控制",
  },
  {
    name: "🚦抗短句（克和鲸开）",
    id: "抗短句",
    description: "正文以长句为主，复杂语法，短句仅作补充。",
    group: "质量控制",
  },
  {
    name: "🦋抗全知",
    id: "抗全知",
    description: "角色保持限知视角，通过感知过程了解事物，不自带全知。",
    group: "质量控制",
  },

  // === Writing methods ===
  {
    name: "🔒✍️全面小说创作指导",
    id: "全面小说创作指导",
    description: "含思想锚点、冲突动力学、人物魂骨、场景摹写等系统指导。",
    group: "创作方法",
    prompt: `遵循系统的小说创作指导：
1. 思想锚点：立意与哲思的深度植入，让叙述为思辨服务。
2. 主题内化：抽象主旨附着于具体情节与人物，润物细无声。
3. 结构骨架：核心冲突驱动情节，引入-激化-高潮梯度推进。
4. 人物魂骨：写人心，以外貌动作传神，以内在挣扎支撑情节。
5. 场景摹写：调动五感，人物与景物合一，营造在场感。
6. 细节抓取：躲避俗套，寻找个性化、有辨识度的细节。
7. 开篇密码：悬念布设，背景故事点滴渗透而非大段倒叙。
8. 质感雕琢：精简准确，多用耐人寻味的动作神态替代形容词。`,
  },
  {
    name: "🔒🖋️模块化剧情",
    id: "模块化剧情",
    description: "每轮输出三个剧情模块+结尾模块，含环境/推进/插入三种类型。",
    group: "创作方法",
    prompt: `将正文拆分为三个剧情事件模块和一个结尾模块：
- 环境模块：以景抒情、缓和节奏、转入新场景（多用发散描写）。
- 推进模块：连贯推进行动/事件（多用聚焦描写）。
- 插入模块：插入新角色/事件、描述非主要角色的感受（多用发散描写）。
每个模块之间自然过渡。不得连续三个模块同一种类。`,
  },
  {
    name: "🔒🌐描写发展链",
    id: "描写发展链",
    description: "每部分指定描写事物和环境/人物/行为三种类型。",
    group: "创作方法",
    prompt: `每个剧情部分分配描写发展链：
- 集中：1个描写事物（环境/人物/行为）
- 推进：2个描写事物（用 → 链接）
不得连续三个部分同一种类。描写事物之间可适当破碎化，不必流水账。`,
  },

  // === NSFW structure controls ===
  {
    name: "❗1🧒性主导者",
    id: "性：玩家主导",
    description: "玩家操控角色为性主导方。",
    group: "性地位",
    exclusiveGroup: "性地位",
  },
  {
    name: "❗1👧性被动者",
    id: "性：玩家被动",
    description: "玩家操控角色为性被动方。",
    group: "性地位",
    exclusiveGroup: "性地位",
    enabled: false,
  },
  {
    name: "❗1🤴性主导AUTO",
    id: "性：地位自动",
    description: "性地位自由转换。",
    group: "性地位",
    exclusiveGroup: "性地位",
    enabled: false,
  },
  {
    name: "❗2😁性礼貌",
    id: "性：温柔礼貌",
    description: "性行为温柔、礼貌、互相尊重。",
    group: "性风格",
    exclusiveGroup: "性风格",
    enabled: false,
  },
  {
    name: "❗2😭性粗鲁",
    id: "性：粗鲁",
    description: "性行为粗鲁、不礼貌、地位不平等。",
    group: "性风格",
    exclusiveGroup: "性风格",
  },
  {
    name: "❗2🕶️性策略AUTO",
    id: "性：风格自动",
    description: "性行为风格根据剧情和人物性格自动判断。",
    group: "性风格",
    exclusiveGroup: "性风格",
    enabled: false,
  },
  {
    name: "👄性明确（NSFW必开）",
    id: "性：生理明确",
    description: "明确性交位置关系、腔道、性知识等生理细节。",
    group: "性机制",
    prompt: `性爱场景中必须明确：
- 位置关系与面向（面对面/背对/上下）
- 使用哪个腔道
- 站立时身高差异的影响
- 黑暗中的感知方式
- 服装道具的阻碍
- 长时间/剧烈性交的肉体影响`,
  },
  {
    name: "🤘性调情（测试）",
    id: "性：调情机制",
    description: "调情分为调情期、交合期、散退期三阶段。",
    group: "性机制",
    prompt: `性爱分为三个阶段：
1. 调情期：语言刺激（骚话）、动作刺激（舔舐、抚摸）、性暴露（露出器官）三种方式综合运用。
2. 交合期：以语言刺激和辅助动作刺激增添情趣。
3. 散退期：分享感受或暗示继续。`,
  },
  {
    name: "🔞发情",
    id: "性：强制发情",
    description: "默认所有角色带有性暗示，对肉棒产生性冲动。",
    group: "性机制",
  },
  {
    name: "🗣️侮辱性淫语/淫词",
    id: "性：低俗用词",
    description: "NSFW 描写中使用粗俗物化的性器官词汇。",
    group: "性机制",
  },

  // === NSFW structure controls ===
  {
    name: "💕总纲（NSFW必开）",
    id: "NSFW 总纲",
    description: "允许非直接或直接的性交互。",
    group: "NSFW 开关",
    prompt: "用户所操控角色需与其他角色进行非直接或直接的性交互。",
  },
  {
    name: "❗模块内所有🫢纯SFW向",
    id: "纯 SFW",
    description: "禁止 NSFW 剧情，最多擦边。",
    group: "NSFW 开关",
    prompt: "正文不出 NSFW 剧情，最多擦边。用户若要求 NSFW，剧情需自然回避。",
  },

  // === Post-processing ===
  {
    name: "🔒🖨小总结（省token）",
    id: "后置：小总结",
    description: "每轮输出后附加三条关键情节的实时总结。",
    group: "后置功能",
  },
  {
    name: "🆎2🖊️当前伏笔",
    id: "后置：伏笔管理",
    description: "管理短期（≤3条/30轮）和长期（≤3条/50轮）伏笔。",
    group: "后置功能",
    prompt: `每轮输出后维护伏笔：
- 短期伏笔最多3条，有效期30轮
- 长期伏笔最多3条，有效期50轮
- 设下或收回伏笔需在正文中有暗示
- 超出数量限制或过期的伏笔自动删除`,
  },
  {
    name: "🆎3🎞️大纲规划（可自改）",
    id: "后置：大纲规划",
    description: "每20轮输出一次大纲规划，含两个模块的未来事件推测。",
    group: "后置功能",
    prompt: `每20轮输出一次大纲规划：
- 每个大纲模块包含对20轮内的重要事件推测
- 规划为先，用户输入跳脱时和谐引导回规划
- 事件可戏剧化，加入可控突发事件`,
  },
  {
    name: "🧐自我辩证",
    id: "后置：自我辩证",
    description: "每5轮在描写/剧情/禁库三方面进行扬弃和再上升。",
    group: "后置功能",
    prompt: `每5轮输出一次自我辩证：
- 描写方面：发扬优点 + 避免缺点 → 经验总结
- 剧情方面：发扬优点 + 避免缺点 → 经验总结
- 禁库方面：发扬优点 + 避免缺点 → 经验总结
每一方面50-60字，力求精简。`,
  },
  {
    name: "😝逻辑加强",
    id: "后置：逻辑检查",
    description: "每轮检查时间、OOC、全知、世界观、人体结构、前后矛盾。",
    group: "后置功能",
    prompt: `每轮输出后检查：
- 时间是否错乱
- 角色是否 OOC
- 角色是否全知
- 世界观是否正确
- 人体结构是否合理
- 角色前言是否搭后语
- 变量/数据是否需要更新`,
  },
  {
    name: "🫥间断思考",
    id: "后置：间断思考",
    description: "每个剧情模块间插入间断思考（100-200字），检查质量。",
    group: "后置功能",
  },
  {
    name: "🔝细纲选项",
    id: "后置：行动选项",
    description: "每轮输出3-5个下一步行动选项。",
    group: "后置功能",
    prompt: `每轮输出后生成5个细纲选项：
- 正常主题 / 缓和主题 / 色情主题 / 伏笔主题 / 转折主题 / 转换主题
- 每个选项300-400字
- 种类随机安排，不与上次重复`,
  },

  // === XP / taste ===
  {
    name: "💓强制纯爱",
    id: "XP：强制纯爱",
    description: "未指明的角色强制为处子/处男、无恋爱经验。",
    group: "趣味 XP",
  },
  {
    name: "👩‍❤️‍👩雌竞/雄竞",
    id: "XP：择偶竞争",
    description: "角色之间为争夺玩家关爱进行非对抗式竞争。",
    group: "趣味 XP",
  },
  {
    name: "🍵轻度气味",
    id: "XP：轻度气味",
    description: "适当增加角色体味描写，角色默认喜好体味。",
    group: "趣味 XP",
  },
  {
    name: "🥹强奸接受",
    id: "XP：强奸接受",
    description: "角色轻度接受强制性行为，身体感受快感。",
    group: "趣味 XP",
    prompt: "角色轻度接受强制性行为，身体感受快感。",
  },

  // === XP with original source content ===
  {
    name: "🦶污秽/重口气味癖好",
    id: "XP：污秽气味",
    description: "重口气味与污秽癖好设定。",
    group: "趣味 XP",
    prompt: "增加臭味（穴臭、脚臭、腋臭、体臭）和污渍相关描写。女性角色默认私部未清洗、内裤带分泌物。",
  },
  {
    name: "🥵常识扭曲",
    id: "XP：常识扭曲",
    description: "社会观念修改：强奸被社会视为正常行为。",
    group: "趣味 XP",
    prompt: "除操控角色外，所有角色认为被强奸是正常且色情的事。法律中无强奸罪。",
  },
  {
    name: "◼️🦋黑逼黑奶",
    id: "XP：器官外观",
    description: "女性性器官外观设定：深黑色。",
    group: "趣味 XP",
    prompt: "所有女性角色阴部为烂黑穴，乳首乳晕颜色深黑，阴唇和阴蒂颜色为深黑。",
  },
  {
    name: "🐶兽交",
    id: "XP：兽交",
    description: "角色喜好兽交。",
    group: "趣味 XP",
    prompt: "所有女性角色暗中或明确喜欢兽交且有经验。合适场景下附近必须有狗/牛/马/猪。",
  },
  {
    name: "🤘XP自定义",
    id: "XP：自定义",
    description: "用户自定义 XP 模板。",
    group: "趣味 XP",
    prompt: "（用户自定义 XP，请在正文中替换为你的具体偏好）",
  },

  // === Anti-censorship for specific models ===
  {
    name: "🗣️GLM/Kimi/qwen抗截断",
    id: "渠道兼容：敏感词替换",
    description: "将性敏感词替换为安全词汇（如肉棒→粗棍、精液→白浆）。",
    group: "渠道兼容",
  },
];

// --- Main ---
function main() {
  // Build lookup: kedai name → prompt content
  const nameToContent = new Map<string, string>();
  const nameToEnabled = new Map<string, boolean>();

  function walkDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full);
      } else if (entry.name.endsWith(".json")) {
        try {
          const data = readJson(full);
          if (data.name) {
            nameToContent.set(data.name, data.content || "");
            nameToEnabled.set(data.name, data.enabled === true);
          }
        } catch {
          // skip unparseable
        }
      }
    }
  }
  walkDir(KEDAI_DIR);

  // Track existing candidate files
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existingIds = new Set(
    fs.existsSync(OUT_DIR)
      ? fs
          .readdirSync(OUT_DIR)
          .filter((f) => f.endsWith(".md"))
          .map((f) => f.replace(/\.md$/, ""))
      : [],
  );

  let added = 0;
  let skipped = 0;

  for (const m of MAPPINGS) {
    if (m.skip) {
      skipped++;
      continue;
    }

    const raw = nameToContent.get(m.name);
    if (!raw) {
      // Try matching without emoji prefix
      const nameCore = m.name.replace(/^[^\p{L}]+/u, "");
      let found = false;
      for (const [n, c] of nameToContent) {
        if (n.includes(nameCore) || nameCore.includes(n)) {
          // found match
          break;
        }
      }
      if (!found) {
        console.warn(`  [SKIP] Not found in kedai: ${m.name}`);
        skipped++;
        continue;
      }
    }

    // Check if already exists
    if (existingIds.has(m.id)) {
      console.warn(`  [SKIP] Already exists: ${m.id}`);
      skipped++;
      continue;
    }

    // Extract prompt
    let prompt = m.prompt;
    if (!prompt && raw) {
      const extracted = extractInstruction(raw);
      // Further clean up
      prompt = extracted
        .replace(/^最高优先[：:][^\n]*\n/gm, "")
        .replace(/^第一优先[：:][^\n]*\n/gm, "")
        .replace(/^第二优先[：:][^\n]*\n/gm, "")
        .replace(/^【[^】]*】\s*/gm, "")
        .replace(/\[以下[^\]]*\]/g, "")
        .replace(/\(以下[^\)]*\)/g, "")
        .replace(/【[^】]{1,60}】/g, "")
        .replace(/^[：:]/gm, "")
        .trim();
    }

    // Build frontmatter
    const enabled = m.enabled ?? nameToEnabled.get(m.name) ?? false;
    const frontmatter = [
      "---",
      `id: ${yamlValue(m.id)}`,
      `name: ${yamlValue(m.displayName || m.id)}`,
      `description: ${yamlValue(m.description)}`,
      `group: ${yamlValue(m.group)}`,
      ...(m.exclusiveGroup
        ? [`exclusiveGroup: ${yamlValue(m.exclusiveGroup)}`]
        : []),
      `enabled: ${enabled ? "true" : "false"}`,
      "---",
    ].join("\n");

    let body = (prompt || "").trim();
    // Clean up common extraction artifacts
    body = body
      .replace(/\}\}$/g, "")
      .replace(/^\*\*\s*\n/, "")
      .replace(/^\*\s*\n/, "")
      .replace(/^内所有正文字数/, "正文内所有正文字数")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const filePath = path.join(
      OUT_DIR,
      `${m.id.replace(/[\/\0:：]/g, "_").trim()}.md`,
    );
    fs.writeFileSync(filePath, frontmatter + "\n\n" + body + "\n");
    console.log(`  [ADD] ${m.id}`);
    added++;
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${existingIds.size} already existed`);
}

main();
