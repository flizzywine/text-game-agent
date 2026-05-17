import fs from 'fs'
import http from 'http'
import path from 'path'
import crypto from 'crypto'
import { parseJsonObject } from '../src/jsonObjectParser'
import { mergeItemState, renderItemState } from '../src/itemState'
import {
  mergeLongTermState,
  normalizeKeyInfo,
  normalizeLongTermState,
  normalizePhysicalConstraintList,
  renderLongTermState,
} from '../src/longTermState'
import {
  buildStatusModel,
  fallbackStatusSchema,
  mergeStatusRoster,
  mergeStatusSchema,
  mergeStatusState,
  normalizeControlledCharacterName,
  normalizePlayableCharacters,
  normalizeStatusRoster,
  normalizeStatusSchema,
  normalizeStatusState,
  normalizeStatusStatePatchSubjects,
  renderRelevantStatus,
} from '../src/status'
import {
  appendRawTurnLog,
  appendTurnSummary,
  appendTurnSummaryL2,
  readTurnSummaries,
  readTurnSummaryL2,
  readStoryTurnsByIndex,
  buildRecallSnippetBlock,
  renderHistoricalSummariesWithL2,
  renderStoryTextEntry,
  renderTurnSummariesFile,
  turnSummaryL2Path,
  turnSummariesPath,
  type RawTurnLogEntry,
  type RecallResult,
} from '../src/recall'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
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
  gender?: string
  role?: string
  mood?: string
  location?: string
  health?: string
  trust?: string
  appearance?: string
  personality?: string
  notes?: string
}

interface ConversationItem {
  role: 'user' | 'assistant'
  content: string
}

interface PipelineContext {
  storyId?: string
  storyName?: string
  globalContext?: string
  storyContext?: string
  playerFeedback?: string
  controlledCharacterName?: string
  feedbackText?: string
  planFeedback?: unknown
  physicalConstraints?: unknown
  longTermState?: unknown
  keyInfo?: unknown
  directorStyle?: string
  narratorStyle?: string
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  statusSchema?: string[]
  statusRoster?: string[]
  statusState?: Record<string, Record<string, string>>
  itemState?: Record<string, Record<string, string>>
  model?: string
  pipelineModels?: Record<string, string>
  apiKey?: string
  apiKeys?: Record<string, string>
  temperature?: number
  reasoningEffort?: string
  recallEvidence?: string
}

interface GenerateRequest extends PipelineContext {
  playerInput: string
  director?: Record<string, unknown>
  recentDirectorPlans?: unknown[]
  turnIndex?: number
}

interface PostprocessRequest extends PipelineContext {
  playerInput: string
  finalText: string
  director?: Record<string, unknown>
  recentDirectorPlans?: unknown[]
  playerOptions?: unknown[]
  turnIndex?: number
  summaryOnly?: boolean
}

interface ProviderTestRequest {
  model?: string
  apiKey?: string
  reasoningEffort?: string
}

interface ProviderSpeedTestRequest {
  model?: string
  apiKey?: string
  reasoningEffort?: string
}

interface InterceptionPromptRequest extends PipelineContext {
  playerInput?: string
  director?: Record<string, unknown>
  finalText?: string
}

interface InterceptionTestRequest {
  model?: string
  apiKey?: string
  temperature?: number
  reasoningEffort?: string
  systemInstruction?: string
  narratorSystem?: string
  narratorUser?: string
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
  apiKeys?: Record<string, string>
  model?: string
  pipelineModels?: Record<string, string>
  reasoningEffort?: string
  force?: boolean
}

interface ReviseProgramConfigRequest extends PipelineContext {
  revisionFeedback?: string
}

interface OpeningSummaryRequest extends PipelineContext {
  assetId?: string
  openingText?: string
  storyContext?: string
}

interface PlayerOption {
  inputText: string
}

interface StoryProgramConfig {
  sourceName: string
  generatedAt: string
  openingText: string
  openingSummary?: string
  worldview: string
  statusSchema: string[]
  statusRoster: string[]
  statusState: Record<string, Record<string, string>>
  itemState?: Record<string, Record<string, string>>
  playableCharacters: string[]
  directorStyle?: string
  narratorStyle?: string
  initialPlayerOptions: PlayerOption[]
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
  ttftMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedOutputTokens: number
}

interface PipelineEvent {
  type: 'stage_start' | 'stage_tick' | 'stage_result' | 'stage_skip' | 'visible_text'
  stage: 'initializer' | 'recall' | 'director' | 'planFeedback' | 'narrator' | 'postprocess' | 'postprocessSummary'
  label: string
  message?: string
  json?: Record<string, unknown> | null
  payload?: Record<string, unknown>
}

interface SaveSlotRecord {
  id: string
  slotKind: string
  name: string
  savedAt: string
  updatedAt: string
  favorite: boolean
  storyName: string
  turnIndex: number
  saveEvaluation: string
  saveEvaluationStatus: string
  state: unknown
}

type ModelProvider = 'deepseek' | 'infron'
type PipelineStage = 'initializer' | 'director' | 'narrator' | 'postprocess'
type RuntimePipelineStage = PipelineEvent['stage']

const rootDir = process.cwd()
const webDir = path.join(rootDir, 'web')
const promptDir = path.join(rootDir, 'prompts')
const storyDir = path.join(rootDir, 'story')
const docsDir = path.join(rootDir, 'docs')
const saveDir = path.join(rootDir, 'save')
const saveSlotsDir = path.join(saveDir, 'slots')
const currentAutoSlotId = '当前游玩'
const legacyStorySaveDir = path.join(saveDir, 'stories')
const providerApiKeysFile = path.join(saveDir, 'provider-api-keys.json')
const debugDir = path.join(rootDir, 'debug')
const llmDebugDir = path.join(debugDir, 'llm-raw')
const interceptionDebugDir = path.join(debugDir, 'content-interception')
const speedTestRecordFile = path.join(docsDir, '模型速度测试记录.md')
const saveFile = path.join(saveDir, 'current-state.json')
const syntheticContentInterceptionInput = '内容拦截测试：使用当前存档状态生成 Narrator prompt。'
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const infronGemini31FlashLiteModel = 'google/gemini-3.1-flash-lite'
const defaultModel = officialDeepSeekV4FlashModel
const modelCatalog: Array<{ id: string; label: string; provider: ModelProvider }> = [
  { id: officialDeepSeekV4FlashModel, label: 'DeepSeek V4 Flash | official | DeepSeek', provider: 'deepseek' },
  { id: officialDeepSeekV4ProModel, label: 'DeepSeek V4 Pro | official | DeepSeek', provider: 'deepseek' },
  { id: infronGemini31FlashLiteModel, label: 'Gemini 3.1 Flash Lite | Infron', provider: 'infron' },
]
const modelIds = new Set(modelCatalog.map(item => item.id))
const pipelineStages: PipelineStage[] = ['initializer', 'director', 'narrator', 'postprocess']
const generationPipeline: {
  mode: string
  note: string
  stages: Array<{ stage: RuntimePipelineStage; label: string }>
} = {
  mode: 'director+feedback+narrator+summary-queued+recall-worker',
  note: 'Director 生成计划；Feedback 审查导演计划；Narrator 输出正文和候选项；Summary 后台更新总结和状态；RecallWorker 旁路选择旧轮次并预取最多两轮正文。',
  stages: [
    { stage: 'director', label: 'Director' },
    { stage: 'planFeedback', label: 'Feedback' },
    { stage: 'narrator', label: 'Narrator' },
    { stage: 'postprocessSummary', label: 'Summary' },
  ],
}
const postprocessPipeline = {
  mode: 'summary-retry',
  note: 'Summary 会重新整理总结和状态，用于修复后台总结失败。',
  stages: [{ stage: 'postprocessSummary', label: 'Summary' }],
}
const defaultDeepSeekBaseUrl = 'https://api.deepseek.com'
const defaultInfronBaseUrl = 'https://llm.onerouter.pro/v1'
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300_000)
const directorTimeoutMs = Number(process.env.DIRECTOR_TIMEOUT_MS || 300_000)
const narratorTimeoutMs = Number(process.env.NARRATOR_TIMEOUT_MS || 120_000)
const postprocessTimeoutMs = Number(process.env.POSTPROCESS_TIMEOUT_MS || 120_000)
const providerFetchRetryCount = Number(process.env.LLM_FETCH_RETRY_COUNT || 2)
const providerFetchRetryDelayMs = Number(process.env.LLM_FETCH_RETRY_DELAY_MS || 1200)
const providerConnectivityTimeoutMs = Number(process.env.PROVIDER_CONNECTIVITY_TIMEOUT_MS || 30_000)
const providerSpeedTestTimeoutMs = Number(process.env.PROVIDER_SPEED_TEST_TIMEOUT_MS || 100_000)
const defaultMaxTokens = Number(process.env.LLM_MAX_TOKENS || 8192)
const initializerMaxTokens = Number(process.env.INITIALIZER_MAX_TOKENS || defaultMaxTokens)
const directorMaxTokens = Number(process.env.DIRECTOR_MAX_TOKENS || 6000)
const narratorMaxTokens = Number(process.env.NARRATOR_MAX_TOKENS || 12000)
const postprocessMaxTokens = Number(process.env.POSTPROCESS_MAX_TOKENS || defaultMaxTokens)
const port = Number(process.env.PORT || 4173)
const localEnv = readDotEnv(path.join(rootDir, '.env.local'))

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

function buildPipelineModels(requestedModel = defaultModel, overrides?: unknown): Record<PipelineStage, string> {
  const selectedModel = normalizeModel(requestedModel)
  const record = overrides && typeof overrides === 'object' ? overrides as Record<string, unknown> : {}
  return Object.fromEntries(
    pipelineStages.map(stage => [stage, record[stage] ? normalizeModel(record[stage]) : selectedModel]),
  ) as Record<PipelineStage, string>
}

function providerForModel(model: string): ModelProvider {
  const normalized = normalizeModel(model)
  return modelCatalog.find(item => item.id === normalized)?.provider || 'deepseek'
}

function normalizeProvider(value: unknown): ModelProvider {
  return value === 'infron' ? 'infron' : 'deepseek'
}

function providerLabel(provider: ModelProvider): string {
  return {
    deepseek: 'DeepSeek Official',
    infron: 'Infron',
  }[provider]
}

function providerBaseUrl(provider: ModelProvider): string {
  const value = provider === 'infron'
    ? env('INFRON_BASE_URL') || defaultInfronBaseUrl
    : env('DEEPSEEK_BASE_URL') || defaultDeepSeekBaseUrl
  return value.replace(/\/+$/, '')
}

function providerApiKey(provider: ModelProvider, explicitKey?: string): string {
  const saved = readSavedProviderApiKeys()
  const key = explicitKey?.trim() || (
    provider === 'infron'
      ? saved.infron || env('INFRON_API_KEY') || env('ONEROUTER_API_KEY')
      : saved.deepseek || env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY')
  )
  if (key) return key
  throw new Error(`missing ${provider === 'infron' ? 'INFRON_API_KEY' : 'DEEPSEEK_API_KEY'}`)
}

function pipelineApiKeyForModel(input: PipelineContext, model: string): string | undefined {
  const provider = providerForModel(model)
  const keyed = input.apiKeys?.[provider]
  if (typeof keyed === 'string' && keyed.trim()) return keyed
  const selectedProvider = providerForModel(normalizeModel(input.model))
  return provider === selectedProvider ? input.apiKey : undefined
}

function providerHasApiKey(provider: ModelProvider): boolean {
  const saved = readSavedProviderApiKeys()
  return provider === 'infron'
    ? Boolean(saved.infron || env('INFRON_API_KEY') || env('ONEROUTER_API_KEY'))
    : Boolean(saved.deepseek || env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY'))
}

function normalizeReasoningEffort(value: unknown): string {
  void value
  return ''
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

function delay(ms: number): Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), ms))
}

async function readResponseTextWithTimeout(
  response: Response,
  controller: AbortController,
  timer: ReturnType<typeof setTimeout>,
  unlinkAbortSignal: () => void,
): Promise<string> {
  try {
    return await response.text()
  } finally {
    unlinkAbortSignal()
    clearTimeout(timer)
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
  fs.mkdirSync(docsDir, { recursive: true })
  fs.mkdirSync(saveDir, { recursive: true })
  fs.mkdirSync(saveSlotsDir, { recursive: true })
  fs.mkdirSync(llmDebugDir, { recursive: true })
  fs.mkdirSync(interceptionDebugDir, { recursive: true })
}

function safeName(value: string, fallback = 'untitled'): string {
  return (value || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback
}

function shortStoryId(storyId: unknown): string {
  const value = String(storyId || 'current-story')
    .replace(/^story-slot[.-]?/i, '')
    .replace(/[^A-Za-z0-9_-]/g, '')
  return value.slice(0, 8) || 'current'
}

function formatSlotTimeForName(value: unknown): string {
  const date = new Date(String(value || ''))
  const valid = Number.isFinite(date.getTime()) ? date : new Date()
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(valid)
  const part = (type: string): string => parts.find(item => item.type === type)?.value || '00'
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}_${part('minute')}_${part('second')}`
}

function slotDirNameFromTimeAndName(time: unknown, name: unknown): string {
  const slotName = String(name || '未命名存档').trim() || '未命名存档'
  return safeName(`${formatSlotTimeForName(time)}-${slotName}`, 'current-story')
}

function currentStorySlotDirName(story: Record<string, unknown>): string {
  const name = String(story.name || story.storyName || '未命名故事').trim() || '未命名故事'
  return slotDirNameFromTimeAndName(story.createdAt || story.updatedAt, name)
}

function currentAutoSlotDir(): string {
  return saveSlotDir(currentAutoSlotId)
}

function isCurrentAutoSlotId(id: unknown): boolean {
  return sanitizeSaveSlotId(String(id || '')) === currentAutoSlotId
}

function saveSlotDir(id: string): string {
  const safeId = sanitizeSaveSlotId(id)
  if (!safeId) throw new Error('存档不存在。')
  const dirPath = path.normalize(path.join(saveSlotsDir, safeId))
  if (!isInsidePath(saveSlotsDir, dirPath)) throw new Error('存档路径无效。')
  return dirPath
}

function saveSlotFile(id: string): string {
  return path.join(saveSlotDir(id), 'slot.json')
}

function legacySaveSlotFile(id: string): string {
  const safeId = sanitizeSaveSlotId(id)
  if (!safeId) throw new Error('存档不存在。')
  const filePath = path.normalize(path.join(saveSlotsDir, `${safeId}.json`))
  if (!isInsidePath(saveSlotsDir, filePath)) throw new Error('存档路径无效。')
  return filePath
}

function storyFromSlotRecord(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null
  const state = value.state === undefined ? value : value.state
  if (!isPlainRecord(state)) return null
  const story = isPlainRecord(state.story) ? state.story : state
  return isPlainRecord(story) ? story : null
}

function slotRecordStoryId(value: Record<string, unknown>): string {
  return String(storyFromSlotRecord(value)?.id || '').trim()
}

function findSlotDirByStoryId(storyId: unknown): string | null {
  const target = String(storyId || '').trim()
  if (!target || !fs.existsSync(saveSlotsDir)) return null
  const currentDir = currentAutoSlotDir()
  const currentRecord = readJsonFileIfExists(path.join(currentDir, 'slot.json'))
  if (currentRecord && slotRecordStoryId(currentRecord) === target) return currentDir
  const matches: string[] = []
  for (const entry of fs.readdirSync(saveSlotsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const record = readJsonFileIfExists(path.join(saveSlotsDir, entry.name, 'slot.json'))
        || readJsonFileIfExists(path.join(saveSlotsDir, entry.name, 'story.json'))
      if (record && slotRecordStoryId(record) === target) matches.push(path.join(saveSlotsDir, entry.name))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const record = readJsonFileIfExists(path.join(saveSlotsDir, entry.name))
      const migratedDir = path.join(saveSlotsDir, path.basename(entry.name, '.json'))
      if (record && slotRecordStoryId(record) === target && fs.existsSync(migratedDir)) matches.push(migratedDir)
    }
  }
  return matches.find(item => readJsonFileIfExists(path.join(item, 'slot.json'))?.saveEvaluationStatus === 'current') || matches[0] || null
}

function findLegacyStoryDirById(storyId: unknown): string | null {
  const safeId = safeName(String(storyId || 'current-story'), 'current-story')
  const shortId = shortStoryId(storyId)
  if (!fs.existsSync(legacyStorySaveDir)) return null
  const dirs = fs.readdirSync(legacyStorySaveDir, { withFileTypes: true }).filter(item => item.isDirectory())
  const readable = dirs.find(item => item.name.endsWith(`__${shortId}`))
  if (readable) return path.join(legacyStorySaveDir, readable.name)
  const exact = dirs.find(item => item.name === safeId)
  if (exact) return path.join(legacyStorySaveDir, exact.name)
  return null
}

function storyDebugDirForStory(story: Record<string, unknown>): string {
  return currentAutoSlotDir()
}

function storyMemoryDirForId(storyId: unknown, storyName?: unknown): string {
  const storyDirPath = findSlotDirByStoryId(storyId)
    || findLegacyStoryDirById(storyId)
    || path.join(saveSlotsDir, currentStorySlotDirName({
      id: storyId,
      name: storyName || '未命名故事',
    }))
  return path.join(storyDirPath, 'memory')
}

function storyRawTurnLogFile(storyId: unknown, storyName?: unknown): string {
  return path.join(storyMemoryDirForId(storyId, storyName), 'raw-turns.jsonl')
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function readSavedProviderApiKeys(): Partial<Record<ModelProvider, string>> {
  try {
    const raw = readJsonFileIfExists(providerApiKeysFile)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const record = raw as Record<string, unknown>
    return {
      deepseek: String(record.deepseek || '').trim(),
      infron: String(record.infron || '').trim(),
    }
  } catch {
    return {}
  }
}

function writeSavedProviderApiKey(provider: ModelProvider, key: unknown): void {
  ensureDataDirs()
  const value = String(key || '').trim()
  if (!value) throw new Error('API Key 不能为空。')
  if (provider === 'deepseek' && !/^sk-[A-Za-z0-9_-]{16,}$/.test(value)) {
    throw new Error('API Key 格式不对。DeepSeek key 通常以 sk- 开头。')
  }
  const current = readSavedProviderApiKeys()
  writeJsonFile(providerApiKeysFile, compactProviderApiKeys({
    ...current,
    [provider]: value,
  }))
  try {
    fs.chmodSync(providerApiKeysFile, 0o600)
  } catch {
    // Best effort: the save directory is already gitignored.
  }
}

function deleteSavedProviderApiKey(provider: ModelProvider): void {
  ensureDataDirs()
  const current = readSavedProviderApiKeys()
  delete current[provider]
  writeJsonFile(providerApiKeysFile, compactProviderApiKeys(current))
  try {
    fs.chmodSync(providerApiKeysFile, 0o600)
  } catch {
    // Best effort.
  }
}

function compactProviderApiKeys(value: Partial<Record<ModelProvider, string>>): Partial<Record<ModelProvider, string>> {
  return Object.fromEntries(Object.entries(value).filter(([, key]) => String(key || '').trim())) as Partial<Record<ModelProvider, string>>
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

function writeDebugTextArtifact(dir: string, suffix: string, content: string): string {
  ensureDataDirs()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(dir, `${stamp}-${safeName(suffix, 'artifact')}.md`)
  fs.writeFileSync(filePath, content, 'utf-8')
  return path.relative(rootDir, filePath)
}

function looksLikeHtmlResponse(value: string): boolean {
  const text = value.trim().slice(0, 300).toLowerCase()
  return text.startsWith('<!doctype html')
    || text.startsWith('<html')
    || text.startsWith('<!--[if')
    || /<title>[^<]*(524|timeout|cloudflare|onerouter)/i.test(value.slice(0, 1000))
}

function describeHtmlGatewayError(value: string): string {
  const title = value.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim()
  return title || '网关返回 HTML 错误页'
}

function appendSpeedTestRecord(input: {
  providerLabel: string
  model: string
  durationMs: number
  ttftMs: number
  generationMs: number
  tps: number
  outputTokens: number
  reply: string
}): void {
  ensureDataDirs()
  const timestamp = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
  if (!fs.existsSync(speedTestRecordFile)) {
    fs.writeFileSync(speedTestRecordFile, [
      '# 模型速度测试记录',
      '',
      '备注：连通性测试、速度测试、内容拦截测试是三个独立入口；速度数据以“速度测试”为准，不用短输出连通性测试推算 TPS。',
      '',
    ].join('\n'), 'utf-8')
  }
  const record = [
    '',
    `## ${timestamp}`,
    '',
    '- 测试模块：模型管理页的“速度测试”',
    '- 测试方式：流式输出长文本，按首个 token 到达计算 TTFT，按首 token 后的生成耗时计算 TPS',
    `- Provider：${input.providerLabel}`,
    `- 模型：\`${input.model}\``,
    `- 总耗时：${Math.round(input.durationMs)} ms`,
    `- TTFT：${Math.round(input.ttftMs)} ms`,
    `- 生成耗时：${Math.round(input.generationMs)} ms`,
    `- TPS：${input.tps}`,
    `- 输出 tokens：${input.outputTokens}`,
    `- 返回预览：${input.reply.replace(/\s+/g, ' ').trim().slice(0, 120)}`,
    '',
  ].join('\n')
  fs.appendFileSync(speedTestRecordFile, record, 'utf-8')
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

function readSaveState(): unknown | null {
  ensureDataDirs()
  if (!fs.existsSync(saveFile)) return null
  return unwrapSaveStateEnvelope(JSON.parse(fs.readFileSync(saveFile, 'utf-8')))
}

function writeSaveState(value: unknown): void {
  ensureDataDirs()
  const existing = readSaveState()
  const incoming = unwrapSaveStateEnvelope(value)
  clearCurrentStoryMemoryArtifactsOnStorySwitch(existing, incoming)
  const merged = mergeSaveStateForWrite(existing, incoming)
  writeJsonFile(saveFile, merged)
  materializeStoryMemoryFromSaveState(merged)
}

function clearCurrentStoryMemoryArtifactsOnStorySwitch(existing: unknown, incoming: unknown): void {
  const existingId = currentStoryIdFromSaveState(existing)
  const incomingId = currentStoryIdFromSaveState(incoming)
  if (!existingId || !incomingId || existingId === incomingId) return
  const memoryDir = path.join(currentAutoSlotDir(), 'memory')
  for (const filename of ['recall-cache.json', 'recall-worker-events.jsonl', 'turn-summaries-l2.txt']) {
    const filePath = path.join(memoryDir, filename)
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
  }
}

function currentStoryIdFromSaveState(value: unknown): string {
  const root = isPlainRecord(value) && isPlainRecord(value.state) ? value.state : value
  if (!isPlainRecord(root)) return ''
  const explicit = String(root.currentStoryId || '').trim()
  if (explicit) return explicit
  const stories = extractStoriesFromSaveState(root)
  return String(stories[0]?.id || '').trim()
}

function unwrapSaveStateEnvelope(value: unknown): unknown {
  let current = value
  for (let i = 0; i < 4; i += 1) {
    if (!isPlainRecord(current)) break
    const keys = Object.keys(current)
    if (keys.length !== 1 || !isPlainRecord(current.state)) break
    current = current.state
  }
  return current
}

function mergeSaveStateForWrite(existing: unknown, incoming: unknown): unknown {
  if (!isPlainRecord(existing) || !isPlainRecord(incoming)) return incoming
  if (!Array.isArray(existing.stories) || !Array.isArray(incoming.stories)) return incoming
  const existingById = new Map<string, Record<string, unknown>>()
  for (const story of existing.stories) {
    if (!isPlainRecord(story)) continue
    const id = String(story.id || '')
    if (id) existingById.set(id, story)
  }
  return {
    ...incoming,
    stories: incoming.stories.map(story => {
      const id = isPlainRecord(story) ? String(story.id || '') : ''
      return mergeStoryForWrite(existingById.get(id), story)
    }),
  }
}

function mergeStoryForWrite(existing: Record<string, unknown> | undefined, incoming: unknown): unknown {
  if (!existing || !isPlainRecord(incoming)) return incoming
  const existingFeedbackAt = Date.parse(String(existing.playerFeedbackUpdatedAt || existing.updatedAt || ''))
  const incomingFeedbackAt = Date.parse(String(incoming.playerFeedbackUpdatedAt || incoming.updatedAt || ''))
  if (Number.isFinite(existingFeedbackAt) && Number.isFinite(incomingFeedbackAt) && existingFeedbackAt > incomingFeedbackAt) {
    return {
      ...incoming,
      playerFeedback: String(existing.playerFeedback || ''),
      playerFeedbackUpdatedAt: String(existing.playerFeedbackUpdatedAt || existing.updatedAt || ''),
    }
  }
  return incoming
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function materializeStoryMemoryFromSaveState(value: unknown): void {
  const root = isPlainRecord(value) && isPlainRecord(value.state) ? value.state : value
  const currentStoryId = isPlainRecord(root) ? String(root.currentStoryId || '') : ''
  pruneObsoleteAutoSlots()
  for (const story of extractStoriesFromSaveState(value)) {
    if (currentStoryId && String(story.id || '') !== currentStoryId) continue
    materializeStoryMemory(story, currentStoryId)
  }
}

function pruneObsoleteAutoSlots(): void {
  if (!fs.existsSync(saveSlotsDir)) return
  for (const entry of fs.readdirSync(saveSlotsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (isCurrentAutoSlotId(entry.name)) continue
    const filePath = path.join(saveSlotsDir, entry.name, 'slot.json')
    const slot = readJsonFileIfExists(filePath)
    if (!slot || !isObsoleteAutoSlot(slot, entry.name)) continue
    fs.rmSync(path.join(saveSlotsDir, entry.name), { recursive: true, force: true })
  }
}

function isObsoleteAutoSlot(slot: Record<string, unknown>, fallbackId: string): boolean {
  const normalized = normalizeSaveSlotRecord(slot, fallbackId)
  if (normalized.slotKind === 'current') return true
  return normalized.saveEvaluationStatus === 'done'
    && !normalized.saveEvaluation
    && !normalized.favorite
    && normalized.name === normalized.storyName
}

function extractStoriesFromSaveState(value: unknown): Record<string, unknown>[] {
  const root = isPlainRecord(value) && isPlainRecord(value.state) ? value.state : value
  if (!isPlainRecord(root)) return []
  if (Array.isArray(root.stories)) return root.stories.filter(isPlainRecord)
  const story = isPlainRecord(root.story) ? root.story : root
  return isPlainRecord(story) ? [story] : []
}

function materializeStoryMemory(story: Record<string, unknown>, currentStoryId = '', targetDir?: string): void {
  const storyId = String(story.id || '').trim()
  if (!storyId) return
  const messages = Array.isArray(story.messages) ? story.messages : []
  const entries: RawTurnLogEntry[] = []
  const openingText = String(story.openingText || '').trim()
  if (openingText) {
    entries.push({
      storyId,
      storyName: String(story.name || story.storyName || ''),
      turnIndex: 0,
      playerInput: '（开场）',
      finalText: openingText,
      createdAt: String(story.createdAt || story.updatedAt || new Date().toISOString()),
    })
  }
  let pendingPlayerInput = ''
  let turnIndex = 0
  for (const message of messages) {
    if (!isPlainRecord(message)) continue
    const role = String(message.role || '')
    const content = String(message.content || '').trim()
    if (role === 'user') {
      pendingPlayerInput = content
      continue
    }
    if (role !== 'assistant' || !pendingPlayerInput || !content) continue
    turnIndex += 1
    entries.push({
      storyId,
      storyName: String(story.name || story.storyName || ''),
      turnIndex,
      playerInput: pendingPlayerInput,
      finalText: content,
      createdAt: String(story.updatedAt || new Date().toISOString()),
    })
    pendingPlayerInput = ''
  }
  const storyDirPath = targetDir || storyDebugDirForStory(story)
  const memoryDirPath = path.join(storyDirPath, 'memory')
  const rawFile = path.join(memoryDirPath, 'raw-turns.jsonl')
  fs.mkdirSync(memoryDirPath, { recursive: true })
  writeJsonFile(path.join(storyDirPath, 'story.json'), story)
  if (!targetDir && currentStoryId === storyId) {
    const now = String(story.updatedAt || new Date().toISOString())
    const slotId = currentAutoSlotId
    writeJsonFile(path.join(storyDirPath, 'slot.json'), normalizeSaveSlotRecord({
      id: slotId,
      slotKind: 'current',
      name: currentAutoSlotId,
      savedAt: now,
      updatedAt: now,
      favorite: false,
      storyName: story.name || story.storyName,
      turnIndex,
      saveEvaluation: '',
      saveEvaluationStatus: 'current',
      state: story,
    }, slotId))
  }
  fs.writeFileSync(path.join(storyDirPath, 'README.md'), renderStoryDebugReadme(story, entries, currentStoryId === storyId), 'utf-8')
  fs.writeFileSync(rawFile, entries.map(entry => JSON.stringify(entry)).join('\n') + (entries.length ? '\n' : ''), 'utf-8')
  fs.writeFileSync(path.join(memoryDirPath, 'story.txt'), entries.map(renderStoryTextEntry).join(''), 'utf-8')
  renderTurnSummariesFile(path.join(memoryDirPath, 'turn-summaries.txt'), renderStoryTurnSummariesWithOpening(story))
}

function renderStoryTurnSummariesWithOpening(story: Record<string, unknown>): string {
  const opening = summarizeOpeningForTurnSummary(story.openingText)
  const existing = String(story.globalContext || story.chapterSummary || '').trim()
  const lines = existing.split(/\r?\n/).map(line => line.trim().replace(/^-\s*/, '')).filter(Boolean)
  const withoutOpening = lines.filter(line => !/^第0轮[:：]/.test(line))
  return [
    opening ? `第0轮：${opening}` : '',
    ...withoutOpening,
  ].filter(Boolean).join('\n')
}

function summarizeOpeningForTurnSummary(value: unknown): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const sentence = text.match(/^(.{1,160}?[。！？!?])/u)?.[1] || text
  return compactTextWithoutEllipsis(sentence, 160)
}

function renderStoryDebugReadme(story: Record<string, unknown>, entries: RawTurnLogEntry[], isCurrent: boolean): string {
  const name = String(story.name || story.storyName || '未命名故事')
  const messages = Array.isArray(story.messages) ? story.messages : []
  const lastEntry = entries[entries.length - 1]
  const statusRoster = Array.isArray(story.statusRoster) ? story.statusRoster.map(String).join('、') : ''
  const itemState = isPlainRecord(story.itemState) ? JSON.stringify(story.itemState, null, 2) : '（无）'
  return [
    `# ${name}`,
    '',
    `- 故事 ID：${String(story.id || '')}`,
    `- 是否当前游玩：${isCurrent ? '是' : '否'}`,
    `- 轮次：${entries.length}`,
    `- 消息数：${messages.length}`,
    `- 更新时间：${String(story.updatedAt || '') || '（无）'}`,
    `- 故事资料：${String(story.storyAssetId || '') || '（无）'}`,
    `- 当前操控人物：${String(story.controlledCharacterName || '') || '（未指定）'}`,
    `- 追踪人物：${statusRoster || '（无）'}`,
    '',
    '## 文件',
    '',
    '- `story.json`：这个故事的完整前端状态',
    '- `memory/story.txt`：按轮次展开的玩家输入 + 正文，用于召回排查',
    '- `memory/raw-turns.jsonl`：结构化轮次日志',
    '',
    '## 当前关键道具',
    '',
    '```json',
    itemState,
    '```',
    '',
    '## 最近一轮',
    '',
    lastEntry
      ? [
        `第 ${lastEntry.turnIndex} 轮`,
        '',
        '玩家输入：',
        compactDebugLine(lastEntry.playerInput, 600),
        '',
        '正文：',
        compactDebugLine(lastEntry.finalText, 900),
      ].join('\n')
      : '暂无正文轮次。这个目录只说明故事已存在，但还没开始产生正文。',
    '',
  ].join('\n')
}

function compactDebugLine(value: unknown, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function sanitizeSaveSlotId(id: string): string {
  return safeName(id, '').replace(/\.json$/i, '')
}

function normalizeSaveSlotRecord(value: Record<string, unknown>, fallbackId: string): SaveSlotRecord {
  const state = value.state === undefined ? value : value.state
  const story = state && typeof state === 'object' ? (state as Record<string, unknown>).story || state : {}
  const storyRecord = story && typeof story === 'object' ? story as Record<string, unknown> : {}
  const messages = Array.isArray(storyRecord.messages) ? storyRecord.messages : []
  const savedAt = String(value.savedAt || value.createdAt || new Date().toISOString())
  const name = String(value.name || storyRecord.name || '未命名存档').trim() || '未命名存档'
  const explicitSlotKind = String(value.slotKind || '').trim()
  const slotKind = explicitSlotKind
    || (isCurrentAutoSlotId(value.id || fallbackId) || value.saveEvaluationStatus === 'current'
      ? 'current'
      : isLegacyObsoleteAutoSlotRecord(value, name, String(value.storyName || storyRecord.name || name))
        ? 'legacy-auto'
        : 'manual')
  return {
    id: sanitizeSaveSlotId(String(value.id || fallbackId)),
    slotKind,
    name,
    savedAt,
    updatedAt: String(value.updatedAt || savedAt),
    favorite: Boolean(value.favorite),
    storyName: String(value.storyName || storyRecord.name || name),
    turnIndex: Number.isFinite(Number(value.turnIndex)) ? Math.max(0, Math.floor(Number(value.turnIndex))) : messages.filter((message: unknown) => (message as Record<string, unknown>)?.role === 'assistant').length,
    saveEvaluation: String(value.saveEvaluation || ''),
    saveEvaluationStatus: String(value.saveEvaluationStatus || ''),
    state,
  }
}

function readSaveSlot(id: string): SaveSlotRecord {
  ensureDataDirs()
  const filePath = saveSlotFile(id)
  const raw = readJsonFileIfExists(filePath) || readJsonFileIfExists(legacySaveSlotFile(id))
  if (!raw) throw new Error('存档不存在。')
  return normalizeSaveSlotRecord(raw, sanitizeSaveSlotId(id))
}

function listSaveSlots(): Omit<SaveSlotRecord, 'state'>[] {
  ensureDataDirs()
  const slots: SaveSlotRecord[] = []
  const seen = new Set<string>()
  for (const entry of fs.readdirSync(saveSlotsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const raw = readJsonFileIfExists(path.join(saveSlotsDir, entry.name, 'slot.json'))
      if (!raw) continue
      const slot = normalizeSaveSlotRecord(raw, entry.name)
      if (shouldListSaveSlot(slot)) slots.push(slot)
      seen.add(slot.id)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const raw = readJsonFileIfExists(path.join(saveSlotsDir, entry.name))
    if (!raw) continue
    const slot = normalizeSaveSlotRecord(raw, path.basename(entry.name, '.json'))
    if (seen.has(slot.id) || !shouldListSaveSlot(slot)) continue
    slots.push(slot)
  }
  return slots
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.savedAt).localeCompare(String(a.savedAt)))
    .map(({ state: _state, ...slot }) => slot)
}

function shouldListSaveSlot(slot: SaveSlotRecord): boolean {
  if (slot.slotKind === 'current') return true
  return slot.slotKind !== 'legacy-auto'
}

function isLegacyObsoleteAutoSlotRecord(value: Record<string, unknown>, name: string, storyName: string): boolean {
  return value.saveEvaluationStatus === 'done'
    && !String(value.saveEvaluation || '').trim()
    && !Boolean(value.favorite)
    && name === storyName
}

function writeSaveSlotRecord(record: SaveSlotRecord): void {
  const dirPath = saveSlotDir(record.id)
  fs.mkdirSync(dirPath, { recursive: true })
  writeJsonFile(path.join(dirPath, 'slot.json'), record)
  const legacyFile = legacySaveSlotFile(record.id)
  if (fs.existsSync(legacyFile)) fs.unlinkSync(legacyFile)
  const story = storyFromSlotRecord(record)
  if (story) materializeStoryMemory(story, String(story.id || ''), dirPath)
}

function createSaveSlot(input: Record<string, unknown>): SaveSlotRecord {
  ensureDataDirs()
  const savedAt = new Date().toISOString()
  const name = String(input.name || '未命名存档').trim() || '未命名存档'
  const id = slotDirNameFromTimeAndName(savedAt, input.storyName || name)
  const record = normalizeSaveSlotRecord({
    id,
    slotKind: 'manual',
    name,
    savedAt,
    updatedAt: savedAt,
    favorite: Boolean(input.favorite),
    storyName: input.storyName,
    turnIndex: input.turnIndex,
    saveEvaluation: '',
    saveEvaluationStatus: 'pending',
    state: input.state,
  }, id)
  writeSaveSlotRecord(record)
  return record
}

function updateSaveSlot(id: string, patch: Record<string, unknown>): SaveSlotRecord {
  const current = readSaveSlot(id)
  const updated = normalizeSaveSlotRecord({
    ...current,
    name: patch.name === undefined ? current.name : patch.name,
    favorite: patch.favorite === undefined ? current.favorite : Boolean(patch.favorite),
    saveEvaluation: patch.saveEvaluation === undefined ? current.saveEvaluation : patch.saveEvaluation,
    saveEvaluationStatus: patch.saveEvaluationStatus === undefined ? current.saveEvaluationStatus : patch.saveEvaluationStatus,
    updatedAt: new Date().toISOString(),
  }, current.id)
  writeSaveSlotRecord(updated)
  return updated
}

function compactSavedStoryForEvaluation(slot: SaveSlotRecord): string {
  const stateRecord = slot.state && typeof slot.state === 'object' ? slot.state as Record<string, unknown> : {}
  const story = stateRecord.story && typeof stateRecord.story === 'object' ? stateRecord.story as Record<string, unknown> : stateRecord
  const messages = Array.isArray(story.messages) ? story.messages : []
  const recent = messages.slice(-10).map(message => {
    const item = message && typeof message === 'object' ? message as Record<string, unknown> : {}
    const role = item.role === 'user' ? '用户输入' : item.role === 'assistant' ? '正文' : '其他'
    return `${role}：${String(item.content || '').replace(/\s+/g, ' ').trim().slice(0, 500)}`
  }).join('\n')
  return [
    `故事名：${slot.storyName || story.name || slot.name}`,
    `轮次：${slot.turnIndex}`,
    story.worldview ? `世界观：${String(story.worldview).replace(/\s+/g, ' ').trim().slice(0, 800)}` : '',
    story.chapterSummary ? `历史总结：${String(story.chapterSummary).replace(/\s+/g, ' ').trim().slice(0, 800)}` : '',
    recent ? `最近正文：\n${recent}` : '',
  ].filter(Boolean).join('\n\n')
}

function normalizeSaveEvaluations(value: string): string {
  const raw = String(value || '').trim()
  const parsed = parseJsonObject(raw)
  const source = Array.isArray(parsed?.evaluations) ? parsed.evaluations : raw.match(/[\u4e00-\u9fff]{4}/g) || []
  const words = source
    .map(item => normalizeFourCharacterWord(String(item || '')))
    .filter(Boolean)
    .slice(0, 3)
  return words.length ? words.join('、') : '未有评语'
}

function normalizeFourCharacterWord(value: string): string {
  const compact = value.replace(/[`"'“”‘’\s，。！？、:：；;,.!?-]/g, '').trim()
  const match = compact.match(/[\u4e00-\u9fff]{4}/)
  return match?.[0] || compact.slice(0, 4)
}

async function evaluateSaveSlot(id: string, input: Record<string, unknown>): Promise<SaveSlotRecord> {
  const slot = readSaveSlot(id)
  updateSaveSlot(slot.id, { saveEvaluationStatus: 'running' })
  try {
    const model = normalizeModel(input.model)
    const provider = providerForModel(model)
    const apiKey = providerApiKey(provider, typeof input.apiKey === 'string' ? input.apiKey : undefined)
    const content = renderPromptTemplate('save-evaluation.md', {
      savedStory: compactSavedStoryForEvaluation(slot),
    })
    const result = await requestModelContent(apiKey, [{
      role: 'user',
      content,
    }], 0.3, model, 'SaveSlotEvaluation', 512)
    return updateSaveSlot(slot.id, {
      saveEvaluation: normalizeSaveEvaluations(result.raw),
      saveEvaluationStatus: 'done',
    })
  } catch (error) {
    return updateSaveSlot(slot.id, {
      saveEvaluationStatus: `error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 220),
    })
  }
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

function deleteStoryAsset(id: string): void {
  ensureDataDirs()
  const assetDir = path.normalize(path.join(storyDir, id))
  if (!isInsidePath(storyDir, assetDir) || !fs.existsSync(path.join(assetDir, 'manifest.json'))) {
    throw new Error('故事资料不存在。')
  }
  fs.rmSync(assetDir, { recursive: true, force: true })
}

function renameStoryAsset(id: string, sourceName: unknown): StoryAssetRecord {
  ensureDataDirs()
  const assetDir = path.normalize(path.join(storyDir, id))
  const manifestPath = path.join(assetDir, 'manifest.json')
  if (!isInsidePath(storyDir, assetDir) || !fs.existsSync(manifestPath)) {
    throw new Error('故事资料不存在。')
  }
  const nextName = String(sourceName || '').trim()
  if (!nextName) throw new Error('故事资料名不能为空。')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
  writeJsonFile(manifestPath, {
    ...manifest,
    sourceName: nextName,
  })
  const programConfig = readProgramConfig(assetDir)
  if (programConfig) {
    const characters = Array.isArray(manifest.characters) ? manifest.characters as CharacterState[] : []
    const entries = Array.isArray(manifest.entries) ? manifest.entries as StorybookEntry[] : []
    const fallback = fallbackStoryInitialization({
      assetId: id,
      sourceName: nextName,
      entries,
      characters,
    })
    writeProgramConfig(assetDir, normalizeProgramConfig({
      ...programConfig,
      sourceName: nextName,
    } as Record<string, unknown>, fallback))
  }
  const record = readStoryAssetRecord(assetDir, id)
  if (!record) throw new Error('故事资料改名后读取失败。')
  return record
}

function readStoryAssetRecord(assetDir: string, id: string): StoryAssetRecord | null {
  const manifestPath = path.join(assetDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<StoryAssetRecord>
    const markdownFileName = manifest.markdownFile || fs.readdirSync(assetDir).find(file => file.endsWith('.md'))
    const programConfigFileName = manifest.programConfigFile || 'program-config.json'
    const programConfigPath = path.join(assetDir, programConfigFileName)
    const rawProgramConfig = fs.existsSync(programConfigPath)
      ? JSON.parse(fs.readFileSync(programConfigPath, 'utf-8')) as Record<string, unknown>
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
    const fallbackConfig = fallbackStoryInitialization({
      assetId: id,
      sourceName: String(manifest.sourceName || id),
      entries,
      characters,
    })
    const programConfig = rawProgramConfig ? normalizeProgramConfig(rawProgramConfig, fallbackConfig) : undefined
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

function deleteSaveSlot(id: string): void {
  ensureDataDirs()
  const dirPath = saveSlotDir(id)
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
    return
  }
  const filePath = legacySaveSlotFile(id)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
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
        character.gender ? `- 性别：${character.gender}` : '',
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
  const rendered = readPrompt(name).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (key === 'user') return '{{user}}'
    const value = key === 'hardRule' ? readPrompt('hard-rule.md') : variables[key]
    return value?.trim() || fallback
  }).trim()
  return rendered.replace(/\n## [^\n]+\n（无）(?=\n## |\n# |$)/g, '').trim()
}

function renderPromptMessagePair(name: string, variables: Record<string, string | undefined>, fallback = '（无）'): { system: string; user: string } {
  const rendered = renderPromptTemplate(name, variables, fallback)
  const marker = '\n# User Message\n'
  const markerIndex = rendered.indexOf(marker)
  const cleanTemplateSystem = (system: string): string => system.replace(/^# System Message\s*/i, '').trim()
  if (markerIndex < 0) {
    return { system: '', user: rendered }
  }
  const templateSystem = cleanTemplateSystem(rendered.slice(0, markerIndex).trim())
  const templateUser = rendered.slice(markerIndex + marker.length).trim()
  return {
    system: '',
    user: [templateSystem, templateUser].filter(Boolean).join('\n\n').trim(),
  }
}

function promptMessages(systemContent: string, userContent: string): ChatMessage[] {
  const user = [String(systemContent || '').trim(), String(userContent || '').trim()].filter(Boolean).join('\n\n').trim()
  return [{ role: 'user', content: user }]
}

function renderPromptMessagesForDisplay(systemContent: string, userContent: string): string {
  return [
    '## System',
    systemContent,
    '',
    '## User',
    userContent,
  ].join('\n').trim()
}

function isSyntheticPromptInput(value: unknown): boolean {
  return String(value || '').trim() === syntheticContentInterceptionInput
}

function readPromptFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  const marker = '\n---\n'
  const index = content.indexOf(marker)
  return (index >= 0 ? content.slice(index + marker.length) : content).trim()
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function renderCharacters(characters: CharacterState[] = []): string {
  if (characters.length === 0) return ''
  return characters.map(character => [
    `## ${character.name || character.id}`,
    character.gender ? `性别：${character.gender}` : '',
    character.role ? `身份：${character.role}` : '',
    character.mood ? `情绪：${character.mood}` : '',
    character.location ? `位置：${character.location}` : '',
    character.health ? `状态：${character.health}` : '',
    character.trust ? `关系：${character.trust}` : '',
    character.appearance ? `外貌：${character.appearance}` : '',
    character.personality ? `性格：${character.personality}` : '',
    character.notes ? `备注：${character.notes}` : '',
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderConversation(turns: ConversationItem[] = []): string {
  return turns.slice(-20).map(turn => `${turn.role === 'user' ? '用户输入' : '正文'}：${turn.content}`).join('\n\n')
}

function renderRecentConversationByAssistantTurns(turns: ConversationItem[] = [], assistantTurnCount = 1): string {
  const items = Array.isArray(turns) ? turns.filter(turn => String(turn.content || '').trim()) : []
  let assistantCount = 0
  let start = items.length
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === 'assistant') assistantCount += 1
    start = index
    if (assistantCount >= assistantTurnCount && (index === 0 || items[index - 1]?.role !== 'user')) break
  }
  return renderConversation(items.slice(start))
}

function renderLatestConversationTurn(turns: ConversationItem[] = []): string {
  const items = Array.isArray(turns) ? turns.filter(turn => String(turn.content || '').trim()) : []
  const lastAssistantIndex = items.map(turn => turn.role).lastIndexOf('assistant')
  if (lastAssistantIndex < 0) return ''
  const start = lastAssistantIndex > 0 && items[lastAssistantIndex - 1]?.role === 'user'
    ? lastAssistantIndex - 1
    : lastAssistantIndex
  return items.slice(start, lastAssistantIndex + 1)
    .map(turn => `${turn.role === 'user' ? '用户输入' : '正文'}：${turn.content}`)
    .join('\n\n')
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
      directorStyle: '都市修仙 / 重生爽文导演风格：以“低估、试探、压迫、反转或震慑、余波”构成本轮动力；主动引入校园、家族、地下江湖、资源线和前世遗憾的外部压力；早期保留陈凡身体弱、资源少、身份低的限制；每轮制造一个可推进的矛盾、线索或身份误判，不让世界无条件顺从用户意图。',
      narratorStyle: '现代都市修仙叙事风格：语调克制但有压迫感，突出陈凡重生后的冷静、信息差和旧日遗憾；描写以都市现实细节、人物反应、身体凡胎限制和微弱灵气感知为主；少堆设定名词，爽点通过旁人误判、局势反转和细节震慑呈现，正文清晰紧凑。',
    }
  }

  return {
      directorStyle: '通用互动小说导演风格：以用户输入作为局部触发点，同时保持 NPC 独立和世界压力；主动制造信息差、关系变化、短期扰动和可回收线索；重大事件分阶段推进，小事可以几笔带过；每轮保留用户可接续的行动窗口。',
    narratorStyle: '通用小说叙事风格：正文以清晰可读为先，动作、神态和具体场景细节替代空泛形容；角色保持限知视角，通过看、听、触、推理逐步获得信息；避免设定宣读、重复句式和无意义铺陈，保持段落节奏紧凑。',
  }
}

function fallbackStoryInitialization(input: InitializeStoryRequest): StoryProgramConfig {
  const baseCharacters = input.characters?.length
    ? input.characters
    : [{
      id: 'character.main',
      name: '主角',
      gender: '未设定',
      role: '可操控人物',
      mood: '待输入',
      location: '开场',
      health: '正常',
      trust: '',
      notes: '初始化失败时生成的可操控人物占位；后续可在故事 JSON 中改名。',
    }]
  const seedCharacters = baseCharacters
  const statusSchema = fallbackStatusSchema
  const statusRoster = normalizeStatusRoster([], seedCharacters)
  const statusState = normalizeStatusState({}, statusRoster, seedCharacters, statusSchema)
  const playableCharacters = normalizePlayableCharacters([], statusRoster, seedCharacters, statusRoster)
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
    openingSummary: '',
    worldview,
    statusSchema,
    statusRoster,
    statusState,
    itemState: {},
    playableCharacters,
    directorStyle,
    narratorStyle,
    initialPlayerOptions: [
      { inputText: '我先观察周围和对方的反应。' },
      { inputText: '我开口问道：“现在是什么情况？”' },
      { inputText: '我向前一步，试探性地接近当前互动对象。' },
    ],
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
    sourceName: String(patch.sourceName ?? existing.sourceName ?? ''),
    generatedAt: String(patch.generatedAt ?? existing.generatedAt ?? new Date().toISOString()),
    worldview: String(patch.worldview ?? existing.worldview ?? ''),
    openingText: String(patch.openingText ?? existing.openingText ?? ''),
    openingSummary: String(patch.openingSummary ?? existing.openingSummary ?? ''),
    directorStyle: String(patch.directorStyle ?? existing.directorStyle ?? ''),
    narratorStyle: String(patch.narratorStyle ?? existing.narratorStyle ?? ''),
    statusSchema: normalizeStatusSchema(patch.statusSchema ?? existing.statusSchema),
    statusRoster: normalizeStatusRoster(patch.statusRoster ?? existing.statusRoster),
    statusState: normalizeStatusState(
      patch.statusState ?? existing.statusState,
      normalizeStatusRoster(patch.statusRoster ?? existing.statusRoster),
      [],
      normalizeStatusSchema(patch.statusSchema ?? existing.statusSchema),
    ),
    itemState: mergeItemState({}, patch.itemState ?? existing.itemState),
    playableCharacters: normalizePlayableCharacters(patch.playableCharacters ?? existing.playableCharacters, patch.statusRoster ?? existing.statusRoster, [], existing.playableCharacters),
    initialPlayerOptions: Array.isArray(patch.initialPlayerOptions) ? patch.initialPlayerOptions : existing.initialPlayerOptions,
  }
  const config = normalizeProgramConfig({
    ...existing,
    ...editablePatch,
  } as Record<string, unknown>, existing)
  writeProgramConfig(assetDir, config)
  return config
}

async function reviseStoryAssetProgramConfig(assetId: string, input: ReviseProgramConfigRequest): Promise<StoryProgramConfig> {
  const assetDir = getStoryAssetDir(assetId)
  if (!assetDir) throw new Error('找不到故事资料目录。')
  const existing = readProgramConfig(assetDir)
  if (!existing) throw new Error('这个故事还没有初始化，不能反馈修改。')
  const revisionFeedback = String(input.revisionFeedback || '').trim()
  if (!revisionFeedback) throw new Error('修改反馈不能为空。')

  const record = readStoryAssetRecord(assetDir, assetId)
  const model = buildPipelineModels(input.model, input.pipelineModels).initializer
  const provider = providerForModel(model)
  if (!pipelineApiKeyForModel(input, model)?.trim() && !providerHasApiKey(provider)) {
    throw new Error(`缺少 ${providerLabel(provider)} API Key，不能修改初始化配置。`)
  }

  const fallback = normalizeProgramConfig(existing as unknown as Record<string, unknown>, fallbackStoryInitialization({
    assetId,
    sourceName: record?.sourceName || existing.sourceName || assetId,
    entries: record?.entries || [],
    characters: record?.characters || [],
  }))
  const revisionMessages = renderPromptMessagePair('initializer-revision.md', {
    currentConfig: JSON.stringify(existing, null, 2),
    revisionFeedback,
  })
  const result = await callModel(promptMessages(revisionMessages.system, revisionMessages.user), {
    temperature: 0.35,
    apiKey: pipelineApiKeyForModel(input, model),
    model,
    maxTokens: initializerMaxTokens,
    debugLabel: 'InitializerRevision',
    reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
  })
  const config = normalizeProgramConfig(result.json, fallback)
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
    '## 开场白',
    config.openingText || '（无）',
    '',
    '## 开场白总结',
    config.openingSummary || '（无）',
    '',
    '## 追踪人物',
    config.statusRoster.join('、') || '（无）',
    '',
    '## 可操控人物',
    config.playableCharacters.join('、') || '（无）',
    '',
    '## 状态字段',
    config.statusSchema.join('、') || '（无）',
    '',
    '## 初始人物状态',
    JSON.stringify(config.statusState, null, 2),
    '',
    '## 初始关键道具状态',
    renderItemState(config.itemState),
    '',
    '## 导演风格',
    config.directorStyle || '（无）',
    '',
    '## 叙事风格',
    config.narratorStyle || '（无）',
    '',
    '## 初始用户选项',
    config.initialPlayerOptions.length
      ? config.initialPlayerOptions.map(option => `- ${option.inputText}`).join('\n')
      : '（无）',
    '',
  ].join('\n')
}

function normalizeProgramConfig(raw: Record<string, unknown>, fallback: StoryProgramConfig): StoryProgramConfig {
  const legacyCharacters = Array.isArray(raw.cast)
    ? raw.cast as CharacterState[]
    : Array.isArray(raw.characterSeeds)
      ? raw.characterSeeds as CharacterState[]
      : []
  const initialPlayerOptions = Array.isArray(raw.initialPlayerOptions)
    ? raw.initialPlayerOptions
    : Array.isArray(raw.playerOptions)
      ? raw.playerOptions
      : fallback.initialPlayerOptions
  return {
    sourceName: String(raw.sourceName ?? fallback.sourceName),
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    openingText: String(raw.openingText ?? fallback.openingText ?? ''),
    openingSummary: String(raw.openingSummary ?? fallback.openingSummary ?? ''),
    worldview: String(raw.worldview ?? fallback.worldview ?? ''),
    statusSchema: normalizeStatusSchema(raw.statusSchema ?? fallback.statusSchema),
    statusRoster: normalizeStatusRoster(raw.statusRoster ?? fallback.statusRoster, legacyCharacters),
    statusState: normalizeStatusState(raw.statusState ?? fallback.statusState, normalizeStatusRoster(raw.statusRoster ?? fallback.statusRoster, legacyCharacters), legacyCharacters, normalizeStatusSchema(raw.statusSchema ?? fallback.statusSchema)),
    itemState: mergeItemState({}, raw.itemState ?? fallback.itemState),
    playableCharacters: normalizePlayableCharacters(raw.playableCharacters, raw.statusRoster ?? fallback.statusRoster, legacyCharacters, fallback.playableCharacters),
    directorStyle: String(raw.directorStyle ?? fallback.directorStyle ?? ''),
    narratorStyle: String(raw.narratorStyle ?? fallback.narratorStyle ?? ''),
    initialPlayerOptions: normalizeInitialPlayerOptionsForConfig(initialPlayerOptions, fallback.initialPlayerOptions),
    currentSituation: typeof raw.currentSituation === 'string' ? raw.currentSituation : undefined,
    outline: typeof raw.outline === 'string' ? raw.outline : undefined,
    plotLines: Array.isArray(raw.plotLines) ? raw.plotLines : undefined,
  }
}

function normalizeInitialPlayerOptionsForConfig(value: unknown, fallback: unknown): PlayerOption[] {
  const options = normalizePlayerOptions(value) as PlayerOption[]
  const fallbackOptions = normalizePlayerOptions(fallback) as PlayerOption[]
  const defaults: PlayerOption[] = [
    { inputText: '我先观察周围和对方的反应。' },
    { inputText: '我开口问道：“现在是什么情况？”' },
    { inputText: '我向前一步，试探性地接近当前互动对象。' },
  ]
  const seen = new Set<string>()
  const merged = [...options, ...fallbackOptions, ...defaults].filter(option => {
    const text = String(option?.inputText || '').trim()
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  })
  return merged.slice(0, 3)
}

function renderStatusUpdateMaterial(playerInput: string, finalText: string): string {
  return [
    '【本轮用户输入】',
    String(playerInput || '').trim() || '（无）',
    '',
    '【最终正文】',
    String(finalText || '').trim() || '（无）',
  ].join('\n')
}

function hasControlledCharacterStatusPatch(patch: unknown, controlledCharacterName: unknown): boolean {
  const normalized = normalizeStatusStatePatchSubjects(patch, controlledCharacterName)
  const controlled = normalizeControlledCharacterName(controlledCharacterName)
  if (!controlled) return true
  const record = normalized[controlled]
  return Boolean(record && typeof record === 'object' && !Array.isArray(record) && Object.keys(record as Record<string, unknown>).length)
}

function requireControlledCharacterStatusPatch(summaryJson: Record<string, unknown>, controlledCharacterName: unknown): void {
  const controlled = normalizeControlledCharacterName(controlledCharacterName)
  if (!controlled) return
  if (hasControlledCharacterStatusPatch(summaryJson.statusStatePatch, controlled)) return
  throw new Error(`Summary 缺少当前操控人物“${controlled}”的 statusStatePatch。`)
}

function sanitizePlayerEntityText(value: string): string {
  return value
    .replace(/^状态追踪人物：玩家\s*$/gm, '')
    .replace(/玩家输入/g, '用户输入')
    .replace(/玩家可接续/g, '用户可接续')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function initializeStory(
  input: InitializeStoryRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<StoryProgramConfig> {
  const model = buildPipelineModels(input.model, input.pipelineModels).initializer
  const provider = providerForModel(model)
  const assetDir = getStoryAssetDir(input.assetId)
  if (input.assetId && !assetDir) {
    throw new Error('故事资料未写入本地 story 目录，请重新导入后再初始化。')
  }
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
  if (!pipelineApiKeyForModel(input, model)?.trim() && !providerHasApiKey(provider)) {
    throw new Error(`故事尚未初始化：缺少 ${providerLabel(provider)} API Key，不能生成 program-config。`)
  }

  const initializerMessages = renderPromptMessagePair('initializer.md', {
    storyMaterial: renderInitializationMaterial(input),
  })

  try {
    emit({ type: 'stage_start', stage: 'initializer', label: 'Initializer', message: '初始化层：整理故事书，生成世界观、人物介绍、开场交互和人物状态 schema。' })
    const result = await callModelWithPublicTrace('initializer', 'Initializer', promptMessages(initializerMessages.system, initializerMessages.user), { temperature: 0.4, apiKey: pipelineApiKeyForModel(input, model), model, maxTokens: initializerMaxTokens, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在读取故事书、人物卡和世界书，去掉重复噪音。',
      '公开日志：正在抽取世界观、人物介绍和固定设定。',
      '公开日志：正在写第一轮开场交互和 3 个用户初始选项。',
      '公开日志：正在选择状态追踪人物，并生成人物状态 schema。',
      '公开日志：初始化层仍在等待模型返回 program-config。',
    ])
    const config = normalizeProgramConfig(result.json, fallback)
    if (assetDir) {
      writeProgramConfig(assetDir, config)
      if (!readProgramConfig(assetDir)) {
        throw new Error('program-config 写入后读取失败。')
      }
    }
    emit({ type: 'stage_result', stage: 'initializer', label: 'Initializer', message: '初始化完成：program-config 已生成。', json: config as unknown as Record<string, unknown> })
    return config
  } catch (error) {
    throw new Error(`故事初始化失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

async function callModel(messages: ChatMessage[], options: { temperature: number; apiKey?: string; debugLabel?: string; model?: string; maxTokens?: number; signal?: AbortSignal; reasoningEffort?: string }): Promise<LayerResult> {
  const model = normalizeModel(options.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, options.apiKey)
  const response = await requestModelContent(apiKey, messages, options.temperature, model, options.debugLabel || providerLabel(provider), options.maxTokens, options.signal, options.reasoningEffort)
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
  reasoningEffort?: string,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const provider = providerForModel(model)
  void reasoningEffort
  return requestOpenAICompatibleContent(provider, providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
}

async function requestOpenAICompatibleContent(
  provider: ModelProvider,
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const providerName = providerLabel(provider)
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
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`${providerName} 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-${provider}-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`${providerName} 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
    }
    throw error
  }

  const text = await readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)
  const durationMs = Date.now() - startedAt
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(`${providerName} API Key 无效或已过期。请在页面右上角 API Key 里清除后重新粘贴完整 key。`)
    }
    throw new Error(`${providerName} ${response.status}: ${text.slice(0, 500)}`)
  }
  const payload = JSON.parse(text) as {
    error?: { message?: string; code?: number | string; metadata?: unknown }
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
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
      label: `${label}-${provider}-error`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`${providerName} 上游错误：${detail}；原始返回已保存：${file}`)
  }
  const message = payload.choices?.[0]?.message
  const raw = message?.content?.trim() || fallbackJsonFromReasoningContent(message?.reasoning_content)
  if (!raw) {
    const finishReason = (payload.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason
    const reasonText = finishReason ? `; finish_reason=${String(finishReason)}` : ''
    const file = writeLlmDebugFile({
      label: `${label}-${provider}-empty`,
      raw: text,
      messages,
      error: new Error(`${providerName} returned an empty response${reasonText}`),
    })
    throw new Error(`${providerName} returned an empty response${reasonText}；原始返回已保存：${file}`)
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
}

function fallbackJsonFromReasoningContent(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    return JSON.stringify(parseJsonObject(text))
  } catch {
    return ''
  }
}

async function repairJsonWithModel(apiKey: string, raw: string, model = defaultModel): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  return requestModelContent(apiKey, [
    {
      role: 'user',
      content: [
        '你是 JSON 修复器。',
        '把用户提供的文本改写成一个合法 JSON object。',
        '禁止输出 Markdown、解释、注释、代码块。',
        '所有 key 和字符串必须使用英文双引号。',
        '禁止尾逗号。',
        '如果文本中已有 JSON-like object，只修复语法，不改写字段含义。',
        '',
        raw.slice(0, 80_000),
      ].join('\n'),
    },
  ], 0, normalizeModel(model), 'JSON Repair')
}

async function testProvider(input: ProviderTestRequest): Promise<Record<string, unknown>> {
  const model = normalizeModel(input.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, input.apiKey)
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), providerConnectivityTimeoutMs)
  try {
    const result = await requestModelContent(apiKey, [
      {
        role: 'user',
        content: '连通性测试。只输出：ok',
      },
    ], 0, model, 'ProviderTest', 20, controller.signal, normalizeReasoningEffort(input.reasoningEffort))
    return {
      ok: true,
      testType: 'connectivity',
      provider,
      providerLabel: providerLabel(provider),
      model,
      durationMs: result.metrics.durationMs || Date.now() - startedAt,
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${providerLabel(provider)} 连通性测试超过 ${Math.round(providerConnectivityTimeoutMs / 1000)} 秒未返回。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function testProviderSpeed(input: ProviderSpeedTestRequest): Promise<Record<string, unknown>> {
  const model = normalizeModel(input.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, input.apiKey)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), providerSpeedTestTimeoutMs)
  try {
    const result = await requestModelStreamProbe(apiKey, [
      {
        role: 'user',
        content: '速度测试。请直接输出一段约 1200 个汉字的中文散文，主题是城市清晨的普通街景。不要输出标题、列表、JSON、解释或代码块；不要提前结束。',
      },
    ], 0.7, model, 'ProviderSpeedTest', 1800, controller.signal, normalizeReasoningEffort(input.reasoningEffort))
    const generationMs = Math.max(1, result.metrics.durationMs - (result.metrics.ttftMs || 0))
    const outputTokens = result.metrics.outputTokens || result.metrics.estimatedOutputTokens
    const response = {
      ok: true,
      testType: 'speed',
      provider,
      providerLabel: providerLabel(provider),
      model,
      streamed: true,
      durationMs: result.metrics.durationMs,
      ttftMs: result.metrics.ttftMs || result.metrics.durationMs,
      generationMs,
      tps: Number((outputTokens / Math.max(0.001, generationMs / 1000)).toFixed(2)),
      reply: result.raw.slice(0, 120),
      usage: {
        inputTokens: result.metrics.inputTokens,
        outputTokens: result.metrics.outputTokens,
        totalTokens: result.metrics.totalTokens,
        estimatedOutputTokens: result.metrics.estimatedOutputTokens,
      },
      recordFile: path.relative(rootDir, speedTestRecordFile),
    }
    appendSpeedTestRecord({
      providerLabel: response.providerLabel,
      model,
      durationMs: response.durationMs,
      ttftMs: response.ttftMs,
      generationMs: response.generationMs,
      tps: response.tps,
      outputTokens,
      reply: response.reply,
    })
    return {
      ...response,
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`${providerLabel(provider)} 速度测试超过 ${Math.round(providerSpeedTestTimeoutMs / 1000)} 秒未返回。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function buildStreamRequestInit(input: {
  provider: ModelProvider
  apiKey: string
  messages: ChatMessage[]
  temperature: number
  model: string
  maxTokens: number
  signal?: AbortSignal
  reasoningEffort?: string
}): { url: string; init: RequestInit } {
  const baseUrl = providerBaseUrl(input.provider)
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.apiKey}`,
    'content-type': 'application/json',
  }
  void input.reasoningEffort
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    stream: true,
    max_tokens: input.maxTokens,
  }
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      signal: input.signal,
      headers,
      body: JSON.stringify(body),
    },
  }
}

function extractStreamDelta(line: string): string {
  if (!line.startsWith('data:')) return ''
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return ''
  try {
    const payload = JSON.parse(data) as {
      choices?: Array<{
        delta?: { content?: string }
        message?: { content?: string }
      }>
    }
    return String(payload.choices?.[0]?.delta?.content || payload.choices?.[0]?.message?.content || '')
  } catch {
    return ''
  }
}

async function requestModelStreamProbe(
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens: number,
  signal?: AbortSignal,
  reasoningEffort?: string,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const provider = providerForModel(model)
  const startedAt = Date.now()
  const request = buildStreamRequestInit({ provider, apiKey, messages, temperature, model, maxTokens, signal, reasoningEffort })
  let response: Response
  try {
    response = await fetchWithTransientRetry(request.url, request.init)
  } catch (error) {
    if (isAbortError(error)) {
      throw Object.assign(new Error(`${label} 流式测速已取消。`), { name: 'AbortError' })
    }
    throw error
  }
  if (!response.ok) {
    const text = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${providerLabel(provider)} API Key 无效、无权限，或当前账号不能调用该模型。`)
    }
    throw new Error(`${providerLabel(provider)} ${response.status}: ${text.slice(0, 500)}`)
  }
  if (!response.body) throw new Error(`${providerLabel(provider)} 没有返回可读取的流。`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let raw = ''
  let firstTokenAt = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        const delta = extractStreamDelta(line.trim())
        if (!delta) continue
        if (!firstTokenAt) firstTokenAt = Date.now()
        raw += delta
      }
    }
  }
  buffer += decoder.decode()
  for (const line of buffer.split(/\r?\n/)) {
    const delta = extractStreamDelta(line.trim())
    if (!delta) continue
    if (!firstTokenAt) firstTokenAt = Date.now()
    raw += delta
  }
  const durationMs = Date.now() - startedAt
  raw = raw.trim()
  if (!raw) {
    const file = writeLlmDebugFile({
      label: `${label}-${provider}-stream-empty`,
      raw: '',
      messages,
      error: new Error(`${providerLabel(provider)} stream returned an empty response`),
    })
    throw new Error(`${providerLabel(provider)} 流式测速返回空内容；诊断已保存：${file}`)
  }
  const estimatedOutputTokens = estimateTokens(raw)
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      ttftMs: firstTokenAt ? firstTokenAt - startedAt : durationMs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedOutputTokens,
    },
  }
}

function fallbackDirectorPlanForInterception(): Record<string, unknown> {
  return {
    plotDrive: '外部压力；只检查模型是否能返回。',
    mainPresentation: '动作推进',
    supportingPresentation: [],
    narrativeStyle: '快速切入，短句推进，只做返回测试。',
    physicalConstraints: [],
  }
}

function buildInterceptionNarratorPrompt(input: InterceptionPromptRequest): Record<string, unknown> {
  const playerInput = String(input.playerInput || '').trim() || '内容拦截测试：请根据当前 Narrator prompt 输出。'
  const model = buildPipelineModels(input.model, input.pipelineModels).narrator
  const context = buildRuntimeBlocks({
    ...input,
    playerInput,
  })
  const directorPlan = input.director && Object.keys(input.director).length ? input.director : fallbackDirectorPlanForInterception()
  const payload = buildNarratorPromptPayload({
    ...input,
    playerInput,
  }, {
    model,
    temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8,
    context,
    playerInput,
    directorPlan,
  })
  const messages = promptMessages(payload.narratorSystem, payload.narratorUser)
  const combined = [
    '# Narrator Prompt Snapshot',
    '',
    '## System',
    '',
    payload.narratorSystem,
    '',
    '## User',
    '',
    payload.narratorUser,
    '',
  ].join('\n')
  const jsonFile = writeDebugArtifact(interceptionDebugDir, 'narrator-prompt', {
    artifactType: 'narrator-prompt',
    createdAt: new Date().toISOString(),
    model,
    playerInput,
    messages: messages.map(message => ({
      role: message.role,
      contentLength: message.content.length,
      content: message.content,
    })),
    combined,
  }, { latest: true })
  const textFile = writeDebugTextArtifact(interceptionDebugDir, 'narrator-prompt', combined)
  return {
    ok: true,
    model,
    playerInput,
    file: jsonFile,
    textFile,
    narratorSystem: payload.narratorSystem,
    narratorUser: payload.narratorUser,
    systemLength: payload.narratorSystem.length,
    userLength: payload.narratorUser.length,
    combinedLength: combined.length,
  }
}

function compactPromptPreviewPlan(input: InterceptionPromptRequest): Record<string, unknown> {
  if (!input.director || typeof input.director !== 'object' || !Object.keys(input.director).length) return {}
  return compactDirectorPlan(input.director)
}

function buildPromptPreview(input: InterceptionPromptRequest): Record<string, unknown> {
  const rawPlayerInput = String(input.playerInput || '').trim()
  const playerInput = isSyntheticPromptInput(rawPlayerInput) ? '' : rawPlayerInput
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const requestedModel = normalizeModel(input.model)
  const pipelineModels = buildPipelineModels(requestedModel, input.pipelineModels)
  const recentTurns = Array.isArray(input.recentTurns)
    ? input.recentTurns.filter(turn => !isSyntheticPromptInput(turn.content))
    : []
  const generateInput = { ...input, playerInput, recentTurns, model: requestedModel } as GenerateRequest
  const directorPayload = buildDirectorPromptPayload(generateInput, Math.min(temperature, 0.4))
  const directorPlan = compactPromptPreviewPlan(input)
  const finalText = String(input.finalText || '').trim()
  const planFeedbackPayload = buildPlanFeedbackPromptPayload(generateInput, {
    model: pipelineModels.postprocess,
    temperature: 0.5,
    playerInput,
    finalText,
    directorPlan,
    context: directorPayload.context,
  })
  const narratorPayload = buildNarratorPromptPayload(generateInput, {
    model: pipelineModels.narrator,
    temperature,
    context: directorPayload.context,
    planFeedback: { 叙事整改要求: 'Prompt preview only: actual Feedback is produced at runtime before Narrator.' },
    playerInput,
    directorPlan,
  })
  const postprocessPayload = buildPostprocessPromptPayload(generateInput, {
    model: pipelineModels.postprocess,
    temperature: 0.5,
    playerInput,
    finalText,
    directorPlan,
    context: directorPayload.context,
    turnIndex: directorPayload.turnIndex,
  })
  const initializerMessages = renderPromptMessagePair('initializer.md', {
    storyMaterial: '（当前游戏运行中没有初始化原始材料；Initializer 真实输入只来自故事库导入的原始材料。）',
  })
  return {
    ok: true,
    model: requestedModel,
    pipelineModels,
    prompts: [
      { task: 'Initializer', model: pipelineModels.initializer, system: initializerMessages.system, user: initializerMessages.user },
      { task: 'Director', model: pipelineModels.director, system: directorPayload.directorSystem, user: directorPayload.directorUser },
      { task: 'Feedback', model: pipelineModels.postprocess, system: planFeedbackPayload.postprocessSystem, user: planFeedbackPayload.postprocessUser },
      { task: 'Narrator', model: pipelineModels.narrator, system: narratorPayload.narratorSystem, user: narratorPayload.narratorUser },
      { task: 'Summary', model: pipelineModels.postprocess, system: postprocessPayload.postprocessSystem, user: postprocessPayload.postprocessUser },
    ].map(item => ({
      task: item.task,
      model: item.model,
      user: item.user,
      userLength: item.user.length,
    })),
  }
}

async function runInterceptionTest(input: InterceptionTestRequest): Promise<Record<string, unknown>> {
  const model = normalizeModel(input.model)
  const provider = providerForModel(model)
  const apiKey = providerApiKey(provider, input.apiKey)
  const systemInstruction = String(input.systemInstruction || '').trim()
  const narratorSystem = String(input.narratorSystem || '').trim()
  const narratorUser = String(input.narratorUser || '').trim()
  if (!narratorUser) throw new Error('缺少测试 Prompt，请先生成快照或选择 Prompt 文件。')
  const messages = promptMessages('', [systemInstruction, narratorSystem, narratorUser].filter(Boolean).join('\n\n'))
  const requestFile = writeDebugArtifact(interceptionDebugDir, 'interception-test-request', {
    artifactType: 'interception-test-request',
    createdAt: new Date().toISOString(),
    provider,
    model,
    messages: messages.map(message => ({
      role: message.role,
      contentLength: message.content.length,
      content: message.content,
    })),
  }, { latest: true })
  try {
    const result = await requestModelContent(apiKey, messages, Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8, model, 'ContentInterceptionTest', 4096, undefined, normalizeReasoningEffort(input.reasoningEffort))
    const outputTokens = result.metrics.outputTokens || result.metrics.estimatedOutputTokens
    const responseFile = writeDebugArtifact(interceptionDebugDir, 'interception-test-response', {
      artifactType: 'interception-test-response',
      createdAt: new Date().toISOString(),
      ok: true,
      provider,
      model,
      requestFile,
      raw: result.raw,
      metrics: result.metrics,
    })
    return {
      ok: true,
      provider,
      providerLabel: providerLabel(provider),
      model,
      requestFile,
      responseFile,
      raw: result.raw,
      durationMs: result.metrics.durationMs,
      ttftMs: result.metrics.ttftMs || result.metrics.durationMs,
      tps: Number((outputTokens / Math.max(0.001, result.metrics.durationMs / 1000)).toFixed(2)),
      usage: {
        inputTokens: result.metrics.inputTokens,
        outputTokens: result.metrics.outputTokens,
        totalTokens: result.metrics.totalTokens,
        estimatedOutputTokens: result.metrics.estimatedOutputTokens,
      },
    }
  } catch (error) {
    const errorFile = writeDebugArtifact(interceptionDebugDir, 'interception-test-error', {
      artifactType: 'interception-test-error',
      createdAt: new Date().toISOString(),
      ok: false,
      provider,
      model,
      requestFile,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      provider,
      providerLabel: providerLabel(provider),
      model,
      requestFile,
      errorFile,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function callModelWithPublicTrace(
  stage: PipelineEvent['stage'],
  label: string,
  messages: ChatMessage[],
  options: { temperature: number; apiKey?: string; model?: string; maxTokens?: number; timeoutMs?: number; reasoningEffort?: string },
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
  longTermState: string
  recentTurns: string
  directorRecentTurns: string
  shortHistoricalSummary: string
  longHistoricalSummary: string
  turnSummaries: string
} {
  const characterStatus = renderRelevantStatus(input)
  const longTermState = renderLongTermState(input.longTermState, {
    characterStatus: JSON.parse(characterStatus).state,
    keyItems: input.itemState,
    keyInfo: input.keyInfo,
    physicalConstraints: input.physicalConstraints,
  })
  const rawFile = storyRawTurnLogFile(input.storyId, input.storyName)
  const turnSummaries = readTurnSummaries(turnSummariesPath(rawFile)) || String(input.globalContext || '').trim()
  const turnSummaryL2 = readTurnSummaryL2(turnSummaryL2Path(rawFile))
  const currentTurnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  return {
    storyContext: String(input.storyContext || '').trim(),
    longTermState,
    recentTurns: renderConversation(input.recentTurns),
    directorRecentTurns: renderRecentConversationByAssistantTurns(input.recentTurns, 1),
    shortHistoricalSummary: selectHistoricalSummariesForPrompt(turnSummaries, currentTurnIndex, 5, 10),
    longHistoricalSummary: renderHistoricalSummariesWithL2(turnSummaries, turnSummaryL2, { currentTurnIndex, excludeRecentTurnCount: 5 }),
    turnSummaries,
  }
}

function selectHistoricalSummariesForPrompt(value: unknown, currentTurnIndex: number, excludeRecentTurnCount: number, limit = Number.POSITIVE_INFINITY): string {
  const cutoff = Number(currentTurnIndex) - excludeRecentTurnCount
  const lines = String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
    .filter(line => {
      const match = line.match(/^第(\d+)轮[:：]/)
      if (!match) return true
      return Number(match[1]) < cutoff
    })
  const kept = Number.isFinite(limit) ? lines.slice(-Math.max(0, limit)) : lines
  return kept.map(line => `- ${line}`).join('\n')
}

function normalizePlayerOptions(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map(option => {
      if (typeof option === 'string') {
        const text = option.trim()
        return text ? { inputText: text } : null
      }
      if (!option || typeof option !== 'object') return null
      const record = option as Record<string, unknown>
      const inputText = String(record.inputText || record.label || record.description || '').trim()
      return inputText ? { inputText } : null
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
  const direction = compactStringArray(record.direction || record.directions, 3, 80)
  const prototypes = compactStringArray(record.prototypes || record.usablePrototypes, 3, 50)
  return [
    goal ? `目标：${goal}` : '',
    direction.length ? `方向：\n${direction.map(item => `- ${item}`).join('\n')}` : '',
    prototypes.length ? `可用原型：${prototypes.join(' / ')}` : '',
  ].filter(Boolean).join('\n')
}

function compactText(value: unknown, maxLength = 120): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function compactTextWithoutEllipsis(value: unknown, maxLength = 120): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text
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

function compactDirectorPlan(value: unknown): Record<string, unknown> {
  const root = compactRecord(value)
  const source = directorPlanSource(root)
  const output = pruneEmpty({
    sceneOutcome: compactText(firstPresent(source, ['sceneOutcome', '落点局面', '新局面', '本轮落点', '本轮结束局面']), 160),
    plotDrive: compactText(firstPresent(source, ['plotDrive', '剧情推动力', '剧情驱动力', '推动力']), 180),
    mainPresentation: compactText(firstPresent(source, ['mainPresentation', '主要呈现方式', '呈现方式', 'primaryMode']), 24),
    supportingPresentation: compactStringArray(firstPresent(source, ['supportingPresentation', '辅助呈现方式', '辅助方式', 'secondaryMode']), 2, 24),
    narrativeStyle: compactText(firstPresent(source, ['narrativeStyle', '叙事风格', '动态叙事风格', '写法种子', '风格']), 160),
  }) as Record<string, unknown>
  return output
}

function hasUsableDirectorPlan(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0
}

interface RecallQuestion {
  question: string
  turnIndexes: number[]
}

interface RecallSnippet {
  source: string
  turnIndex: number
  text: string
}

interface RecallCache {
  createdAt: string
  createdAtTurn: number
  basis: string
  questions: RecallQuestion[]
  snippets: RecallSnippet[]
  resultCount: number
}

interface RecallWorkerEvent {
  id: string
  createdAt: string
  createdAtTurn: number
  basis: string
  output: Record<string, unknown>
}

const recallWorkerInFlight = new Set<string>()

function normalizeRecallQuestions(value: unknown): RecallQuestion[] {
  const record = compactRecord(value)
  const directTurnIndexes = normalizeRecallTurnIndexes(firstPresent(record, ['turnIndexes', 'turns', 'turnIndex', '轮次', '回看轮次']))
  if (directTurnIndexes.length) {
    return [{ question: '', turnIndexes: directTurnIndexes }]
  }
  const source = Array.isArray(record.questions) ? record.questions : []
  return source
    .map(item => {
      const itemRecord = compactRecord(item)
      const question = compactText(itemRecord.question || itemRecord.问题, 160)
      const turnIndexes = normalizeRecallTurnIndexes(firstPresent(itemRecord, ['turnIndexes', 'turns', 'turnIndex', '轮次', '回看轮次']))
      if (!turnIndexes.length) return null
      return { question, turnIndexes }
    })
    .filter((item): item is RecallQuestion => Boolean(item && item.question))
    .slice(0, 3)
}

function normalizeRecallTurnIndexes(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [value]
  const indexes = source
    .flatMap(item => {
      if (typeof item === 'string') return item.match(/\d+/g) || []
      return [item]
    })
    .map(item => Math.floor(Number(item)))
    .filter(item => Number.isFinite(item) && item >= 0)
  return Array.from(new Set(indexes)).slice(0, 2)
}

function normalizeRecallSnippets(value: unknown): RecallSnippet[] {
  const record = compactRecord(value)
  const source = Array.isArray(record.snippets) ? record.snippets : []
  return source
    .map(item => {
      const itemRecord = compactRecord(item)
      const sourceRef = compactText(itemRecord.source || itemRecord.来源, 100)
      const turnIndex = Math.floor(Number(itemRecord.turnIndex ?? itemRecord.轮次))
      const text = String(itemRecord.text || itemRecord.正文 || '').trim()
      if (!sourceRef || !Number.isFinite(turnIndex) || !text) return null
      return { source: sourceRef, turnIndex, text: compactText(text, 1800) }
    })
    .filter((item): item is RecallSnippet => Boolean(item))
    .slice(0, 2)
}

function renderRecallSnippetsForPrompt(value: RecallSnippet[]): string {
  if (!value.length) return '（无）'
  return value.map(item => [
    `## 旧正文摘录：${item.source}`,
    item.text,
  ].join('\n')).join('\n\n')
}

function recallCachePath(rawFile: string): string {
  return path.join(path.dirname(rawFile), 'recall-cache.json')
}

function recallWorkerEventsPath(rawFile: string): string {
  return path.join(path.dirname(rawFile), 'recall-worker-events.jsonl')
}

function appendRecallWorkerEvent(input: PipelineContext, event: Omit<RecallWorkerEvent, 'id' | 'createdAt'>): RecallWorkerEvent {
  const file = recallWorkerEventsPath(storyRawTurnLogFile(input.storyId, input.storyName))
  const createdAt = new Date().toISOString()
  const record: RecallWorkerEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    ...event,
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8')
  return record
}

function readRecallWorkerEvents(input: { storyId?: string; storyName?: string; after?: string; turnIndex?: unknown }): RecallWorkerEvent[] {
  const file = recallWorkerEventsPath(storyRawTurnLogFile(input.storyId, input.storyName))
  if (!fs.existsSync(file)) return []
  const after = String(input.after || '').trim()
  const turnIndex = Number(input.turnIndex)
  const rows = fs.readFileSync(file, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => parseJsonObject(line) as Partial<RecallWorkerEvent>)
    .filter(record => record && typeof record === 'object')
    .map(record => ({
      id: String(record.id || ''),
      createdAt: String(record.createdAt || ''),
      createdAtTurn: Math.floor(Number(record.createdAtTurn)),
      basis: String(record.basis || ''),
      output: record.output && typeof record.output === 'object' && !Array.isArray(record.output) ? record.output as Record<string, unknown> : {},
    }))
    .filter(record => record.id && Number.isFinite(record.createdAtTurn))
    .filter(record => !Number.isFinite(turnIndex) || record.createdAtTurn === turnIndex)
  const startIndex = after ? rows.findIndex(record => record.id === after) + 1 : 0
  return rows.slice(Math.max(0, startIndex)).slice(-20)
}

function normalizeRecallCache(value: unknown): RecallCache | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const createdAtTurn = Math.floor(Number(record.createdAtTurn))
  const snippets = normalizeRecallSnippets(record)
  if (!Number.isFinite(createdAtTurn) || !snippets.length) return null
  return {
    createdAt: String(record.createdAt || ''),
    createdAtTurn,
    basis: String(record.basis || ''),
    questions: normalizeRecallQuestions(record),
    snippets,
    resultCount: Math.max(0, Math.floor(Number(record.resultCount || 0))),
  }
}

function writeRecallCache(input: PipelineContext, cache: RecallCache): void {
  const file = recallCachePath(storyRawTurnLogFile(input.storyId, input.storyName))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  writeJsonFile(file, cache)
}

function readRecallCacheForPrompt(input: PipelineContext, currentTurnIndex: number): { cache: RecallCache | null; evidence: string } {
  const file = recallCachePath(storyRawTurnLogFile(input.storyId, input.storyName))
  const cache = normalizeRecallCache(readJsonFileIfExists(file))
  if (!cache || cache.createdAtTurn >= currentTurnIndex) return { cache: null, evidence: '（无）' }
  return {
    cache,
    evidence: renderRecallSnippetsForPrompt(cache.snippets),
  }
}

function directorPlanSource(value: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['directorPlan', 'director', 'plan', 'output', 'result', '本轮导演计划', '导演计划']) {
    const nested = value[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Record<string, unknown>
  }
  return value
}

function firstPresent(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value) && value.length) return value
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return undefined
}

function compactRecentDirectorPlans(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => compactDirectorPlan(item))
    .filter(item => Object.keys(item).length > 0)
    .slice(-5)
}

function normalizeTurnSummary(value: unknown, finalText = ''): string {
  const summary = compactTextWithoutEllipsis(value, 80)
  if (summary) return summary
  return compactTextWithoutEllipsis(
    String(finalText || '')
      .replace(/\s+/g, ' ')
      .replace(/[。！？!?].*$/s, match => match.slice(0, 1)),
    60,
  )
}

function normalizeFeedbackBreakdown(value: Record<string, unknown>): Record<string, string> {
  const repetitionIssue = compactText(value.文字细节重复 || value.存在重复 || value.narrativeRepetitionFeedback, 160)
  const plotDesignRepetition = compactText(value.剧情设计重复 || value.plotDesignRepetitionFeedback, 180)
  const plotPacingDrag = compactText(value.剧情速度拖沓 || value.plotPacingDragFeedback, 180)
  return {
    文字细节重复: repetitionIssue,
    剧情设计重复: plotDesignRepetition,
    剧情速度拖沓: plotPacingDrag,
  }
}

async function summarizeOpeningText(input: OpeningSummaryRequest): Promise<Record<string, unknown>> {
  const assetDir = getStoryAssetDir(input.assetId)
  const config = assetDir ? readProgramConfig(assetDir) : null
  const existingSummary = String(config?.openingSummary || '').trim()
  if (existingSummary) {
    return {
      summary: existingSummary,
      source: 'program-config',
      config,
    }
  }
  const openingText = String(input.openingText || config?.openingText || '').trim()
  if (!openingText) return { summary: '' }
  const model = buildPipelineModels(input.model, input.pipelineModels).postprocess
  const messages = renderPromptMessagePair('opening-summary.md', {
    storyContext: String(input.storyContext || config?.worldview || '').trim(),
    openingText,
  })
  const result = await callModel(promptMessages(messages.system, messages.user), {
    temperature: 0.2,
    apiKey: pipelineApiKeyForModel(input, model),
    model,
    maxTokens: 500,
    debugLabel: 'OpeningSummary',
    signal: AbortSignal.timeout(Math.min(20_000, postprocessTimeoutMs)),
    reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
  })
  const summary = normalizeTurnSummary(result.json.summary, openingText)
  let nextConfig = config
  if (assetDir && config && summary) {
    nextConfig = normalizeProgramConfig({
      ...config,
      openingSummary: summary,
    } as Record<string, unknown>, config)
    writeProgramConfig(assetDir, nextConfig)
  }
  return {
    summary,
    source: assetDir ? 'generated-and-saved' : 'generated',
    config: nextConfig,
    raw: result.json,
    metrics: result.metrics,
  }
}

function turnSummaryRangeBlock(value: unknown, startTurn: number, endTurn: number): string {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
    .filter(line => {
      const match = line.match(/^第(\d+)轮[:：]/)
      if (!match) return false
      const turn = Number(match[1])
      return turn >= startTurn && turn <= endTurn
    })
    .join('\n')
}

function hasTurnSummaryL2(value: unknown, startTurn: number, endTurn: number): boolean {
  return String(value || '').split(/\r?\n/).some(line => line.trim().startsWith(`第${startTurn}-${endTurn}轮：`))
}

async function ensureTurnSummaryL2(
  input: PipelineContext,
  options: {
    model: string
    temperature: number
    turnIndex: number
    emit: (event: PipelineEvent) => void
  },
): Promise<void> {
  const turnIndex = Math.floor(Number(options.turnIndex))
  if (!Number.isFinite(turnIndex) || turnIndex < 10 || turnIndex % 10 !== 0) return
  const startTurn = turnIndex - 9
  const endTurn = turnIndex
  const rawFile = storyRawTurnLogFile(input.storyId, input.storyName)
  const l1Path = turnSummariesPath(rawFile)
  const l2Path = turnSummaryL2Path(rawFile)
  const l1Text = readTurnSummaries(l1Path)
  const l2Text = readTurnSummaryL2(l2Path)
  if (hasTurnSummaryL2(l2Text, startTurn, endTurn)) return
  const l1SummaryBlock = turnSummaryRangeBlock(l1Text, startTurn, endTurn)
  if (!l1SummaryBlock) return

  options.emit({ type: 'stage_tick', stage: 'postprocessSummary', label: 'Summary', message: `正在压缩 L2 历史总结：第${startTurn}-${endTurn}轮。` })
  const messages = renderPromptMessagePair('summary-l2.md', {
    startTurn: String(startTurn),
    endTurn: String(endTurn),
    l1SummaryBlock,
  })
  const result = await callModelWithPublicTrace('postprocessSummary', 'SummaryL2', promptMessages(messages.system, messages.user), {
    temperature: 0.2,
    apiKey: pipelineApiKeyForModel(input, options.model),
    model: options.model,
    maxTokens: 800,
    timeoutMs: postprocessTimeoutMs,
    reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
  }, options.emit, [
    `公开日志：正在把第${startTurn}-${endTurn}轮 L1 总结压缩成 L2。`,
    '公开日志：SummaryL2 仍在等待模型返回结构化总结。',
  ])
  const summary = normalizeTurnSummary(result.json.summary, l1SummaryBlock)
  appendTurnSummaryL2(l2Path, startTurn, endTurn, summary)
  options.emit({ type: 'stage_tick', stage: 'postprocessSummary', label: 'Summary', message: `L2 历史总结已写入：第${startTurn}-${endTurn}轮。` })
}

function buildDirectorPromptPayload(input: GenerateRequest, temperature: number): {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  feedbackMemory: string
  turnIndex: number
  playerInput: string
  directorSystem: string
  directorUser: string
} {
  const context = buildRuntimeBlocks(input)
  const feedbackMemory = String(input.feedbackText || '').trim()
  const playerFeedback = String(input.playerFeedback || '').trim() || '（无）'
  const directorStyle = String(input.directorStyle || '').trim() || '（无）'
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const playerInput = input.playerInput.trim()
  const model = buildPipelineModels(input.model, input.pipelineModels).director
  const directorMessages = renderPromptMessagePair('director.md', {
    storyContext: context.storyContext,
    longTermState: context.longTermState,
    directorRecentTurns: context.directorRecentTurns || '（无）',
    longHistoricalSummary: context.longHistoricalSummary || '（无）',
    recallEvidence: String(input.recallEvidence || '').trim() || '（无）',
    feedbackMemory,
    playerFeedback,
    directorStyle,
    playerInput,
  })
  const directorSystem = directorMessages.system
  const directorUser = directorMessages.user
  return {
    model,
    temperature,
    context,
    feedbackMemory,
    turnIndex,
    playerInput,
    directorSystem,
    directorUser,
  }
}

function buildRecallQaPromptPayload(input: GenerateRequest, context: ReturnType<typeof buildRuntimeBlocks>, options: {
  playerInput: string
  searchEvidence?: string
}): {
  system: string
  user: string
} {
  const messages = renderPromptMessagePair('recall-qa.md', {
    storyContext: context.storyContext || '（无）',
    longTermState: context.longTermState || '（无）',
    longHistoricalSummary: context.longHistoricalSummary || '（无）',
    recentTurns: context.recentTurns || '（无）',
    playerInput: options.playerInput,
    searchEvidence: String(options.searchEvidence || '').trim() || '（无）',
  })
  return {
    system: messages.system,
    user: messages.user,
  }
}

async function runRecallSnippets(
  input: GenerateRequest,
  context: ReturnType<typeof buildRuntimeBlocks>,
  options: {
    model: string
    playerInput: string
    currentTurnIndex: number
  },
  emit: (event: PipelineEvent) => void,
): Promise<{ questions: RecallQuestion[]; snippets: RecallSnippet[]; results: RecallResult[]; evidence: string; output: Record<string, unknown> }> {
  emit({ type: 'stage_start', stage: 'recall', label: 'Recall', message: '召回：根据压缩历史决定最多两轮旧正文。' })
  const questionPayload = buildRecallQaPromptPayload(input, context, {
    playerInput: options.playerInput,
  })
  const questionResult = await callModelWithPublicTrace('recall', 'Recall', promptMessages(questionPayload.system, questionPayload.user), { temperature: 0.2, apiKey: pipelineApiKeyForModel(input, options.model), model: options.model, maxTokens: 1200, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在判断是否需要翻旧正文。',
    '公开日志：正在从压缩历史里选择最多两轮旧正文。',
    '公开日志：Recall 仍在等待模型返回轮次列表。',
  ])
  const questions = normalizeRecallQuestions(questionResult.json)
  if (!questions.length) {
    const json = { turnRequests: [], snippets: [] }
    emit({ type: 'stage_result', stage: 'recall', label: 'Recall', message: '召回完成：本轮不需要注入旧正文。', json })
    return { questions: [], snippets: [], results: [], evidence: '（无）', output: json }
  }

  const cutoff = options.currentTurnIndex - 5
  const turnIndexes = Array.from(new Set(questions.flatMap(question => question.turnIndexes)))
    .filter(turnIndex => turnIndex < cutoff)
    .slice(0, 2)
  const results = readStoryTurnsByIndex(storyRawTurnLogFile(input.storyId, input.storyName), turnIndexes)
  const snippets = results.slice(0, 2).map(result => ({
    source: result.source,
    turnIndex: result.turnIndex,
    text: compactText(result.text, 1800),
  }))
  const json = { turnRequests: questions, snippets, loadedTurnIndexes: turnIndexes, resultCount: results.length }
  emit({ type: 'stage_result', stage: 'recall', label: 'Recall', message: snippets.length ? '召回完成：旧正文摘录已准备给后续 Director/Narrator。' : '召回完成：已选择轮次，但原文未命中。', json })
  return { questions, snippets, results, evidence: buildRecallSnippetBlock(results), output: json }
}

function appendCurrentTurnForRecall(recentTurns: ConversationItem[] | undefined, playerInput: string, finalText: string): ConversationItem[] {
  const turns: ConversationItem[] = [
    ...(Array.isArray(recentTurns) ? recentTurns : []),
    { role: 'user', content: playerInput },
    { role: 'assistant', content: finalText },
  ]
  return turns.slice(-12)
}

function triggerRecallWorker(
  input: GenerateRequest,
  options: {
    basis: string
    model: string
    playerInput: string
    finalText: string
    currentTurnIndex: number
  },
): void {
  const rawFile = storyRawTurnLogFile(input.storyId, input.storyName)
  const key = `${rawFile}:${options.basis}:${options.currentTurnIndex}`
  if (recallWorkerInFlight.has(key)) return
  recallWorkerInFlight.add(key)
  void (async () => {
    try {
      const workerInput: GenerateRequest = {
        ...input,
        playerInput: options.playerInput,
        recentTurns: appendCurrentTurnForRecall(input.recentTurns, options.playerInput, options.finalText),
        turnIndex: options.currentTurnIndex,
      }
      const context = buildRuntimeBlocks(workerInput)
      const result = await runRecallSnippets(workerInput, context, {
        model: options.model,
        playerInput: options.playerInput,
        currentTurnIndex: options.currentTurnIndex,
      }, () => {})
      appendRecallWorkerEvent(workerInput, {
        createdAtTurn: options.currentTurnIndex,
        basis: options.basis,
        output: result.output,
      })
      if (!result.snippets.length) return
      writeRecallCache(workerInput, {
        createdAt: new Date().toISOString(),
        createdAtTurn: options.currentTurnIndex,
        basis: options.basis,
        questions: result.questions,
        snippets: result.snippets,
        resultCount: result.results.length,
      })
    } catch (error) {
      appendRecallWorkerEvent(input, {
        createdAtTurn: options.currentTurnIndex,
        basis: options.basis,
        output: {
          turnRequests: [],
          snippets: [],
          error: error instanceof Error ? error.message : String(error),
        },
      })
      writeLlmDebugFile({
        label: 'RecallWorker-error',
        raw: '',
        messages: [],
        error: error instanceof Error ? error : new Error(String(error)),
      })
    } finally {
      recallWorkerInFlight.delete(key)
    }
  })()
}

function buildNarratorPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  planFeedback?: unknown
  playerInput: string
  directorPlan: Record<string, unknown>
}): {
  model: string
  temperature: number
  playerInput: string
  narratorSystem: string
  narratorUser: string
} {
  const narratorStyle = String(input.narratorStyle || '').trim() || '（无）'
  const playerFeedback = String(input.playerFeedback || '').trim() || '（无）'
  const playerInput = options.playerInput || input.playerInput.trim()
  const narratorMessages = renderPromptMessagePair('narrator.md', {
    storyContext: options.context.storyContext || '（无）',
    directorPlan: JSON.stringify(options.directorPlan),
    longTermState: options.context.longTermState,
    recallEvidence: String(input.recallEvidence || '').trim() || '（无）',
    shortHistoricalSummary: options.context.shortHistoricalSummary || '（无）',
    planFeedback: renderPlanFeedbackForNarrator(options.planFeedback),
    recentTurns: options.context.recentTurns,
    narratorStyle,
    playerFeedback,
    playerInput,
  })
  const narratorSystem = narratorMessages.system
  const narratorUser = narratorMessages.user
  return {
    model: options.model,
    temperature: options.temperature,
    playerInput,
    narratorSystem,
    narratorUser,
  }
}

function renderPlanFeedbackForNarrator(value: unknown): string {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const rows = [
    ['文字细节重复', record.文字细节重复],
    ['剧情设计重复', record.剧情设计重复],
    ['剧情速度拖沓', record.剧情速度拖沓],
    ['叙事整改要求', record.叙事整改要求 || record.revisionInstruction],
  ]
    .map(([label, item]) => {
      const text = compactText(item, 180)
      return text ? `- ${label}：${text}` : ''
    })
    .filter(Boolean)
  return rows.length ? rows.join('\n') : '（无）'
}

function extractNarratorFinalText(entry: LayerResult): string {
  const json = entry.json
  const raw = entry.raw || ''
  const text = typeof json.draftText === 'string'
    ? json.draftText
    : typeof json.text === 'string'
      ? json.text
      : typeof json.content === 'string'
        ? json.content
        : typeof json.finalText === 'string'
          ? json.finalText
          : String(raw)
  return text.trim()
}

function buildPostprocessPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature?: number
  playerInput: string
  finalText: string
  directorPlan: Record<string, unknown>
  context: ReturnType<typeof buildRuntimeBlocks>
  turnIndex: number
}): {
  model: string
  temperature: number
  playerInput: string
  finalText: string
  postprocessSystem: string
  postprocessUser: string
} {
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.5
  const statusModel = buildStatusModel(input)
  const postprocessMessages = renderPromptMessagePair('summary.md', {
    storyContext: String(input.storyContext || '').trim() || '（无）',
    longTermState: options.context.longTermState,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    itemState: renderItemState(input.itemState),
    controlledCharacterName: normalizeControlledCharacterName(input.controlledCharacterName) || '（未指定）',
    playerInput: options.playerInput,
    finalText: options.finalText,
    statusUpdateMaterial: renderStatusUpdateMaterial(options.playerInput, options.finalText),
  })
  const postprocessSystem = postprocessMessages.system
  const postprocessUser = postprocessMessages.user
  return {
    model: options.model,
    temperature,
    playerInput: options.playerInput,
    finalText: options.finalText,
    postprocessSystem,
    postprocessUser,
  }
}

function buildPlanFeedbackPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature?: number
  playerInput: string
  finalText?: string
  directorPlan: Record<string, unknown>
  context: ReturnType<typeof buildRuntimeBlocks>
}): {
  model: string
  temperature: number
  playerInput: string
  finalText: string
  postprocessSystem: string
  postprocessUser: string
} {
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.5
  const feedbackMessages = renderPromptMessagePair('feedback.md', {
    storyContext: String(input.storyContext || '').trim() || '（无）',
    playerFeedback: String(input.playerFeedback || '').trim() || '（无）',
    directorStyle: String(input.directorStyle || '').trim() || '（无）',
    narratorStyle: String(input.narratorStyle || '').trim() || '（无）',
    recentTurns: options.context.recentTurns,
    directorPlan: JSON.stringify(options.directorPlan),
    playerInput: options.playerInput,
  })
  return {
    model: options.model,
    temperature,
    playerInput: options.playerInput,
    finalText: String(options.finalText || ''),
    postprocessSystem: feedbackMessages.system,
    postprocessUser: feedbackMessages.user,
  }
}

async function generate(
  input: GenerateRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const playerInput = String(input.playerInput || '').trim()
  if (!playerInput) throw new Error('playerInput is required')

  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const directorTemperature = Math.min(temperature, 0.4)
  const currentTurnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const requestedModel = normalizeModel(input.model)
  const pipelineModels = buildPipelineModels(requestedModel, input.pipelineModels)
  const cachedRecall = readRecallCacheForPrompt(input, currentTurnIndex)
  const generationInput: GenerateRequest = {
    ...input,
    recallEvidence: cachedRecall.evidence,
  }
  const directorPayload = buildDirectorPromptPayload(generationInput, directorTemperature)
  const directorModel = directorPayload.model
  const narratorModel = pipelineModels.narrator

  let director: LayerResult | null = null
  let directorPlan: Record<string, unknown>
  if (input.director && typeof input.director === 'object' && Object.keys(input.director).length) {
    directorPlan = compactDirectorPlan(input.director)
    if (!hasUsableDirectorPlan(directorPlan)) throw new Error('复用的 Director 计划缺少可用字段。')
    emit({ type: 'stage_skip', stage: 'director', label: 'Director', message: '导演层已复用：继续未完成时沿用上一轮计划。', json: directorPlan })
  } else {
    emit({ type: 'stage_start', stage: 'director', label: 'Director', message: '导演层：根据用户输入、当前状态、历史总结和 Plot，生成本轮计划。' })
    const directorMessages = promptMessages(directorPayload.directorSystem, directorPayload.directorUser)
    director = await callModelWithPublicTrace('director', 'Director', directorMessages, { temperature: directorTemperature, apiKey: pipelineApiKeyForModel(input, directorModel), model: directorModel, maxTokens: directorMaxTokens, timeoutMs: directorTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在拆解用户输入和当前场景。',
      '公开日志：正在安排本轮剧情步伐和描写方式。',
      '公开日志：正在生成 Narrator 可执行的本轮计划。',
      '公开日志：导演层仍在等待模型返回结构化计划。',
    ])
    directorPlan = compactDirectorPlan(director.json)
    if (!hasUsableDirectorPlan(directorPlan)) {
      const file = writeLlmDebugFile({
        label: 'Director-empty-plan',
        raw: director.raw,
        messages: directorMessages,
        error: new Error('Director 返回 JSON，但缺少可用导演计划字段。'),
      })
      throw new Error(`Director 返回 JSON，但导演计划为空；原始返回已保存：${file}`)
    }
    emit({ type: 'stage_result', stage: 'director', label: 'Director', message: '导演层完成：本轮计划已生成。', json: directorPlan })
  }
  let planFeedback: Record<string, unknown>
  if (input.planFeedback && typeof input.planFeedback === 'object' && !Array.isArray(input.planFeedback) && Object.keys(input.planFeedback).length) {
    planFeedback = input.planFeedback as Record<string, unknown>
    emit({ type: 'stage_skip', stage: 'planFeedback', label: 'Feedback', message: '反馈已复用：继续未完成时沿用上一轮整改要求。', json: planFeedback })
  } else {
    const feedbackPayload = buildPlanFeedbackPromptPayload(input, {
      model: pipelineModels.postprocess,
      temperature: 0.5,
      playerInput,
      directorPlan,
      context: directorPayload.context,
    })
    emit({ type: 'stage_start', stage: 'planFeedback', label: 'Feedback', message: '反馈：审查最近正文和本轮计划，提前发现拖沓和重复。' })
    const feedbackResult = await callModelWithPublicTrace('planFeedback', 'Feedback', promptMessages(feedbackPayload.postprocessSystem, feedbackPayload.postprocessUser), { temperature: 0.5, apiKey: pipelineApiKeyForModel(input, pipelineModels.postprocess), model: pipelineModels.postprocess, maxTokens: postprocessMaxTokens, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在对照最近正文和本轮计划。',
      '公开日志：正在检查本轮计划是否拖沓或重复。',
      '公开日志：正在生成给 Narrator 的本轮整改要求。',
      '公开日志：Feedback 仍在等待模型返回结构化反馈。',
    ])
    planFeedback = feedbackResult.json
    emit({ type: 'stage_result', stage: 'planFeedback', label: 'Feedback', message: '反馈完成：整改要求已注入叙事层。', json: planFeedback })
  }
  const feedback = normalizeFeedbackBreakdown(planFeedback)

  const narratorPayload = buildNarratorPromptPayload(generationInput, {
    model: narratorModel,
    temperature,
    context: directorPayload.context,
    planFeedback,
    playerInput,
    directorPlan,
  })
  emit({ type: 'stage_start', stage: 'narrator', label: 'Narrator', message: '叙事层：按导演计划和反馈写用户可见正文。' })
  const narrator = await callModelWithPublicTrace('narrator', 'Narrator', promptMessages(narratorPayload.narratorSystem, narratorPayload.narratorUser), { temperature, apiKey: pipelineApiKeyForModel(input, narratorModel), model: narratorModel, maxTokens: narratorMaxTokens, timeoutMs: narratorTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在根据导演计划和反馈要求组织正文。',
    '公开日志：正在保持人物限知视角和物理约束。',
    '公开日志：正在生成候选项。',
    '公开日志：叙事层仍在等待模型返回正文。',
  ])
  const finalText = extractNarratorFinalText(narrator)
  appendRawTurnLog(storyRawTurnLogFile(input.storyId, input.storyName), {
    storyId: input.storyId,
    storyName: input.storyName,
    turnIndex: directorPayload.turnIndex,
    playerInput,
    finalText,
    createdAt: new Date().toISOString(),
  })
  emit({ type: 'visible_text', stage: 'narrator', label: 'Narrator', message: '叙事层完成：正文和候选项已显示，Summary 进入后台队列。', payload: { finalText, pipelineMode: generationPipeline.mode } })
  emit({ type: 'stage_result', stage: 'narrator', label: 'Narrator', message: '叙事层完成：正文已生成。', json: narrator.json })

  const physicalConstraints = normalizeLongTermState(input.longTermState, {
    physicalConstraints: input.physicalConstraints,
  }).physicalConstraints
  const longTermState = mergeLongTermState(input.longTermState, {
    characterStatus: input.statusState,
    keyItems: input.itemState,
    keyInfo: input.keyInfo,
    physicalConstraints,
  })
  void triggerRecallWorker({
    ...input,
    longTermState,
    keyInfo: normalizeLongTermState(longTermState).keyInfo,
    physicalConstraints,
  }, {
    basis: 'after-output',
    model: pipelineModels.postprocess,
    playerInput,
    finalText,
    currentTurnIndex: directorPayload.turnIndex,
  })

  return {
    finalText,
    pipelineMode: generationPipeline.mode,
    director: directorPlan,
    physicalConstraints,
    longTermState,
    keyInfo: normalizeLongTermState(longTermState).keyInfo,
    narrator: narrator.json,
    planFeedback,
    memoryRecall: {
      source: cachedRecall.cache ? 'cache' : 'none',
      createdAtTurn: cachedRecall.cache?.createdAtTurn ?? null,
      basis: cachedRecall.cache?.basis || '',
      turnRequests: cachedRecall.cache?.questions || [],
      snippets: cachedRecall.cache?.snippets || [],
      resultCount: cachedRecall.cache?.resultCount || 0,
    },
    playerOptions: normalizePlayerOptions(narrator.json.playerOptions),
    文字细节重复: feedback.文字细节重复,
    剧情设计重复: feedback.剧情设计重复,
    剧情速度拖沓: feedback.剧情速度拖沓,
    postprocess: null,
    pendingSummary: {
      summaryOnly: true,
      storyId: input.storyId,
      storyName: input.storyName,
      playerInput,
      finalText,
      director: directorPlan,
      recentDirectorPlans: compactRecentDirectorPlans([...(Array.isArray(input.recentDirectorPlans) ? input.recentDirectorPlans : []), directorPlan]),
      recentTurns: input.recentTurns,
      characters: input.characters,
      statusSchema: input.statusSchema,
      statusRoster: input.statusRoster,
      statusState: input.statusState,
      itemState: input.itemState,
      longTermState,
      keyInfo: normalizeLongTermState(longTermState).keyInfo,
      controlledCharacterName: input.controlledCharacterName,
      playerOptions: normalizePlayerOptions(narrator.json.playerOptions),
      physicalConstraints,
      feedbackText: directorPayload.feedbackMemory,
      directorStyle: input.directorStyle,
      narratorStyle: input.narratorStyle,
      storyContext: input.storyContext,
      turnIndex: directorPayload.turnIndex,
      model: requestedModel,
      temperature: 0.5,
      pipelineModels,
      createdAt: new Date().toISOString(),
    },
    model: requestedModel,
    pipelineModels,
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

  const requestedModel = normalizeModel(input.model)
  const pipelineModels = buildPipelineModels(requestedModel, input.pipelineModels)
  const postprocessModel = pipelineModels.postprocess
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const director = input.director && typeof input.director === 'object' ? input.director : {}
  const directorPlan = compactDirectorPlan(director)
  const context = buildRuntimeBlocks({
    playerInput,
    recentTurns: input.recentTurns,
    characters: input.characters,
    statusState: input.statusState,
    itemState: input.itemState,
    keyInfo: input.keyInfo,
    physicalConstraints: input.physicalConstraints,
    longTermState: input.longTermState,
  } as GenerateRequest)
  const summaryPayload = buildPostprocessPromptPayload(input as GenerateRequest, {
    model: postprocessModel,
    temperature,
    playerInput,
    finalText,
    directorPlan,
    context,
    turnIndex,
  })
  emit({ type: 'stage_start', stage: 'postprocessSummary', label: 'Summary', message: '总结：补写本轮总结和长期变量。' })
  const summaryMessages = promptMessages(summaryPayload.postprocessSystem, summaryPayload.postprocessUser)
  let summary = await callModelWithPublicTrace('postprocessSummary', 'Summary', summaryMessages, { temperature, apiKey: pipelineApiKeyForModel(input, postprocessModel), model: postprocessModel, maxTokens: postprocessMaxTokens, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在补跑总结。',
    '公开日志：正在补写本轮事实总结。',
    '公开日志：正在按最终正文更新人物状态、关键道具、关键信息和物理约束。',
    '公开日志：Summary 仍在等待模型返回结构化状态。',
  ])
  try {
    requireControlledCharacterStatusPatch(summary.json, input.controlledCharacterName)
  } catch (error) {
    emit({ type: 'stage_start', stage: 'postprocessSummary', label: 'Summary', message: '总结缺少当前操控人物状态，正在要求模型修正。' })
    const repairUser = [
      summaryPayload.postprocessUser,
      '',
      '# 上次输出无效，必须修正',
      error instanceof Error ? error.message : String(error),
      '',
      '上次 JSON：',
      JSON.stringify(summary.json),
      '',
      '只重新输出完整 JSON object。必须包含当前操控人物的人物名 patch，至少更新 `姿势` 或 `情绪`。',
    ].join('\n')
    summary = await callModelWithPublicTrace('postprocessSummary', 'Summary', promptMessages(summaryPayload.postprocessSystem, repairUser), { temperature: 0.2, apiKey: pipelineApiKeyForModel(input, postprocessModel), model: postprocessModel, maxTokens: postprocessMaxTokens, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在修正当前操控人物状态更新。',
      '公开日志：Summary 修正仍在等待模型返回结构化状态。',
    ])
    requireControlledCharacterStatusPatch(summary.json, input.controlledCharacterName)
  }
  emit({ type: 'stage_result', stage: 'postprocessSummary', label: 'Summary', message: '总结完成：状态和事实总结已更新。', json: summary.json })

  const normalizedStatusStatePatch = normalizeStatusStatePatchSubjects(summary.json.statusStatePatch, input.controlledCharacterName)
  const postprocessJson = { ...summary.json, statusStatePatch: normalizedStatusStatePatch }
  const turnSummary = normalizeTurnSummary(summary.json.turnSummary, finalText)
  appendTurnSummary(turnSummariesPath(storyRawTurnLogFile(input.storyId, input.storyName)), turnIndex, turnSummary)
  await ensureTurnSummaryL2(input, { model: postprocessModel, temperature, turnIndex, emit })
  const nextStatusSchema = mergeStatusSchema(input.statusSchema, summary.json.statusSchemaPatch)
  const nextStatusRoster = mergeStatusRoster(input.statusRoster, summary.json.statusRosterPatch, input.characters || [], normalizedStatusStatePatch)
  const nextStatusState = mergeStatusState(input.statusState, normalizedStatusStatePatch, nextStatusRoster, input.characters || [], nextStatusSchema)
  const nextItemState = mergeItemState(input.itemState, summary.json.itemStatePatch, turnIndex)
  const nextPhysicalConstraints = summary.json.physicalConstraints === undefined
    ? normalizeLongTermState(input.longTermState, { physicalConstraints: input.physicalConstraints }).physicalConstraints
    : normalizePhysicalConstraintList(summary.json.physicalConstraints)
  const nextKeyInfo = summary.json.keyInfo === undefined
    ? normalizeLongTermState(input.longTermState, { keyInfo: input.keyInfo }).keyInfo
    : normalizeKeyInfo(summary.json.keyInfo)
  const nextLongTermState = mergeLongTermState(input.longTermState, {
    characterStatus: nextStatusState,
    keyItems: nextItemState,
    keyInfo: nextKeyInfo,
    physicalConstraints: nextPhysicalConstraints,
  })
  void triggerRecallWorker({
    ...input,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
    itemState: nextItemState,
    keyInfo: nextKeyInfo,
    physicalConstraints: nextPhysicalConstraints,
    longTermState: nextLongTermState,
  }, {
    basis: 'after-summary',
    model: postprocessModel,
    playerInput,
    finalText,
    currentTurnIndex: turnIndex,
  })

  return {
    finalText,
    pipelineMode: postprocessPipeline.mode,
    director: directorPlan,
    postprocess: postprocessJson,
    postprocessSummary: postprocessJson,
    physicalConstraints: nextPhysicalConstraints,
    turnSummary,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
    itemState: nextItemState,
    keyInfo: nextKeyInfo,
    longTermState: nextLongTermState,
    skipFeedbackMemoryUpdate: true,
    model: requestedModel,
    pipelineModels,
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
        pipelineModels: buildPipelineModels(),
        pipelines: {
          generation: generationPipeline,
          postprocess: postprocessPipeline,
        },
        models: modelCatalog,
        providers: {
          deepseek: {
            baseUrl: providerBaseUrl('deepseek'),
            hasApiKey: providerHasApiKey('deepseek'),
          },
          infron: {
            baseUrl: providerBaseUrl('infron'),
            hasApiKey: providerHasApiKey('infron'),
          },
        },
        baseUrl: providerBaseUrl('deepseek'),
        hasApiKey: providerHasApiKey('deepseek'),
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/save-state') {
      sendJson(res, 200, { state: readSaveState() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/recall-worker-events') {
      sendJson(res, 200, {
        events: readRecallWorkerEvents({
          storyId: url.searchParams.get('storyId') || '',
          storyName: url.searchParams.get('storyName') || '',
          after: url.searchParams.get('after') || '',
          turnIndex: url.searchParams.get('turnIndex'),
        }),
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/provider-api-key') {
      const body = await readBody(req)
      const input = JSON.parse(body || '{}') as Record<string, unknown>
      const provider = normalizeProvider(input.provider)
      writeSavedProviderApiKey(provider, input.apiKey)
      sendJson(res, 200, { ok: true, provider, hasApiKey: providerHasApiKey(provider) })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/recall-worker/run') {
      const body = await readBody(req)
      const input = JSON.parse(body || '{}') as GenerateRequest & { finalText?: string; basis?: string }
      const playerInput = String(input.playerInput || '').trim()
      const finalText = String(input.finalText || '').trim()
      if (!playerInput) {
        sendJson(res, 400, { error: 'playerInput is required' })
        return
      }
      if (!finalText) {
        sendJson(res, 400, { error: 'finalText is required' })
        return
      }
      const pipelineModels = buildPipelineModels(input.model, input.pipelineModels)
      triggerRecallWorker(input, {
        basis: String(input.basis || 'frontend-retry'),
        model: pipelineModels.postprocess,
        playerInput,
        finalText,
        currentTurnIndex: normalizeTurnIndex(input.turnIndex, input.recentTurns),
      })
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'DELETE' && url.pathname === '/api/provider-api-key') {
      const body = await readBody(req)
      const input = body ? JSON.parse(body) as Record<string, unknown> : {}
      const provider = normalizeProvider(input.provider || url.searchParams.get('provider'))
      deleteSavedProviderApiKey(provider)
      sendJson(res, 200, { ok: true, provider, hasApiKey: providerHasApiKey(provider) })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/provider-test') {
      const body = await readBody(req)
      const input = JSON.parse(body) as ProviderTestRequest
      sendJson(res, 200, await testProvider(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/opening-summary') {
      const body = await readBody(req)
      const input = JSON.parse(body || '{}') as OpeningSummaryRequest
      sendJson(res, 200, await summarizeOpeningText(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/provider-speed-test') {
      const body = await readBody(req)
      const input = JSON.parse(body) as ProviderSpeedTestRequest
      sendJson(res, 200, await testProviderSpeed(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/content-interception/prompt') {
      const body = await readBody(req)
      const input = JSON.parse(body) as InterceptionPromptRequest
      sendJson(res, 200, buildInterceptionNarratorPrompt(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/prompt-preview') {
      const body = await readBody(req)
      const input = JSON.parse(body) as InterceptionPromptRequest
      sendJson(res, 200, buildPromptPreview(input))
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/content-interception/test') {
      const body = await readBody(req)
      const input = JSON.parse(body) as InterceptionTestRequest
      const result = await runInterceptionTest(input)
      sendJson(res, result.ok ? 200 : 200, result)
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

    if (req.method === 'GET' && url.pathname === '/api/save-slots') {
      sendJson(res, 200, { slots: listSaveSlots() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/save-slots') {
      const body = await readBody(req)
      const input = JSON.parse(body) as Record<string, unknown>
      const slot = createSaveSlot(input)
      const { state: _state, ...summary } = slot
      sendJson(res, 200, { ok: true, slot: summary, file: path.relative(rootDir, saveSlotFile(slot.id)) })
      return
    }

    const saveSlotMatch = url.pathname.match(/^\/api\/save-slots\/([^/]+)$/)
    if (saveSlotMatch && req.method === 'GET') {
      sendJson(res, 200, { slot: readSaveSlot(decodeURIComponent(saveSlotMatch[1] || '')) })
      return
    }

    if (saveSlotMatch && req.method === 'PATCH') {
      const body = await readBody(req)
      const input = JSON.parse(body) as Record<string, unknown>
      const slot = updateSaveSlot(decodeURIComponent(saveSlotMatch[1] || ''), input)
      const { state: _state, ...summary } = slot
      sendJson(res, 200, { ok: true, slot: summary })
      return
    }

    if (saveSlotMatch && req.method === 'DELETE') {
      deleteSaveSlot(decodeURIComponent(saveSlotMatch[1] || ''))
      sendJson(res, 200, { ok: true })
      return
    }

    const saveSlotEvaluationMatch = url.pathname.match(/^\/api\/save-slots\/([^/]+)\/evaluate$/)
    if (saveSlotEvaluationMatch && req.method === 'POST') {
      const body = await readBody(req)
      const input = JSON.parse(body || '{}') as Record<string, unknown>
      const slot = await evaluateSaveSlot(decodeURIComponent(saveSlotEvaluationMatch[1] || ''), input)
      const { state: _state, ...summary } = slot
      sendJson(res, 200, { ok: true, slot: summary })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/story-assets') {
      sendJson(res, 200, { assets: listStoryAssets() })
      return
    }

    const storyAssetMatch = url.pathname.match(/^\/api\/story-assets\/([^/]+)$/)
    if (req.method === 'DELETE' && storyAssetMatch) {
      deleteStoryAsset(decodeURIComponent(storyAssetMatch[1] || ''))
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'PATCH' && storyAssetMatch) {
      const body = await readBody(req)
      const input = JSON.parse(body || '{}') as Record<string, unknown>
      const asset = renameStoryAsset(decodeURIComponent(storyAssetMatch[1] || ''), input.sourceName)
      sendJson(res, 200, { ok: true, asset })
      return
    }

    const storyConfigRevisionMatch = url.pathname.match(/^\/api\/story-assets\/([^/]+)\/program-config\/revise$/)
    if (req.method === 'POST' && storyConfigRevisionMatch) {
      const body = await readBody(req)
      const input = JSON.parse(body) as ReviseProgramConfigRequest
      const config = await reviseStoryAssetProgramConfig(decodeURIComponent(storyConfigRevisionMatch[1] || ''), input)
      sendJson(res, 200, { ok: true, config })
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
