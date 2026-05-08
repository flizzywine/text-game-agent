import fs from 'fs'
import http from 'http'
import path from 'path'
import crypto from 'crypto'
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
  layer?: 'director' | 'narrator'
  group?: string
  exclusiveGroup?: string
  prompt?: string
  file?: string
  enabled: boolean
  custom?: boolean
}

type UserModuleStage = 'director' | 'narrator'

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

interface PhysicalSceneStateFields {
  currentScene: string
  nextScene: string
  transitionRule: string
  currentSceneForbidden: string
}

type PhysicalSceneStateInput = string | Partial<PhysicalSceneStateFields> | null | undefined

interface GenerateRequest {
  playerInput: string
  globalContext?: string
  qualityFeedback?: string
  longRangeOutline?: string
  directorGuidance?: string
  turnIndex?: number
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  userModules?: UserModule[]
  storybookEntries?: StorybookEntry[]
  foreshadowRecords?: Array<Record<string, unknown>>
  statusPanelSchema?: string
  statusPanel?: string
  physicalSceneState?: PhysicalSceneStateInput
  sceneState?: PhysicalSceneStateInput
  bypassGenerationCache?: boolean
  model?: string
  apiKey?: string
  temperature?: number
}

interface DirectorPrewarmRequest {
  requests?: GenerateRequest[]
}

interface PostprocessRequest {
  playerInput: string
  finalText: string
  director?: Record<string, unknown>
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  userModules?: UserModule[]
  storybookEntries?: StorybookEntry[]
  foreshadowRecords?: Array<Record<string, unknown>>
  statusPanelSchema?: string
  statusPanel?: string
  physicalSceneState?: PhysicalSceneStateInput
  sceneState?: PhysicalSceneStateInput
  longRangeOutline?: string
  directorGuidance?: string
  globalContext?: string
  qualityFeedback?: string
  turnIndex?: number
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
  model?: string
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
  physicalSceneState?: PhysicalSceneStateInput
  sceneState?: PhysicalSceneStateInput
  initialPlayerOptions: PlayerOption[]
  normalizedEntries: StorybookEntry[]
  globalContextSeed: string
  currentSituation?: string
  outline?: string
  longRangeOutline?: string
  plotLines?: unknown[]
  foreshadowRecords?: Array<Record<string, unknown>>
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
  ttftMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedOutputTokens: number
  cacheHit?: boolean
}

interface DirectorCacheEntry {
  key: string
  createdAt: string
  model: string
  temperature: number
  playerInput: string
  directorPlan: Record<string, unknown>
}

interface NarratorCacheEntry {
  key: string
  createdAt: string
  model: string
  temperature: number
  playerInput: string
  narratorJson: Record<string, unknown>
  raw: string
}

interface PrewarmJob<T> {
  key: string
  stage: 'director' | 'narrator'
  playerInput: string
  controller: AbortController
  promise: Promise<T | null>
  startedAt: number
}

interface PrewarmStageResult {
  key: string
  status: string
  completed?: boolean
}

interface NextTurnPrewarmResult {
  director: PrewarmStageResult
  narrator: PrewarmStageResult
}

interface PipelineEvent {
  type: 'stage_start' | 'stage_tick' | 'stage_result' | 'stage_skip' | 'visible_text'
  stage: 'initializer' | 'director' | 'narrator' | 'postprocess'
  label: string
  message?: string
  json?: Record<string, unknown> | null
  payload?: Record<string, unknown>
}

type ModelProvider = 'deepseek' | 'fireworks'

const rootDir = process.cwd()
const webDir = path.join(rootDir, 'web')
const promptDir = path.join(rootDir, 'prompts')
const userConfigDir = path.join(promptDir, 'user-config-templates')
const storyDir = path.join(rootDir, 'story')
const saveDir = path.join(rootDir, 'save')
const debugDir = path.join(rootDir, 'debug')
const llmDebugDir = path.join(debugDir, 'llm-raw')
const saveFile = path.join(saveDir, 'current-state.json')
const directorCacheFile = path.join(saveDir, 'director-cache.json')
const narratorCacheFile = path.join(saveDir, 'narrator-cache.json')
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const fireworksDeepSeekV4ProModel = 'accounts/fireworks/models/deepseek-v4-pro'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const defaultModel = fireworksDeepSeekV4ProPriorityModel
const modelIds = new Set([
  officialDeepSeekV4ProModel,
  fireworksDeepSeekV4ProPriorityModel,
])
const defaultDeepSeekBaseUrl = 'https://api.deepseek.com'
const defaultFireworksBaseUrl = 'https://api.fireworks.ai/inference/v1'
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300_000)
const defaultMaxTokens = 4096
const narratorMaxTokens = 8192
const prewarmWaitMs = Number(process.env.PREWARM_WAIT_MS || 12_000)
const port = Number(process.env.PORT || 4173)
const localEnv = readDotEnv(path.join(rootDir, '.env.local'))
const internalizedModuleIds = new Set<string>()
const metadataKeys = new Set(['id', 'name', 'description', 'layer', 'group', 'exclusiveGroup', 'enabled'])
const directorPrewarmJobs = new Map<string, PrewarmJob<DirectorCacheEntry>>()
const narratorPrewarmJobs = new Map<string, PrewarmJob<NarratorCacheEntry>>()

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

function providerForModel(model: string): ModelProvider {
  if (isFireworksModel(model)) return 'fireworks'
  return 'deepseek'
}

function isFireworksModel(model: string): boolean {
  return model === fireworksDeepSeekV4ProModel
    || model === fireworksDeepSeekV4ProPriorityModel
}

function fireworksRequestModel(model: string): string {
  return model === fireworksDeepSeekV4ProPriorityModel ? fireworksDeepSeekV4ProModel : model
}

function fireworksServiceTier(model: string): 'priority' | undefined {
  return model === fireworksDeepSeekV4ProPriorityModel ? 'priority' : undefined
}

function providerLabel(provider: ModelProvider): string {
  if (provider === 'fireworks') return 'Fireworks'
  return 'DeepSeek'
}

function providerBaseUrl(provider: ModelProvider): string {
  if (provider === 'fireworks') return (env('FIREWORKS_BASE_URL') || defaultFireworksBaseUrl).replace(/\/+$/, '')
  return (env('DEEPSEEK_BASE_URL') || defaultDeepSeekBaseUrl).replace(/\/+$/, '')
}

function providerApiKey(provider: ModelProvider, explicitKey?: string): string {
  const key = explicitKey?.trim()
    || (provider === 'fireworks'
      ? env('FIREWORKS_API_KEY')
      : env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY'))
  if (key) return key
  throw new Error(provider === 'fireworks' ? 'missing FIREWORKS_API_KEY' : 'missing DEEPSEEK_API_KEY')
}

function providerHasApiKey(provider: ModelProvider): boolean {
  return provider === 'fireworks'
    ? Boolean(env('FIREWORKS_API_KEY'))
    : Boolean(env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY'))
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text || '').length / 1.8))
}

function linkAbortSignal(controller: AbortController, signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {}
  const abort = (): void => {
    onAbort()
    controller.abort()
  }
  if (signal.aborted) {
    abort()
    return () => {}
  }
  signal.addEventListener('abort', abort, { once: true })
  return () => signal.removeEventListener('abort', abort)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /请求已取消|aborted|abort/i.test(error.message))
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

function readDirectorCache(): Record<string, DirectorCacheEntry> {
  ensureDataDirs()
  if (!fs.existsSync(directorCacheFile)) return {}
  try {
    const value = JSON.parse(fs.readFileSync(directorCacheFile, 'utf-8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, DirectorCacheEntry> : {}
  } catch {
    return {}
  }
}

function getDirectorCacheEntry(key: string): DirectorCacheEntry | null {
  const entry = readDirectorCache()[key]
  return entry?.directorPlan && typeof entry.directorPlan === 'object' ? entry : null
}

function writeDirectorCacheEntry(entry: DirectorCacheEntry): void {
  const cache = readDirectorCache()
  cache[entry.key] = entry
  const entries = Object.values(cache)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 80)
  writeJsonFile(directorCacheFile, Object.fromEntries(entries.map(item => [item.key, item])))
}

function readNarratorCache(): Record<string, NarratorCacheEntry> {
  ensureDataDirs()
  if (!fs.existsSync(narratorCacheFile)) return {}
  try {
    const value = JSON.parse(fs.readFileSync(narratorCacheFile, 'utf-8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, NarratorCacheEntry> : {}
  } catch {
    return {}
  }
}

function getNarratorCacheEntry(key: string): NarratorCacheEntry | null {
  const entry = readNarratorCache()[key]
  return entry?.narratorJson && typeof entry.narratorJson === 'object' ? entry : null
}

function writeNarratorCacheEntry(entry: NarratorCacheEntry): void {
  const cache = readNarratorCache()
  cache[entry.key] = entry
  const entries = Object.values(cache)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 80)
  writeJsonFile(narratorCacheFile, Object.fromEntries(entries.map(item => [item.key, item])))
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

function renderModulesForStage(modules: UserModule[] | undefined, stage: UserModuleStage): string {
  return renderModules((modules || []).filter(module => moduleTargetsStage(module, stage)))
}

function moduleTargetsStage(module: UserModule, stage: UserModuleStage): boolean {
  if (!module.enabled) return false
  return module.layer === stage
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
  const physicalSceneState = normalizePhysicalSceneState({
    currentScene: openingText ? `开场环境：${openingText.slice(0, 80)}` : '开场环境：等待玩家进入第一轮互动。',
    nextScene: '第一轮玩家输入后的当前互动场景。',
    transitionRule: '玩家输入明确行动、对话或观察目标后进入下一步；若玩家保持观望，场景只做轻微自然推进。',
    currentSceneForbidden: '无缘无故跳到远期剧情；未交代过渡就改变地点、时间或主要角色位置。',
  })
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
    physicalSceneState,
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
      physicalSceneState.currentScene ? `物理场景状态：${renderPhysicalSceneState(physicalSceneState)}` : '',
      openingText ? `开场白：${openingText.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n'),
  }
}

function ensureSpatialStatusPanelSchema(value: string, subject = '人物', characters: CharacterState[] = []): string {
  const text = String(value || '').trim()
  if (!text) return ''
  void subject
  void characters
  return stripSpatialStatusSection(text)
}

function ensureSpatialStatusPanel(value: string, subject = '人物', characters: CharacterState[] = []): string {
  const text = String(value || '').trim()
  if (!text) return ''
  void subject
  void characters
  return stripSpatialStatusSection(text)
}

function stripSpatialStatusSection(value: string): string {
  return String(value || '')
    .split(/\n(?=##\s+)/)
    .filter(section => !/^##\s*多人物身体\/空间状态/.test(section.trim()))
    .join('\n')
    .trim()
}

function formatStatusPanelPayload(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  return formatStatusPanelObject(value).trim()
}

function emptyPhysicalSceneState(): PhysicalSceneStateFields {
  return {
    currentScene: '',
    nextScene: '',
    transitionRule: '',
    currentSceneForbidden: '',
  }
}

function normalizePhysicalSceneState(value: unknown, fallback?: unknown): PhysicalSceneStateFields {
  const base = fallback ? normalizePhysicalSceneState(fallback) : emptyPhysicalSceneState()
  if (typeof value === 'string') {
    const currentScene = value.trim()
    return currentScene ? { ...base, currentScene } : base
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base
  const record = value as Record<string, unknown>
  return {
    currentScene: compactText(record.currentScene || base.currentScene, 180),
    nextScene: compactText(record.nextScene || base.nextScene, 140),
    transitionRule: compactText(record.transitionRule || base.transitionRule, 220),
    currentSceneForbidden: compactText(record.currentSceneForbidden || base.currentSceneForbidden, 180),
  }
}

function renderPhysicalSceneState(value: unknown, fallback = '（无）'): string {
  const scene = normalizePhysicalSceneState(value)
  const lines = [
    scene.currentScene ? `currentScene：${scene.currentScene}` : '',
    scene.nextScene ? `nextScene：${scene.nextScene}` : '',
    scene.transitionRule ? `transitionRule：${scene.transitionRule}` : '',
    scene.currentSceneForbidden ? `currentSceneForbidden：${scene.currentSceneForbidden}` : '',
  ].filter(Boolean)
  return lines.length ? lines.join('\n') : fallback
}

function pickPhysicalSceneStateInput(value: { physicalSceneState?: PhysicalSceneStateInput; sceneState?: PhysicalSceneStateInput }): PhysicalSceneStateInput {
  return value.physicalSceneState ?? value.sceneState
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
    '## 初始物理场景状态',
    renderPhysicalSceneState(config.physicalSceneState),
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
    physicalSceneState: normalizePhysicalSceneState(raw.physicalSceneState ?? raw.sceneState, fallback.physicalSceneState ?? fallback.sceneState),
    initialPlayerOptions: initialPlayerOptions as PlayerOption[],
    normalizedEntries: normalizedEntries as StorybookEntry[],
    globalContextSeed: String(raw.globalContextSeed || fallback.globalContextSeed || ''),
    currentSituation: typeof raw.currentSituation === 'string' ? raw.currentSituation : undefined,
    outline: typeof raw.outline === 'string' ? raw.outline : undefined,
    longRangeOutline: typeof raw.longRangeOutline === 'string' ? raw.longRangeOutline : '',
    plotLines: Array.isArray(raw.plotLines) ? raw.plotLines : undefined,
  }
}

async function initializeStory(
  input: InitializeStoryRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<StoryProgramConfig> {
  const model = normalizeModel(input.model)
  const provider = providerForModel(model)
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
  if (!input.apiKey?.trim() && !providerHasApiKey(provider)) {
    throw new Error(`故事尚未初始化：缺少 ${providerLabel(provider)} API Key，不能生成 program-config。`)
  }

  const user = [
    block('固定 Initializer prompt', readPrompt('initializer/prompt.md')),
    block('故事资料', renderInitializationMaterial(input)),
  ].join('\n')

  try {
    emit({ type: 'stage_start', stage: 'initializer', label: 'Initializer', message: '初始化层：整理故事书，生成世界观、人物介绍、开场交互和人物状态 schema。' })
    const result = await callModelWithPublicTrace('initializer', 'Initializer', [{ role: 'user', content: user }], { temperature: 0.4, apiKey: input.apiKey, model }, emit, [
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

async function callModel(messages: ChatMessage[], options: { temperature: number; apiKey?: string; debugLabel?: string; model?: string; maxTokens?: number; signal?: AbortSignal }): Promise<LayerResult> {
  const model = normalizeModel(options.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, options.apiKey)
  const response = await requestModelContent(apiKey, messages, options.temperature, model, options.debugLabel || providerLabel(provider), options.maxTokens, options.signal)
  const raw = response.raw

  try {
    return { raw, json: parseJsonObject(raw), metrics: response.metrics }
  } catch (parseError) {
    let repairedRaw = ''
    try {
      const repaired = await repairJsonWithModel(apiKey, raw, model)
      repairedRaw = repaired.raw
      return {
        raw: repairedRaw,
        json: parseJsonObject(repairedRaw),
        metrics: {
          ...response.metrics,
          durationMs: response.metrics.durationMs + repaired.metrics.durationMs,
          ttftMs: response.metrics.ttftMs,
          inputTokens: response.metrics.inputTokens + repaired.metrics.inputTokens,
          outputTokens: response.metrics.outputTokens + repaired.metrics.outputTokens,
          totalTokens: response.metrics.totalTokens + repaired.metrics.totalTokens,
          estimatedOutputTokens: response.metrics.estimatedOutputTokens + repaired.metrics.estimatedOutputTokens,
        },
      }
    } catch (repairError) {
      const file = writeLlmDebugFile({
        label: options.debugLabel || `${provider}-parse-failed`,
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

async function requestModelContent(
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens = defaultMaxTokens,
  signal?: AbortSignal,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const provider = providerForModel(model)
  if (provider === 'fireworks') {
    return requestFireworksContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
  }
  return requestDeepSeekContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
}

async function requestDeepSeekContent(
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const controller = new AbortController()
  let externallyAborted = false
  const unlinkAbortSignal = linkAbortSignal(controller, signal, () => {
    externallyAborted = true
  })
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
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`DeepSeek 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    throw error
  } finally {
    unlinkAbortSignal()
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
    error?: { message?: string; code?: number | string; metadata?: unknown }
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
  }
  if (payload.error) {
    const detail =
      typeof payload.error.message === 'string' && payload.error.message.trim()
        ? payload.error.message.trim()
        : JSON.stringify(payload.error)
    const file = writeLlmDebugFile({
      label: `${label}-deepseek-error`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`DeepSeek 上游错误：${detail}；原始返回已保存：${file}`)
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
      ttftMs: durationMs,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedOutputTokens,
    },
  }
}

async function requestFireworksContent(
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const controller = new AbortController()
  let externallyAborted = false
  const unlinkAbortSignal = linkAbortSignal(controller, signal, () => {
    externallyAborted = true
  })
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
        'x-session-affinity': env('FIREWORKS_SESSION_AFFINITY') || 'text-game-agent',
      },
      body: JSON.stringify({
        model: fireworksRequestModel(model),
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        response_format: { type: 'json_object' },
        ...(fireworksServiceTier(model) ? { service_tier: fireworksServiceTier(model) } : {}),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`Fireworks 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    throw error
  } finally {
    unlinkAbortSignal()
    clearTimeout(timer)
  }

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new Error('Fireworks API Key 无效、无权限，或当前账号不能调用该模型。请检查 Fireworks key 和模型权限。')
    }
    throw new Error(`Fireworks ${response.status}: ${text.slice(0, 500)}`)
  }
  const streamed = await readFireworksStream(response, messages, label, startedAt)
  const durationMs = Date.now() - startedAt
  const raw = streamed.raw.trim()
  if (!raw) {
    const file = writeLlmDebugFile({
      label: `${label}-fireworks-empty`,
      raw: streamed.rawSse,
      messages,
      error: new Error('Fireworks returned an empty response'),
    })
    throw new Error(`Fireworks 返回空内容；原始返回已保存：${file}`)
  }
  const estimatedOutputTokens = estimateTokens(raw)
  const inputTokens = Number(streamed.usage?.prompt_tokens || 0)
  const outputTokens = Number(streamed.usage?.completion_tokens || 0)
  const totalTokens = Number(streamed.usage?.total_tokens || 0)
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      ttftMs: streamed.firstTokenMs || durationMs,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedOutputTokens,
    },
  }
}

async function readFireworksStream(
  response: Response,
  messages: ChatMessage[],
  label: string,
  startedAt: number,
): Promise<{
  raw: string
  rawSse: string
  firstTokenMs?: number
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}> {
  if (!response.body) throw new Error('Fireworks 流式响应没有 body。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let rawSse = ''
  let raw = ''
  let firstTokenMs = 0
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    rawSse += chunk
    buffer += chunk
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        let payload: {
          error?: { message?: string; code?: number | string; metadata?: unknown }
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        try {
          payload = JSON.parse(data)
        } catch {
          continue
        }
        if (payload.error) {
          const detail =
            typeof payload.error.message === 'string' && payload.error.message.trim()
              ? payload.error.message.trim()
              : JSON.stringify(payload.error)
          const file = writeLlmDebugFile({
            label: `${label}-fireworks-error`,
            raw: rawSse,
            messages,
            error: new Error(detail),
          })
          throw new Error(`Fireworks 上游错误：${detail}；原始返回已保存：${file}`)
        }
        if (payload.usage) usage = payload.usage
        for (const choice of payload.choices || []) {
          const content = choice.delta?.content || choice.message?.content || ''
          if (content && !firstTokenMs) firstTokenMs = Date.now() - startedAt
          raw += content
        }
      }
    }
  }

  return { raw, rawSse, firstTokenMs: firstTokenMs || undefined, usage }
}

async function repairJsonWithModel(apiKey: string, raw: string, model = defaultModel): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  return requestModelContent(apiKey, [
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
  ], 0, normalizeModel(model), 'JSON Repair')
}

async function callModelWithPublicTrace(
  stage: PipelineEvent['stage'],
  label: string,
  messages: ChatMessage[],
  options: { temperature: number; apiKey?: string; model?: string; maxTokens?: number },
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
    const result = await callModel(messages, { ...options, debugLabel: label })
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
  spatialState: string
  physicalSceneState: string
  recentTurns: string
  storybook: string
  storybookRegistry: string
} {
  const characterState = renderCharacters(input.characters)
  const storybook = renderStorybook(input.storybookEntries)
  return {
    worldState: [
      characterState ? `【人物状态】\n${characterState}` : '',
    ].filter(Boolean).join('\n\n'),
    spatialState: input.statusPanel
      ? [
        '以下是 Narrator 直接使用的身体/空间状态。写正文前必须据此检查姿势、朝向、接触关系、手部占用、可触达区域；动作不可达时先写姿势转换。',
        input.statusPanel,
      ].join('\n')
      : '无明确空间状态；必须从最近正文保持姿势、朝向、接触关系和手部占用的连续性。',
    physicalSceneState: renderPhysicalSceneState(pickPhysicalSceneStateInput(input)),
    recentTurns: renderConversation(input.recentTurns),
    storybook,
    storybookRegistry: renderStorybookRegistry(input.storybookEntries),
  }
}

function normalizePlayerOptions(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((option, index) => {
      const id = ['A', 'B', 'C'][index]
      if (typeof option === 'string') {
        const text = option.trim()
        return text ? { id, label: text, description: '', inputText: text } : null
      }
      if (!option || typeof option !== 'object') return null
      const record = option as Record<string, unknown>
      const inputText = String(record.inputText || record.label || record.description || '').trim()
      const label = String(record.label || inputText || `选项 ${id}`).trim()
      const description = String(record.description || (record.label ? inputText : '') || '').trim()
      return { ...record, id, label, description, inputText }
    })
    .filter(Boolean)
}

function normalizeTurnIndex(value: unknown, recentTurns?: ConversationItem[]): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric)
  const assistantTurns = Array.isArray(recentTurns)
    ? recentTurns.filter(turn => turn.role === 'assistant').length
    : 0
  return assistantTurns + 1
}

function renderLongArc(value: unknown): string {
  const record = compactRecord(value)
  const goal = compactText(record.goal, 120)
  const pressure = compactText(record.pressure, 120)
  const direction = compactStringArray(record.direction || record.directions, 3, 80)
  const prototypes = compactStringArray(record.prototypes || record.usablePrototypes, 3, 50)
  return [
    goal ? `目标：${goal}` : '',
    pressure ? `压力：${pressure}` : '',
    direction.length ? `方向：\n${direction.map(item => `- ${item}`).join('\n')}` : '',
    prototypes.length ? `可用原型：${prototypes.join(' / ')}` : '',
  ].filter(Boolean).join('\n')
}

function compactText(value: unknown, maxLength = 120): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function compactStringArray(value: unknown, maxItems = 3, maxLength = 80): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : []
  return items
    .map(item => compactText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function compactRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function pruneEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneEmpty).filter(item => {
    if (item == null) return false
    if (Array.isArray(item)) return item.length > 0
    if (typeof item === 'object') return Object.keys(item as Record<string, unknown>).length > 0
    return String(item).trim() !== ''
  })
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const compacted = pruneEmpty(item)
    if (compacted == null) continue
    if (Array.isArray(compacted) && compacted.length === 0) continue
    if (typeof compacted === 'object' && !Array.isArray(compacted) && Object.keys(compacted as Record<string, unknown>).length === 0) continue
    if (typeof compacted === 'string' && !compacted.trim()) continue
    output[key] = compacted
  }
  return output
}

function compactSceneBeat(value: unknown): string {
  if (typeof value === 'string') return compactText(value, 100)
  const record = compactRecord(value)
  return [
    compactText(record.summary, 70),
    compactText(record.goal, 50),
  ].filter(Boolean).join('；')
}

function compactDescriptionFocus(value: unknown): string {
  if (typeof value === 'string') return compactText(value, 80)
  const record = compactRecord(value)
  const chain = compactStringArray(record.chain, 2, 20).join('->')
  const notes = compactText(record.notes || record.summary || record.goal, 50)
  return [chain, notes].filter(Boolean).join('：')
}

function compactDirectorPlan(value: unknown): Record<string, unknown> {
  const source = compactRecord(value)
  const preflight = compactRecord(source.preflight)
  const requirement = compactRecord(source.requirementReinforcement)
  const novel = compactRecord(source.novelGuidance)
  const outline = compactRecord(source.outlineGuidance)
  const intent = compactText(source.intent, 100)
    || [
      compactText(preflight.turnIntent, 70),
      compactStringArray(preflight.playerMustCarry, 2, 45).join('；'),
    ].filter(Boolean).join('；')
  const policy = Array.isArray(source.policy) ? source.policy : [
    requirement.retellPolicy ? `转述:${compactText(requirement.retellPolicy, 24)}` : '',
    requirement.initiativePolicy ? `抢话:${compactText(requirement.initiativePolicy, 24)}` : '',
    requirement.dialoguePlan ? `对话:${compactText(requirement.dialoguePlan, 40)}` : '',
    requirement.paragraphPlan ? `段落:${compactText(requirement.paragraphPlan, 40)}` : '',
    requirement.intentFit ? `顺应:${compactText(requirement.intentFit, 45)}` : '',
  ].filter(Boolean)
  const craft = Array.isArray(source.craft) ? source.craft : [
    [novel.conflictEngine, novel.characterArc].map(item => compactText(item, 35)).filter(Boolean).join('；'),
    compactText(novel.dramaticGradient, 70),
    [
      compactStringArray(novel.sensoryPlan, 2, 12).join('/'),
      compactText(novel.freshDetail, 35),
      compactText(novel.textureDiscipline, 35),
    ].filter(Boolean).join('；'),
  ].filter(Boolean)
  const currentPlot = Array.isArray(source.currentPlot) ? source.currentPlot : [
    ...compactStringArray(outline.follow, 2, 55).map(item => `follow:${item}`),
    ...compactStringArray(outline.avoid, 1, 55).map(item => `avoid:${item}`),
    ...compactStringArray(outline.revise, 1, 55).map(item => `revise:${item}`),
  ]
  const foreshadow = Array.isArray(source.foreshadow) ? source.foreshadow : (Array.isArray(source.foreshadowing) ? source.foreshadowing : [])
    .slice(0, 3)
    .map(item => {
      const record = compactRecord(item)
      const action = compactText(record.action, 24)
      const id = compactText(record.id, 50)
      return [action, id].filter(Boolean).join(':')
    })

  return pruneEmpty({
    intent,
    npc: compactText(source.npc || requirement.mainNpcRead, 90),
    policy: compactStringArray(policy, 4, 55),
    craft: compactStringArray(craft, 3, 70),
    load: compactStringArray(source.load || source.loadModuleIds, 6, 80),
    beats: (Array.isArray(source.beats) ? source.beats : Array.isArray(source.sceneBeats) ? source.sceneBeats : []).slice(0, 3).map(compactSceneBeat).filter(Boolean),
    ending: compactSceneBeat(source.ending || source.endingBeat || source.exitWindow),
    focus: (Array.isArray(source.focus) ? source.focus : Array.isArray(source.descriptionFocus) ? source.descriptionFocus : Array.isArray(source.descriptionPlans) ? source.descriptionPlans : [])
      .slice(0, 4)
      .map(compactDescriptionFocus)
      .filter(Boolean),
    sceneDecision: compactText(source.sceneDecision || source.sceneTransition || source.transitionDecision, 100),
    foreshadow: compactStringArray(foreshadow, 3, 65),
    currentPlot: compactStringArray(currentPlot, 4, 70),
    mustNotResolve: compactStringArray(source.mustNotResolve, 3, 70),
    brief: compactText(source.brief || source.narratorBrief || source.exitWindow, 120),
  }) as Record<string, unknown>
}

function compactPostprocessDirectorBrief(plan: Record<string, unknown>): string {
  const currentPlot = compactStringArray(plan.currentPlot, 2, 70)
  return [
    compactText(plan.intent, 80) ? `intent: ${compactText(plan.intent, 80)}` : '',
    currentPlot.length ? `currentPlot: ${currentPlot.join('；')}` : '',
    compactStringArray(plan.foreshadow, 2, 60).length ? `foreshadow: ${compactStringArray(plan.foreshadow, 2, 60).join('；')}` : '',
    compactStringArray(plan.mustNotResolve, 2, 60).length ? `mustNotResolve: ${compactStringArray(plan.mustNotResolve, 2, 60).join('；')}` : '',
  ].filter(Boolean).join('\n')
}

function normalizeLongRangeStatus(value: unknown, currentLongRangeOutline = ''): string {
  const status = String(value || '').trim().toLowerCase()
  if (!currentLongRangeOutline.trim()) return 'missing'
  if (status === 'completed' || status === 'missing') return status
  return 'keep'
}

function shouldRunLongRangeDirector(value: unknown, currentLongRangeOutline = ''): boolean {
  const status = normalizeLongRangeStatus(value, currentLongRangeOutline)
  return status === 'missing' || status === 'completed'
}

function normalizeLongRangeDirectorOutline(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback
  const record = compactRecord(value)
  const direct = String(record.longRangeOutline || '').trim().slice(0, 1000)
  if (direct) return direct
  const rendered = renderLongArc(record.longArc || record.arc || record)
  return rendered || fallback
}

function buildLongRangeDirectorUser(input: {
  hardRules: string
  worldState: string
  storybook: string
  recentTurns: string
  globalContext: string
  currentLongRangeOutline: string
  longRangeStatus: string
  turnSummary: string
  finalText: string
  directorGuidance?: string
  modules?: UserModule[]
}): string {
  return wrapWithMustRead([
    block('固定高级 Director prompt', readPrompt('long-range-director/prompt.md')),
    block('硬规则', input.hardRules),
    block('当前长期剧情', input.currentLongRangeOutline, '（无）'),
    block('Postprocess 长期剧情判定', input.longRangeStatus),
    block('长期剧情总结', input.globalContext, '（无）'),
    block('本轮事实总结', input.turnSummary, '（无）'),
    block('本轮最终正文', input.finalText),
    block('当前世界状态', input.worldState, '（无）'),
    block('最近正文', input.recentTurns, '（无）'),
    block('已加载动态注入模块', input.storybook, '（无）'),
    block('上帝模式导演要求', input.directorGuidance || '', '（无）'),
    block('导演风格配置', renderModulesForStage(input.modules || [], 'director'), '（无）'),
  ].join('\n'))
}

function extractDirectorForeshadowRecords(plan: Record<string, unknown>): Array<Record<string, unknown>> {
  return compactStringArray(plan.foreshadow, 3, 80)
    .map(parseDirectorForeshadowRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

function parseDirectorForeshadowRecord(value: string): Record<string, unknown> | null {
  const text = String(value || '').trim()
  if (!text) return null
  const match = text.match(/^\s*(plant|delay|payoff|drop|埋下|延迟|回收|废弃|删除)\s*[:：]\s*(.+)$/i)
  const type = normalizeDirectorForeshadowType(match?.[1] || 'plant')
  const body = String(match?.[2] || text).trim()
  return body ? { type, text: body } : null
}

function normalizeDirectorForeshadowType(value: string): string {
  const type = String(value || '').trim().toLowerCase()
  if (type === 'payoff' || type === '回收') return 'payoff'
  if (type === 'drop' || type === '废弃' || type === '删除') return 'drop'
  if (type === 'delay' || type === '延迟') return 'delay'
  return 'plant'
}

function renderForeshadowContext(records: Array<Record<string, unknown>> | undefined, turnIndex = 0): string {
  const items = Array.isArray(records) ? records : []
  const active = items
    .map(item => ({
      type: String(item?.type || '').trim(),
      text: String(item?.text || '').trim(),
      status: String(item?.status || '').trim(),
      createdTurn: Number(item?.createdTurn || 0),
      updatedTurn: Number(item?.updatedTurn || 0),
      delayCount: Number(item?.delayCount || 0),
    }))
    .filter(item => item.text && item.type !== 'payoff' && item.type !== 'drop' && item.status !== 'paid' && item.status !== 'dropped')
    .slice(0, 3)
  return active.length
    ? active.map(item => {
      const age = turnIndex && item.createdTurn ? Math.max(0, turnIndex - item.createdTurn) : 0
      const due = age >= 4 || item.delayCount >= 2
      const meta = [
        age ? `已挂起${age}轮` : '',
        item.delayCount ? `延迟${item.delayCount}次` : '',
        due ? '到期：优先payoff/drop' : '',
      ].filter(Boolean).join('；')
      return `- ${item.type || '伏笔'}：${item.text}${meta ? `（${meta}）` : ''}`
    }).join('\n')
    : '（无未回收伏笔）'
}

function buildInteractionMetrics(input: {
  model: string
  startedAt: number
  stages: LayerResult[]
  finalText: string
}): Record<string, unknown> {
  const stages = input.stages.map(result => result.metrics)
  const totalMs = Date.now() - input.startedAt
  const firstResponseMs = stages[0]?.ttftMs || stages[0]?.durationMs || totalMs
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
      ttftMs: item.ttftMs,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens || item.estimatedOutputTokens,
      totalTokens: item.totalTokens,
      cacheHit: item.cacheHit,
    })),
  }
}

function buildDirectorPromptPayload(input: GenerateRequest, temperature: number): {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  hardRules: string
  globalContext: string
  qualityFeedback: string
  longRangeOutline: string
  turnIndex: number
  playerInput: string
  modules: UserModule[]
  directorUser: string
  cacheKey: string
} {
  const context = buildRuntimeBlocks(input)
  const hardRules = buildHardRules()
  const globalContext = input.globalContext || ''
  const qualityFeedback = String(input.qualityFeedback || '').trim()
  const longRangeOutline = String(input.longRangeOutline || '').trim()
  const directorGuidance = String(input.directorGuidance || '').trim()
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const playerInput = input.playerInput.trim()
  const modules = input.userModules || []
  const model = normalizeModel(input.model)
  const directorUser = wrapWithMustRead([
    block('固定 Director prompt', readPrompt('director/prompt.md')),
    block('硬规则', hardRules),
    block('已加载动态注入模块', context.storybook),
    block('可请求动态注入模块 registry', context.storybookRegistry, '当前没有故事书条目。'),
    block('当前世界状态', context.worldState),
    block('当前物理场景状态', context.physicalSceneState, '（无）'),
    block('长期剧情总结', globalContext),
    block('长期写作负反馈', String(input.qualityFeedback || '').trim(), '（无）'),
    block('当前长期剧情', longRangeOutline, '（无。Director 只能规划本轮，不得生成长期剧情。）'),
    block('上帝模式导演要求', directorGuidance, '（无）'),
    block('导演风格配置', renderModulesForStage(modules, 'director'), '（无）'),
    block('当前伏笔', renderForeshadowContext(input.foreshadowRecords, turnIndex)),
    block('最近正文', context.recentTurns),
    block('当前轮次', `第 ${turnIndex} 轮剧情输出`),
    block('当前玩家输入', playerInput),
  ].join('\n'))
  return {
    model,
    temperature,
    context,
    hardRules,
    globalContext,
    qualityFeedback,
    longRangeOutline,
    turnIndex,
    playerInput,
    modules,
    directorUser,
    cacheKey: buildDirectorCacheKey(model, temperature, directorUser),
  }
}

function buildDirectorCacheKey(model: string, temperature: number, directorUser: string): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ version: 2, model, temperature: Number(temperature.toFixed(2)), directorUser }))
    .digest('hex')
}

function cachedDirectorResult(entry: DirectorCacheEntry, model: string): LayerResult {
  const raw = JSON.stringify(entry.directorPlan)
  return {
    raw,
    json: entry.directorPlan,
    metrics: {
      label: 'Director',
      model,
      durationMs: 0,
      ttftMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedOutputTokens: 0,
      cacheHit: true,
    },
  }
}

function buildNarratorPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  hardRules: string
  globalContext: string
  qualityFeedback: string
  nextLongRangeOutline: string
  physicalSceneState: string
  playerInput: string
  modules: UserModule[]
  directorPlan: Record<string, unknown>
}): {
  model: string
  temperature: number
  playerInput: string
  narratorUser: string
  cacheKey: string
} {
  const narratorUser = wrapWithMustRead([
    block('固定 Narrator prompt', readPrompt('narrator/prompt.md')),
    block('硬规则', options.hardRules),
    block('导演计划', JSON.stringify(options.directorPlan)),
    block('当前世界状态', options.context.worldState),
    block('当前物理场景状态', options.physicalSceneState, '（无）'),
    block('叙事空间输入', options.context.spatialState),
    block('长期剧情总结', options.globalContext),
    block('长期写作负反馈', options.qualityFeedback, '（无）'),
    block('当前长期剧情', options.nextLongRangeOutline, '（无）'),
    block('最近正文', options.context.recentTurns),
    block('当前玩家输入', options.playerInput),
    block('已加载动态注入模块', options.context.storybook),
    block('叙事风格配置', renderModulesForStage(options.modules, 'narrator')),
  ].join('\n'))
  return {
    model: options.model,
    temperature: options.temperature,
    playerInput: options.playerInput || input.playerInput.trim(),
    narratorUser,
    cacheKey: buildNarratorCacheKey(options.model, options.temperature, narratorUser),
  }
}

function buildNarratorCacheKey(model: string, temperature: number, narratorUser: string): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ version: 3, model, temperature: Number(temperature.toFixed(2)), maxTokens: narratorMaxTokens, narratorUser }))
    .digest('hex')
}

function cachedNarratorResult(entry: NarratorCacheEntry, model: string): LayerResult {
  return {
    raw: entry.raw || JSON.stringify(entry.narratorJson),
    json: entry.narratorJson,
    metrics: {
      label: 'Narrator',
      model,
      durationMs: 0,
      ttftMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedOutputTokens: 0,
      cacheHit: true,
    },
  }
}

async function runDirectorCall(input: GenerateRequest, payload: ReturnType<typeof buildDirectorPromptPayload>, signal?: AbortSignal): Promise<DirectorCacheEntry> {
  const director = await callModel([
    { role: 'user', content: payload.directorUser },
  ], { temperature: payload.temperature, apiKey: input.apiKey, model: payload.model, debugLabel: 'Director', signal })
  const directorPlan = compactDirectorPlan(director.json)
  const entry: DirectorCacheEntry = {
    key: payload.cacheKey,
    createdAt: new Date().toISOString(),
    model: payload.model,
    temperature: payload.temperature,
    playerInput: payload.playerInput,
    directorPlan,
  }
  writeDirectorCacheEntry(entry)
  return entry
}

async function runNarratorCall(input: GenerateRequest, payload: ReturnType<typeof buildNarratorPromptPayload>, signal?: AbortSignal): Promise<NarratorCacheEntry> {
  const narrator = await callModel([
    { role: 'user', content: payload.narratorUser },
  ], { temperature: payload.temperature, apiKey: input.apiKey, model: payload.model, debugLabel: 'Narrator', maxTokens: narratorMaxTokens, signal })
  const entry: NarratorCacheEntry = {
    key: payload.cacheKey,
    createdAt: new Date().toISOString(),
    model: payload.model,
    temperature: payload.temperature,
    playerInput: payload.playerInput,
    narratorJson: narrator.json,
    raw: narrator.raw,
  }
  writeNarratorCacheEntry(entry)
  return entry
}

function startDirectorPrewarm(input: GenerateRequest): { key: string; status: string } {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const payload = buildDirectorPromptPayload(input, temperature)
  if (!payload.playerInput) return { key: payload.cacheKey, status: 'empty-input' }
  if (getDirectorCacheEntry(payload.cacheKey)) return { key: payload.cacheKey, status: 'cached' }
  if (directorPrewarmJobs.has(payload.cacheKey)) return { key: payload.cacheKey, status: 'running' }
  const controller = new AbortController()
  const promise = runDirectorCall(input, payload, controller.signal)
    .catch(error => {
      if (isAbortError(error)) return null
      writeLlmDebugFile({
        label: 'Director Prewarm',
        raw: '',
        messages: [{ role: 'user', content: payload.directorUser }],
        error,
      })
      return null
    })
    .finally(() => {
      directorPrewarmJobs.delete(payload.cacheKey)
    })
  directorPrewarmJobs.set(payload.cacheKey, {
    key: payload.cacheKey,
    stage: 'director',
    playerInput: payload.playerInput,
    controller,
    promise,
    startedAt: Date.now(),
  })
  return { key: payload.cacheKey, status: 'queued' }
}

function startNarratorPrewarm(input: GenerateRequest, payload: ReturnType<typeof buildNarratorPromptPayload>): { key: string; status: string } {
  if (!payload.playerInput) return { key: payload.cacheKey, status: 'empty-input' }
  if (getNarratorCacheEntry(payload.cacheKey)) return { key: payload.cacheKey, status: 'cached' }
  if (narratorPrewarmJobs.has(payload.cacheKey)) return { key: payload.cacheKey, status: 'running' }
  const controller = new AbortController()
  const promise = runNarratorCall(input, payload, controller.signal)
    .catch(error => {
      if (isAbortError(error)) return null
      writeLlmDebugFile({
        label: 'Narrator Prewarm',
        raw: '',
        messages: [{ role: 'user', content: payload.narratorUser }],
        error,
      })
      return null
    })
    .finally(() => {
      narratorPrewarmJobs.delete(payload.cacheKey)
    })
  narratorPrewarmJobs.set(payload.cacheKey, {
    key: payload.cacheKey,
    stage: 'narrator',
    playerInput: payload.playerInput,
    controller,
    promise,
    startedAt: Date.now(),
  })
  return { key: payload.cacheKey, status: 'queued' }
}

async function startNextTurnPrewarm(input: GenerateRequest): Promise<NextTurnPrewarmResult> {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const directorPayload = buildDirectorPromptPayload(input, temperature)
  const director = startDirectorPrewarm(input)
  let directorEntry = getDirectorCacheEntry(director.key)
  if (!directorEntry) {
    const job = directorPrewarmJobs.get(director.key)
    if (job) directorEntry = await job.promise
  }
  if (!directorEntry) {
    return {
      director: { ...director, completed: false },
      narrator: { key: '', status: 'director-failed' },
    }
  }

  const directorPlan = directorEntry.directorPlan
  const nextLongRangeOutline = directorPayload.longRangeOutline

  const narratorPayload = buildNarratorPromptPayload(input, {
    model: directorPayload.model,
    temperature: directorPayload.temperature,
    context: directorPayload.context,
    hardRules: directorPayload.hardRules,
    globalContext: directorPayload.globalContext,
    qualityFeedback: directorPayload.qualityFeedback,
    nextLongRangeOutline,
    physicalSceneState: directorPayload.context.physicalSceneState,
    playerInput: directorPayload.playerInput,
    modules: directorPayload.modules,
    directorPlan,
  })
  const narrator = startNarratorPrewarm(input, narratorPayload)
  let narratorEntry = getNarratorCacheEntry(narrator.key)
  if (!narratorEntry) {
    const job = narratorPrewarmJobs.get(narrator.key)
    if (job) narratorEntry = await job.promise
  }

  return {
    director: { ...director, completed: true },
    narrator: { ...narrator, completed: Boolean(narratorEntry) },
  }
}

function cancelPrewarmJobsExcept(allowedKeys: Set<string>, stage: 'director' | 'narrator'): void {
  const jobs = stage === 'director' ? directorPrewarmJobs : narratorPrewarmJobs
  for (const [key, job] of jobs.entries()) {
    if (allowedKeys.has(key)) continue
    job.controller.abort()
    jobs.delete(key)
  }
}

function delay(ms: number): Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), ms))
}

async function awaitPrewarmJob<T>(
  job: PrewarmJob<T> | undefined,
  stage: PipelineEvent['stage'],
  label: string,
  emit: (event: PipelineEvent) => void,
): Promise<T | null> {
  if (!job) return null
  const startedAt = Date.now()
  while (true) {
    const result = await Promise.race([
      job.promise.then(value => ({ done: true as const, value })),
      delay(2500).then(() => ({ done: false as const, value: null })),
    ])
    if (result.done) return result.value
    const elapsedMs = Date.now() - startedAt
    emit({
      type: 'stage_tick',
      stage,
      label,
      message: `等待命中的后台 ${label} 预热结果，已等待 ${(elapsedMs / 1000).toFixed(1)}s。`,
    })
    if (elapsedMs >= prewarmWaitMs) {
      job.controller.abort()
      emit({
        type: 'stage_tick',
        stage,
        label,
        message: `后台 ${label} 预热超过 ${(prewarmWaitMs / 1000).toFixed(0)}s 未返回，已取消并转为前台生成。`,
      })
      return null
    }
  }
}

async function generate(
  input: GenerateRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const startedAt = Date.now()
  const model = normalizeModel(input.model)
  const directorPayload = buildDirectorPromptPayload(input, temperature)
  const context = directorPayload.context
  const hardRules = directorPayload.hardRules
  const globalContext = directorPayload.globalContext
  const longRangeOutline = directorPayload.longRangeOutline
  const playerInput = directorPayload.playerInput
  const modules = directorPayload.modules
  const turnIndex = directorPayload.turnIndex

  if (!input.bypassGenerationCache) {
    cancelPrewarmJobsExcept(new Set([directorPayload.cacheKey]), 'director')
  }

  emit({ type: 'stage_start', stage: 'director', label: 'Director', message: '导演层：规划本轮结构、节奏、伏笔和玩家窗口。' })
  if (input.bypassGenerationCache) {
    emit({ type: 'stage_tick', stage: 'director', label: 'Director', message: '重新生成：跳过 Director 缓存，完整重跑导演层。' })
  }
  const cachedDirector = input.bypassGenerationCache ? null : getDirectorCacheEntry(directorPayload.cacheKey)
  const runningDirectorJob = input.bypassGenerationCache ? undefined : directorPrewarmJobs.get(directorPayload.cacheKey)
  let director: LayerResult
  let directorPlan: Record<string, unknown>
  if (cachedDirector) {
    director = cachedDirectorResult(cachedDirector, model)
    directorPlan = cachedDirector.directorPlan
    emit({ type: 'stage_tick', stage: 'director', label: 'Director', message: '命中本地 Director 缓存，跳过模型调用。' })
  } else if (runningDirectorJob) {
    emit({ type: 'stage_tick', stage: 'director', label: 'Director', message: '等待命中的后台 Director 预热计划。' })
    const entry = await awaitPrewarmJob(runningDirectorJob, 'director', 'Director', emit)
    if (entry) {
      director = cachedDirectorResult(entry, model)
      directorPlan = entry.directorPlan
    } else {
      director = await callModelWithPublicTrace('director', 'Director', [
        { role: 'user', content: directorPayload.directorUser },
      ], { temperature, apiKey: input.apiKey, model }, emit, [
        '公开日志：正在判断玩家输入类型、承接边界和本轮互动入口。',
        '公开日志：正在安排剧情模块、推进速度和玩家下轮窗口。',
        '公开日志：正在检查人物知识边界、伏笔和不可提前解决的问题。',
        '公开日志：导演层仍在等待模型返回结构化计划。',
      ])
      directorPlan = compactDirectorPlan(director.json)
      writeDirectorCacheEntry({
        key: directorPayload.cacheKey,
        createdAt: new Date().toISOString(),
        model,
        temperature,
        playerInput,
        directorPlan,
      })
    }
  } else {
    director = await callModelWithPublicTrace('director', 'Director', [
      { role: 'user', content: directorPayload.directorUser },
    ], { temperature, apiKey: input.apiKey, model }, emit, [
      '公开日志：正在判断玩家输入类型、承接边界和本轮互动入口。',
      '公开日志：正在安排剧情模块、推进速度和玩家下轮窗口。',
      '公开日志：正在检查人物知识边界、伏笔和不可提前解决的问题。',
      '公开日志：导演层仍在等待模型返回结构化计划。',
    ])
    directorPlan = compactDirectorPlan(director.json)
    writeDirectorCacheEntry({
      key: directorPayload.cacheKey,
      createdAt: new Date().toISOString(),
      model,
      temperature,
      playerInput,
      directorPlan,
    })
  }
  emit({ type: 'stage_result', stage: 'director', label: 'Director', message: director.metrics.cacheHit ? '导演层完成：命中本地缓存。' : '导演层完成：已得到压缩结构化计划。', json: directorPlan })

  let nextLongRangeOutline = longRangeOutline

  const narratorPayload = buildNarratorPromptPayload(input, {
    model,
    temperature,
    context,
    hardRules,
    globalContext,
    qualityFeedback: directorPayload.qualityFeedback,
    nextLongRangeOutline,
    physicalSceneState: context.physicalSceneState,
    playerInput,
    modules,
    directorPlan,
  })

  emit({ type: 'stage_start', stage: 'narrator', label: 'Narrator', message: '叙事层：按导演计划写正文草稿。' })
  if (input.bypassGenerationCache) {
    emit({ type: 'stage_tick', stage: 'narrator', label: 'Narrator', message: '重新生成：跳过 Narrator 缓存，完整重跑叙事层。' })
  }
  const cachedNarrator = input.bypassGenerationCache ? null : getNarratorCacheEntry(narratorPayload.cacheKey)
  if (!input.bypassGenerationCache) {
    cancelPrewarmJobsExcept(new Set([narratorPayload.cacheKey]), 'narrator')
  }
  const runningNarratorJob = input.bypassGenerationCache ? undefined : narratorPrewarmJobs.get(narratorPayload.cacheKey)
  let narrator: LayerResult
  if (cachedNarrator) {
    narrator = cachedNarratorResult(cachedNarrator, model)
    emit({ type: 'stage_tick', stage: 'narrator', label: 'Narrator', message: '命中本地 Narrator 缓存，跳过模型调用。' })
  } else if (runningNarratorJob) {
    emit({ type: 'stage_tick', stage: 'narrator', label: 'Narrator', message: '等待命中的后台 Narrator 预热草稿。' })
    const entry = await awaitPrewarmJob(runningNarratorJob, 'narrator', 'Narrator', emit)
    if (entry) {
      narrator = cachedNarratorResult(entry, model)
    } else {
      narrator = await callModelWithPublicTrace('narrator', 'Narrator', [
        { role: 'user', content: narratorPayload.narratorUser },
      ], { temperature, apiKey: input.apiKey, model, maxTokens: narratorMaxTokens }, emit, [
        '公开日志：正在把导演计划转成可读正文，不更新人物状态。',
        '公开日志：正在平衡对话、动作、环境和心理描写。',
        '公开日志：正在检查是否替玩家做了长期选择。',
        '公开日志：叙事层仍在等待模型返回正文草稿。',
      ])
      writeNarratorCacheEntry({
        key: narratorPayload.cacheKey,
        createdAt: new Date().toISOString(),
        model,
        temperature,
        playerInput,
        narratorJson: narrator.json,
        raw: narrator.raw,
      })
    }
  } else {
    narrator = await callModelWithPublicTrace('narrator', 'Narrator', [
      { role: 'user', content: narratorPayload.narratorUser },
    ], { temperature, apiKey: input.apiKey, model, maxTokens: narratorMaxTokens }, emit, [
      '公开日志：正在把导演计划转成可读正文，不更新人物状态。',
      '公开日志：正在平衡对话、动作、环境和心理描写。',
      '公开日志：正在检查是否替玩家做了长期选择。',
      '公开日志：叙事层仍在等待模型返回正文草稿。',
    ])
    writeNarratorCacheEntry({
      key: narratorPayload.cacheKey,
      createdAt: new Date().toISOString(),
      model,
      temperature,
      playerInput,
      narratorJson: narrator.json,
      raw: narrator.raw,
    })
  }
  emit({ type: 'stage_result', stage: 'narrator', label: 'Narrator', message: narrator.metrics.cacheHit ? '叙事层完成：命中本地缓存。' : '叙事层完成：已得到正文草稿。', json: narrator.json })

  const draftText = typeof narrator.json.draftText === 'string'
    ? narrator.json.draftText
    : String(narrator.raw)
  const finalText = draftText

  emit({
    type: 'visible_text',
    stage: 'narrator',
    label: 'Narrator',
    message: '正文已完成，Postprocess 正在后台更新状态。',
    payload: {
      finalText,
      pipelineMode: 'narrator+postprocess',
    },
  })

  const postprocessUser = wrapWithMustRead([
    block('固定 Postprocess prompt', readPrompt('postprocess/prompt.md')),
    block('玩家输入', playerInput),
    block('最终正文', finalText),
    block('导演摘要', compactPostprocessDirectorBrief(directorPlan)),
    block('长期剧情总结', globalContext),
    block('当前伏笔', renderForeshadowContext(input.foreshadowRecords, turnIndex)),
    block('最近正文', context.recentTurns),
    block('人物状态 Schema', input.statusPanelSchema),
    block('当前人物状态', input.statusPanel),
    block('当前物理场景状态', renderPhysicalSceneState(pickPhysicalSceneStateInput(input))),
    block('当前长期剧情', longRangeOutline, '（无）'),
  ].join('\n'))

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '后处理层：更新总结、状态栏、伏笔、写作负反馈和玩家选项。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', [
    { role: 'user', content: postprocessUser },
  ], { temperature: 0.5, apiKey: input.apiKey, model }, emit, [
    '公开日志：正文已经可读，正在后台整理本轮事实。',
    '公开日志：正在按人物状态 Schema 更新人物状态。',
    '公开日志：正在更新历史总结、当前剧情和写作负反馈。',
    '公开日志：正在生成 3 个玩家候选项。',
    '公开日志：后处理层仍在等待模型返回结构化状态。',
  ])
  const postprocessJson = postprocess.json
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理完成：状态、总结和候选项已更新。', json: postprocessJson })

  let longRangeDirector: LayerResult | null = null
  if (shouldRunLongRangeDirector(postprocess.json.longRangeStatus, longRangeOutline)) {
    const longRangeStatus = normalizeLongRangeStatus(postprocess.json.longRangeStatus, longRangeOutline)
    const longRangeDirectorUser = buildLongRangeDirectorUser({
      hardRules,
      worldState: context.worldState,
      storybook: context.storybook,
      recentTurns: context.recentTurns,
      globalContext,
      currentLongRangeOutline: longRangeOutline,
      longRangeStatus,
      turnSummary: String(postprocess.json.turnSummary || ''),
      finalText,
      directorGuidance: input.directorGuidance,
      modules,
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: '高级导演层：生成或修订当前长期剧情。' })
    longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', [
      { role: 'user', content: longRangeDirectorUser },
    ], { temperature: 0.6, apiKey: input.apiKey, model }, emit, [
      '公开日志：正在判断当前长期剧情是否已完成、缺失或偏离。',
      '公开日志：正在生成可供后续多轮缓慢靠近的高层方向。',
      '公开日志：高级导演层仍在等待模型返回长期剧情。',
    ])
    nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, longRangeOutline)
    emit({ type: 'stage_result', stage: 'director', label: 'LongRangeDirector', message: '高级导演层完成：当前长期剧情已更新。', json: { longRangeOutline: nextLongRangeOutline } })
  }

  const playerOptions = normalizePlayerOptions(postprocess.json.playerOptions)
  const nextStatusPanel = formatStatusPanelPayload(postprocess.json.statusPanel || input.statusPanel || '')
  const metrics = buildInteractionMetrics({
    model,
    startedAt,
    stages: [director, narrator, postprocess, ...(longRangeDirector ? [longRangeDirector] : [])],
    finalText,
  })

  return {
    finalText,
    pipelineMode: 'narrator+postprocess',
    director: directorPlan,
    narrator: narrator.json,
    postprocess: postprocessJson,
    playerOptions,
    turnSummary: postprocess.json.turnSummary || '',
    foreshadowRecords: extractDirectorForeshadowRecords(directorPlan),
    longRangeOutline: nextLongRangeOutline,
    qualityFeedback: postprocess.json.qualityFeedback || '',
    statusPanel: nextStatusPanel,
    physicalSceneState: normalizePhysicalSceneState(postprocess.json.physicalSceneState ?? postprocess.json.sceneState, pickPhysicalSceneStateInput(input)),
    metrics,
    model,
  }
}

async function runPostprocess(
  input: PostprocessRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const playerInput = String(input.playerInput || '').trim()
  const finalText = String(input.finalText || '').trim()
  if (!playerInput) throw new Error('playerInput is required')
  if (!finalText) throw new Error('finalText is required')

  const model = normalizeModel(input.model)
  const startedAt = Date.now()
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const director = input.director && typeof input.director === 'object' ? input.director : {}
  const directorPlan = compactDirectorPlan(director)
  const context = buildRuntimeBlocks({
    playerInput,
    recentTurns: input.recentTurns,
    characters: input.characters,
    storybookEntries: input.storybookEntries,
    statusPanel: input.statusPanel,
    physicalSceneState: pickPhysicalSceneStateInput(input),
  } as GenerateRequest)
  const hardRules = buildHardRules()
  const currentLongRangeOutline = String(input.longRangeOutline || '').trim()
  const postprocessUser = wrapWithMustRead([
    block('固定 Postprocess prompt', readPrompt('postprocess/prompt.md')),
    block('玩家输入', playerInput),
    block('最终正文', finalText),
    block('导演摘要', compactPostprocessDirectorBrief(directorPlan)),
    block('长期剧情总结', String(input.globalContext || '').trim()),
    block('当前伏笔', renderForeshadowContext(input.foreshadowRecords, turnIndex)),
    block('最近正文', context.recentTurns),
    block('人物状态 Schema', input.statusPanelSchema),
    block('当前人物状态', input.statusPanel),
    block('当前物理场景状态', renderPhysicalSceneState(pickPhysicalSceneStateInput(input))),
    block('当前长期剧情', currentLongRangeOutline, '（无）'),
  ].join('\n'))

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '重试后处理层：补写总结、状态栏、伏笔、写作负反馈和玩家选项。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', [
    { role: 'user', content: postprocessUser },
  ], { temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在补跑上一轮失败的 Postprocess。',
    '公开日志：正在按人物状态 Schema 更新人物状态。',
    '公开日志：正在补写历史总结、当前剧情和写作负反馈。',
    '公开日志：正在生成 3 个玩家候选项。',
    '公开日志：Postprocess 重试仍在等待模型返回结构化状态。',
  ])
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理重试完成：状态、总结和候选项已更新。', json: postprocess.json })

  let nextLongRangeOutline = currentLongRangeOutline
  let longRangeDirector: LayerResult | null = null
  if (shouldRunLongRangeDirector(postprocess.json.longRangeStatus, currentLongRangeOutline)) {
    const longRangeStatus = normalizeLongRangeStatus(postprocess.json.longRangeStatus, currentLongRangeOutline)
    const longRangeDirectorUser = buildLongRangeDirectorUser({
      hardRules,
      worldState: context.worldState,
      storybook: context.storybook,
      recentTurns: context.recentTurns,
      globalContext: String(input.globalContext || '').trim(),
      currentLongRangeOutline,
      longRangeStatus,
      turnSummary: String(postprocess.json.turnSummary || ''),
      finalText,
      directorGuidance: input.directorGuidance,
      modules: input.userModules || [],
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: '高级导演层：生成或修订当前长期剧情。' })
    longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', [
      { role: 'user', content: longRangeDirectorUser },
    ], { temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.6, apiKey: input.apiKey, model }, emit, [
      '公开日志：正在补跑长期剧情生成/修订。',
      '公开日志：正在生成可供后续多轮缓慢靠近的高层方向。',
      '公开日志：高级导演层仍在等待模型返回长期剧情。',
    ])
    nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, currentLongRangeOutline)
    emit({ type: 'stage_result', stage: 'director', label: 'LongRangeDirector', message: '高级导演层完成：当前长期剧情已更新。', json: { longRangeOutline: nextLongRangeOutline } })
  }
  const nextStatusPanel = formatStatusPanelPayload(postprocess.json.statusPanel || input.statusPanel || '')
  const metrics = buildInteractionMetrics({
    model,
    startedAt,
    stages: [postprocess, ...(longRangeDirector ? [longRangeDirector] : [])],
    finalText,
  })

  return {
    finalText,
    pipelineMode: 'postprocess-retry',
    director: directorPlan,
    postprocess: postprocess.json,
    playerOptions: normalizePlayerOptions(postprocess.json.playerOptions),
    turnSummary: postprocess.json.turnSummary || '',
    foreshadowRecords: extractDirectorForeshadowRecords(directorPlan),
    longRangeOutline: nextLongRangeOutline,
    qualityFeedback: postprocess.json.qualityFeedback || '',
    statusPanel: nextStatusPanel,
    physicalSceneState: normalizePhysicalSceneState(postprocess.json.physicalSceneState ?? postprocess.json.sceneState, pickPhysicalSceneStateInput(input)),
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

function loadUserConfigModules(): UserModule[] {
  if (!fs.existsSync(userConfigDir)) return []
  const modules = walkUserConfigFiles(userConfigDir)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(filePath => readUserConfigModule(filePath))
    .filter(module => !internalizedModuleIds.has(module.id))
    .map(module => ({
      id: module.id,
      name: module.name,
      description: module.description || '',
      layer: module.layer || 'narrator',
      group: module.group || '',
      exclusiveGroup: styleExclusiveGroup(module.layer),
      prompt: module.prompt,
      file: module.file,
      enabled: module.enabled,
      custom: false,
    }))
  return enforceSingleEnabledStylePerLayer(modules)
}

function readUserConfigModule(filePath: string): UserModule {
  const relativePath = path.relative(userConfigDir, filePath)
  const { attrs, body } = parseMarkdownConfig(fs.readFileSync(filePath, 'utf-8'))
  const id = attrs.id || path.basename(filePath, '.md')
  const fallbackEnabled = attrs.enabled === undefined ? false : attrs.enabled === 'true'
  const layer = normalizeUserConfigLayer(attrs.layer) || inferUserConfigLayer(relativePath, attrs.group || '')
  const group = attrs.group || (layer === 'director' ? '导演风格' : '叙事风格')
  return {
    id,
    name: attrs.name || id,
    description: attrs.description || '',
    layer,
    group,
    exclusiveGroup: styleExclusiveGroup(layer),
    prompt: body,
    file: `prompts/user-config-templates/${relativePath}`,
    enabled: fallbackEnabled,
    custom: false,
  }
}

function normalizeUserConfigLayer(value: string | undefined): UserModule['layer'] | undefined {
  const layer = String(value || '').trim()
  if (layer === 'director' || layer === 'narrator') return layer
  return undefined
}

function inferUserConfigLayer(relativePath: string, group: string): UserModule['layer'] {
  const text = `${relativePath} ${group}`
  if (/导演/.test(text)) return 'director'
  return 'narrator'
}

function styleExclusiveGroup(layer: UserModule['layer']): string {
  return layer === 'director' ? 'director-style' : 'narrator-style'
}

function enforceSingleEnabledStylePerLayer(modules: UserModule[]): UserModule[] {
  const enabledGroups = new Set<string>()
  return modules.map(module => {
    if (!module.enabled) return module
    const exclusiveGroup = styleExclusiveGroup(module.layer)
    if (enabledGroups.has(exclusiveGroup)) return { ...module, enabled: false }
    enabledGroups.add(exclusiveGroup)
    return module
  })
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
          { id: fireworksDeepSeekV4ProPriorityModel, label: 'DeepSeek V4 Pro (Fireworks Priority)', provider: 'fireworks' },
          { id: officialDeepSeekV4ProModel, label: 'DeepSeek V4 Pro (Official)', provider: 'deepseek' },
        ],
        providers: {
          deepseek: {
            baseUrl: providerBaseUrl('deepseek'),
            hasApiKey: providerHasApiKey('deepseek'),
          },
          fireworks: {
            baseUrl: providerBaseUrl('fireworks'),
            hasApiKey: providerHasApiKey('fireworks'),
          },
        },
        baseUrl: providerBaseUrl('deepseek'),
        hasApiKey: providerHasApiKey('deepseek'),
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

    if (req.method === 'POST' && url.pathname === '/api/director-prewarm') {
      const body = await readBody(req)
      const input = JSON.parse(body) as DirectorPrewarmRequest
      const requests = Array.isArray(input.requests) ? input.requests.slice(0, 3) : []
      const jobs = requests
        .filter(request => request?.playerInput?.trim())
        .map(request => startNextTurnPrewarm(request))
      const settled = jobs.length ? await Promise.allSettled(jobs) : []
      const results = settled
        .filter((result): result is PromiseFulfilledResult<NextTurnPrewarmResult> => result.status === 'fulfilled')
        .map(result => result.value)
      const directorResults = results.map(result => result.director)
      const narratorResults = results.map(result => result.narrator)
      const failed = settled.filter(result => result.status === 'rejected').length
      sendJson(res, 200, {
        queued: directorResults.filter(result => result.status === 'queued').length,
        cached: directorResults.filter(result => result.status === 'cached').length,
        running: directorResults.filter(result => result.status === 'running').length,
        completed: directorResults.filter(result => result.completed && result.status !== 'cached').length,
        failed: failed + directorResults.filter(result => result.completed === false).length,
        narratorQueued: narratorResults.filter(result => result.status === 'queued').length,
        narratorCached: narratorResults.filter(result => result.status === 'cached').length,
        narratorRunning: narratorResults.filter(result => result.status === 'running').length,
        narratorCompleted: narratorResults.filter(result => result.completed && result.status !== 'cached').length,
        narratorSkipped: narratorResults.filter(result => result.status === 'skipped').length,
        narratorFailed: narratorResults.filter(result => result.completed === false || result.status === 'director-failed').length,
        results,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/postprocess-stream') {
      const body = await readBody(req)
      const input = JSON.parse(body) as PostprocessRequest
      if (!input.playerInput?.trim()) {
        sendJson(res, 400, { error: 'playerInput is required' })
        return
      }
      if (!input.finalText?.trim()) {
        sendJson(res, 400, { error: 'finalText is required' })
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
        const result = await runPostprocess(input, writePipelineEvent)
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
