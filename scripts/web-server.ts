import fs from 'fs'
import http from 'http'
import path from 'path'
import { parseJsonObject } from '../src/jsonObjectParser'

type ChatRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface UserModule {
  id: string
  name: string
  description?: string
  layer?: 'narrator' | 'editor' | 'all'
  group?: string
  exclusiveGroup?: string
  prompt?: string
  file?: string
  enabled: boolean
  custom?: boolean
}

interface StorybookEntry {
  id: string
  title: string
  type?: string
  tags?: string[]
  content: string
  enabled: boolean
}

interface CharacterState {
  id: string
  name: string
  role?: string
  mood?: string
  location?: string
  health?: string
  trust?: string
  notes?: string
}

interface ConversationItem {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateRequest {
  playerInput: string
  globalContext?: string
  longRangeOutline?: string
  turnIndex?: number
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  userModules?: UserModule[]
  storybookEntries?: StorybookEntry[]
  statusPanelSchema?: string
  statusPanel?: string
  enableEditor?: boolean
  model?: string
  apiKey?: string
  temperature?: number
}

interface PersistedStoryAsset {
  sourceName: string
  originalBase64?: string
  originalText?: string
  entries?: StorybookEntry[]
  characters?: CharacterState[]
  apiKey?: string
}

interface InitializeStoryRequest {
  assetId?: string
  sourceName: string
  entries?: StorybookEntry[]
  characters?: CharacterState[]
  apiKey?: string
  force?: boolean
}

interface PlayerOption {
  id: string
  label: string
  description: string
  inputText: string
}

interface StoryProgramConfig {
  sourceName: string
  generatedAt: string
  openingText: string
  worldview: string
  cast: CharacterState[]
  statusSubject?: string
  statusPanelSchema: string
  statusPanel: string
  initialPlayerOptions: PlayerOption[]
  normalizedEntries: StorybookEntry[]
  globalContextSeed: string
  currentSituation?: string
  outline?: string
  plotLines?: unknown[]
}

interface StoryAssetRecord {
  id: string
  sourceName: string
  importedAt?: string
  originalFile?: string
  markdownFile?: string
  programConfigFile?: string
  programConfig?: StoryProgramConfig
  entries: StorybookEntry[]
  characters: CharacterState[]
}

interface LayerResult {
  raw: string
  json: Record<string, unknown>
  metrics: LlmCallMetrics
}

interface LlmCallMetrics {
  label: string
  model: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedOutputTokens: number
}

interface PipelineEvent {
  type: 'stage_start' | 'stage_tick' | 'stage_result' | 'stage_skip'
  stage: 'initializer' | 'director' | 'narrator' | 'editor' | 'postprocess'
  label: string
  message?: string
  json?: Record<string, unknown> | null
}

const rootDir = process.cwd()
const webDir = path.join(rootDir, 'web')
const promptDir = path.join(rootDir, 'prompts')
const userConfigDir = path.join(promptDir, 'user-config')
const storyDir = path.join(rootDir, 'story')
const saveDir = path.join(rootDir, 'save')
const debugDir = path.join(rootDir, 'debug')
const llmDebugDir = path.join(debugDir, 'llm-raw')
const saveFile = path.join(saveDir, 'current-state.json')
const defaultModel = 'deepseek-v4-pro'
const modelIds = new Set(['deepseek-v4-pro', 'deepseek-v4-flash'])
const defaultBaseUrl = 'https://api.deepseek.com'
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300_000)
const port = Number(process.env.PORT || 4173)
const localEnv = readDotEnv(path.join(rootDir, '.env.local'))
const internalizedModuleIds = new Set([
  'editor.output-constraints',
  'editor.continuity-validator',
  'editor.narrative-critic',
])
const metadataKeys = new Set(['id', 'name', 'description', 'layer', 'group', 'exclusiveGroup', 'enabled'])

function readDotEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

function env(name: string): string | undefined {
  return process.env[name] || localEnv[name]
}

function normalizeModel(value: unknown): string {
  const model = String(value || '').trim()
  return modelIds.has(model) ? model : defaultModel
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text || '').length / 1.8))
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
      if (body.length > 80_000_000) {
        reject(new Error('request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function ensureDataDirs(): void {
  fs.mkdirSync(storyDir, { recursive: true })
  fs.mkdirSync(saveDir, { recursive: true })
  fs.mkdirSync(llmDebugDir, { recursive: true })
}

function safeName(value: string, fallback = 'untitled'): string {
  return (value || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function writeLlmDebugFile(input: {
  label: string
  raw: string
  repairedRaw?: string
  messages: ChatMessage[]
  error: unknown
}): string {
  ensureDataDirs()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(llmDebugDir, `${stamp}-${safeName(input.label, 'llm')}.json`)
  writeJsonFile(filePath, {
    label: input.label,
    createdAt: new Date().toISOString(),
    error: input.error instanceof Error ? input.error.message : String(input.error),
    raw: input.raw,
    repairedRaw: input.repairedRaw,
    messages: input.messages.map(message => ({
      role: message.role,
      contentLength: message.content.length,
      content: message.content,
    })),
  })
  return path.relative(rootDir, filePath)
}

function readSaveState(): unknown | null {
  ensureDataDirs()
  if (!fs.existsSync(saveFile)) return null
  return JSON.parse(fs.readFileSync(saveFile, 'utf-8'))
}

function writeSaveState(value: unknown): void {
  ensureDataDirs()
  writeJsonFile(saveFile, value)
}

function persistStoryAsset(asset: PersistedStoryAsset): Record<string, string> {
  ensureDataDirs()
  const baseName = safeName(path.basename(asset.sourceName || 'story-asset'))
  const stem = safeName(baseName.replace(/\.[^.]+$/, ''), 'story-asset')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const assetDir = path.join(storyDir, `${stamp}-${stem}`)
  fs.mkdirSync(assetDir, { recursive: true })

  if (asset.originalBase64) {
    fs.writeFileSync(path.join(assetDir, baseName), Buffer.from(asset.originalBase64, 'base64'))
  } else if (asset.originalText !== undefined) {
    fs.writeFileSync(path.join(assetDir, baseName), asset.originalText, 'utf-8')
  }

  writeJsonFile(path.join(assetDir, 'manifest.json'), {
    sourceName: asset.sourceName,
    importedAt: new Date().toISOString(),
    originalFile: baseName,
    markdownFile: `${stem}.md`,
    programConfigFile: 'program-config.json',
    entries: asset.entries || [],
    characters: asset.characters || [],
  })

  const md = renderAssetMarkdown(asset)
  fs.writeFileSync(path.join(assetDir, `${stem}.md`), md, 'utf-8')
  return {
    dir: path.relative(rootDir, assetDir),
    markdown: path.relative(rootDir, path.join(assetDir, `${stem}.md`)),
    original: path.relative(rootDir, path.join(assetDir, baseName)),
  }
}

function listStoryAssets(): StoryAssetRecord[] {
  ensureDataDirs()
  return fs.readdirSync(storyDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => readStoryAssetRecord(path.join(storyDir, entry.name), entry.name))
    .filter((record): record is StoryAssetRecord => Boolean(record))
    .sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')))
}

function readStoryAssetRecord(assetDir: string, id: string): StoryAssetRecord | null {
  const manifestPath = path.join(assetDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<StoryAssetRecord>
    const markdownFileName = manifest.markdownFile || fs.readdirSync(assetDir).find(file => file.endsWith('.md'))
    const programConfigFileName = manifest.programConfigFile || 'program-config.json'
    const programConfigPath = path.join(assetDir, programConfigFileName)
    const programConfig = fs.existsSync(programConfigPath)
      ? JSON.parse(fs.readFileSync(programConfigPath, 'utf-8')) as StoryProgramConfig
      : undefined
    const markdownPath = markdownFileName ? path.join(assetDir, markdownFileName) : ''
    const markdownContent = markdownPath && fs.existsSync(markdownPath)
      ? fs.readFileSync(markdownPath, 'utf-8')
      : ''
    let entries = Array.isArray(manifest.entries) ? manifest.entries : []
    if (entries.length > 0 && entries.every(entry => !entry.content) && markdownContent) {
      entries = [{
        id: `story-asset.${id}.markdown`,
        title: String(manifest.sourceName || id),
        type: entries[0]?.type || 'story-book',
        tags: [...new Set(entries.flatMap(entry => entry.tags || []))],
        content: markdownContent,
        enabled: true,
      }]
    }
    const characters = Array.isArray(manifest.characters) ? manifest.characters : []
    return {
      id,
      sourceName: String(manifest.sourceName || id),
      importedAt: manifest.importedAt,
      originalFile: manifest.originalFile ? path.posix.join('story', id, manifest.originalFile) : undefined,
      markdownFile: markdownFileName ? path.posix.join('story', id, markdownFileName) : undefined,
      programConfigFile: fs.existsSync(programConfigPath) ? path.posix.join('story', id, programConfigFileName) : undefined,
      programConfig,
      entries,
      characters,
    }
  } catch {
    return null
  }
}

function deleteSaveState(): void {
  ensureDataDirs()
  if (fs.existsSync(saveFile)) fs.unlinkSync(saveFile)
}

function renderAssetMarkdown(asset: PersistedStoryAsset): string {
  const lines = [
    '---',
    `source: "${(asset.sourceName || '').replace(/"/g, '\\"')}"`,
    `importedAt: "${new Date().toISOString()}"`,
    '---',
    '',
    `# ${asset.sourceName || '导入资料'}`,
    '',
  ]

  if (asset.characters?.length) {
    lines.push('## 人物状态', '')
    for (const character of asset.characters) {
      lines.push(
        `### ${character.name || character.id}`,
        character.role ? `- 身份：${character.role}` : '',
        character.mood ? `- 情绪：${character.mood}` : '',
        character.location ? `- 位置：${character.location}` : '',
        character.health ? `- 状态：${character.health}` : '',
        character.trust ? `- 关系：${character.trust}` : '',
        character.notes ? `\n${character.notes}` : '',
        '',
      )
    }
  }

  if (asset.entries?.length) {
    lines.push('## 资料条目', '')
    for (const entry of asset.entries) {
      lines.push(
        `### ${entry.title || entry.id}`,
        `- id：${entry.id}`,
        entry.type ? `- 类型：${entry.type}` : '',
        entry.tags?.length ? `- 标签：${entry.tags.join(', ')}` : '',
        '',
        entry.content || '',
        '',
      )
    }
  }

  return `${lines.filter(line => line !== undefined).join('\n')}\n`
}

function readPrompt(name: string): string {
  return readPromptFile(path.join(promptDir, name))
}

function readPromptFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  const marker = '\n---\n'
  const index = content.indexOf(marker)
  return (index >= 0 ? content.slice(index + marker.length) : content).trim()
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
    const key = line.slice(0, index).trim()
    if (!metadataKeys.has(key)) continue
    attrs[key] = unquoteYamlValue(line.slice(index + 1).trim())
  }
  return { attrs, body: normalized.slice(end + 5).trim() }
}

function unquoteYamlValue(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim()
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function block(label: string, value: string | undefined, fallback = '（无）'): string {
  return `【${label}】\n${value?.trim() || fallback}\n`
}

function wrapWithMustRead(content: string): string {
  return [
    readPrompt('system-hard-rules/must-read-top.md'),
    content.trim(),
    readPrompt('system-hard-rules/must-read-bottom.md'),
  ].join('\n\n')
}

function renderCharacters(characters: CharacterState[] = []): string {
  if (characters.length === 0) return ''
  return characters.map(character => [
    `## ${character.name || character.id}`,
    character.role ? `身份：${character.role}` : '',
    character.mood ? `情绪：${character.mood}` : '',
    character.location ? `位置：${character.location}` : '',
    character.health ? `状态：${character.health}` : '',
    character.trust ? `关系：${character.trust}` : '',
    character.notes ? `备注：${character.notes}` : '',
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderConversation(turns: ConversationItem[] = []): string {
  return turns.slice(-20).map(turn => `${turn.role === 'user' ? '玩家' : '系统'}：${turn.content}`).join('\n\n')
}

function renderModules(modules: UserModule[] = []): string {
  const filtered = modules.filter(module => module.enabled)
  if (filtered.length === 0) return ''
  return filtered.map(module => [
    `## ${module.id}`,
    `名称：${module.name}`,
    module.description ? `说明：${module.description}` : '',
    module.prompt,
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderStorybook(entries: StorybookEntry[] = []): string {
  const enabled = entries.filter(entry => entry.enabled && entry.content.trim())
  if (enabled.length === 0) return ''
  return enabled.map(entry => [
    `## ${entry.id}｜${entry.title}`,
    entry.type ? `类型：${entry.type}` : '',
    entry.tags?.length ? `标签：${entry.tags.join(', ')}` : '',
    entry.content,
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderStorybookRegistry(entries: StorybookEntry[] = []): string {
  const enabled = entries.filter(entry => entry.enabled && entry.content.trim())
  if (enabled.length === 0) return ''
  return enabled.map(entry => `${entry.id}：${entry.title}${entry.tags?.length ? `｜${entry.tags.join(',')}` : ''}`).join('\n')
}

function renderInitializationMaterial(input: InitializeStoryRequest): string {
  return [
    input.sourceName ? `# ${input.sourceName}` : '',
    input.characters?.length ? `\n## 人物\n${renderCharacters(input.characters)}` : '',
    input.entries?.length ? `\n## 故事资料\n${renderStorybook(input.entries)}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 50000)
}

function extractOpeningTextFromEntries(entries: StorybookEntry[] = []): string {
  const preferred = entries.find(entry => {
    const text = `${entry.title || ''} ${entry.type || ''} ${(entry.tags || []).join(' ')}`
    return /开场|开局|opening|greeting|first/i.test(text)
  }) || entries[0]
  return String(preferred?.content || '').trim()
}

function fallbackStoryInitialization(input: InitializeStoryRequest): StoryProgramConfig {
  const cast = input.characters?.length
    ? input.characters
    : [{
      id: 'character.player',
      name: '玩家',
      role: '玩家操控角色',
      mood: '待输入',
      location: '开场',
      health: '正常',
      trust: '',
      notes: '玩家操控角色；不替玩家锁死长期选择。',
    }]
  const statusSubject = cast.find(character => character.name && character.name !== '玩家')?.name || cast[0]?.name || '玩家'
  const openingText = extractOpeningTextFromEntries(input.entries || [])
  const worldview = [
    `故事资料：${input.sourceName || '未命名故事'}`,
    input.entries?.length ? `资料条目：${input.entries.map(entry => entry.title || entry.id).filter(Boolean).join('、')}` : '',
  ].filter(Boolean).join('\n')
  const statusPanelSchema = ensureSpatialStatusPanelSchema([
    `# 人物状态 Schema｜${statusSubject}`,
    '- 当前位置：人物当前所在位置。',
    '- 外显状态：玩家能观察到的姿态、表情、动作。',
    '- 情绪：当前情绪和强度。',
    '- 对玩家态度：关系温度、信任、戒备或兴趣。',
    '- 已知信息：该人物已经知道的事实。',
    '- 隐藏意图：该人物暂未明说但需要持续追踪的动机。',
    '- 当前可互动入口：玩家下一步最容易触发的互动。',
    '- 固定设定：不得被后续输出擅自改写的人物设定。',
  ].join('\n'), statusSubject, cast)
  const statusPanel = ensureSpatialStatusPanel([
    `## ${statusSubject}｜人物状态`,
    '当前位置：开场',
    '外显状态：等待玩家输入',
    '情绪：未定',
    '对玩家态度：未定',
    '已知信息：按故事资料',
    '隐藏意图：未揭示',
    '当前可互动入口：输入第一句行动、对话或想法',
    '固定设定：遵守人物介绍和世界观',
  ].join('\n'), statusSubject, cast)
  const normalizedEntries = [
    {
      id: 'worldview.main',
      title: '世界观',
      type: 'worldview',
      tags: ['worldview'],
      content: worldview,
      enabled: true,
    },
    ...cast.map(character => ({
      id: `character.${safeName(character.name || character.id, 'main')}.profile`,
      title: `人物介绍：${character.name || character.id}`,
      type: 'character-profile',
      tags: ['character', character.name || character.id].filter(Boolean),
      content: renderCharacters([character]),
      enabled: true,
    })),
    ...(input.entries || []),
  ]
  return {
    sourceName: input.sourceName || '未命名故事',
    generatedAt: new Date().toISOString(),
    openingText,
    worldview,
    cast,
    statusSubject,
    statusPanelSchema,
    statusPanel,
    initialPlayerOptions: [
      { id: 'A', label: '观察', description: '先观察当前局面。', inputText: '我先观察周围和对方的反应。' },
      { id: 'B', label: '开口', description: '用一句话打开互动。', inputText: '我开口问道：“现在是什么情况？”' },
      { id: 'C', label: '行动', description: '用一个轻动作试探场景。', inputText: '我向前一步，试探性地接近当前互动对象。' },
    ],
    normalizedEntries,
    globalContextSeed: [
      `当前故事资料：${input.sourceName || '未命名故事'}`,
      worldview ? `世界观：${worldview.slice(0, 300)}` : '',
      statusSubject ? `状态追踪人物：${statusSubject}` : '',
      openingText ? `开场白：${openingText.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n'),
  }
}

function ensureSpatialStatusPanelSchema(value: string, subject = '人物', characters: CharacterState[] = []): string {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/多人物身体\/空间状态/.test(text)) return text
  return [
    text,
    '',
    renderMultiCharacterSpatialSchema(subject, characters),
  ].join('\n')
}

function ensureSpatialStatusPanel(value: string, subject = '人物', characters: CharacterState[] = []): string {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/多人物身体\/空间状态/.test(text)) return text
  return [
    text,
    '',
    renderMultiCharacterSpatialPanel(subject, characters),
  ].join('\n')
}

function spatialParticipantNames(subject: string, characters: CharacterState[] = []): string[] {
  const names = [
    subject,
    ...characters.map(character => character.name || character.id || '').filter(Boolean),
  ]
  return [...new Set(names.map(name => String(name).trim()).filter(Boolean))]
}

function renderMultiCharacterSpatialSchema(subject: string, characters: CharacterState[] = []): string {
  const names = spatialParticipantNames(subject, characters)
  return [
    '## 多人物身体/空间状态（硬性维护）',
    `- 追踪对象：${names.join('、') || subject}`,
    '- 每个在场人物都必须有一行状态，不只记录核心人物。',
    '- 字段：姿势、朝向、相对位置/接触关系、双手占用、可触达区域、动作限制。',
    '- 姿势：站立、坐着、趴着、仰躺、侧躺、跪坐、靠墙、被遮挡等。',
    '- 朝向：面向谁、背对谁、侧向谁。',
    '- 相对位置/接触关系：谁在上方、侧边、身后、前方；是否贴近；中间是否有物件阻隔。',
    '- 双手占用：左手、右手分别在哪里，是否撑住、抓握、被压住、被遮挡或空闲。',
    '- 可触达区域：当前姿势下自然能碰到哪里，不能碰到哪里。',
    '- 动作限制：不可达动作必须先发生转身、侧身、起身、伸臂、移动位置或改变朝向。',
  ].join('\n')
}

function renderMultiCharacterSpatialPanel(subject: string, characters: CharacterState[] = []): string {
  const names = spatialParticipantNames(subject, characters)
  return [
    '## 多人物身体/空间状态',
    ...(names.length ? names : [subject]).map(name => [
      `### ${name}`,
      '姿势：开场，未发生具体姿势变化',
      '朝向：未定，等待正文建立',
      '相对位置/接触关系：未建立明确身体接触',
      '双手占用：左手未占用；右手未占用',
      '可触达区域：常规可达范围；具体动作以后续正文为准',
      '动作限制：若要执行当前姿势不可达动作，必须先写清楚姿势或位置调整',
    ].join('\n')),
  ].join('\n\n')
}

function formatStatusPanelPayload(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return formatStatusPanelObject(value).trim()
}

function formatStatusPanelObject(value: unknown, depth = 2): string {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === 'object') return formatStatusPanelObject(item, depth + 1)
        return `- ${String(item || '').trim()}`
      })
      .filter(Boolean)
      .join('\n')
  }
  if (!value || typeof value !== 'object') return String(value ?? '').trim()
  const heading = '#'.repeat(Math.min(depth, 4))
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      const title = `${heading} ${key}`
      if (item && typeof item === 'object') {
        const nested = formatStatusPanelObject(item, depth + 1)
        return nested ? `${title}\n${nested}` : title
      }
      const text = String(item ?? '').trim()
      return text ? `${key}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function getStoryAssetDir(assetId: string | undefined): string | null {
  if (!assetId) return null
  const dir = path.normalize(path.join(storyDir, assetId))
  return isInsidePath(storyDir, dir) && fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null
}

function readProgramConfig(assetDir: string): StoryProgramConfig | null {
  const configPath = path.join(assetDir, 'program-config.json')
  if (!fs.existsSync(configPath)) return null
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as StoryProgramConfig
}

function writeProgramConfig(assetDir: string, config: StoryProgramConfig): void {
  writeJsonFile(path.join(assetDir, 'program-config.json'), config)
  fs.writeFileSync(path.join(assetDir, 'program-config.md'), renderProgramConfigMarkdown(config), 'utf-8')
}

function renderProgramConfigMarkdown(config: StoryProgramConfig): string {
  return [
    '---',
    `sourceName: "${config.sourceName.replace(/"/g, '\\"')}"`,
    `generatedAt: "${config.generatedAt}"`,
    '---',
    '',
    `# ${config.sourceName}｜程序初始化配置`,
    '',
    '## 世界观',
    config.worldview || '（无）',
    '',
    '## 登场人物',
    config.cast.length
      ? config.cast.map(character => [
        `### ${character.name || character.id}`,
        character.role ? `- 身份：${character.role}` : '',
        character.mood ? `- 情绪：${character.mood}` : '',
        character.location ? `- 位置：${character.location}` : '',
        character.health ? `- 状态：${character.health}` : '',
        character.trust ? `- 关系：${character.trust}` : '',
        character.notes || '',
      ].filter(Boolean).join('\n')).join('\n\n')
      : '（无）',
    '',
    '## 开场白',
    config.openingText || '（无）',
    '',
    '## 人物状态追踪对象',
    config.statusSubject || '（无）',
    '',
    '## 人物状态 Schema',
    config.statusPanelSchema || '（无）',
    '',
    '## 初始人物状态',
    config.statusPanel || '（无）',
    '',
    '## 初始玩家选项',
    config.initialPlayerOptions.length
      ? config.initialPlayerOptions.map(option => [
        `### ${option.id}｜${option.label}`,
        option.description ? `- 说明：${option.description}` : '',
        option.inputText ? `- 输入：${option.inputText}` : '',
      ].filter(Boolean).join('\n')).join('\n\n')
      : '（无）',
    '',
    '## 规范化资料条目',
    config.normalizedEntries.length
      ? config.normalizedEntries.map(entry => [
        `### ${entry.title || entry.id}`,
        `- id：${entry.id}`,
        entry.type ? `- 类型：${entry.type}` : '',
        entry.tags?.length ? `- 标签：${entry.tags.join(', ')}` : '',
        '',
        entry.content || '',
      ].filter(Boolean).join('\n')).join('\n\n')
      : '（无）',
    '',
  ].join('\n')
}

function normalizeProgramConfig(raw: Record<string, unknown>, fallback: StoryProgramConfig): StoryProgramConfig {
  const cast = Array.isArray(raw.cast) ? raw.cast : Array.isArray(raw.characterSeeds) ? raw.characterSeeds : fallback.cast
  const normalizedEntries = Array.isArray(raw.normalizedEntries) ? raw.normalizedEntries : fallback.normalizedEntries
  const initialPlayerOptions = Array.isArray(raw.initialPlayerOptions)
    ? raw.initialPlayerOptions
    : Array.isArray(raw.playerOptions)
      ? raw.playerOptions
      : fallback.initialPlayerOptions
  return {
    sourceName: String(raw.sourceName || fallback.sourceName),
    generatedAt: String(raw.generatedAt || new Date().toISOString()),
    openingText: String(raw.openingText || fallback.openingText || ''),
    worldview: String(raw.worldview || fallback.worldview || ''),
    cast: cast as CharacterState[],
    statusSubject: String(raw.statusSubject || fallback.statusSubject || ''),
    statusPanelSchema: ensureSpatialStatusPanelSchema(String(raw.statusPanelSchema || fallback.statusPanelSchema || ''), String(raw.statusSubject || fallback.statusSubject || '人物'), cast as CharacterState[]),
    statusPanel: ensureSpatialStatusPanel(formatStatusPanelPayload(raw.statusPanel || fallback.statusPanel), String(raw.statusSubject || fallback.statusSubject || '人物'), cast as CharacterState[]),
    initialPlayerOptions: initialPlayerOptions as PlayerOption[],
    normalizedEntries: normalizedEntries as StorybookEntry[],
    globalContextSeed: String(raw.globalContextSeed || fallback.globalContextSeed || ''),
    currentSituation: typeof raw.currentSituation === 'string' ? raw.currentSituation : undefined,
    outline: typeof raw.outline === 'string' ? raw.outline : undefined,
    plotLines: Array.isArray(raw.plotLines) ? raw.plotLines : undefined,
  }
}

async function initializeStory(
  input: InitializeStoryRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<StoryProgramConfig> {
  const assetDir = getStoryAssetDir(input.assetId)
  if (assetDir && !input.force) {
    const existing = readProgramConfig(assetDir)
    if (existing) {
      emit({ type: 'stage_skip', stage: 'initializer', label: 'Initializer', message: '已存在 program-config，跳过初始化。', json: existing as unknown as Record<string, unknown> })
      return existing
    }
  }
  if (assetDir) {
    const record = readStoryAssetRecord(assetDir, input.assetId || '')
    input = {
      ...input,
      sourceName: input.sourceName || record?.sourceName || input.assetId || '未命名故事',
      entries: input.entries?.length ? input.entries : record?.entries || [],
      characters: input.characters?.length ? input.characters : record?.characters || [],
    }
  }

  const fallback = fallbackStoryInitialization(input)
  if (!input.apiKey?.trim() && !env('DEEPSEEK_API_KEY') && !env('DEEP_SEEK_API_KEY')) {
    throw new Error('故事尚未初始化：缺少 DeepSeek API Key，不能生成 program-config。')
  }

  const user = [
    block('固定 Initializer prompt', readPrompt('initializer/prompt.md')),
    block('故事资料', renderInitializationMaterial(input)),
  ].join('\n')

  try {
    emit({ type: 'stage_start', stage: 'initializer', label: 'Initializer', message: '初始化层：整理故事书，生成世界观、人物介绍、开场交互和人物状态 schema。' })
    const result = await callDeepSeekWithPublicTrace('initializer', 'Initializer', [{ role: 'user', content: user }], { temperature: 0.4, apiKey: input.apiKey }, emit, [
      '公开日志：正在读取故事书、人物卡和世界书，去掉重复噪音。',
      '公开日志：正在抽取世界观、人物介绍和固定设定。',
      '公开日志：正在写第一轮开场交互和 3 个玩家初始选项。',
      '公开日志：正在选择状态追踪人物，并生成人物状态 schema。',
      '公开日志：初始化层仍在等待模型返回 program-config。',
    ])
    const config = normalizeProgramConfig(result.json, fallback)
    if (assetDir) writeProgramConfig(assetDir, config)
    emit({ type: 'stage_result', stage: 'initializer', label: 'Initializer', message: '初始化完成：program-config 已生成。', json: config as unknown as Record<string, unknown> })
    return config
  } catch (error) {
    throw new Error(`故事初始化失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

async function callDeepSeek(messages: ChatMessage[], options: { temperature: number; apiKey?: string; debugLabel?: string; model?: string }): Promise<LayerResult> {
  const apiKey = options.apiKey?.trim() || env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY')
  if (!apiKey) throw new Error('missing DEEPSEEK_API_KEY')

  const baseUrl = (env('DEEPSEEK_BASE_URL') || defaultBaseUrl).replace(/\/+$/, '')
  const response = await requestDeepSeekContent(baseUrl, apiKey, messages, options.temperature, normalizeModel(options.model), options.debugLabel || 'DeepSeek')
  const raw = response.raw

  try {
    return { raw, json: parseJsonObject(raw), metrics: response.metrics }
  } catch (parseError) {
    let repairedRaw = ''
    try {
      const repaired = await repairJsonWithDeepSeek(baseUrl, apiKey, raw, normalizeModel(options.model))
      repairedRaw = repaired.raw
      return {
        raw: repairedRaw,
        json: parseJsonObject(repairedRaw),
        metrics: {
          ...response.metrics,
          durationMs: response.metrics.durationMs + repaired.metrics.durationMs,
          inputTokens: response.metrics.inputTokens + repaired.metrics.inputTokens,
          outputTokens: response.metrics.outputTokens + repaired.metrics.outputTokens,
          totalTokens: response.metrics.totalTokens + repaired.metrics.totalTokens,
          estimatedOutputTokens: response.metrics.estimatedOutputTokens + repaired.metrics.estimatedOutputTokens,
        },
      }
    } catch (repairError) {
      const file = writeLlmDebugFile({
        label: options.debugLabel || 'deepseek-parse-failed',
        raw,
        repairedRaw,
        messages,
        error: repairError,
      })
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError)
      const repairMessage = repairError instanceof Error ? repairError.message : String(repairError)
      throw new Error(`${parseMessage}；二次 JSON 修复也失败：${repairMessage}；原始返回已保存：${file}`)
    }
  }
}

async function requestDeepSeekContent(
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), llmTimeoutMs)
  let response: Response
  const startedAt = Date.now()

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`DeepSeek 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  const durationMs = Date.now() - startedAt
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('DeepSeek API Key 无效或已过期。请在页面右上角 API Key 里清除后重新粘贴完整 key。')
    }
    throw new Error(`DeepSeek ${response.status}: ${text.slice(0, 500)}`)
  }
  const payload = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
  }
  const raw = payload.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('DeepSeek returned an empty response')
  const estimatedOutputTokens = estimateTokens(raw)
  const inputTokens = Number(payload.usage?.prompt_tokens || 0)
  const outputTokens = Number(payload.usage?.completion_tokens || 0)
  const totalTokens = Number(payload.usage?.total_tokens || 0)
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedOutputTokens,
    },
  }
}

async function repairJsonWithDeepSeek(baseUrl: string, apiKey: string, raw: string, model = defaultModel): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  return requestDeepSeekContent(baseUrl, apiKey, [
    {
      role: 'system',
      content: [
        '你是 JSON 修复器。',
        '把用户提供的文本改写成一个合法 JSON object。',
        '禁止输出 Markdown、解释、注释、代码块。',
        '所有 key 和字符串必须使用英文双引号。',
        '禁止尾逗号。',
        '如果文本中已有 JSON-like object，只修复语法，不改写字段含义。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: raw.slice(0, 80_000),
    },
  ], 0, model, 'JSON Repair')
}

async function callDeepSeekWithPublicTrace(
  stage: PipelineEvent['stage'],
  label: string,
  messages: ChatMessage[],
  options: { temperature: number; apiKey?: string; model?: string },
  emit: (event: PipelineEvent) => void,
  traceMessages: string[],
): Promise<LayerResult> {
  let index = 0
  const timer = setInterval(() => {
    const message = traceMessages[Math.min(index, traceMessages.length - 1)]
    index += 1
    emit({ type: 'stage_tick', stage, label, message })
  }, 2500)
  try {
    const result = await callDeepSeek(messages, { ...options, debugLabel: label })
    emit({
      type: 'stage_tick',
      stage,
      label,
      message: `耗时 ${(result.metrics.durationMs / 1000).toFixed(2)}s · 输出 ${result.metrics.outputTokens || result.metrics.estimatedOutputTokens} tokens`,
    })
    return result
  } finally {
    clearInterval(timer)
  }
}

function buildHardRules(): string {
  return readPrompt('system-hard-rules/hard-rules.md')
}

function buildRuntimeBlocks(input: GenerateRequest): {
  worldState: string
  recentTurns: string
  storybook: string
  storybookRegistry: string
} {
  const characterState = renderCharacters(input.characters)
  const storybook = renderStorybook(input.storybookEntries)
  return {
    worldState: [
      characterState ? `【人物状态】\n${characterState}` : '',
      input.statusPanel ? `【当前人物状态】\n${input.statusPanel}` : '',
    ].filter(Boolean).join('\n\n'),
    recentTurns: renderConversation(input.recentTurns),
    storybook,
    storybookRegistry: renderStorybookRegistry(input.storybookEntries),
  }
}

function normalizePlayerOptions(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(option => option && typeof option === 'object')
    .slice(0, 3)
    .map((option, index) => ({
      ...(option as Record<string, unknown>),
      id: ['A', 'B', 'C'][index],
    }))
}

function normalizeTurnIndex(value: unknown, recentTurns?: ConversationItem[]): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  const assistantTurns = Array.isArray(recentTurns)
    ? recentTurns.filter(turn => turn.role === 'assistant').length
    : 0
  return assistantTurns + 1
}

function formatLongRangePlanning(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback
  if (!value || typeof value !== 'object') return fallback
  const record = value as Record<string, unknown>
  const blocks = Array.isArray(record.blocks) ? record.blocks : []
  const rendered = blocks
    .map((blockValue, index) => {
      if (!blockValue || typeof blockValue !== 'object') return ''
      const block = blockValue as Record<string, unknown>
      const range = String(block.range || `规划区间 ${index + 1}`).trim()
      const events = Array.isArray(block.events) ? block.events : []
      const lines = events
        .map((event, eventIndex) => `${eventIndex + 1}. ${String(event || '').trim()}`)
        .filter(line => !/^\d+\.\s*$/.test(line))
      if (!range || lines.length === 0) return ''
      return `- ${range}：\n${lines.join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
  return rendered || fallback
}

function buildInteractionMetrics(input: {
  model: string
  startedAt: number
  stages: LayerResult[]
  finalText: string
}): Record<string, unknown> {
  const stages = input.stages.map(result => result.metrics)
  const totalMs = Date.now() - input.startedAt
  const firstResponseMs = stages[0]?.durationMs || totalMs
  const outputTokens = stages.reduce((sum, item) => sum + (item.outputTokens || 0), 0)
  const estimatedOutputTokens = stages.reduce((sum, item) => sum + (item.estimatedOutputTokens || 0), 0)
  const inputTokens = stages.reduce((sum, item) => sum + (item.inputTokens || 0), 0)
  const totalTokens = stages.reduce((sum, item) => sum + (item.totalTokens || 0), 0)
  const visibleOutputTokens = estimateTokens(input.finalText)
  const tpsBase = outputTokens || estimatedOutputTokens || visibleOutputTokens
  return {
    model: input.model,
    firstResponseMs,
    totalMs,
    tps: totalMs > 0 ? tpsBase / (totalMs / 1000) : 0,
    inputTokens,
    outputTokens: outputTokens || estimatedOutputTokens || visibleOutputTokens,
    totalTokens,
    visibleOutputTokens,
    stages: stages.map(item => ({
      stage: item.label.toLowerCase().replace(/\s+/g, '-'),
      label: item.label,
      model: item.model,
      durationMs: item.durationMs,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens || item.estimatedOutputTokens,
      totalTokens: item.totalTokens,
    })),
  }
}

async function generate(
  input: GenerateRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const context = buildRuntimeBlocks(input)
  const hardRules = buildHardRules()
  const globalContext = input.globalContext || ''
  const longRangeOutline = String(input.longRangeOutline || '').trim()
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const playerInput = input.playerInput.trim()
  const modules = input.userModules || []
  const enableEditor = input.enableEditor === true
  const model = normalizeModel(input.model)
  const startedAt = Date.now()

  const directorUser = wrapWithMustRead([
    block('固定 Director prompt', readPrompt('director/prompt.md')),
    block('硬规则', hardRules),
    block('当前轮次', `第 ${turnIndex} 轮剧情输出`),
    block('当前世界状态', context.worldState),
    block('长期剧情总结', globalContext),
    block('当前远期剧情规划', longRangeOutline, '（无。若这是第 1 轮或规划为空，必须生成两个 20 轮规划区间。）'),
    block('最近正文', context.recentTurns),
    block('当前玩家输入', playerInput),
    block('已加载动态注入模块', context.storybook),
    block('用户注入模块', renderModules(modules)),
    block('可请求动态注入模块 registry', context.storybookRegistry, '当前没有故事书条目。'),
  ].join('\n'))

  emit({ type: 'stage_start', stage: 'director', label: 'Director', message: '导演层：规划本轮结构、节奏、伏笔和玩家窗口。' })
  const director = await callDeepSeekWithPublicTrace('director', 'Director', [
    { role: 'user', content: directorUser },
  ], { temperature, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在判断玩家输入类型、承接边界和本轮互动入口。',
    '公开日志：正在安排剧情模块、推进速度和玩家下轮窗口。',
    '公开日志：正在检查人物知识边界、伏笔和不可提前解决的问题。',
    '公开日志：导演层仍在等待模型返回结构化计划。',
  ])
  emit({ type: 'stage_result', stage: 'director', label: 'Director', message: '导演层完成：已得到结构化计划。', json: director.json })

  const narratorUser = wrapWithMustRead([
    block('固定 Narrator prompt', readPrompt('narrator/prompt.md')),
    block('硬规则', hardRules),
    block('导演计划', JSON.stringify(director.json, null, 2)),
    block('当前世界状态', context.worldState),
    block('长期剧情总结', globalContext),
    block('远期剧情规划', formatLongRangePlanning(director.json.longRangePlanning, longRangeOutline), '（无）'),
    block('最近正文', context.recentTurns),
    block('当前玩家输入', playerInput),
    block('已加载动态注入模块', context.storybook),
    block('用户注入模块', renderModules(modules)),
  ].join('\n'))

  emit({ type: 'stage_start', stage: 'narrator', label: 'Narrator', message: '叙事层：按导演计划写正文草稿。' })
  const narrator = await callDeepSeekWithPublicTrace('narrator', 'Narrator', [
    { role: 'user', content: narratorUser },
  ], { temperature, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在把导演计划转成可读正文，不更新人物状态。',
    '公开日志：正在平衡对话、动作、环境和心理描写。',
    '公开日志：正在检查是否替玩家做了长期选择。',
    '公开日志：叙事层仍在等待模型返回正文草稿。',
  ])
  emit({ type: 'stage_result', stage: 'narrator', label: 'Narrator', message: '叙事层完成：已得到正文草稿。', json: narrator.json })

  const draftText = String(narrator.json.draftText || narrator.raw)
  let editor: LayerResult | null = null
  let finalText = draftText
  if (enableEditor) {
    const editorUser = wrapWithMustRead([
      block('固定 Editor prompt', readPrompt('editor/prompt.md')),
      block('硬规则', hardRules),
      block('当前世界状态', context.worldState),
      block('长期剧情总结', globalContext),
      block('远期剧情规划', formatLongRangePlanning(director.json.longRangePlanning, longRangeOutline), '（无）'),
      block('最近正文', context.recentTurns),
      block('已加载动态注入模块', context.storybook),
      block('导演计划', JSON.stringify(director.json, null, 2)),
      block('正文草稿', draftText),
      block('当前玩家输入', playerInput),
      block('用户注入模块', renderModules(modules)),
    ].join('\n'))

    emit({ type: 'stage_start', stage: 'editor', label: 'Editor', message: '编辑层：检查草稿并修订最终正文。' })
    editor = await callDeepSeekWithPublicTrace('editor', 'Editor', [
      { role: 'user', content: editorUser },
    ], { temperature, apiKey: input.apiKey, model }, emit, [
      '公开日志：正在检查逻辑、视角、人设和节奏。',
      '公开日志：正在压制套话、重复结尾和提示词痕迹。',
      '公开日志：正在小幅修订，不新增重大剧情。',
      '公开日志：编辑层仍在等待模型返回修订正文。',
    ])
    finalText = String(editor.json.finalText || draftText)
    emit({ type: 'stage_result', stage: 'editor', label: 'Editor', message: '编辑层完成：已得到最终正文。', json: editor.json })
  } else {
    emit({ type: 'stage_skip', stage: 'editor', label: 'Editor', message: '精修关闭：跳过编辑层。', json: null })
  }
  const postprocessUser = wrapWithMustRead([
    block('固定 Postprocess prompt', readPrompt('postprocess/prompt.md')),
    block('玩家输入', playerInput),
    block('最终正文', finalText),
    block('人物状态', renderCharacters(input.characters)),
    block('人物状态 Schema', input.statusPanelSchema),
    block('当前人物状态', input.statusPanel),
  ].join('\n'))

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '后处理层：生成总结、选项，并更新人物状态。' })
  const postprocess = await callDeepSeekWithPublicTrace('postprocess', 'Postprocess', [
    { role: 'user', content: postprocessUser },
  ], { temperature: 0.5, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在从最终正文提取事实总结和伏笔变化。',
    '公开日志：正在按人物状态 Schema 更新人物状态。',
    '公开日志：正在生成 3 个玩家候选项。',
    '公开日志：后处理层仍在等待模型返回结构化状态。',
  ])
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理完成：人物状态和玩家选项已生成。', json: postprocess.json })
  const playerOptions = normalizePlayerOptions(postprocess.json.playerOptions)
  const nextLongRangeOutline = formatLongRangePlanning(director.json.longRangePlanning, longRangeOutline)
  const nextStatusPanel = formatStatusPanelPayload(postprocess.json.statusPanel || input.statusPanel || '')
  const metrics = buildInteractionMetrics({
    model,
    startedAt,
    stages: [director, narrator, editor, postprocess].filter(Boolean) as LayerResult[],
    finalText,
  })

  return {
    finalText,
    pipelineMode: enableEditor ? 'refine' : 'quick',
    director: director.json,
    narrator: narrator.json,
    editor: editor?.json ?? null,
    postprocess: postprocess.json,
    playerOptions,
    turnSummary: postprocess.json.turnSummary || '',
    globalContextPatch: postprocess.json.globalContextPatch || '',
    foreshadowRecords: postprocess.json.foreshadowRecords || [],
    outlinePatch: postprocess.json.outlinePatch || '',
    longRangeOutline: nextLongRangeOutline,
    logicGuidance: postprocess.json.logicGuidance || '',
    characterUpdates: postprocess.json.characterUpdates || [],
    statusPanel: nextStatusPanel,
    metrics,
    model,
  }
}

function walkUserConfigFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkUserConfigFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

function loadUserConfigDefault(): { enabledModules: Set<string> } {
  const configPath = path.join(userConfigDir, 'default-config.json')
  if (!fs.existsSync(configPath)) return { enabledModules: new Set() }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return {
      enabledModules: new Set(Array.isArray(raw.enabledModules) ? raw.enabledModules : []),
    }
  } catch {
    return { enabledModules: new Set() }
  }
}

function loadUserConfigModules(): UserModule[] {
  if (!fs.existsSync(userConfigDir)) return []
  const defaults = loadUserConfigDefault()
  const filePaths = walkUserConfigFiles(userConfigDir).sort()
  return filePaths
    .map(filePath => readUserConfigModule(filePath, defaults))
    .filter(module => !internalizedModuleIds.has(module.id))
    .map(module => ({
      id: module.id,
      name: module.name,
      description: module.description || '',
      layer: 'all' as const,
      group: module.group || '',
      exclusiveGroup: module.exclusiveGroup || '',
      prompt: module.prompt,
      file: module.file,
      enabled: module.enabled,
      custom: false,
    }))
}

function readUserConfigModule(filePath: string, defaults?: { enabledModules: Set<string> }): UserModule {
  const relativePath = path.relative(userConfigDir, filePath)
  const { attrs, body } = parseMarkdownConfig(fs.readFileSync(filePath, 'utf-8'))
  const id = attrs.id || path.basename(filePath, '.md')
  const fallbackEnabled = attrs.enabled === undefined ? false : attrs.enabled === 'true'
  const enabled = defaults ? (defaults.enabledModules.has(id) ? true : (defaults.enabledModules.size > 0 ? false : fallbackEnabled)) : fallbackEnabled
  return {
    id,
    name: attrs.name || id,
    description: attrs.description || '',
    layer: 'all',
    group: attrs.group || '',
    exclusiveGroup: attrs.exclusiveGroup || '',
    prompt: body,
    file: `prompts/user-config/${relativePath}`,
    enabled,
    custom: false,
  }
}

function serveStatic(reqPath: string, res: http.ServerResponse): void {
  const targetPath = reqPath === '/' ? '/index.html' : reqPath
  const filePath = path.normalize(path.join(webDir, targetPath))
  if (!isInsidePath(webDir, filePath)) {
    sendText(res, 403, 'forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'not found')
    return
  }
  const ext = path.extname(filePath)
  const contentType = ext === '.html' ? 'text/html; charset=utf-8'
    : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream'
  res.writeHead(200, { 'content-type': contentType })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'GET' && url.pathname === '/api/config') {
      sendJson(res, 200, {
        model: defaultModel,
        models: [
          { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
          { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
        ],
        baseUrl: env('DEEPSEEK_BASE_URL') || defaultBaseUrl,
        hasApiKey: Boolean(env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY')),
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/modules') {
      sendJson(res, 200, { modules: loadUserConfigModules() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/save-state') {
      sendJson(res, 200, { state: readSaveState() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/save-state') {
      const body = await readBody(req)
      const input = JSON.parse(body) as unknown
      writeSaveState(input)
      sendJson(res, 200, { ok: true, file: path.relative(rootDir, saveFile) })
      return
    }

    if (req.method === 'DELETE' && url.pathname === '/api/save-state') {
      deleteSaveState()
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/story-assets') {
      sendJson(res, 200, { assets: listStoryAssets() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/story-assets') {
      const body = await readBody(req)
      const input = JSON.parse(body) as PersistedStoryAsset
      const files = persistStoryAsset(input)
      sendJson(res, 200, { ok: true, files, initializationRequired: true })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/initialize-story') {
      const body = await readBody(req)
      const input = JSON.parse(body) as InitializeStoryRequest
      sendJson(res, 200, await initializeStory(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/initialize-story-stream') {
      const body = await readBody(req)
      const input = JSON.parse(body) as InitializeStoryRequest
      res.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const writeEvent = (event: Record<string, unknown>): void => {
        res.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
      }
      const writePipelineEvent = (event: PipelineEvent): void => {
        writeEvent(event as unknown as Record<string, unknown>)
      }
      try {
        const result = await initializeStory(input, writePipelineEvent)
        writeEvent({ type: 'final', payload: result })
      } catch (error) {
        writeEvent({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        res.end()
      }
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readBody(req)
      const input = JSON.parse(body) as GenerateRequest
      if (!input.playerInput?.trim()) {
        sendJson(res, 400, { error: 'playerInput is required' })
        return
      }
      sendJson(res, 200, await generate(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/generate-stream') {
      const body = await readBody(req)
      const input = JSON.parse(body) as GenerateRequest
      if (!input.playerInput?.trim()) {
        sendJson(res, 400, { error: 'playerInput is required' })
        return
      }
      res.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const writeEvent = (event: Record<string, unknown>): void => {
        res.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
      }
      const writePipelineEvent = (event: PipelineEvent): void => {
        writeEvent(event as unknown as Record<string, unknown>)
      }
      try {
        const result = await generate(input, writePipelineEvent)
        writeEvent({ type: 'final', payload: result })
      } catch (error) {
        writeEvent({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        res.end()
      }
      return
    }

    if (req.method === 'GET') {
      serveStatic(url.pathname, res)
      return
    }

    sendText(res, 405, 'method not allowed')
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

ensureDataDirs()

server.listen(port, () => {
  console.log(`text-game-agent web: http://127.0.0.1:${port}`)
})
