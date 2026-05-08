import fs from 'fs'
import path from 'path'
import { buildRoleplayPipeline, type RoleplaySkill } from '../src/promptPipeline'

const DEFAULT_SKILL_DIR = path.resolve(process.cwd(), 'prompts/user-config')
const DEFAULT_OUT = path.resolve(process.cwd(), 'data/roleplay-mvp/roleplay-pipeline-demo.json')
const DEFAULT_CONFIG = path.resolve(process.cwd(), 'data/roleplay-mvp/player-config.json')
const DEFAULT_DIRECTOR_PROMPT = path.resolve(process.cwd(), 'prompts/director/prompt.md')
const DEFAULT_NARRATOR_PROMPT = path.resolve(process.cwd(), 'prompts/narrator/prompt.md')
const DEFAULT_HARD_RULES = path.resolve(process.cwd(), 'prompts/system-hard-rules/hard-rules.md')

const skillDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SKILL_DIR
const outPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT
const configPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_CONFIG
const directorPromptPath = process.argv[5] ? path.resolve(process.argv[5]) : DEFAULT_DIRECTOR_PROMPT
const narratorPromptPath = process.argv[6] ? path.resolve(process.argv[6]) : DEFAULT_NARRATOR_PROMPT

interface PlayerConfig {
  userInjectionModuleIds: string[]
  directSkillIds: string[]
}

function loadSkills(dir: string): RoleplaySkill[] {
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.md')).sort()
  return files.map(file => {
    const { attrs, body } = parseMarkdownConfig(fs.readFileSync(path.join(dir, file), 'utf-8'))
    const id = attrs.id || path.basename(file, '.md')
    return {
      id,
      name: attrs.name || id,
      description: attrs.description || '',
      layer: 'all',
      sourceName: attrs.name || id,
      sourceIdentifier: null,
      sourceRole: null,
      enabledInSource: attrs.enabled === 'true',
      prompt: body,
    } satisfies RoleplaySkill
  })
}

function parseMarkdownConfig(raw: string): { attrs: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n').trim()
  if (!normalized.startsWith('---\n')) return { attrs: {}, body: normalized }
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) return { attrs: {}, body: normalized }
  const attrs: Record<string, string> = {}
  for (const line of normalized.slice(4, end).split('\n')) {
    const index = line.indexOf(':')
    if (index < 1) continue
    attrs[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return { attrs, body: normalized.slice(end + 5).trim() }
}

function readPromptPath(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  const marker = '\n---\n'
  const index = content.indexOf(marker)
  return (index >= 0 ? content.slice(index + marker.length) : content).trim()
}

function loadPlayerConfig(filePath: string): PlayerConfig {
  if (!fs.existsSync(filePath)) return { userInjectionModuleIds: [], directSkillIds: [] }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { userInjectionModuleIds?: unknown; directSkillIds?: unknown }
  const userInjectionModuleIds = Array.isArray(raw.userInjectionModuleIds)
    ? raw.userInjectionModuleIds.filter((id): id is string => typeof id === 'string')
    : []
  const directSkillIds = Array.isArray(raw.directSkillIds)
    ? raw.directSkillIds.filter((id): id is string => typeof id === 'string')
    : []
  return {
    userInjectionModuleIds: userInjectionModuleIds.length > 0 ? userInjectionModuleIds : directSkillIds,
    directSkillIds,
  }
}

const skills = loadSkills(skillDir)
const playerConfig = loadPlayerConfig(configPath)
const directorPrompt = readPromptPath(directorPromptPath)
const narratorPrompt = readPromptPath(narratorPromptPath)
const hardRules = readPromptPath(DEFAULT_HARD_RULES)
const pipeline = buildRoleplayPipeline(skills, {
  hardRules,
  worldState: [
    '当前场景：雨夜房间。',
    '在场角色：玩家、林晚。',
    '已知事实：林晚把一封旧信压在掌心下，玩家已经注意到信纸。',
    '知识边界：林晚不知道玩家已经看清信纸上的旧印章。',
    '当前张力：信件来源不能在本轮直接揭示。',
  ].join('\n'),
  globalContext: [
    '玩家与林晚已经连续几轮围绕旧信周旋。',
    '旧信来源仍未揭示。',
  ].join('\n'),
  recentTurns: [
    '上一轮：林晚把旧信压在掌心下，短暂回避玩家视线。',
    '再上一轮：玩家注意到信纸边缘有旧印章。',
  ].join('\n'),
  loadedMaterialModules: 'character.lin-wan：林晚谨慎、压抑，知道旧信来源但不愿主动说明。',
  moduleRegistry: [
    'character.lin-wan：林晚的人设、知识边界、说话习惯。',
    'world.old-letter：旧信、印章、旧案相关设定。',
  ].join('\n'),
  directorPlan: '（此处填入第一轮 Director 输出的 JSON；MVP demo 只展示 prompt envelope。）',
  playerInput: '我看着她手里的信纸，没有立刻开口。',
  userInjectionModuleIds: playerConfig.userInjectionModuleIds,
  directorPrompt,
  narratorPrompt,
})

const demo = {
  name: 'roleplay-mvp-demo',
  generatedAt: new Date().toISOString(),
  note: 'MVP 不调用外部模型，只展示 Director / Narrator prompt envelope；运行时正文直接进入 Postprocess。',
  configPath,
  directorPromptPath,
  narratorPromptPath,
  userInjectionModuleIds: playerConfig.userInjectionModuleIds,
  pipeline,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(demo, null, 2)}\n`)

console.log(outPath)
