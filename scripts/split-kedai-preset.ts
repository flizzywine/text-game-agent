import * as fs from "fs";
import * as path from "path";

const SOURCE =
  "/Users/cf/Workspace/tools/SillyTavern/data/default-user/OpenAI Settings/5.5【可待-创】 一幕三场.json";
const OUT_DIR = "/Users/cf/Workspace/text-game-agent/kedai-preset";

function safeName(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/^\.+/, "")
    .replace(/\s+/g, "_")
    .substring(0, 80);
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Map prompt identifier to section based on content analysis
function classifyPrompt(prompt: any): string {
  const name = prompt.name || "";
  const content = prompt.content || "";

  // System section headers
  if (name.startsWith("〈前置处理〉")) return "前置处理/00_系统标头";
  if (name.startsWith("〈人称")) return "创作准则/00_系统标头";
  if (name.startsWith("〈文风处理〉")) return "文风准则/00_系统标头";
  if (name.startsWith("〈瑟瑟处理〉")) return "文风准则_瑟瑟/00_系统标头";
  if (name.startsWith("〈趣味功能〉")) return "趣味功能/00_系统标头";
  if (name.startsWith("〈清口XP〉")) return "趣味功能/00_系统标头_清口";
  if (name.startsWith("〈重口XP〉")) return "趣味功能/00_系统标头_重口";
  if (name.startsWith("〈后置功能〉")) return "后置功能/00_系统标头";
  if (name.startsWith("〈核心功能〉")) return "核心功能/00_系统标头";
  if (name.startsWith("〈必读上〉")) return "核心功能/01_必读上";
  if (name.startsWith("〈必读下〉")) return "核心功能/02_必读下";
  if (name.startsWith("〈模块思维链〉")) return "思维链/00_系统标头";
  if (name.startsWith("〈填充功能相关〉")) return "填充功能/00_系统标头";
  if (name.includes("必读）〈其他思维链")) return "思维链/01_其他思维链说明";
  if (name.startsWith("〈风格文风〉")) return "文风准则/01_风格文风总纲";

  // Check content for setvar calls
  if (content.includes("可待_前置处理")) return "前置处理";
  if (content.includes("可待_创作准则")) return "创作准则";
  if (content.includes("可待_文风准则")) return "文风准则";
  if (content.includes("可待_后置功能")) return "后置功能";
  if (content.includes("可待_思维链_本体")) return "思维链";
  if (content.includes("可待_思维链_预填充定位")) return "填充功能";
  if (content.includes("可待_思维链_非预填充定位")) return "填充功能";
  if (content.includes("可待_定位")) return "后置功能";
  if (content.includes("可待_模板格式")) return "核心功能";
  if (content.includes("可待_伏笔大纲")) return "后置功能";
  if (content.includes("助手要求")) return "助手人格";
  if (content.includes("lastUserMessage")) return "核心功能";
  if (content.includes("梁元_创作准则")) return "文风准则_NSFW参考";
  if (content.includes("output-template")) return "核心功能";

  // Special known prompts by name
  if (name === "Main Prompt") return "核心功能";
  if (name === "Enhance Definitions") return "核心功能";
  if (name === "Auxiliary Prompt") return "核心功能";
  if (name === "Post-History Instructions") return "核心功能";
  if (name === "User设定" || name.includes("Persona")) return "核心功能";
  if (name.includes("Char设定")) return "核心功能";
  if (name.includes("Char性格")) return "核心功能";
  if (name.includes("Char情景")) return "核心功能";
  if (name === "Chat Examples") return "核心功能";
  if (name === "Chat History") return "核心功能";
  if (name.includes("World Info")) return "核心功能";
  if (name === "SPreset配置") return "核心功能";
  if (name.includes("由角色卡注入")) return "核心功能";

  return "其他";
}

function main() {
  console.log("Reading source...");
  const raw = fs.readFileSync(SOURCE, "utf-8");
  const data = JSON.parse(raw);

  ensureDir(OUT_DIR);

  // 1. Base settings (temperature, etc.)
  const baseSettings: any = {};
  const settingKeys = [
    "temperature", "frequency_penalty", "presence_penalty", "top_p",
    "top_k", "top_a", "min_p", "repetition_penalty",
    "openai_max_context", "openai_max_tokens",
    "wrap_in_quotes", "names_behavior", "send_if_empty",
    "stream_openai", "max_context_unlocked",
    "wi_format", "scenario_format", "personality_format",
    "assistant_prefill", "assistant_impersonation",
    "continue_prefill", "continue_postfix",
    "function_calling", "show_thoughts", "reasoning_effort",
    "enable_web_search", "request_images", "seed", "n",
    "claude_use_sysprompt", "use_makersuite_sysprompt",
    "squash_system_messages", "image_inlining", "video_inlining", "audio_inlining",
    "inline_image_quality",
  ];
  for (const key of settingKeys) {
    if (key in data) baseSettings[key] = data[key];
  }
  // Also save prompt order and special prompts
  baseSettings.prompt_order = data.prompt_order;
  baseSettings.impersonation_prompt = data.impersonation_prompt || "";
  baseSettings.new_chat_prompt = data.new_chat_prompt || "";
  baseSettings.new_group_chat_prompt = data.new_group_chat_prompt || "";
  baseSettings.new_example_chat_prompt = data.new_example_chat_prompt || "";
  baseSettings.continue_nudge_prompt = data.continue_nudge_prompt || "";
  baseSettings.group_nudge_prompt = data.group_nudge_prompt || "";
  baseSettings.bias_preset_selected = data.bias_preset_selected || "";

  fs.writeFileSync(
    path.join(OUT_DIR, "base-settings.json"),
    JSON.stringify(baseSettings, null, 2),
  );
  console.log("Wrote base-settings.json");

  // 2. Extensions
  if (data.extensions) {
    ensureDir(path.join(OUT_DIR, "extensions"));
    fs.writeFileSync(
      path.join(OUT_DIR, "extensions", "SPreset.json"),
      JSON.stringify(data.extensions.SPreset, null, 2),
    );
    console.log("Wrote extensions/SPreset.json");

    if (data.extensions.regex_scripts) {
      const regexDir = path.join(OUT_DIR, "extensions", "regex-scripts");
      ensureDir(regexDir);
      for (const rs of data.extensions.regex_scripts) {
        const name = safeName(rs.scriptName || rs.id);
        fs.writeFileSync(
          path.join(regexDir, `${name}.json`),
          JSON.stringify(rs, null, 2),
        );
      }
      console.log(
        `Wrote ${data.extensions.regex_scripts.length} regex-scripts`,
      );
    }
  }

  // 3. Tavern helper scripts
  if (data.extensions?.tavern_helper?.scripts) {
    const scriptsDir = path.join(OUT_DIR, "extensions", "tavern-scripts");
    ensureDir(scriptsDir);
    for (const s of data.extensions.tavern_helper.scripts) {
      const name = safeName(s.name || s.id);
      fs.writeFileSync(
        path.join(scriptsDir, `${name}.json`),
        JSON.stringify(s, null, 2),
      );
    }
    console.log(
      `Wrote ${data.extensions.tavern_helper.scripts.length} tavern-scripts`,
    );
  }

  // 3b. Tavern helper variables
  if (data.extensions?.tavern_helper?.variables) {
    ensureDir(path.join(OUT_DIR, "extensions", "variables"));
    for (const [key, value] of Object.entries(
      data.extensions.tavern_helper.variables,
    )) {
      fs.writeFileSync(
        path.join(OUT_DIR, "extensions", "variables", `${safeName(key)}.json`),
        JSON.stringify(value, null, 2),
      );
    }
    console.log(
      `Wrote ${Object.keys(data.extensions.tavern_helper.variables).length} variable files`,
    );
  }

  // 4. Prompts - split into individual files
  if (data.prompts) {
    const promptsDir = path.join(OUT_DIR, "prompts");
    ensureDir(promptsDir);

    // Create manifest
    const manifest: any[] = [];

    for (let i = 0; i < data.prompts.length; i++) {
      const prompt = data.prompts[i];
      const section = classifyPrompt(prompt);
      const secDir = path.join(promptsDir, section);
      ensureDir(secDir);

      const idx = String(i).padStart(3, "0");
      const name = safeName(prompt.name || prompt.identifier);
      const filename = `${idx}_${name}.json`;

      fs.writeFileSync(path.join(secDir, filename), JSON.stringify(prompt, null, 2),);

      manifest.push({
        index: i,
        identifier: prompt.identifier,
        name: prompt.name,
        enabled: prompt.enabled,
        role: prompt.role,
        section,
        file: `${section}/${filename}`,
      });
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "prompts-manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    console.log(`Wrote ${data.prompts.length} prompts to prompts/`);
  }

  // 5. Prompt order
  if (data.prompt_order) {
    fs.writeFileSync(
      path.join(OUT_DIR, "prompt-order.json"),
      JSON.stringify(data.prompt_order, null, 2),
    );
    console.log("Wrote prompt-order.json");
  }

  console.log(`\nDone! Output: ${OUT_DIR}`);
}

main();
