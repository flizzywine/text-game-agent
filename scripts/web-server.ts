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

interface PipelineContext {
  globalContext?: string
  storyContext?: string
  feedbackText?: string
  feedbackMemory?: Array<Record<string, unknown>>
  longRangeOutline?: string
  directorStyle?: string
  narratorStyle?: string
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  userModules?: UserModule[]
  statusSchema?: string[]
  statusRoster?: string[]
  statusState?: Record<string, Record<string, string>>
  model?: string
  apiKey?: string
  temperature?: number
}

interface GenerateRequest extends PipelineContext {
  playerInput: string
  turnIndex?: number
}

interface PostprocessRequest extends PipelineContext {
  playerInput: string
  finalText: string
  director?: Record<string, unknown>
  turnIndex?: number
}

interface EvaluationRequest extends PostprocessRequest {
  narrator?: Record<string, unknown>
  postprocess?: Record<string, unknown>
  evaluationTarget?: 'external-api' | 'codex'
  storyId?: string
  storyName?: string
  playerOptions?: unknown[]
}

interface ProviderTestRequest {
  model?: string
  apiKey?: string
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
  statusSchema: string[]
  statusRoster: string[]
  statusState: Record<string, Record<string, string>>
  directorStyle?: string
  narratorStyle?: string
  initialPlayerOptions: PlayerOption[]
  globalContextSeed: string
  currentSituation?: string
  outline?: string
  longRangeOutline?: string
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
  ttftMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedOutputTokens: number
}

interface PipelineEvent {
  type: 'stage_start' | 'stage_tick' | 'stage_result' | 'stage_skip' | 'visible_text'
  stage: 'initializer' | 'director' | 'narrator' | 'postprocess' | 'evaluator'
  label: string
  message?: string
  json?: Record<string, unknown> | null
  payload?: Record<string, unknown>
}

type ModelProvider = 'deepseek' | 'fireworks'

const rootDir = process.cwd()
const webDir = path.join(rootDir, 'web')
const promptDir = path.join(rootDir, 'prompts')
const userConfigDirs = [
  path.join(promptDir, '导演风格'),
  path.join(promptDir, '叙事风格'),
]
const storyDir = path.join(rootDir, 'story')
const saveDir = path.join(rootDir, 'save')
const debugDir = path.join(rootDir, 'debug')
const llmDebugDir = path.join(debugDir, 'llm-raw')
const evaluationDebugDir = path.join(debugDir, 'evaluations')
const evaluationMaterialDir = path.join(debugDir, 'evaluation-materials')
const saveFile = path.join(saveDir, 'current-state.json')
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const fireworksDeepSeekV4ProRequestModel = 'accounts/fireworks/models/deepseek-v4-pro'
const defaultModel = officialDeepSeekV4FlashModel
const modelIds = new Set([
  officialDeepSeekV4ProModel,
  officialDeepSeekV4FlashModel,
  fireworksDeepSeekV4ProPriorityModel,
])
const defaultDeepSeekBaseUrl = 'https://api.deepseek.com'
const defaultFireworksBaseUrl = 'https://api.fireworks.ai/inference/v1'
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300_000)
const longRangeDirectorTimeoutMs = Number(process.env.LONG_RANGE_DIRECTOR_TIMEOUT_MS || 45_000)
const directorTimeoutMs = Number(process.env.DIRECTOR_TIMEOUT_MS || 300_000)
const narratorTimeoutMs = Number(process.env.NARRATOR_TIMEOUT_MS || 120_000)
const providerFetchRetryCount = Number(process.env.LLM_FETCH_RETRY_COUNT || 2)
const providerFetchRetryDelayMs = Number(process.env.LLM_FETCH_RETRY_DELAY_MS || 1200)
const defaultMaxTokens = 4096
const directorMaxTokens = Number(process.env.DIRECTOR_MAX_TOKENS || 1200)
const narratorMaxTokens = 8192
const port = Number(process.env.PORT || 4173)
const localEnv = readDotEnv(path.join(rootDir, '.env.local'))
const internalizedModuleIds = new Set<string>()
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

function providerForModel(model: string): ModelProvider {
  if (isFireworksModel(model)) return 'fireworks'
  return 'deepseek'
}

function isFireworksModel(model: string): boolean {
  return model === fireworksDeepSeekV4ProPriorityModel
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

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = error.cause && typeof error.cause === 'object' ? error.cause as { code?: unknown; message?: unknown } : {}
  const detail = [
    error.name,
    error.message,
    cause.code,
    cause.message,
  ].filter(Boolean).join(' ')
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR|network|socket|TLS/i.test(detail)
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause && typeof error.cause === 'object' ? error.cause as { code?: unknown; message?: unknown } : {}
  return [
    error.message,
    cause.code ? `cause=${String(cause.code)}` : '',
    cause.message ? String(cause.message) : '',
  ].filter(Boolean).join('；')
}

async function fetchWithTransientRetry(input: string, init: RequestInit): Promise<Response> {
  let attempt = 0
  while (true) {
    try {
      return await fetch(input, init)
    } catch (error) {
      const aborted = isAbortError(error) || init.signal instanceof AbortSignal && init.signal.aborted
      if (aborted || !isTransientFetchError(error) || attempt >= providerFetchRetryCount) throw error
      attempt += 1
      await delay(providerFetchRetryDelayMs * attempt)
    }
  }
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
  fs.mkdirSync(evaluationDebugDir, { recursive: true })
  fs.mkdirSync(evaluationMaterialDir, { recursive: true })
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

function writeDebugArtifact(dir: string, suffix: string, payload: Record<string, unknown>, options: { latest?: boolean } = {}): string {
  ensureDataDirs()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(dir, `${stamp}-${safeName(suffix, 'artifact')}.json`)
  writeJsonFile(filePath, payload)
  if (options.latest) {
    writeJsonFile(path.join(dir, 'latest.json'), {
      ...payload,
      file: path.relative(rootDir, filePath),
    })
  }
  return path.relative(rootDir, filePath)
}

function readJsonFileIfExists(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function sanitizeEvaluationRequest(input: EvaluationRequest): Record<string, unknown> {
  const { apiKey: _apiKey, ...safeInput } = input
  return safeInput as Record<string, unknown>
}

function writeLlmDebugFile(input: {
  label: string
  raw: string
  repairedRaw?: string
  messages: ChatMessage[]
  error: unknown
}): string {
  return writeDebugArtifact(llmDebugDir, input.label, {
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
}

function writeEvaluationMaterialFile(input: EvaluationRequest, model = normalizeModel(input.model)): {
  file: string
  latestFile: string
  payload: Record<string, unknown>
  evaluatorPayload: ReturnType<typeof buildEvaluationPromptPayload>
} {
  const evaluatorPayload = buildEvaluationPromptPayload(input, model)
  const payload = {
    type: 'evaluation-material',
    createdAt: new Date().toISOString(),
    storyId: String(input.storyId || '').trim(),
    storyName: String(input.storyName || '').trim(),
    model,
    turnIndex: input.turnIndex,
    playerInput: evaluatorPayload.playerInput,
    finalText: evaluatorPayload.finalText,
    evaluatorPrompt: evaluatorPayload.evaluatorUser,
    material: {
      director: input.director || {},
      narrator: input.narrator || {},
      postprocess: input.postprocess || {},
      recentTurns: input.recentTurns || [],
      characters: input.characters || [],
      statusSchema: input.statusSchema || [],
      statusRoster: input.statusRoster || [],
      statusState: input.statusState || {},
      longRangeOutline: input.longRangeOutline || '',
      globalContext: input.globalContext || '',
      feedbackText: input.feedbackText || '',
      feedbackMemory: input.feedbackMemory || [],
      playerOptions: input.playerOptions || [],
      userModules: input.userModules || [],
    },
    sourcePayload: sanitizeEvaluationRequest(input),
  }
  const file = writeDebugArtifact(evaluationMaterialDir, 'material', payload, { latest: true })
  return {
    file,
    latestFile: 'debug/evaluation-materials/latest.json',
    payload,
    evaluatorPayload,
  }
}

function writeEvaluationDebugFile(input: {
  model: string
  storyId?: string
  storyName?: string
  playerInput: string
  finalText: string
  evaluatorPrompt: string
  evaluation: Record<string, unknown>
  metrics: Record<string, unknown>
  materialFile?: string
}): string {
  return writeDebugArtifact(evaluationDebugDir, 'evaluation', {
    type: 'external-api-report',
    createdAt: new Date().toISOString(),
    model: input.model,
    storyId: input.storyId || '',
    storyName: input.storyName || '',
    playerInput: input.playerInput,
    finalText: input.finalText,
    evaluatorPrompt: input.evaluatorPrompt,
    materialFile: input.materialFile || '',
    evaluation: input.evaluation,
    metrics: input.metrics,
  }, { latest: true })
}

function writeCodexEvaluationRequestFile(input: {
  model: string
  storyId?: string
  storyName?: string
  playerInput: string
  finalText: string
  evaluatorPrompt: string
  materialFile?: string
}): string {
  return writeDebugArtifact(evaluationDebugDir, 'codex-request', {
    type: 'codex-request',
    createdAt: new Date().toISOString(),
    instruction: '请 Codex 基于 evaluatorPrompt 和上下文材料，按评估准则输出质量评估报告；不要续写正文，不要自动修改文件。',
    model: input.model,
    storyId: input.storyId || '',
    storyName: input.storyName || '',
    playerInput: input.playerInput,
    finalText: input.finalText,
    materialFile: input.materialFile || '',
    evaluatorPrompt: input.evaluatorPrompt,
  }, { latest: true })
}

function readLatestEvaluationArtifacts(): Record<string, unknown> {
  const material = readJsonFileIfExists(path.join(evaluationMaterialDir, 'latest.json'))
  const report = readJsonFileIfExists(path.join(evaluationDebugDir, 'latest.json'))
  return {
    material,
    report,
    materialFile: material?.file || '',
    reportFile: report?.file || '',
    latestEvaluationMaterialFile: 'debug/evaluation-materials/latest.json',
    latestEvaluationFile: 'debug/evaluations/latest.json',
  }
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

function renderPromptTemplate(name: string, variables: Record<string, string | undefined>, fallback = '（无）'): string {
  return readPrompt(name).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key]
    return value?.trim() || fallback
  }).trim()
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

const defaultStatusSchema = ['位置', '姿势', '外显状态', '情绪', '已知信息', '对玩家态度', '手上物', '可触达区域']

function normalizeStatusSchema(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|[,，、]/)
      : []
  const fields = items.map(item => String(item || '').replace(/^[-*]\s*/, '').split(/[：:]/)[0].trim()).filter(Boolean)
  return [...new Set(fields.length ? fields : defaultStatusSchema)]
}

function normalizeStatusRoster(value: unknown, characters: CharacterState[] = []): string[] {
  const items = Array.isArray(value) ? value : []
  const names = items.map(item => typeof item === 'string' ? item : (item && typeof item === 'object' ? (item as Record<string, unknown>).name : '')).map(item => String(item || '').trim()).filter(Boolean)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(Boolean)
  return [...new Set(['玩家', ...names, ...characterNames])]
}

function normalizeStatusState(value: unknown, roster: string[], characters: CharacterState[] = []): Record<string, Record<string, string>> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const byName = new Map(characters.map(character => [String(character.name || '').trim(), character]))
  const output: Record<string, Record<string, string>> = {}
  for (const name of roster) {
    const raw = source[name]
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const character = byName.get(name)
    output[name] = {
      位置: String(record.位置 || record.location || character?.location || '未知'),
      姿势: String(record.姿势 || '未知'),
      外显状态: String(record.外显状态 || record.health || character?.health || '未知'),
      情绪: String(record.情绪 || record.mood || character?.mood || '未知'),
      已知信息: String(record.已知信息 || '未揭示'),
      对玩家态度: String(record.对玩家态度 || record.trust || (name === '玩家' ? '玩家本人' : character?.trust || '未知')),
      手上物: String(record.手上物 || '未知'),
      可触达区域: String(record.可触达区域 || '未知'),
    }
  }
  return output
}

function buildStatusModel(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: CharacterState[] }): {
  statusSchema: string[]
  statusRoster: string[]
  statusState: Record<string, Record<string, string>>
} {
  const characters = input.characters || []
  const statusSchema = normalizeStatusSchema(input.statusSchema)
  const statusRoster = normalizeStatusRoster(input.statusRoster, characters)
  const statusState = normalizeStatusState(input.statusState, statusRoster, characters)
  return { statusSchema, statusRoster, statusState }
}

function renderRelevantStatus(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: CharacterState[] }): string {
  const model = buildStatusModel(input)
  return JSON.stringify({ fields: model.statusSchema, people: model.statusRoster, state: model.statusState })
}

function mergeStatusSchema(current: unknown, patch: unknown): string[] {
  return [...new Set([...normalizeStatusSchema(current), ...normalizeStatusSchema(patch)])]
}

function mergeStatusRoster(current: unknown, patch: unknown, characters: CharacterState[] = [], statePatch: unknown = {}): string[] {
  const patchNames = statePatch && typeof statePatch === 'object' && !Array.isArray(statePatch)
    ? Object.keys(statePatch as Record<string, unknown>)
    : []
  return normalizeStatusRoster([...(Array.isArray(current) ? current : []), ...(Array.isArray(patch) ? patch : []), ...patchNames], characters)
}

function mergeStatusState(current: unknown, patch: unknown, roster: string[], characters: CharacterState[] = []): Record<string, Record<string, string>> {
  const base = normalizeStatusState(current, roster, characters)
  const delta = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch as Record<string, unknown> : {}
  for (const [name, value] of Object.entries(delta)) {
    if (!roster.includes(name)) continue
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    base[name] = { ...(base[name] || {}), ...Object.fromEntries(Object.entries(record).map(([key, item]) => [key, String(item ?? '').trim()]).filter(([, item]) => item)) }
  }
  return base
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

function renderMergedStyle(storyStyle: string, modules: UserModule[] | undefined, stage: UserModuleStage): string {
  const parts = [
    String(storyStyle || '').trim(),
    renderModulesForStage(modules, stage).trim(),
  ].filter(Boolean)
  return parts.length ? parts.join('\n\n') : '（无）'
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

function inferInitialStoryStyles(
  input: InitializeStoryRequest,
  worldview = '',
  openingText = '',
): { directorStyle: string; narratorStyle: string } {
  const material = [
    input.sourceName || '',
    worldview,
    openingText,
    ...(input.entries || []).slice(0, 12).map(entry => [
      entry.title || '',
      entry.type || '',
      ...(entry.tags || []),
      entry.content || '',
    ].join('\n')),
  ].join('\n')

  if (/重生之都市修仙|重生都市修仙|都市修仙|陈凡|陈北玄|灵气|武道|术法/.test(material)) {
    return {
      directorStyle: '都市修仙 / 重生爽文导演风格：以“低估、试探、压迫、反转或震慑、余波”构成本轮动力；主动引入校园、家族、地下江湖、资源线和前世遗憾的外部压力；早期保留陈凡身体弱、资源少、身份低的限制；每轮制造一个可推进的矛盾、线索或身份误判，不让世界无条件顺从玩家。',
      narratorStyle: '现代都市修仙叙事风格：语调克制但有压迫感，突出陈凡重生后的冷静、信息差和旧日遗憾；描写以都市现实细节、人物反应、身体凡胎限制和微弱灵气感知为主；少堆设定名词，爽点通过旁人误判、局势反转和细节震慑呈现，正文清晰紧凑。',
    }
  }

  return {
    directorStyle: '通用互动小说导演风格：以玩家输入作为局部触发点，同时保持 NPC 独立和世界压力；主动制造信息差、关系变化、短期扰动和可回收线索；重大事件分阶段推进，小事可以几笔带过；每轮保留玩家可接续的行动窗口。',
    narratorStyle: '通用小说叙事风格：正文以清晰可读为先，动作、神态和具体场景细节替代空泛形容；角色保持限知视角，通过看、听、触、推理逐步获得信息；避免设定宣读、重复句式和无意义铺陈，保持段落节奏紧凑。',
  }
}

function fallbackStoryInitialization(input: InitializeStoryRequest): StoryProgramConfig {
  const baseCast = input.characters?.length
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
  const cast = baseCast.some(character => character.name === '玩家')
    ? baseCast
    : [{
      id: 'character.player',
      name: '玩家',
      role: '玩家操控角色',
      mood: '待输入',
      location: '开场',
      health: '正常',
      trust: '',
      notes: '玩家操控角色；不替玩家锁死长期选择。',
    }, ...baseCast]
  const statusSchema = defaultStatusSchema
  const statusRoster = normalizeStatusRoster([], cast)
  const statusState = normalizeStatusState({}, statusRoster, cast)
  const openingText = extractOpeningTextFromEntries(input.entries || [])
  const worldview = [
    `故事资料：${input.sourceName || '未命名故事'}`,
    input.entries?.length ? `资料条目：${input.entries.map(entry => entry.title || entry.id).filter(Boolean).join('、')}` : '',
  ].filter(Boolean).join('\n')
  const inferredStyles = inferInitialStoryStyles(input, worldview, openingText)
  const directorStyle = inferredStyles.directorStyle
  const narratorStyle = inferredStyles.narratorStyle
  return {
    sourceName: input.sourceName || '未命名故事',
    generatedAt: new Date().toISOString(),
    openingText,
    worldview,
    cast,
    statusSchema,
    statusRoster,
    statusState,
    directorStyle,
    narratorStyle,
    initialPlayerOptions: [
      { id: 'A', label: '观察', description: '先观察当前局面。', inputText: '我先观察周围和对方的反应。' },
      { id: 'B', label: '开口', description: '用一句话打开互动。', inputText: '我开口问道：“现在是什么情况？”' },
      { id: 'C', label: '行动', description: '用一个轻动作试探场景。', inputText: '我向前一步，试探性地接近当前互动对象。' },
    ],
    globalContextSeed: [
      `当前故事资料：${input.sourceName || '未命名故事'}`,
      worldview ? `世界观：${worldview.slice(0, 300)}` : '',
      statusRoster.length ? `状态追踪人物：${statusRoster.join('、')}` : '',
      directorStyle ? `故事导演风格：${directorStyle}` : '',
      narratorStyle ? `故事叙事风格：${narratorStyle}` : '',
      openingText ? `开场白：${openingText.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n'),
  }
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

function updateStoryAssetProgramConfig(assetId: string, patch: Partial<StoryProgramConfig>): StoryProgramConfig {
  const assetDir = getStoryAssetDir(assetId)
  if (!assetDir) throw new Error('找不到故事资料目录。')
  const record = readStoryAssetRecord(assetDir, assetId)
  const existing = readProgramConfig(assetDir) || fallbackStoryInitialization({
    assetId,
    sourceName: record?.sourceName || assetId,
    entries: record?.entries || [],
    characters: record?.characters || [],
  })
  const editablePatch = {
    worldview: String(patch.worldview ?? existing.worldview ?? ''),
    openingText: String(patch.openingText ?? existing.openingText ?? ''),
    directorStyle: String(patch.directorStyle ?? existing.directorStyle ?? ''),
    narratorStyle: String(patch.narratorStyle ?? existing.narratorStyle ?? ''),
    statusSchema: normalizeStatusSchema(patch.statusSchema ?? existing.statusSchema),
    statusRoster: normalizeStatusRoster(patch.statusRoster ?? existing.statusRoster, existing.cast),
    statusState: normalizeStatusState(patch.statusState ?? existing.statusState, normalizeStatusRoster(patch.statusRoster ?? existing.statusRoster, existing.cast), existing.cast),
    globalContextSeed: String(patch.globalContextSeed ?? existing.globalContextSeed ?? ''),
  }
  const config = normalizeProgramConfig({
    ...existing,
    ...editablePatch,
  } as Record<string, unknown>, existing)
  writeProgramConfig(assetDir, config)
  return config
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
    '## 追踪人物',
    config.statusRoster.join('、') || '（无）',
    '',
    '## 状态字段',
    config.statusSchema.join('、') || '（无）',
    '',
    '## 初始人物状态',
    JSON.stringify(config.statusState, null, 2),
    '',
    '## 当前剧情目标',
    config.longRangeOutline || '（无）',
    '',
    '## 导演风格',
    config.directorStyle || '（无）',
    '',
    '## 叙事风格',
    config.narratorStyle || '（无）',
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
  ].join('\n')
}

function normalizeProgramConfig(raw: Record<string, unknown>, fallback: StoryProgramConfig): StoryProgramConfig {
  const cast = Array.isArray(raw.cast) ? raw.cast : Array.isArray(raw.characterSeeds) ? raw.characterSeeds : fallback.cast
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
    statusSchema: normalizeStatusSchema(raw.statusSchema || fallback.statusSchema),
    statusRoster: normalizeStatusRoster(raw.statusRoster || fallback.statusRoster, cast as CharacterState[]),
    statusState: normalizeStatusState(raw.statusState || fallback.statusState, normalizeStatusRoster(raw.statusRoster || fallback.statusRoster, cast as CharacterState[]), cast as CharacterState[]),
    directorStyle: String(raw.directorStyle || fallback.directorStyle || ''),
    narratorStyle: String(raw.narratorStyle || fallback.narratorStyle || ''),
    initialPlayerOptions: initialPlayerOptions as PlayerOption[],
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

  const user = renderPromptTemplate('initializer.md', {
    storyMaterial: renderInitializationMaterial(input),
  })

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
    response = await fetchWithTransientRetry(`${baseUrl}/chat/completions`, {
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
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-deepseek-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`DeepSeek 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
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
    response = await fetchWithTransientRetry(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'x-session-affinity': env('FIREWORKS_SESSION_AFFINITY') || 'text-game-agent',
      },
      body: JSON.stringify({
        model: fireworksDeepSeekV4ProRequestModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        service_tier: 'priority',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      if (response.status === 401 || response.status === 403) {
        throw new Error('Fireworks API Key 无效、无权限，或当前账号不能调用该模型。请检查 Fireworks key 和模型权限。')
      }
      throw new Error(`Fireworks ${response.status}: ${text.slice(0, 500)}`)
    }

    const text = await response.text()
    const durationMs = Date.now() - startedAt
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
        label: `${label}-fireworks-error`,
        raw: text,
        messages,
        error: new Error(detail),
      })
      throw new Error(`Fireworks 上游错误：${detail}；原始返回已保存：${file}`)
    }
    const raw = payload.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      const file = writeLlmDebugFile({
        label: `${label}-fireworks-empty`,
        raw: text,
        messages,
        error: new Error('Fireworks returned an empty response'),
      })
      throw new Error(`Fireworks 返回空内容；原始返回已保存：${file}`)
    }
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
  } catch (error) {
    if (isAbortError(error)) {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`Fireworks 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-fireworks-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`Fireworks 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
    }
    throw error
  } finally {
    unlinkAbortSignal()
    clearTimeout(timer)
  }
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

async function testProvider(input: ProviderTestRequest): Promise<Record<string, unknown>> {
  const model = normalizeModel(input.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, input.apiKey)
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const result = await requestModelContent(apiKey, [
      {
        role: 'user',
        content: '连通性测试。只输出一个 JSON：{"ok":true}',
      },
    ], 0, model, 'ProviderTest', 80, controller.signal)
    return {
      ok: true,
      provider,
      providerLabel: providerLabel(provider),
      model,
      durationMs: result.metrics.durationMs || Date.now() - startedAt,
      reply: result.raw.slice(0, 120),
      usage: {
        inputTokens: result.metrics.inputTokens,
        outputTokens: result.metrics.outputTokens,
        totalTokens: result.metrics.totalTokens,
      },
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${providerLabel(provider)} 连通性测试超过 12 秒未返回。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function callModelWithPublicTrace(
  stage: PipelineEvent['stage'],
  label: string,
  messages: ChatMessage[],
  options: { temperature: number; apiKey?: string; model?: string; maxTokens?: number; timeoutMs?: number },
  emit: (event: PipelineEvent) => void,
  traceMessages: string[],
): Promise<LayerResult> {
  let index = 0
  const controller = options.timeoutMs ? new AbortController() : undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  const timer = setInterval(() => {
    const message = traceMessages[Math.min(index, traceMessages.length - 1)]
    index += 1
    emit({ type: 'stage_tick', stage, label, message })
  }, 2500)
  try {
    const call = callModel(messages, { ...options, debugLabel: label, signal: controller?.signal })
    const result = options.timeoutMs
      ? await Promise.race([
        call,
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => {
            const error = new Error(`${label} 超过 ${Math.round(Number(options.timeoutMs) / 1000)} 秒未完成，已中断。`)
            const file = writeLlmDebugFile({
              label: `${label}-timeout`,
              raw: '',
              messages,
              error,
            })
            controller?.abort()
            reject(new Error(`${error.message}；请求上下文已保存：${file}`))
          }, options.timeoutMs)
        }),
      ])
      : await call
    emit({
      type: 'stage_tick',
      stage,
      label,
      message: `耗时 ${(result.metrics.durationMs / 1000).toFixed(2)}s · 输出 ${result.metrics.outputTokens || result.metrics.estimatedOutputTokens} tokens`,
    })
    return result
  } finally {
    if (deadline) clearTimeout(deadline)
    clearInterval(timer)
  }
}

function buildRuntimeBlocks(input: GenerateRequest): {
  storyContext: string
  characterStatus: string
  recentTurns: string
} {
  const characterStatus = renderRelevantStatus(input)
  return {
    storyContext: String(input.storyContext || '').trim(),
    characterStatus,
    recentTurns: renderConversation(input.recentTurns),
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

function compactModuleType(value: unknown, fallback: string): string {
  const text = compactText(value, 16)
  if (/氛围|环境/.test(text)) return '氛围模块'
  if (/推进|行动|事件/.test(text)) return '推进模块'
  if (/插入|信息|角色|反应/.test(text)) return '插入模块'
  if (/结尾/.test(text)) return '结尾模块'
  return text || fallback
}

function compactDescriptionChain(value: unknown): string {
  if (typeof value === 'string') return compactText(value, 70)
  const record = compactRecord(value)
  const mode = compactText(record.mode || record.type || record.kind, 12)
  const objects = Array.isArray(record.objects)
    ? compactStringArray(record.objects, 2, 24)
    : compactStringArray(record.chain || record.object || record.target, 2, 24)
  const notes = compactText(record.notes || record.summary || record.goal || record.detail, 45)
  const chain = objects.length ? objects.join('→') : notes
  if (!mode) return chain
  return [mode, chain].filter(Boolean).join('｜')
}

function compactModuleBeat(value: unknown): string {
  if (typeof value === 'string') return compactText(value, 140)
  const record = compactRecord(value)
  const moduleType = compactModuleType(record.moduleType || record.type || record.kind || record.mode, '推进模块')
  const summary = compactText(record.summary || record.synopsis || record.event || record.goal || record.description, 80)
  const chain = compactDescriptionChain(record.descriptionChain || record.chain || record.focus)
  return [
    moduleType,
    summary,
    chain,
  ].filter(Boolean).join('｜')
}

function compactEndingBeat(value: unknown): string {
  if (typeof value === 'string') {
    const text = compactText(value, 140)
    if (!text) return ''
    return text.startsWith('结尾模块') ? text : `结尾模块｜${text}`
  }
  const record = compactRecord(value)
  const summary = compactText(record.summary || record.synopsis || record.event || record.goal || record.description, 80)
  const chain = compactDescriptionChain(record.descriptionChain || record.chain || record.focus)
  return [
    '结尾模块',
    summary,
    chain,
  ].filter(Boolean).join('｜')
}

function compactDirectorPlan(value: unknown): Record<string, unknown> {
  const source = compactRecord(value)
  return pruneEmpty({
    beats: (Array.isArray(source.beats) ? source.beats : Array.isArray(source.sceneBeats) ? source.sceneBeats : []).slice(0, 3).map(compactModuleBeat).filter(Boolean),
    ending: compactEndingBeat(source.ending || source.endingBeat || source.exitWindow),
    physicalConstraints: compactStringArray(source.physicalConstraints, 3, 80),
    mustNotResolve: compactStringArray(source.mustNotResolve, 3, 70),
  }) as Record<string, unknown>
}

function normalizeTurnSummary(value: unknown, finalText = ''): string {
  const summary = compactText(value, 45)
  if (summary) return summary
  return compactText(
    String(finalText || '')
      .replace(/\s+/g, ' ')
      .replace(/[。！？!?].*$/s, match => match.slice(0, 1)),
    35,
  )
}

function normalizeFeedbackBreakdown(value: Record<string, unknown>): Record<string, string> {
  const planExecutionFeedback = compactText(value.planExecutionFeedback, 160)
  const narrativeConstraintFeedback = compactText(value.narrativeConstraintFeedback, 160)
  const directorProgressFeedback = compactText(value.directorProgressFeedback, 160)
  return {
    planExecutionFeedback,
    narrativeConstraintFeedback,
    directorProgressFeedback,
  }
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
  storyContext: string
  characterStatus: string
  globalContext: string
  currentLongRangeOutline: string
  longRangeStatus: string
  turnSummary: string
  directorStyle?: string
}): string {
  return renderPromptTemplate('high-level-director.md', {
    currentLongRangeOutline: input.currentLongRangeOutline,
    storyContext: input.storyContext,
    characterStatus: input.characterStatus,
    longRangeStatus: input.longRangeStatus,
    globalContext: input.globalContext,
    turnSummary: input.turnSummary,
    directorStyle: input.directorStyle || '',
  })
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
    })),
  }
}

function buildDirectorPromptPayload(input: GenerateRequest, temperature: number): {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  globalContext: string
  feedbackMemory: string
  longRangeOutline: string
  turnIndex: number
  playerInput: string
  modules: UserModule[]
  directorUser: string
} {
  const context = buildRuntimeBlocks(input)
  const globalContext = input.globalContext || ''
  const feedbackMemory = String(input.feedbackText || '').trim()
  const longRangeOutline = String(input.longRangeOutline || '').trim()
  const directorStyle = renderMergedStyle(String(input.directorStyle || ''), input.userModules, 'director')
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const playerInput = input.playerInput.trim()
  const modules = input.userModules || []
  const model = normalizeModel(input.model)
  const directorUser = renderPromptTemplate('director.md', {
    storyContext: context.storyContext,
    characterStatus: context.characterStatus,
    globalContext,
    feedbackMemory,
    longRangeOutline: longRangeOutline || '（无。Director 只能规划本轮，不得生成剧情目标。）',
    directorStyle,
    playerInput,
  })
  return {
    model,
    temperature,
    context,
    globalContext,
    feedbackMemory,
    longRangeOutline,
    turnIndex,
    playerInput,
    modules,
    directorUser,
  }
}

function buildNarratorPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  feedbackMemory: string
  playerInput: string
  modules: UserModule[]
  directorPlan: Record<string, unknown>
}): {
  model: string
  temperature: number
  playerInput: string
  narratorUser: string
} {
  const narratorStyle = renderMergedStyle(String(input.narratorStyle || ''), options.modules, 'narrator')
  const narratorUser = renderPromptTemplate('narrator.md', {
    directorPlan: JSON.stringify(options.directorPlan),
    storyContext: options.context.storyContext,
    characterStatus: options.context.characterStatus,
    feedbackMemory: options.feedbackMemory,
    recentTurns: options.context.recentTurns,
    playerInput: options.playerInput,
    narratorStyle,
  })
  return {
    model: options.model,
    temperature: options.temperature,
    playerInput: options.playerInput || input.playerInput.trim(),
    narratorUser,
  }
}

function extractNarratorFinalText(entry: LayerResult): string {
  const json = entry.json
  const raw = entry.raw || ''
  return typeof json.draftText === 'string'
    ? json.draftText
    : String(raw)
}

function buildPostprocessPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature?: number
  playerInput: string
  finalText: string
  directorPlan: Record<string, unknown>
  context: ReturnType<typeof buildRuntimeBlocks>
  turnIndex: number
  longRangeOutline: string
}): {
  model: string
  temperature: number
  playerInput: string
  finalText: string
  postprocessUser: string
} {
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.5
  const statusModel = buildStatusModel(input)
  const postprocessUser = renderPromptTemplate('postprocess.md', {
    storyContext: String(input.storyContext || '').trim(),
    longRangeOutline: options.longRangeOutline,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    directorPlan: JSON.stringify(options.directorPlan),
    playerInput: options.playerInput,
    finalText: options.finalText,
  })
  return {
    model: options.model,
    temperature,
    playerInput: options.playerInput,
    finalText: options.finalText,
    postprocessUser,
  }
}

function buildEvaluationPromptPayload(input: EvaluationRequest, model: string): {
  model: string
  temperature: number
  playerInput: string
  finalText: string
  evaluatorUser: string
} {
  const playerInput = String(input.playerInput || '').trim()
  const finalText = String(input.finalText || '').trim()
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const context = buildRuntimeBlocks({
    playerInput,
    recentTurns: input.recentTurns,
    characters: input.characters,
    statusState: input.statusState,
  } as GenerateRequest)
  const statusModel = buildStatusModel(input)
  const evaluatorUser = renderPromptTemplate('evaluator.md', {
    playerInput,
    finalText,
    directorOutput: JSON.stringify(input.director || {}, null, 2),
    narratorOutput: JSON.stringify(input.narrator || {}, null, 2),
    postprocessOutput: JSON.stringify(input.postprocess || {}, null, 2),
    recentTurns: context.recentTurns,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    longRangeOutline: String(input.longRangeOutline || '').trim(),
    globalContext: String(input.globalContext || '').trim(),
    storyContext: String(input.storyContext || '').trim(),
    characterStatus: context.characterStatus,
    feedbackMemory: String(input.feedbackText || '').trim(),
    directorStyle: String(input.directorStyle || '').trim(),
    narratorStyle: String(input.narratorStyle || '').trim(),
    userModules: renderModulesForStage(input.userModules || [], 'director') + '\n\n' + renderModulesForStage(input.userModules || [], 'narrator'),
  })
  return {
    model,
    temperature: 0.2,
    playerInput,
    finalText,
    evaluatorUser,
  }
}

function delay(ms: number): Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), ms))
}

async function generate(
  input: GenerateRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const directorTemperature = Math.min(temperature, 0.4)
  const startedAt = Date.now()
  const model = normalizeModel(input.model)
  const directorPayload = buildDirectorPromptPayload(input, directorTemperature)
  const context = directorPayload.context
  const globalContext = directorPayload.globalContext
  const longRangeOutline = directorPayload.longRangeOutline
  const playerInput = directorPayload.playerInput
  const modules = directorPayload.modules
  const turnIndex = directorPayload.turnIndex

  emit({ type: 'stage_start', stage: 'director', label: 'Director', message: '导演层：规划本轮结构、节奏、线索和玩家窗口。' })
  const director = await callModelWithPublicTrace('director', 'Director', [
    { role: 'user', content: directorPayload.directorUser },
  ], { temperature: directorPayload.temperature, apiKey: input.apiKey, model, maxTokens: directorMaxTokens, timeoutMs: directorTimeoutMs }, emit, [
    '公开日志：正在判断玩家输入类型、承接边界和本轮互动入口。',
    '公开日志：正在安排剧情模块、推进速度和玩家下轮窗口。',
    '公开日志：正在检查人物知识边界、线索和不可提前解决的问题。',
    '公开日志：导演层仍在等待模型返回结构化计划。',
  ])
  let directorPlan = compactDirectorPlan(director.json)
  emit({ type: 'stage_result', stage: 'director', label: 'Director', message: '导演层完成：已得到压缩结构化计划。', json: directorPlan })

  let nextLongRangeOutline = longRangeOutline

  const narratorPayload = buildNarratorPromptPayload(input, {
    model,
    temperature,
    context,
    feedbackMemory: directorPayload.feedbackMemory,
    playerInput,
    modules,
    directorPlan,
  })

  emit({ type: 'stage_start', stage: 'narrator', label: 'Narrator', message: '叙事层：按导演计划写正文草稿。' })
  const narrator = await callModelWithPublicTrace('narrator', 'Narrator', [
    { role: 'user', content: narratorPayload.narratorUser },
  ], { temperature, apiKey: input.apiKey, model, maxTokens: narratorMaxTokens, timeoutMs: narratorTimeoutMs }, emit, [
    '公开日志：正在把导演计划转成可读正文，不更新人物状态。',
    '公开日志：正在平衡对话、动作、环境和心理描写。',
    '公开日志：正在检查是否替玩家做了长期选择。',
    '公开日志：叙事层仍在等待模型返回正文草稿。',
  ])
  emit({ type: 'stage_result', stage: 'narrator', label: 'Narrator', message: '叙事层完成：已得到正文草稿。', json: narrator.json })

  const finalText = extractNarratorFinalText(narrator)

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

  const postprocessPayload = buildPostprocessPromptPayload(input, {
    model,
    playerInput,
    finalText,
    directorPlan,
    context,
    turnIndex,
    longRangeOutline,
  })

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '后处理层：总结本轮正文，更新状态栏、写作负反馈、剧情目标判定和玩家选项。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', [
    { role: 'user', content: postprocessPayload.postprocessUser },
  ], { temperature: postprocessPayload.temperature, apiKey: input.apiKey, model }, emit, [
    '公开日志：正文已经可读，正在后台总结本轮事实。',
    '公开日志：正在后台更新人物状态。',
    '公开日志：正在按人物状态 Schema 更新人物状态。',
    '公开日志：正在生成写作负反馈和剧情目标判定。',
    '公开日志：正在生成 3 个玩家候选项。',
    '公开日志：后处理层仍在等待模型返回结构化状态。',
  ])
  const postprocessJson = postprocess.json
  const feedback = normalizeFeedbackBreakdown(postprocessJson)
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理完成：状态、负反馈和候选项已更新。', json: postprocessJson })

  let longRangeDirector: LayerResult | null = null
  const turnSummary = normalizeTurnSummary(postprocess.json.turnSummary, finalText)
  if (shouldRunLongRangeDirector(postprocess.json.longRangeStatus, longRangeOutline)) {
    const longRangeStatus = normalizeLongRangeStatus(postprocess.json.longRangeStatus, longRangeOutline)
    const longRangeDirectorUser = buildLongRangeDirectorUser({
      storyContext: input.storyContext || '',
      characterStatus: context.characterStatus,
      globalContext,
      currentLongRangeOutline: longRangeOutline,
      longRangeStatus,
      turnSummary,
      directorStyle: renderMergedStyle(String(input.directorStyle || ''), modules, 'director'),
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: '高级导演层：生成或修订当前剧情目标。' })
    try {
      longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', [
        { role: 'user', content: longRangeDirectorUser },
      ], { temperature: 0.6, apiKey: input.apiKey, model, maxTokens: 1200, timeoutMs: longRangeDirectorTimeoutMs }, emit, [
        '公开日志：正在判断当前剧情目标是否已完成、缺失或偏离。',
        '公开日志：正在生成可供后续多轮缓慢靠近的高层方向。',
        '公开日志：高级导演层仍在等待模型返回剧情目标。',
      ])
      nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, longRangeOutline)
      emit({ type: 'stage_result', stage: 'director', label: 'LongRangeDirector', message: '高级导演层完成：当前剧情目标已更新。', json: { longRangeOutline: nextLongRangeOutline } })
    } catch (error) {
      longRangeDirector = null
      emit({
        type: 'stage_skip',
        stage: 'director',
        label: 'LongRangeDirector',
        message: `高级导演层未返回，已跳过以免阻塞本轮：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const playerOptions = normalizePlayerOptions(postprocess.json.playerOptions)
  const nextStatusSchema = mergeStatusSchema(input.statusSchema, postprocess.json.statusSchemaPatch)
  const nextStatusRoster = mergeStatusRoster(input.statusRoster, postprocess.json.statusRosterPatch, input.characters || [], postprocess.json.statusStatePatch)
  const nextStatusState = mergeStatusState(input.statusState, postprocess.json.statusStatePatch, nextStatusRoster, input.characters || [])
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
    turnSummary,
    longRangeOutline: nextLongRangeOutline,
    planExecutionFeedback: feedback.planExecutionFeedback,
    narrativeConstraintFeedback: feedback.narrativeConstraintFeedback,
    directorProgressFeedback: feedback.directorProgressFeedback,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
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
  let directorPlan = compactDirectorPlan(director)
  const context = buildRuntimeBlocks({
    playerInput,
    recentTurns: input.recentTurns,
    characters: input.characters,
    statusState: input.statusState,
  } as GenerateRequest)
  const currentLongRangeOutline = String(input.longRangeOutline || '').trim()
  const statusModel = buildStatusModel(input)
  const postprocessUser = renderPromptTemplate('postprocess.md', {
    storyContext: String(input.storyContext || '').trim(),
    longRangeOutline: currentLongRangeOutline,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    directorPlan: JSON.stringify(directorPlan),
    playerInput,
    finalText,
  })

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '重试后处理层：补写本轮总结、状态栏、写作负反馈、剧情目标判定和玩家选项。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', [
    { role: 'user', content: postprocessUser },
  ], { temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在补跑上一轮失败的 Postprocess。',
    '公开日志：正在补写本轮事实总结。',
    '公开日志：正在按人物状态 Schema 更新人物状态。',
    '公开日志：正在补写写作负反馈和剧情目标判定。',
    '公开日志：正在生成 3 个玩家候选项。',
    '公开日志：Postprocess 重试仍在等待模型返回结构化状态。',
  ])
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理重试完成：状态、负反馈和候选项已更新。', json: postprocess.json })
  const feedback = normalizeFeedbackBreakdown(postprocess.json)

  let nextLongRangeOutline = currentLongRangeOutline
  let longRangeDirector: LayerResult | null = null
  const turnSummary = normalizeTurnSummary(postprocess.json.turnSummary, finalText)
  if (shouldRunLongRangeDirector(postprocess.json.longRangeStatus, currentLongRangeOutline)) {
    const longRangeStatus = normalizeLongRangeStatus(postprocess.json.longRangeStatus, currentLongRangeOutline)
    const longRangeDirectorUser = buildLongRangeDirectorUser({
      storyContext: input.storyContext || '',
      characterStatus: context.characterStatus,
      globalContext: String(input.globalContext || '').trim(),
      currentLongRangeOutline,
      longRangeStatus,
      turnSummary,
      directorStyle: renderMergedStyle(String(input.directorStyle || ''), input.userModules || [], 'director'),
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: '高级导演层：生成或修订当前剧情目标。' })
    try {
      longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', [
        { role: 'user', content: longRangeDirectorUser },
      ], { temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.6, apiKey: input.apiKey, model, maxTokens: 1200, timeoutMs: longRangeDirectorTimeoutMs }, emit, [
        '公开日志：正在补跑剧情目标生成/修订。',
        '公开日志：正在生成可供后续多轮缓慢靠近的高层方向。',
        '公开日志：高级导演层仍在等待模型返回剧情目标。',
      ])
      nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, currentLongRangeOutline)
      emit({ type: 'stage_result', stage: 'director', label: 'LongRangeDirector', message: '高级导演层完成：当前剧情目标已更新。', json: { longRangeOutline: nextLongRangeOutline } })
    } catch (error) {
      longRangeDirector = null
      emit({
        type: 'stage_skip',
        stage: 'director',
        label: 'LongRangeDirector',
        message: `高级导演层未返回，已跳过以免阻塞本轮：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  const nextStatusSchema = mergeStatusSchema(input.statusSchema, postprocess.json.statusSchemaPatch)
  const nextStatusRoster = mergeStatusRoster(input.statusRoster, postprocess.json.statusRosterPatch, input.characters || [], postprocess.json.statusStatePatch)
  const nextStatusState = mergeStatusState(input.statusState, postprocess.json.statusStatePatch, nextStatusRoster, input.characters || [])
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
    turnSummary,
    longRangeOutline: nextLongRangeOutline,
    planExecutionFeedback: feedback.planExecutionFeedback,
    narrativeConstraintFeedback: feedback.narrativeConstraintFeedback,
    directorProgressFeedback: feedback.directorProgressFeedback,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
    metrics,
    model,
  }
}

async function runEvaluation(
  input: EvaluationRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const playerInput = String(input.playerInput || '').trim()
  const finalText = String(input.finalText || '').trim()
  if (!playerInput) throw new Error('playerInput is required')
  if (!finalText) throw new Error('finalText is required')

  const model = normalizeModel(input.model)
  const startedAt = Date.now()
  const material = writeEvaluationMaterialFile(input, model)
  const evaluatorPayload = material.evaluatorPayload
  const evaluationTarget = input.evaluationTarget === 'codex' ? 'codex' : 'external-api'

  if (evaluationTarget === 'codex') {
    emit({
      type: 'stage_start',
      stage: 'evaluator',
      label: 'Evaluator',
      message: '评估层：正在把完整评估材料写给 Codex。',
    })
    const evaluationFile = writeCodexEvaluationRequestFile({
      model,
      storyId: input.storyId,
      storyName: input.storyName,
      playerInput,
      finalText,
      evaluatorPrompt: evaluatorPayload.evaluatorUser,
      materialFile: material.file,
    })
    const evaluation = {
      score: null,
      summary: '评估材料已写入本地，等待 Codex 读取后评估。',
      issues: [],
      strengths: [],
      nextActions: ['在 Codex 对话里说“看最新评估”。'],
      doNotAutoChange: true,
    }
    emit({
      type: 'stage_result',
      stage: 'evaluator',
      label: 'Evaluator',
      message: `Codex 待评估材料已写入：${evaluationFile}`,
      json: evaluation,
    })
    return {
      pipelineMode: 'codex-evaluation-request',
      evaluation,
      evaluatorPrompt: evaluatorPayload.evaluatorUser,
      evaluationMaterialFile: material.file,
      latestEvaluationMaterialFile: material.latestFile,
      evaluationFile,
      latestEvaluationFile: 'debug/evaluations/latest.json',
      metrics: buildInteractionMetrics({
        model,
        startedAt,
        stages: [],
        finalText: '',
      }),
      model,
    }
  }

  emit({
    type: 'stage_start',
    stage: 'evaluator',
    label: 'Evaluator',
    message: '评估层：读取本轮输入、正文、流水线输出和状态，生成质量报告。',
  })
  const evaluation = await callModelWithPublicTrace('evaluator', 'Evaluator', [
    { role: 'user', content: evaluatorPayload.evaluatorUser },
  ], { temperature: evaluatorPayload.temperature, apiKey: input.apiKey, model }, emit, [
    '公开日志：正在核对本轮正文和导演计划。',
    '公开日志：正在检查剧情推进、人物独立性和空间物理逻辑。',
    '公开日志：正在检查状态更新、剧情闭环和玩家选项质量。',
    '公开日志：评估层仍在等待模型返回结构化报告。',
  ])
  emit({
    type: 'stage_result',
    stage: 'evaluator',
    label: 'Evaluator',
    message: '评估完成：报告已生成，等待人工判断。',
    json: evaluation.json,
  })

  const reportText = JSON.stringify(evaluation.json, null, 2)
  const metrics = buildInteractionMetrics({
    model,
    startedAt,
    stages: [evaluation],
    finalText: reportText,
  })
  const evaluationFile = writeEvaluationDebugFile({
    model,
    storyId: input.storyId,
    storyName: input.storyName,
    playerInput,
    finalText,
    evaluatorPrompt: evaluatorPayload.evaluatorUser,
    evaluation: evaluation.json,
    metrics,
    materialFile: material.file,
  })
  return {
    pipelineMode: 'evaluation',
    evaluation: evaluation.json,
    evaluatorPrompt: evaluatorPayload.evaluatorUser,
    evaluationMaterialFile: material.file,
    latestEvaluationMaterialFile: material.latestFile,
    evaluationFile,
    latestEvaluationFile: 'debug/evaluations/latest.json',
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
  const modules = userConfigDirs
    .filter(dir => fs.existsSync(dir))
    .flatMap(dir => walkUserConfigFiles(dir))
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
  const relativePath = path.relative(promptDir, filePath)
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
    file: `prompts/${relativePath}`,
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
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': 'no-store, max-age=0',
  })
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
          { id: officialDeepSeekV4FlashModel, label: 'DeepSeek V4 Flash (Official)', provider: 'deepseek' },
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

    if (req.method === 'GET' && url.pathname === '/api/evaluation-latest') {
      sendJson(res, 200, readLatestEvaluationArtifacts())
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/provider-test') {
      const body = await readBody(req)
      const input = JSON.parse(body) as ProviderTestRequest
      sendJson(res, 200, await testProvider(input))
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

    const storyConfigMatch = url.pathname.match(/^\/api\/story-assets\/([^/]+)\/program-config$/)
    if (req.method === 'PUT' && storyConfigMatch) {
      const body = await readBody(req)
      const input = JSON.parse(body) as Partial<StoryProgramConfig>
      const config = updateStoryAssetProgramConfig(decodeURIComponent(storyConfigMatch[1] || ''), input)
      sendJson(res, 200, { ok: true, config })
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

    if (req.method === 'POST' && url.pathname === '/api/evaluation-material') {
      const body = await readBody(req)
      const input = JSON.parse(body) as EvaluationRequest
      if (!input.playerInput?.trim()) {
        sendJson(res, 400, { error: 'playerInput is required' })
        return
      }
      if (!input.finalText?.trim()) {
        sendJson(res, 400, { error: 'finalText is required' })
        return
      }
      const material = writeEvaluationMaterialFile(input, normalizeModel(input.model))
      sendJson(res, 200, {
        ok: true,
        evaluationMaterialFile: material.file,
        latestEvaluationMaterialFile: material.latestFile,
        evaluatorPrompt: material.evaluatorPayload.evaluatorUser,
        material: material.payload,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/evaluate-stream') {
      const body = await readBody(req)
      const input = JSON.parse(body) as EvaluationRequest
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
        const result = await runEvaluation(input, writePipelineEvent)
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
