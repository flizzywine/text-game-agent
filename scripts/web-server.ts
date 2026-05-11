import fs from 'fs'
import http from 'http'
import path from 'path'
import crypto from 'crypto'
import { parseJsonObject } from '../src/jsonObjectParser'

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
  feedbackText?: string
  longRangeOutline?: string
  longRangeOutlineUpdatedTurn?: number
  directorStyle?: string
  narratorStyle?: string
  recentTurns?: ConversationItem[]
  characters?: CharacterState[]
  statusSchema?: string[]
  statusRoster?: string[]
  statusState?: Record<string, Record<string, string>>
  model?: string
  apiKey?: string
  apiKeys?: Record<string, string>
  temperature?: number
  reasoningEffort?: string
}

interface GenerateRequest extends PipelineContext {
  playerInput: string
  director?: Record<string, unknown>
  turnIndex?: number
}

interface PostprocessRequest extends PipelineContext {
  playerInput: string
  finalText: string
  director?: Record<string, unknown>
  playerOptions?: unknown[]
  turnIndex?: number
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

interface PromptProfileRequest {
  promptProfile?: string
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
  model?: string
  reasoningEffort?: string
  force?: boolean
}

interface PlayerOption {
  inputText: string
}

interface StoryProgramConfig {
  sourceName: string
  generatedAt: string
  openingText: string
  worldview: string
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
  stage: 'initializer' | 'director' | 'narrator' | 'postprocess'
  label: string
  message?: string
  json?: Record<string, unknown> | null
  payload?: Record<string, unknown>
}

interface SaveSlotRecord {
  id: string
  name: string
  savedAt: string
  updatedAt: string
  favorite: boolean
  storyName: string
  turnIndex: number
  state: unknown
}

type ModelProvider = 'deepseek' | 'fireworks' | 'infron' | 'cerebras' | 'google-ai-studio'

const rootDir = process.cwd()
const webDir = path.join(rootDir, 'web')
const promptDir = path.join(rootDir, 'prompts')
const activePromptProfileFile = path.join(promptDir, 'active-profile.txt')
const defaultPromptProfile = '基准'
const promptProfiles = ['基准', '繁花']
const storyDir = path.join(rootDir, 'story')
const docsDir = path.join(rootDir, 'docs')
const saveDir = path.join(rootDir, 'save')
const saveSlotsDir = path.join(saveDir, 'slots')
const speedRecordsDir = path.join(saveDir, 'speed-records')
const debugDir = path.join(rootDir, 'debug')
const llmDebugDir = path.join(debugDir, 'llm-raw')
const interceptionDebugDir = path.join(debugDir, 'content-interception')
const speedTestRecordFile = path.join(docsDir, '模型速度测试记录.md')
const saveFile = path.join(saveDir, 'current-state.json')
const syntheticContentInterceptionInput = '内容拦截测试：使用当前存档状态生成 Narrator prompt。'
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const infronDeepSeekV4ProModel = 'deepseek/deepseek-v4-pro'
const infronDeepSeekV4FlashModel = 'deepseek/deepseek-v4-flash'
const infronGemini31FlashLiteModel = 'google/gemini-3.1-flash-lite'
const infronGemini25FlashModel = 'google/gemini-2.5-flash'
const infronGemini3FlashPreviewModel = 'google/gemini-3-flash-preview'
const infronKimiK25Model = 'moonshotai/kimi-k2.5'
const infronQwen35EaricaModel = 'qwen/qwen3.5-27b-earica-derestricted'
const infronQwen36FlashModel = 'qwen/qwen3.6-flash'
const infronQwen36PlusModel = 'qwen/qwen3.6-plus'
const infronXiaomiMimo25Model = 'xiaomi/mimo-v2.5'
const infronGlm47FlashxModel = 'z-ai/glm-4.7-flashx'
const infronGlm51Model = 'z-ai/glm-5.1'
const infronGrok43Model = 'x-ai/grok-4.3'
const googleAiStudioGemini31FlashLiteModel = 'gemini-3.1-flash-lite'
const cerebrasQwenModel = 'qwen-3-235b-a22b-instruct-2507'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const fireworksDeepSeekV4ProRequestModel = 'accounts/fireworks/models/deepseek-v4-pro'
const fireworksKimiK2P5Model = 'accounts/fireworks/models/kimi-k2p5'
const fireworksQwen3235BA22BModel = 'accounts/fireworks/models/qwen3-235b-a22b'
const fireworksQwen36PlusModel = 'accounts/fireworks/models/qwen3p6-plus'
const defaultModel = infronGrok43Model
const strongLayerModel = officialDeepSeekV4ProModel
const simpleLayerModel = officialDeepSeekV4FlashModel
const modelIds = new Set([
  officialDeepSeekV4ProModel,
  officialDeepSeekV4FlashModel,
  infronDeepSeekV4ProModel,
  infronDeepSeekV4FlashModel,
  infronGemini31FlashLiteModel,
  infronGemini25FlashModel,
  infronGemini3FlashPreviewModel,
  infronKimiK25Model,
  infronQwen35EaricaModel,
  infronQwen36FlashModel,
  infronQwen36PlusModel,
  infronXiaomiMimo25Model,
  infronGlm47FlashxModel,
  infronGlm51Model,
  infronGrok43Model,
  googleAiStudioGemini31FlashLiteModel,
  cerebrasQwenModel,
  fireworksDeepSeekV4ProPriorityModel,
  fireworksKimiK2P5Model,
  fireworksQwen3235BA22BModel,
  fireworksQwen36PlusModel,
])
const defaultDeepSeekBaseUrl = 'https://api.deepseek.com'
const defaultFireworksBaseUrl = 'https://api.fireworks.ai/inference/v1'
const defaultInfronBaseUrl = 'https://llm.onerouter.pro/v1'
const defaultCerebrasBaseUrl = 'https://api.cerebras.ai/v1'
const defaultGoogleAiStudioBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
const infronReasoningEfforts = new Set(['none', 'low', 'medium', 'high'])
const infronReasoningHeavyModels = new Set([infronXiaomiMimo25Model])
const infronReasoningMinMaxTokens = Number(process.env.INFRON_REASONING_MIN_MAX_TOKENS || 6000)
const llmTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 300_000)
const longRangeDirectorTimeoutMs = Number(process.env.LONG_RANGE_DIRECTOR_TIMEOUT_MS || 45_000)
const directorTimeoutMs = Number(process.env.DIRECTOR_TIMEOUT_MS || 300_000)
const narratorTimeoutMs = Number(process.env.NARRATOR_TIMEOUT_MS || 120_000)
const postprocessTimeoutMs = Number(process.env.POSTPROCESS_TIMEOUT_MS || 120_000)
const providerFetchRetryCount = Number(process.env.LLM_FETCH_RETRY_COUNT || 2)
const providerFetchRetryDelayMs = Number(process.env.LLM_FETCH_RETRY_DELAY_MS || 1200)
const providerConnectivityTimeoutMs = Number(process.env.PROVIDER_CONNECTIVITY_TIMEOUT_MS || 30_000)
const providerSpeedTestTimeoutMs = Number(process.env.PROVIDER_SPEED_TEST_TIMEOUT_MS || 100_000)
const defaultMaxTokens = Number(process.env.LLM_MAX_TOKENS || 8192)
const directorMaxTokens = Number(process.env.DIRECTOR_MAX_TOKENS || 2000)
const narratorMaxTokens = Number(process.env.NARRATOR_MAX_TOKENS || 12000)
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

function buildPipelineModels(requestedModel = defaultModel): Record<string, string> {
  const provider = providerForModel(normalizeModel(requestedModel))
  const selectedModel = normalizeModel(requestedModel)
  const strongModel = provider === 'deepseek' ? strongLayerModel : selectedModel
  const simpleModel = provider === 'deepseek' ? simpleLayerModel : selectedModel
  return {
    director: strongModel,
    longRangeDirector: strongModel,
    narrator: strongModel,
    postprocess: simpleModel,
    initializer: strongModel,
  }
}

function providerForModel(model: string): ModelProvider {
  if (isFireworksModel(model)) return 'fireworks'
  if (isInfronModel(model)) return 'infron'
  if (isCerebrasModel(model)) return 'cerebras'
  if (isGoogleAiStudioModel(model)) return 'google-ai-studio'
  return 'deepseek'
}

function isFireworksModel(model: string): boolean {
  return model === fireworksDeepSeekV4ProPriorityModel || model === fireworksKimiK2P5Model || model === fireworksQwen3235BA22BModel || model === fireworksQwen36PlusModel
}

function isInfronModel(model: string): boolean {
  return model === infronDeepSeekV4ProModel || model === infronDeepSeekV4FlashModel || model === infronGemini31FlashLiteModel || model === infronGemini25FlashModel || model === infronGemini3FlashPreviewModel || model === infronKimiK25Model || model === infronQwen35EaricaModel || model === infronQwen36FlashModel || model === infronQwen36PlusModel || model === infronXiaomiMimo25Model || model === infronGlm47FlashxModel || model === infronGlm51Model || model === infronGrok43Model
}

function isCerebrasModel(model: string): boolean {
  return model === cerebrasQwenModel
}

function isGoogleAiStudioModel(model: string): boolean {
  return model === googleAiStudioGemini31FlashLiteModel
}

function infronRequestModel(model: string): string {
  return model
}

function fireworksRequestModel(model: string): string {
  return model === fireworksDeepSeekV4ProPriorityModel ? fireworksDeepSeekV4ProRequestModel : model
}

function applyFireworksPriority(body: Record<string, unknown>, model: string): void {
  if (model === fireworksDeepSeekV4ProPriorityModel || model === fireworksKimiK2P5Model) body.service_tier = 'priority'
}

function withFireworksPriority(body: Record<string, unknown>, model: string): Record<string, unknown> {
  applyFireworksPriority(body, model)
  return body
}

function providerLabel(provider: ModelProvider): string {
  if (provider === 'fireworks') return 'Fireworks'
  if (provider === 'infron') return 'Infron'
  if (provider === 'cerebras') return 'Cerebras'
  if (provider === 'google-ai-studio') return 'Google AI Studio'
  return 'DeepSeek'
}

function providerBaseUrl(provider: ModelProvider): string {
  if (provider === 'fireworks') return (env('FIREWORKS_BASE_URL') || defaultFireworksBaseUrl).replace(/\/+$/, '')
  if (provider === 'infron') return (env('INFRON_BASE_URL') || defaultInfronBaseUrl).replace(/\/+$/, '')
  if (provider === 'cerebras') return (env('CEREBRAS_BASE_URL') || defaultCerebrasBaseUrl).replace(/\/+$/, '')
  if (provider === 'google-ai-studio') return (env('GOOGLE_AI_STUDIO_BASE_URL') || defaultGoogleAiStudioBaseUrl).replace(/\/+$/, '')
  return (env('DEEPSEEK_BASE_URL') || defaultDeepSeekBaseUrl).replace(/\/+$/, '')
}

function providerApiKey(provider: ModelProvider, explicitKey?: string): string {
  const key = explicitKey?.trim()
    || (provider === 'fireworks'
      ? env('FIREWORKS_API_KEY')
      : provider === 'infron'
        ? env('INFRON_API_KEY')
        : provider === 'cerebras'
          ? env('CEREBRAS_API_KEY')
          : provider === 'google-ai-studio'
            ? env('GEMINI_API_KEY') || env('GOOGLE_AI_STUDIO_API_KEY')
            : env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY'))
  if (key) return key
  throw new Error(provider === 'fireworks' ? 'missing FIREWORKS_API_KEY' : provider === 'infron' ? 'missing INFRON_API_KEY' : provider === 'cerebras' ? 'missing CEREBRAS_API_KEY' : provider === 'google-ai-studio' ? 'missing GEMINI_API_KEY' : 'missing DEEPSEEK_API_KEY')
}

function pipelineApiKeyForModel(input: PipelineContext, model: string): string | undefined {
  const provider = providerForModel(model)
  const keyed = input.apiKeys?.[provider]
  if (typeof keyed === 'string' && keyed.trim()) return keyed
  const selectedProvider = providerForModel(normalizeModel(input.model))
  return provider === selectedProvider ? input.apiKey : undefined
}

function providerHasApiKey(provider: ModelProvider): boolean {
  if (provider === 'fireworks') return Boolean(env('FIREWORKS_API_KEY'))
  if (provider === 'infron') return Boolean(env('INFRON_API_KEY'))
  if (provider === 'cerebras') return Boolean(env('CEREBRAS_API_KEY'))
  if (provider === 'google-ai-studio') return Boolean(env('GEMINI_API_KEY') || env('GOOGLE_AI_STUDIO_API_KEY'))
  return Boolean(env('DEEPSEEK_API_KEY') || env('DEEP_SEEK_API_KEY'))
}

function normalizeInfronReasoningEffort(value: unknown): string {
  const effort = String(value || '').trim()
  return infronReasoningEfforts.has(effort) ? effort : ''
}

function applyInfronReasoning(body: Record<string, unknown>, effort: unknown): void {
  const normalized = normalizeInfronReasoningEffort(effort)
  if (normalized) body.reasoning = { effort: normalized }
}

function infronMaxTokensForModel(model: string, maxTokens: number, effort: unknown): number {
  const normalized = normalizeInfronReasoningEffort(effort)
  if (infronReasoningHeavyModels.has(model) && normalized && normalized !== 'none' && maxTokens >= 1000) {
    return Math.max(maxTokens, infronReasoningMinMaxTokens)
  }
  return maxTokens
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
  fs.mkdirSync(speedRecordsDir, { recursive: true })
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

function speedRecordTimestamp(): string {
  return new Date().toLocaleString('zh-CN', {
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
}

function metricOutputTokens(metrics: LlmCallMetrics): number {
  return metrics.outputTokens || metrics.estimatedOutputTokens || 0
}

function metricOutputTokensPerSecondEstimate(metrics: LlmCallMetrics): number {
  const outputTokens = metricOutputTokens(metrics)
  return Number((outputTokens / Math.max(0.001, metrics.durationMs / 1000)).toFixed(2))
}

function metricTtftDisplay(metrics: LlmCallMetrics): string {
  if (!Number.isFinite(metrics.ttftMs) || !metrics.ttftMs || metrics.ttftMs >= metrics.durationMs) return '-'
  return String(Math.round(metrics.ttftMs))
}

function speedRecordFileForGame(storyId?: string, storyName?: string): string {
  const safeId = safeName(String(storyId || 'current-story'), 'current-story')
  const safeStoryName = safeName(String(storyName || '未命名故事'), 'story')
  const filePath = path.normalize(path.join(speedRecordsDir, `${safeId}-${safeStoryName}.md`))
  if (!isInsidePath(speedRecordsDir, filePath)) throw new Error('速度记录路径无效。')
  return filePath
}

function appendPipelineSpeedRecord(input: {
  mode: string
  turnIndex?: number
  storyId?: string
  storyName?: string
  requestedModel: string
  pipelineModels: Record<string, string>
  playerInput?: string
  metrics: Array<{ stage: string; metrics: LlmCallMetrics }>
}): string {
  ensureDataDirs()
  const recordFile = speedRecordFileForGame(input.storyId, input.storyName)
  if (!fs.existsSync(recordFile)) {
    fs.writeFileSync(recordFile, [
      '# 每轮模型速度记录',
      '',
      `- 故事：${String(input.storyName || '未命名故事').trim() || '未命名故事'}`,
      `- Story ID：${String(input.storyId || 'current-story').trim() || 'current-story'}`,
      '- 说明：每轮流水线记录。当前主流水线为非流式调用，无法测真实 TTFT/TPS；这里只记录总耗时和按总耗时估算的输出吞吐。',
      '- 速度测试页的流式 TTFT/TPS 仍写入 docs/模型速度测试记录.md。',
      '',
    ].join('\n'), 'utf-8')
  }
  const lines = [
    '',
    `## ${speedRecordTimestamp()} · 每轮流水线`,
    '',
    `- 模式：${input.mode}`,
    `- 轮次：${Number.isFinite(input.turnIndex) ? input.turnIndex : '未知'}`,
    `- 选择模型：\`${input.requestedModel}\``,
    `- 分级模型：\`${JSON.stringify(input.pipelineModels)}\``,
  ]
  if (input.playerInput?.trim()) {
    lines.push(`- 玩家输入：${input.playerInput.replace(/\s+/g, ' ').trim().slice(0, 120)}`)
  }
  lines.push('', '| 模块 | Provider | 模型 | 总耗时(ms) | TTFT(ms) | 输出tokens/秒(总耗时估算) | 输入tokens | 输出tokens | 总tokens |', '|---|---|---|---:|---:|---:|---:|---:|---:|')
  for (const item of input.metrics) {
    const provider = providerLabel(providerForModel(item.metrics.model))
    lines.push(`| ${[
      item.stage,
      provider,
      `\`${item.metrics.model}\``,
      Math.round(item.metrics.durationMs),
      metricTtftDisplay(item.metrics),
      metricOutputTokensPerSecondEstimate(item.metrics),
      item.metrics.inputTokens,
      metricOutputTokens(item.metrics),
      item.metrics.totalTokens,
    ].join(' | ')} |`)
  }
  lines.push('')
  fs.appendFileSync(recordFile, lines.join('\n'), 'utf-8')
  return path.relative(rootDir, recordFile)
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
  return JSON.parse(fs.readFileSync(saveFile, 'utf-8'))
}

function writeSaveState(value: unknown): void {
  ensureDataDirs()
  writeJsonFile(saveFile, value)
}

function sanitizeSaveSlotId(id: string): string {
  return safeName(id, '').replace(/\.json$/i, '')
}

function saveSlotFile(id: string): string {
  const safeId = sanitizeSaveSlotId(id)
  if (!safeId) throw new Error('存档不存在。')
  const filePath = path.normalize(path.join(saveSlotsDir, `${safeId}.json`))
  if (!isInsidePath(saveSlotsDir, filePath)) throw new Error('存档路径无效。')
  return filePath
}

function normalizeSaveSlotRecord(value: Record<string, unknown>, fallbackId: string): SaveSlotRecord {
  const state = value.state === undefined ? value : value.state
  const story = state && typeof state === 'object' ? (state as Record<string, unknown>).story || state : {}
  const storyRecord = story && typeof story === 'object' ? story as Record<string, unknown> : {}
  const messages = Array.isArray(storyRecord.messages) ? storyRecord.messages : []
  const savedAt = String(value.savedAt || value.createdAt || new Date().toISOString())
  const name = String(value.name || storyRecord.name || '未命名存档').trim() || '未命名存档'
  return {
    id: sanitizeSaveSlotId(String(value.id || fallbackId)),
    name,
    savedAt,
    updatedAt: String(value.updatedAt || savedAt),
    favorite: Boolean(value.favorite),
    storyName: String(value.storyName || storyRecord.name || name),
    turnIndex: Number.isFinite(Number(value.turnIndex)) ? Math.max(0, Math.floor(Number(value.turnIndex))) : messages.filter((message: unknown) => (message as Record<string, unknown>)?.role === 'assistant').length,
    state,
  }
}

function readSaveSlot(id: string): SaveSlotRecord {
  ensureDataDirs()
  const filePath = saveSlotFile(id)
  const raw = readJsonFileIfExists(filePath)
  if (!raw) throw new Error('存档不存在。')
  return normalizeSaveSlotRecord(raw, path.basename(filePath, '.json'))
}

function listSaveSlots(): Omit<SaveSlotRecord, 'state'>[] {
  ensureDataDirs()
  return fs.readdirSync(saveSlotsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => {
      const raw = readJsonFileIfExists(path.join(saveSlotsDir, entry.name))
      return raw ? normalizeSaveSlotRecord(raw, path.basename(entry.name, '.json')) : null
    })
    .filter((slot): slot is SaveSlotRecord => Boolean(slot))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.savedAt).localeCompare(String(a.savedAt)))
    .map(({ state: _state, ...slot }) => slot)
}

function createSaveSlot(input: Record<string, unknown>): SaveSlotRecord {
  ensureDataDirs()
  const savedAt = new Date().toISOString()
  const name = String(input.name || '未命名存档').trim() || '未命名存档'
  const id = `${savedAt.replace(/[:.]/g, '-')}-${safeName(name, 'save')}`
  const record = normalizeSaveSlotRecord({
    id,
    name,
    savedAt,
    updatedAt: savedAt,
    favorite: Boolean(input.favorite),
    storyName: input.storyName,
    turnIndex: input.turnIndex,
    state: input.state,
  }, id)
  writeJsonFile(saveSlotFile(record.id), record)
  return record
}

function updateSaveSlot(id: string, patch: Record<string, unknown>): SaveSlotRecord {
  const current = readSaveSlot(id)
  const updated = normalizeSaveSlotRecord({
    ...current,
    name: patch.name === undefined ? current.name : patch.name,
    favorite: patch.favorite === undefined ? current.favorite : Boolean(patch.favorite),
    updatedAt: new Date().toISOString(),
  }, current.id)
  writeJsonFile(saveSlotFile(updated.id), updated)
  return updated
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

function deleteSaveSlot(id: string): void {
  ensureDataDirs()
  const filePath = saveSlotFile(id)
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

function activePromptProfile(): string {
  const fromEnv = String(process.env.TEXT_GAME_PROMPT_PROFILE || '').trim()
  if (promptProfiles.includes(fromEnv)) return fromEnv
  if (!fs.existsSync(activePromptProfileFile)) return defaultPromptProfile
  return normalizePromptProfile(fs.readFileSync(activePromptProfileFile, 'utf-8'))
}

function normalizePromptProfile(value: unknown): string {
  const profile = String(value || '').trim()
  return promptProfiles.includes(profile) ? profile : defaultPromptProfile
}

function writeActivePromptProfile(profile: string): void {
  fs.writeFileSync(activePromptProfileFile, `${normalizePromptProfile(profile)}\n`, 'utf-8')
}

function readPrompt(name: string): string {
  const profile = activePromptProfile()
  const profiledPath = profile ? path.join(promptDir, profile, name) : ''
  if (profiledPath && fs.existsSync(profiledPath)) return readPromptFile(profiledPath)
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

const requiredStatusSchema = ['性别', '身份', '外貌', '性格']
const fallbackStatusSchema = ['性别', '身份', '外貌', '性格', '位置']

function parseStatusSchemaFields(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|[,，、]/)
      : []
  return items.map(item => String(item || '').replace(/^[-*]\s*/, '').split(/[：:]/)[0].trim()).filter(Boolean)
}

function normalizeStatusSchema(value: unknown, fallback: string[] = fallbackStatusSchema): string[] {
  const fields = parseStatusSchemaFields(value)
  const source = fields.length ? fields : fallback
  return [...new Set([...requiredStatusSchema, ...source])]
}

function normalizeStatusRoster(value: unknown, characters: CharacterState[] = []): string[] {
  const items = Array.isArray(value) ? value : []
  const names = items.map(item => typeof item === 'string' ? item : (item && typeof item === 'object' ? (item as Record<string, unknown>).name : '')).map(item => String(item || '').trim()).filter(Boolean)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(Boolean)
  return [...new Set(['玩家', ...names, ...characterNames])]
}

function normalizeStatusState(value: unknown, roster: string[], characters: CharacterState[] = [], schema: string[] = fallbackStatusSchema): Record<string, Record<string, string>> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const byName = new Map(characters.map(character => [String(character.name || '').trim(), character]))
  const output: Record<string, Record<string, string>> = {}
  for (const name of roster) {
    const raw = source[name]
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const character = byName.get(name)
    output[name] = {}
    for (const field of normalizeStatusSchema(schema)) {
      output[name][field] = statusFieldValue(field, record, character, name)
    }
  }
  return output
}

function statusFieldValue(field: string, record: Record<string, unknown>, character: CharacterState | undefined, name: string): string {
  if (record[field] !== undefined && record[field] !== null) return String(record[field])
  const fallbackByField: Record<string, unknown> = {
    性别: record.gender || character?.gender,
    身份: record.role || character?.role || (name === '玩家' ? '玩家操控角色' : ''),
    位置: record.location || character?.location,
    外显状态: record.health || character?.health,
    外貌: record.appearance || character?.appearance,
    性格: record.personality || character?.personality,
    情绪: record.mood || character?.mood,
    对玩家态度: record.trust || character?.trust || (name === '玩家' ? '玩家本人' : ''),
  }
  return String(fallbackByField[field] || '')
}

function buildStatusModel(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: CharacterState[] }): {
  statusSchema: string[]
  statusRoster: string[]
  statusState: Record<string, Record<string, string>>
} {
  const characters = input.characters || []
  const statusSchema = normalizeStatusSchema(input.statusSchema)
  const statusRoster = normalizeStatusRoster(input.statusRoster, characters)
  const statusState = normalizeStatusState(input.statusState, statusRoster, characters, statusSchema)
  return { statusSchema, statusRoster, statusState }
}

function renderRelevantStatus(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: CharacterState[] }): string {
  const model = buildStatusModel(input)
  return JSON.stringify({ fields: model.statusSchema, people: model.statusRoster, state: model.statusState })
}

function mergeStatusSchema(current: unknown, patch: unknown): string[] {
  return normalizeStatusSchema([...parseStatusSchemaFields(current), ...parseStatusSchemaFields(patch)])
}

function mergeStatusRoster(current: unknown, patch: unknown, characters: CharacterState[] = [], statePatch: unknown = {}): string[] {
  const patchNames = statePatch && typeof statePatch === 'object' && !Array.isArray(statePatch)
    ? Object.keys(statePatch as Record<string, unknown>)
    : []
  return normalizeStatusRoster([...(Array.isArray(current) ? current : []), ...(Array.isArray(patch) ? patch : []), ...patchNames], characters)
}

function mergeStatusState(current: unknown, patch: unknown, roster: string[], characters: CharacterState[] = [], schema: string[] = fallbackStatusSchema): Record<string, Record<string, string>> {
  const base = normalizeStatusState(current, roster, characters, schema)
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
  const baseCharacters = input.characters?.length
    ? input.characters
    : [{
      id: 'character.player',
      name: '玩家',
      gender: '未设定',
      role: '玩家操控角色',
      mood: '待输入',
      location: '开场',
      health: '正常',
      trust: '',
      notes: '玩家操控角色；不替玩家锁死长期选择。',
    }]
  const seedCharacters = baseCharacters.some(character => character.name === '玩家')
    ? baseCharacters
    : [{
      id: 'character.player',
      name: '玩家',
      gender: '未设定',
      role: '玩家操控角色',
      mood: '待输入',
      location: '开场',
      health: '正常',
      trust: '',
      notes: '玩家操控角色；不替玩家锁死长期选择。',
    }, ...baseCharacters]
  const statusSchema = fallbackStatusSchema
  const statusRoster = normalizeStatusRoster([], seedCharacters)
  const statusState = normalizeStatusState({}, statusRoster, seedCharacters, statusSchema)
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
    statusSchema,
    statusRoster,
    statusState,
    directorStyle,
    narratorStyle,
    initialPlayerOptions: [
      { inputText: '我先观察周围和对方的反应。' },
      { inputText: '我开口问道：“现在是什么情况？”' },
      { inputText: '我向前一步，试探性地接近当前互动对象。' },
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
    sourceName: String(patch.sourceName ?? existing.sourceName ?? ''),
    generatedAt: String(patch.generatedAt ?? existing.generatedAt ?? new Date().toISOString()),
    worldview: String(patch.worldview ?? existing.worldview ?? ''),
    openingText: String(patch.openingText ?? existing.openingText ?? ''),
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
    longRangeOutline: String(patch.longRangeOutline ?? existing.longRangeOutline ?? ''),
    initialPlayerOptions: Array.isArray(patch.initialPlayerOptions) ? patch.initialPlayerOptions : existing.initialPlayerOptions,
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
    sourceName: String(raw.sourceName || fallback.sourceName),
    generatedAt: String(raw.generatedAt || new Date().toISOString()),
    openingText: String(raw.openingText || fallback.openingText || ''),
    worldview: String(raw.worldview || fallback.worldview || ''),
    statusSchema: normalizeStatusSchema(raw.statusSchema || fallback.statusSchema),
    statusRoster: normalizeStatusRoster(raw.statusRoster || fallback.statusRoster, legacyCharacters),
    statusState: normalizeStatusState(raw.statusState || fallback.statusState, normalizeStatusRoster(raw.statusRoster || fallback.statusRoster, legacyCharacters), legacyCharacters, normalizeStatusSchema(raw.statusSchema || fallback.statusSchema)),
    directorStyle: String(raw.directorStyle || fallback.directorStyle || ''),
    narratorStyle: String(raw.narratorStyle || fallback.narratorStyle || ''),
    initialPlayerOptions: normalizePlayerOptions(initialPlayerOptions) as PlayerOption[],
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
  const model = buildPipelineModels(input.model).initializer
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
  if (!input.apiKey?.trim() && !providerHasApiKey(provider)) {
    throw new Error(`故事尚未初始化：缺少 ${providerLabel(provider)} API Key，不能生成 program-config。`)
  }

  const initializerMessages = renderPromptMessagePair('initializer.md', {
    storyMaterial: renderInitializationMaterial(input),
  })

  try {
    emit({ type: 'stage_start', stage: 'initializer', label: 'Initializer', message: '初始化层：整理故事书，生成世界观、人物介绍、开场交互和人物状态 schema。' })
    const result = await callModelWithPublicTrace('initializer', 'Initializer', promptMessages(initializerMessages.system, initializerMessages.user), { temperature: 0.4, apiKey: pipelineApiKeyForModel(input, model), model, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在读取故事书、人物卡和世界书，去掉重复噪音。',
      '公开日志：正在抽取世界观、人物介绍和固定设定。',
      '公开日志：正在写第一轮开场交互和 3 个玩家初始选项。',
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
  if (provider === 'fireworks') {
    return requestFireworksContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
  }
  if (provider === 'infron') {
    return requestInfronContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal, reasoningEffort)
  }
  if (provider === 'cerebras') {
    return requestCerebrasContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
  }
  if (provider === 'google-ai-studio') {
    return requestGoogleAiStudioContent(providerBaseUrl(provider), apiKey, messages, temperature, model, label, maxTokens, signal)
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
  }

  const text = await readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)
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
  if (!raw) {
    const finishReason = (payload.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason
    const reasonText = finishReason ? `; finish_reason=${String(finishReason)}` : ''
    const file = writeLlmDebugFile({
      label: `${label}-deepseek-empty`,
      raw: text,
      messages,
      error: new Error(`DeepSeek returned an empty response${reasonText}`),
    })
    throw new Error(`DeepSeek returned an empty response${reasonText}；原始返回已保存：${file}`)
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
      body: JSON.stringify(withFireworksPriority({
        model: fireworksRequestModel(model),
        messages,
        temperature,
        max_tokens: maxTokens,
      }, model)),
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
  }
}

async function requestInfronContent(
  baseUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
  label: string,
  maxTokens: number,
  signal?: AbortSignal,
  reasoningEffort?: string,
): Promise<{ raw: string; metrics: LlmCallMetrics }> {
  const controller = new AbortController()
  let externallyAborted = false
  const unlinkAbortSignal = linkAbortSignal(controller, signal, () => {
    externallyAborted = true
  })
  const timer = setTimeout(() => controller.abort(), llmTimeoutMs)
  let response: Response
  const startedAt = Date.now()

  const body: Record<string, unknown> = {
    model: infronRequestModel(model),
    messages,
    temperature,
    max_tokens: infronMaxTokensForModel(model, maxTokens, reasoningEffort),
    provider: {
      sort: 'throughput',
    },
  }
  applyInfronReasoning(body, reasoningEffort)

  try {
    response = await fetchWithTransientRetry(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`Infron 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-infron-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`Infron 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
    }
    throw error
  }

  const text = await readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)
  const durationMs = Date.now() - startedAt
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Infron API Key 无效、无权限，或当前账号不能调用该模型。请检查 Infron key 和模型权限。')
    }
    throw new Error(`Infron ${response.status}: ${text.slice(0, 500)}`)
  }
  if (looksLikeHtmlResponse(text)) {
    const detail = describeHtmlGatewayError(text)
    const file = writeLlmDebugFile({
      label: `${label}-infron-html`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`Infron 网关返回非 JSON：${detail}；原始返回已保存：${file}`)
  }
  let payload: {
    error?: { message?: string; code?: number | string; metadata?: unknown }
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
  }
  try {
    payload = JSON.parse(text) as typeof payload
  } catch (error) {
    const file = writeLlmDebugFile({
      label: `${label}-infron-non-json`,
      raw: text,
      messages,
      error: error instanceof Error ? error : new Error(String(error)),
    })
    throw new Error(`Infron 返回非 JSON 内容，无法解析；原始返回已保存：${file}`)
  }
  if (payload.error) {
    const detail =
      typeof payload.error.message === 'string' && payload.error.message.trim()
        ? payload.error.message.trim()
        : JSON.stringify(payload.error)
    const file = writeLlmDebugFile({
      label: `${label}-infron-error`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`Infron 上游错误：${detail}；原始返回已保存：${file}`)
  }
  const raw = payload.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    const finishReason = (payload.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason
    const reasonText = finishReason ? `; finish_reason=${String(finishReason)}` : ''
    const file = writeLlmDebugFile({
      label: `${label}-infron-empty`,
      raw: text,
      messages,
      error: new Error(`Infron returned an empty response${reasonText}`),
    })
    throw new Error(`Infron returned an empty response${reasonText}；原始返回已保存：${file}`)
  }
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      ttftMs: durationMs,
      inputTokens: Number(payload.usage?.prompt_tokens || 0),
      outputTokens: Number(payload.usage?.completion_tokens || 0),
      totalTokens: Number(payload.usage?.total_tokens || 0),
      estimatedOutputTokens: estimateTokens(raw),
    },
  }
}

async function requestCerebrasContent(
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
        max_completion_tokens: maxTokens,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`Cerebras 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-cerebras-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`Cerebras 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
    }
    throw error
  }

  const text = await readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)
  const durationMs = Date.now() - startedAt
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Cerebras API Key 无效、无权限，或当前账号不能调用该模型。请检查 Cerebras key 和模型权限。')
    }
    throw new Error(`Cerebras ${response.status}: ${text.slice(0, 500)}`)
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
      label: `${label}-cerebras-error`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`Cerebras 上游错误：${detail}；原始返回已保存：${file}`)
  }
  const raw = payload.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    const finishReason = (payload.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason
    const reasonText = finishReason ? `; finish_reason=${String(finishReason)}` : ''
    const file = writeLlmDebugFile({
      label: `${label}-cerebras-empty`,
      raw: text,
      messages,
      error: new Error(`Cerebras returned an empty response${reasonText}`),
    })
    throw new Error(`Cerebras returned an empty response${reasonText}；原始返回已保存：${file}`)
  }
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      ttftMs: durationMs,
      inputTokens: Number(payload.usage?.prompt_tokens || 0),
      outputTokens: Number(payload.usage?.completion_tokens || 0),
      totalTokens: Number(payload.usage?.total_tokens || 0),
      estimatedOutputTokens: estimateTokens(raw),
    },
  }
}

async function requestGoogleAiStudioContent(
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
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externallyAborted || signal?.aborted) {
        throw Object.assign(new Error(`${label} 请求已取消。`), { name: 'AbortError' })
      }
      throw new Error(`Google AI Studio 请求超过 ${Math.round(llmTimeoutMs / 1000)} 秒未返回，已中断。`)
    }
    if (isTransientFetchError(error)) {
      const file = writeLlmDebugFile({
        label: `${label}-google-ai-studio-fetch-error`,
        raw: '',
        messages,
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw new Error(`Google AI Studio 网络请求失败：${formatFetchError(error)}；已重试 ${providerFetchRetryCount} 次；诊断已保存：${file}`)
    }
    throw error
  }

  const text = await readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)
  const durationMs = Date.now() - startedAt
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Google AI Studio API Key 无效、无权限，或当前账号不能调用该模型。请检查 Gemini key 和模型权限。')
    }
    throw new Error(`Google AI Studio ${response.status}: ${text.slice(0, 500)}`)
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
      label: `${label}-google-ai-studio-error`,
      raw: text,
      messages,
      error: new Error(detail),
    })
    throw new Error(`Google AI Studio 上游错误：${detail}；原始返回已保存：${file}`)
  }
  const raw = payload.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    const finishReason = (payload.choices?.[0] as Record<string, unknown> | undefined)?.finish_reason
    const reasonText = finishReason ? `; finish_reason=${String(finishReason)}` : ''
    const file = writeLlmDebugFile({
      label: `${label}-google-ai-studio-empty`,
      raw: text,
      messages,
      error: new Error(`Google AI Studio returned an empty response${reasonText}`),
    })
    throw new Error(`Google AI Studio returned an empty response${reasonText}；原始返回已保存：${file}`)
  }
  return {
    raw,
    metrics: {
      label,
      model,
      durationMs,
      ttftMs: durationMs,
      inputTokens: Number(payload.usage?.prompt_tokens || 0),
      outputTokens: Number(payload.usage?.completion_tokens || 0),
      totalTokens: Number(payload.usage?.total_tokens || 0),
      estimatedOutputTokens: estimateTokens(raw),
    },
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
    ], 0, model, 'ProviderTest', 20, controller.signal, normalizeInfronReasoningEffort(input.reasoningEffort))
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
    ], 0.7, model, 'ProviderSpeedTest', 1800, controller.signal, normalizeInfronReasoningEffort(input.reasoningEffort))
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
  if (input.provider === 'fireworks') {
    headers['x-session-affinity'] = env('FIREWORKS_SESSION_AFFINITY') || 'text-game-agent'
  }
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    stream: true,
  }
  if (input.provider === 'fireworks') {
    body.model = fireworksRequestModel(input.model)
    body.max_tokens = input.maxTokens
    applyFireworksPriority(body, input.model)
  } else if (input.provider === 'infron') {
    body.model = infronRequestModel(input.model)
    body.max_tokens = infronMaxTokensForModel(input.model, input.maxTokens, input.reasoningEffort)
    applyInfronReasoning(body, input.reasoningEffort)
    body.provider = { sort: 'throughput' }
  } else if (input.provider === 'cerebras') {
    body.max_completion_tokens = input.maxTokens
  } else if (input.provider === 'google-ai-studio') {
    body.max_tokens = input.maxTokens
  } else {
    body.max_tokens = input.maxTokens
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
    beat1: '内容拦截测试占位：复用当前状态，只检查模型是否能返回。',
    beat2: '内容拦截测试占位：不推进真实剧情。',
    beat3: '内容拦截测试占位：不改写存档。',
    ending: '推进模块｜测试结束停在可继续处｜推进｜行为',
    physicalConstraints: [],
  }
}

function buildInterceptionNarratorPrompt(input: InterceptionPromptRequest): Record<string, unknown> {
  const playerInput = String(input.playerInput || '').trim() || '内容拦截测试：请根据当前 Narrator prompt 输出。'
  const model = buildPipelineModels(input.model).narrator
  const context = buildRuntimeBlocks({
    ...input,
    playerInput,
  })
  const payload = buildNarratorPromptPayload({
    ...input,
    playerInput,
  }, {
    model,
    temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8,
    context,
    feedbackMemory: String(input.feedbackText || '').trim(),
    playerFeedback: normalizePlayerFeedback(input.playerFeedback),
    playerInput,
    directorPlan: input.director && Object.keys(input.director).length ? input.director : fallbackDirectorPlanForInterception(),
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
  const pipelineModels = buildPipelineModels(requestedModel)
  const recentTurns = Array.isArray(input.recentTurns)
    ? input.recentTurns.filter(turn => !isSyntheticPromptInput(turn.content))
    : []
  const generateInput = { ...input, playerInput, recentTurns, model: requestedModel } as GenerateRequest
  const directorPayload = buildDirectorPromptPayload(generateInput, Math.min(temperature, 0.4))
  const directorPlan = compactPromptPreviewPlan(input)
  const narratorPayload = buildNarratorPromptPayload(generateInput, {
    model: pipelineModels.narrator,
    temperature,
    context: directorPayload.context,
    feedbackMemory: directorPayload.feedbackMemory,
    playerFeedback: directorPayload.playerFeedback,
    playerInput,
    directorPlan,
  })
  const finalText = String(input.finalText || '').trim()
  const postprocessPayload = buildPostprocessPromptPayload(generateInput, {
    model: pipelineModels.postprocess,
    temperature: 0.5,
    playerInput,
    finalText,
    directorPlan,
    context: directorPayload.context,
    turnIndex: directorPayload.turnIndex,
    longRangeOutline: directorPayload.longRangeOutline,
  })
  const longRangeMessages = buildLongRangeDirectorMessages({
    storyContext: String(input.storyContext || '').trim(),
    characterStatus: directorPayload.context.characterStatus,
    globalContext: directorPayload.globalContext,
    currentLongRangeOutline: directorPayload.longRangeOutline || '（无）',
    longRangeStatus: '',
    turnSummary: '',
    playerFeedback: input.playerFeedback,
    directorStyle: input.directorStyle,
  })
  const initializerMessages = renderPromptMessagePair('initializer.md', {
    storyMaterial: '（当前游戏运行中没有初始化原始材料；Initializer 真实输入只来自故事库导入的原始材料。）',
  })
  return {
    ok: true,
    promptProfile: activePromptProfile(),
    model: requestedModel,
    pipelineModels,
    prompts: [
      { task: 'Initializer', model: pipelineModels.initializer, system: initializerMessages.system, user: initializerMessages.user },
      { task: 'Director', model: pipelineModels.director, system: directorPayload.directorSystem, user: directorPayload.directorUser },
      { task: 'Narrator', model: pipelineModels.narrator, system: narratorPayload.narratorSystem, user: narratorPayload.narratorUser },
      { task: 'Postprocess', model: pipelineModels.postprocess, system: postprocessPayload.postprocessSystem, user: postprocessPayload.postprocessUser },
      { task: 'LongRangeDirector', model: pipelineModels.longRangeDirector, system: longRangeMessages.system, user: longRangeMessages.user },
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
    const result = await requestModelContent(apiKey, messages, Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8, model, 'ContentInterceptionTest', 4096, undefined, normalizeInfronReasoningEffort(input.reasoningEffort))
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

function compactModuleType(value: unknown, fallback: string): string {
  const text = compactText(value, 16)
  if (/氛围|环境/.test(text)) return '氛围模块'
  if (/推进|行动|事件/.test(text)) return '推进模块'
  if (/插入|信息|角色|反应/.test(text)) return '插入模块'
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
    if (/^(氛围模块|推进模块|插入模块)｜/.test(text)) return text
    return `推进模块｜${text}`
  }
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

function compactDirectorBeats(source: Record<string, unknown>): string[] {
  const explicit = [source.beat1, source.beat2, source.beat3]
    .map(compactModuleBeat)
    .filter(Boolean)
  if (explicit.length) return explicit.slice(0, 3)
  const arrayBeats = Array.isArray(source.beats) ? source.beats : Array.isArray(source.sceneBeats) ? source.sceneBeats : []
  return arrayBeats.slice(0, 3).map(compactModuleBeat).filter(Boolean)
}

function compactDirectorPlan(value: unknown): Record<string, unknown> {
  const source = compactRecord(value)
  const beats = compactDirectorBeats(source)
  return pruneEmpty({
    goalStep: compactText(source.goalStep || source.longRangeStep || source.arcStep, 120),
    beat1: beats[0],
    beat2: beats[1],
    beat3: beats[2],
    ending: compactEndingBeat(source.ending || source.endingBeat || source.exitWindow),
    physicalConstraints: compactStringArray(source.physicalConstraints, 3, 80),
    playerOptions: normalizePlayerOptions(source.playerOptions || source.options || source.choices),
  }) as Record<string, unknown>
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
  const constraintViolation = compactText(value.违背约束 || value.narrativeConstraintFeedback, 160)
  const repetitionIssue = compactText(value.存在重复 || value.narrativeRepetitionFeedback, 160)
  const pacingIssue = compactText(value.节奏不足 || value.narrativePacingFeedback, 160)
  const directorProgressIssue = compactText(value.导演推进不足 || value.directorProgressFeedback, 160)
  const directorPhysicalViolation = compactText(value.导演物理违背 || value.directorPhysicalFeedback, 160)
  return {
    违背约束: constraintViolation,
    存在重复: repetitionIssue,
    节奏不足: pacingIssue,
    导演推进不足: directorProgressIssue,
    导演物理违背: directorPhysicalViolation,
  }
}

function normalizePlayerFeedback(value: unknown): string {
  return compactText(value, 240)
}

const longRangeDirectorMaxAgeTurns = Number(process.env.LONG_RANGE_DIRECTOR_MAX_AGE_TURNS || 20)
const longRangeDirectorSoftStartTurns = Number(process.env.LONG_RANGE_DIRECTOR_SOFT_START_TURNS || 8)
const longRangeDirectorMediumStartTurns = Number(process.env.LONG_RANGE_DIRECTOR_MEDIUM_START_TURNS || 15)
const longRangeDirectorSoftProbability = Number(process.env.LONG_RANGE_DIRECTOR_SOFT_PROBABILITY || 0.1)
const longRangeDirectorMediumProbability = Number(process.env.LONG_RANGE_DIRECTOR_MEDIUM_PROBABILITY || 0.25)

function normalizeLongRangeStatus(value: unknown, currentLongRangeOutline = ''): string {
  const status = String(value || '').trim().toLowerCase()
  if (!currentLongRangeOutline.trim()) return 'missing'
  if (status === 'completed' || status === 'missing' || status === 'stale') return status
  return 'keep'
}

function normalizeLongRangeOutlineUpdatedTurn(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0
}

function longRangeOutlineAgeTurns(turnIndex: number, updatedTurn: number): number {
  return Math.max(0, Math.floor(turnIndex) - Math.floor(updatedTurn))
}

function shouldForceLongRangeDirectorByAge(turnIndex: number, updatedTurn: number, currentLongRangeOutline = ''): boolean {
  const age = longRangeOutlineAgeTurns(turnIndex, updatedTurn)
  return Boolean(currentLongRangeOutline.trim()) && age >= longRangeDirectorMaxAgeTurns && age % longRangeDirectorMaxAgeTurns === 0
}

function longRangeDirectorProbabilityByAge(age: number): number {
  if (age >= longRangeDirectorMaxAgeTurns) return 1
  if (age >= longRangeDirectorMediumStartTurns) return longRangeDirectorMediumProbability
  if (age >= longRangeDirectorSoftStartTurns) return longRangeDirectorSoftProbability
  return 0
}

function longRangeDirectorTrigger(value: unknown, currentLongRangeOutline = '', turnIndex = 1, updatedTurn = 0, randomValue = Math.random()): { shouldRun: boolean; status: string; reason: string; age: number } {
  const status = normalizeLongRangeStatus(value, currentLongRangeOutline)
  const age = longRangeOutlineAgeTurns(turnIndex, updatedTurn)
  if (status === 'missing' || status === 'completed' || status === 'stale') return { shouldRun: true, status, reason: status, age }
  if (shouldForceLongRangeDirectorByAge(turnIndex, updatedTurn, currentLongRangeOutline)) return { shouldRun: true, status: 'stale', reason: 'age-hard-limit', age }
  const probability = Boolean(currentLongRangeOutline.trim()) ? longRangeDirectorProbabilityByAge(age) : 0
  if (probability > 0 && randomValue < probability) return { shouldRun: true, status: 'refresh', reason: `age-random-${probability}`, age }
  return { shouldRun: false, status: 'keep', reason: 'keep', age }
}

function shouldRunLongRangeDirector(value: unknown, currentLongRangeOutline = '', turnIndex = 1, updatedTurn = 0): boolean {
  return longRangeDirectorTrigger(value, currentLongRangeOutline, turnIndex, updatedTurn).shouldRun
}

function longRangeDirectorStatusForRun(value: unknown, currentLongRangeOutline: string, turnIndex: number, updatedTurn: number): string {
  return longRangeDirectorTrigger(value, currentLongRangeOutline, turnIndex, updatedTurn).status
}

function normalizeLongRangeDirectorOutline(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback
  const record = compactRecord(value)
  const direct = String(record.longRangeOutline || '').trim().slice(0, 1000)
  if (direct) return direct
  const rendered = renderLongArc(record.longArc || record.arc || record)
  return rendered || fallback
}

function buildLongRangeDirectorMessages(input: {
  storyContext: string
  characterStatus: string
  globalContext: string
  currentLongRangeOutline: string
  longRangeStatus: string
  turnSummary: string
  playerFeedback?: string
  directorStyle?: string
}): { system: string; user: string } {
  return renderPromptMessagePair('high-level-director.md', {
    currentLongRangeOutline: input.currentLongRangeOutline,
    storyContext: input.storyContext,
    characterStatus: input.characterStatus,
    longRangeStatus: input.longRangeStatus,
    globalContext: input.globalContext,
    turnSummary: input.turnSummary,
    playerFeedback: normalizePlayerFeedback(input.playerFeedback),
    directorStyle: input.directorStyle || '',
  })
}

function buildDirectorPromptPayload(input: GenerateRequest, temperature: number): {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  globalContext: string
  feedbackMemory: string
  playerFeedback: string
  longRangeOutline: string
  longRangeOutlineUpdatedTurn: number
  turnIndex: number
  playerInput: string
  directorSystem: string
  directorUser: string
} {
  const context = buildRuntimeBlocks(input)
  const globalContext = input.globalContext || ''
  const feedbackMemory = String(input.feedbackText || '').trim()
  const playerFeedback = normalizePlayerFeedback(input.playerFeedback)
  const longRangeOutline = String(input.longRangeOutline || '').trim()
  const longRangeOutlineUpdatedTurn = normalizeLongRangeOutlineUpdatedTurn(input.longRangeOutlineUpdatedTurn)
  const directorStyle = String(input.directorStyle || '').trim() || '（无）'
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const playerInput = input.playerInput.trim()
  const model = buildPipelineModels(input.model).director
  const directorMessages = renderPromptMessagePair('director.md', {
    storyContext: context.storyContext,
    characterStatus: context.characterStatus,
    recentTurns: context.recentTurns,
    globalContext,
    feedbackMemory,
    playerFeedback,
    longRangeOutline: longRangeOutline || '（无。Director 只能规划本轮，不得生成剧情目标。）',
    directorStyle,
    playerInput,
  })
  const directorSystem = directorMessages.system
  const directorUser = directorMessages.user
  return {
    model,
    temperature,
    context,
    globalContext,
    feedbackMemory,
    playerFeedback,
    longRangeOutline,
    longRangeOutlineUpdatedTurn,
    turnIndex,
    playerInput,
    directorSystem,
    directorUser,
  }
}

function buildNarratorPromptPayload(input: GenerateRequest, options: {
  model: string
  temperature: number
  context: ReturnType<typeof buildRuntimeBlocks>
  feedbackMemory: string
  playerFeedback: string
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
  const playerInput = options.playerInput || input.playerInput.trim()
  const narratorMessages = renderPromptMessagePair('narrator.md', {
    directorPlan: JSON.stringify(options.directorPlan),
    storyContext: options.context.storyContext,
    characterStatus: options.context.characterStatus,
    feedbackMemory: options.feedbackMemory,
    playerFeedback: options.playerFeedback,
    bannedWords: readPrompt('banned-words.md'),
    recentTurns: options.context.recentTurns,
    narratorStyle,
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
  longRangeOutline: string
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
  const postprocessMessages = renderPromptMessagePair('postprocess.md', {
    storyContext: String(input.storyContext || '').trim(),
    historicalSummary: String(input.globalContext || '').trim(),
    longRangeOutline: options.longRangeOutline,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    recentTurns: options.context.recentTurns,
    directorPlan: JSON.stringify(options.directorPlan),
    playerFeedback: normalizePlayerFeedback(input.playerFeedback),
    finalText: options.finalText,
    playerInput: options.playerInput,
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

async function generate(
  input: GenerateRequest,
  emit: (event: PipelineEvent) => void = () => {},
): Promise<Record<string, unknown>> {
  const playerInput = String(input.playerInput || '').trim()
  if (!playerInput) throw new Error('playerInput is required')

  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.8
  const directorTemperature = Math.min(temperature, 0.4)
  const directorPayload = buildDirectorPromptPayload(input, directorTemperature)
  const requestedModel = normalizeModel(input.model)
  const pipelineModels = buildPipelineModels(requestedModel)
  const directorModel = directorPayload.model
  const narratorModel = pipelineModels.narrator
  const postprocessModel = pipelineModels.postprocess
  const longRangeDirectorModel = pipelineModels.longRangeDirector

  let director: LayerResult | null = null
  let directorPlan: Record<string, unknown>
  if (input.director && typeof input.director === 'object' && Object.keys(input.director).length) {
    directorPlan = compactDirectorPlan(input.director)
    emit({ type: 'stage_skip', stage: 'director', label: 'Director', message: '导演层已复用：继续未完成时沿用上一轮计划。', json: directorPlan })
  } else {
    emit({ type: 'stage_start', stage: 'director', label: 'Director', message: '导演层：根据玩家输入、当前状态、历史总结和剧情目标，生成本轮计划。' })
    director = await callModelWithPublicTrace('director', 'Director', promptMessages(directorPayload.directorSystem, directorPayload.directorUser), { temperature: directorTemperature, apiKey: pipelineApiKeyForModel(input, directorModel), model: directorModel, maxTokens: directorMaxTokens, timeoutMs: directorTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
      '公开日志：正在拆解玩家输入和当前场景。',
      '公开日志：正在安排剧情模块、推进链和物理约束。',
      '公开日志：正在生成 Narrator 可执行的本轮计划。',
      '公开日志：导演层仍在等待模型返回结构化计划。',
    ])
    directorPlan = compactDirectorPlan(director.json)
    emit({ type: 'stage_result', stage: 'director', label: 'Director', message: '导演层完成：本轮计划已生成。', json: directorPlan })
  }

  const narratorPayload = buildNarratorPromptPayload(input, {
    model: narratorModel,
    temperature,
    context: directorPayload.context,
    feedbackMemory: directorPayload.feedbackMemory,
    playerFeedback: directorPayload.playerFeedback,
    playerInput,
    directorPlan,
  })
  emit({ type: 'stage_start', stage: 'narrator', label: 'Narrator', message: '叙事层：按导演计划写玩家可见正文。' })
  const narrator = await callModelWithPublicTrace('narrator', 'Narrator', promptMessages(narratorPayload.narratorSystem, narratorPayload.narratorUser), { temperature, apiKey: pipelineApiKeyForModel(input, narratorModel), model: narratorModel, maxTokens: narratorMaxTokens, timeoutMs: narratorTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在根据导演计划组织正文。',
    '公开日志：正在保持人物限知视角和物理约束。',
    '公开日志：正在收束为玩家可继续行动的段落。',
    '公开日志：叙事层仍在等待模型返回正文。',
  ])
  const finalText = extractNarratorFinalText(narrator)
  emit({ type: 'visible_text', stage: 'narrator', label: 'Narrator', message: '叙事层完成：正文已显示，后处理继续后台运行。', payload: { finalText, pipelineMode: 'narrator+postprocess' } })
  emit({ type: 'stage_result', stage: 'narrator', label: 'Narrator', message: '叙事层完成：正文已生成。', json: narrator.json })

  const postprocessPayload = buildPostprocessPromptPayload(input, {
    model: postprocessModel,
    temperature: 0.5,
    playerInput,
    finalText,
    directorPlan,
    context: directorPayload.context,
    turnIndex: directorPayload.turnIndex,
    longRangeOutline: directorPayload.longRangeOutline,
  })
  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '后处理层：更新事实总结、人物状态、负反馈和剧情目标状态。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', promptMessages(postprocessPayload.postprocessSystem, postprocessPayload.postprocessUser), { temperature: postprocessPayload.temperature, apiKey: pipelineApiKeyForModel(input, postprocessModel), model: postprocessModel, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在比对导演计划和正文落差。',
    '公开日志：正在更新人物状态补丁。',
    '公开日志：正在生成三类闭环负反馈。',
    '公开日志：Postprocess 仍在等待模型返回结构化状态。',
  ])
  const postprocessJson = postprocess.json
  const feedback = normalizeFeedbackBreakdown(postprocessJson)
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理完成：状态和负反馈已更新。', json: postprocessJson })

  let nextLongRangeOutline = directorPayload.longRangeOutline
  let nextLongRangeOutlineUpdatedTurn = directorPayload.longRangeOutlineUpdatedTurn
  let longRangeDirector: LayerResult | null = null
  const turnSummary = normalizeTurnSummary(postprocessJson.turnSummary, finalText)
  const longRangeTrigger = longRangeDirectorTrigger(postprocessJson.longRangeStatus, directorPayload.longRangeOutline, directorPayload.turnIndex, directorPayload.longRangeOutlineUpdatedTurn)
  if (longRangeTrigger.shouldRun) {
    const longRangeStatus = longRangeTrigger.status
    const longRangeMessages = buildLongRangeDirectorMessages({
      storyContext: input.storyContext || '',
      characterStatus: directorPayload.context.characterStatus,
      globalContext: directorPayload.globalContext,
      currentLongRangeOutline: directorPayload.longRangeOutline,
      longRangeStatus,
      turnSummary,
      playerFeedback: input.playerFeedback || '',
      directorStyle: String(input.directorStyle || '').trim(),
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: `高级导演层：生成或修订当前剧情目标（${longRangeTrigger.reason}，目标年龄 ${longRangeTrigger.age} 轮）。` })
    try {
      longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', promptMessages(longRangeMessages.system, longRangeMessages.user), { temperature: 0.6, apiKey: pipelineApiKeyForModel(input, longRangeDirectorModel), model: longRangeDirectorModel, maxTokens: 1200, timeoutMs: longRangeDirectorTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
        '公开日志：正在判断当前剧情目标是否已完成、缺失或偏离。',
        '公开日志：正在生成可供后续多轮缓慢靠近的具体人物关系和事件目标。',
        '公开日志：高级导演层仍在等待模型返回剧情目标。',
      ])
      nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, directorPayload.longRangeOutline)
      if (nextLongRangeOutline.trim() && nextLongRangeOutline.trim() !== directorPayload.longRangeOutline.trim()) {
        nextLongRangeOutlineUpdatedTurn = directorPayload.turnIndex
      }
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

  const playerOptions = normalizePlayerOptions(directorPlan.playerOptions)
  const nextStatusSchema = mergeStatusSchema(input.statusSchema, postprocessJson.statusSchemaPatch)
  const nextStatusRoster = mergeStatusRoster(input.statusRoster, postprocessJson.statusRosterPatch, input.characters || [], postprocessJson.statusStatePatch)
  const nextStatusState = mergeStatusState(input.statusState, postprocessJson.statusStatePatch, nextStatusRoster, input.characters || [], nextStatusSchema)
  const speedRecordFile = appendPipelineSpeedRecord({
    mode: 'generate',
    turnIndex: directorPayload.turnIndex,
    storyId: input.storyId,
    storyName: input.storyName,
    requestedModel,
    pipelineModels,
    playerInput,
    metrics: [
      ...(director ? [{ stage: 'Director', metrics: director.metrics }] : []),
      { stage: 'Narrator', metrics: narrator.metrics },
      { stage: 'Postprocess', metrics: postprocess.metrics },
      ...(longRangeDirector ? [{ stage: 'LongRangeDirector', metrics: longRangeDirector.metrics }] : []),
    ],
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
    longRangeOutlineUpdatedTurn: nextLongRangeOutlineUpdatedTurn,
    违背约束: feedback.违背约束,
    存在重复: feedback.存在重复,
    节奏不足: feedback.节奏不足,
    导演推进不足: feedback.导演推进不足,
    导演物理违背: feedback.导演物理违背,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
    model: requestedModel,
    pipelineModels,
    speedRecordFile,
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
  const pipelineModels = buildPipelineModels(requestedModel)
  const postprocessModel = pipelineModels.postprocess
  const longRangeDirectorModel = pipelineModels.longRangeDirector
  const temperature = Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5
  const turnIndex = normalizeTurnIndex(input.turnIndex, input.recentTurns)
  const director = input.director && typeof input.director === 'object' ? input.director : {}
  const directorPlan = compactDirectorPlan(director)
  const context = buildRuntimeBlocks({
    playerInput,
    recentTurns: input.recentTurns,
    characters: input.characters,
    statusState: input.statusState,
  } as GenerateRequest)
  const currentLongRangeOutline = String(input.longRangeOutline || '').trim()
  const statusModel = buildStatusModel(input)
  const postprocessMessages = renderPromptMessagePair('postprocess.md', {
    storyContext: String(input.storyContext || '').trim(),
    historicalSummary: String(input.globalContext || '').trim(),
    longRangeOutline: currentLongRangeOutline,
    statusSchema: JSON.stringify(statusModel.statusSchema),
    statusRoster: JSON.stringify(statusModel.statusRoster),
    statusState: JSON.stringify(statusModel.statusState),
    recentTurns: context.recentTurns,
    directorPlan: JSON.stringify(directorPlan),
    playerFeedback: normalizePlayerFeedback(input.playerFeedback),
    playerInput,
    finalText,
  })

  emit({ type: 'stage_start', stage: 'postprocess', label: 'Postprocess', message: '重试后处理层：补写本轮总结、人物状态、写作负反馈和剧情目标判定。' })
  const postprocess = await callModelWithPublicTrace('postprocess', 'Postprocess', promptMessages(postprocessMessages.system, postprocessMessages.user), { temperature, apiKey: pipelineApiKeyForModel(input, postprocessModel), model: postprocessModel, timeoutMs: postprocessTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
    '公开日志：正在补跑上一轮失败的 Postprocess。',
    '公开日志：正在补写本轮事实总结。',
    '公开日志：正在按状态字段更新人物状态。',
    '公开日志：正在补写写作负反馈和剧情目标判定。',
    '公开日志：Postprocess 重试仍在等待模型返回结构化状态。',
  ])
  emit({ type: 'stage_result', stage: 'postprocess', label: 'Postprocess', message: '后处理重试完成：状态和负反馈已更新。', json: postprocess.json })
  const feedback = normalizeFeedbackBreakdown(postprocess.json)

  let nextLongRangeOutline = currentLongRangeOutline
  let nextLongRangeOutlineUpdatedTurn = normalizeLongRangeOutlineUpdatedTurn(input.longRangeOutlineUpdatedTurn)
  let longRangeDirector: LayerResult | null = null
  const turnSummary = normalizeTurnSummary(postprocess.json.turnSummary, finalText)
  const longRangeTrigger = longRangeDirectorTrigger(postprocess.json.longRangeStatus, currentLongRangeOutline, turnIndex, nextLongRangeOutlineUpdatedTurn)
  if (longRangeTrigger.shouldRun) {
    const longRangeStatus = longRangeTrigger.status
    const longRangeMessages = buildLongRangeDirectorMessages({
      storyContext: input.storyContext || '',
      characterStatus: context.characterStatus,
      globalContext: String(input.globalContext || '').trim(),
      currentLongRangeOutline,
      longRangeStatus,
      turnSummary,
      playerFeedback: input.playerFeedback || '',
      directorStyle: String(input.directorStyle || '').trim(),
    })
    emit({ type: 'stage_start', stage: 'director', label: 'LongRangeDirector', message: `高级导演层：生成或修订当前剧情目标（${longRangeTrigger.reason}，目标年龄 ${longRangeTrigger.age} 轮）。` })
    try {
      longRangeDirector = await callModelWithPublicTrace('director', 'LongRangeDirector', promptMessages(longRangeMessages.system, longRangeMessages.user), { temperature: 0.6, apiKey: pipelineApiKeyForModel(input, longRangeDirectorModel), model: longRangeDirectorModel, maxTokens: 1200, timeoutMs: longRangeDirectorTimeoutMs, reasoningEffort: normalizeInfronReasoningEffort(input.reasoningEffort) }, emit, [
        '公开日志：正在补跑剧情目标生成/修订。',
        '公开日志：正在生成可供后续多轮缓慢靠近的具体人物关系和事件目标。',
        '公开日志：高级导演层仍在等待模型返回剧情目标。',
      ])
      nextLongRangeOutline = normalizeLongRangeDirectorOutline(longRangeDirector.json.longRangeOutline || longRangeDirector.json, currentLongRangeOutline)
      if (nextLongRangeOutline.trim() && nextLongRangeOutline.trim() !== currentLongRangeOutline.trim()) {
        nextLongRangeOutlineUpdatedTurn = turnIndex
      }
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
  const nextStatusState = mergeStatusState(input.statusState, postprocess.json.statusStatePatch, nextStatusRoster, input.characters || [], nextStatusSchema)
  const speedRecordFile = appendPipelineSpeedRecord({
    mode: 'postprocess-retry',
    turnIndex,
    storyId: input.storyId,
    storyName: input.storyName,
    requestedModel,
    pipelineModels,
    playerInput,
    metrics: [
      { stage: 'Postprocess', metrics: postprocess.metrics },
      ...(longRangeDirector ? [{ stage: 'LongRangeDirector', metrics: longRangeDirector.metrics }] : []),
    ],
  })

  return {
    finalText,
    pipelineMode: 'postprocess-retry',
    director: directorPlan,
    postprocess: postprocess.json,
    playerOptions: normalizePlayerOptions(input.playerOptions?.length ? input.playerOptions : directorPlan.playerOptions),
    turnSummary,
    longRangeOutline: nextLongRangeOutline,
    longRangeOutlineUpdatedTurn: nextLongRangeOutlineUpdatedTurn,
    违背约束: feedback.违背约束,
    存在重复: feedback.存在重复,
    节奏不足: feedback.节奏不足,
    导演推进不足: feedback.导演推进不足,
    导演物理违背: feedback.导演物理违背,
    statusSchema: nextStatusSchema,
    statusRoster: nextStatusRoster,
    statusState: nextStatusState,
    model: requestedModel,
    pipelineModels,
    speedRecordFile,
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
        promptProfile: activePromptProfile(),
        promptProfiles,
        models: [
          { id: fireworksDeepSeekV4ProPriorityModel, label: 'DeepSeek V4 Pro | priority | Fireworks', provider: 'fireworks' },
          { id: fireworksKimiK2P5Model, label: 'Kimi K2.5 | Fireworks', provider: 'fireworks' },
          { id: fireworksQwen3235BA22BModel, label: 'Qwen3 235B A22B | Fireworks', provider: 'fireworks' },
          { id: fireworksQwen36PlusModel, label: 'Qwen3.6 Plus | Fireworks', provider: 'fireworks' },
          { id: officialDeepSeekV4ProModel, label: 'DeepSeek V4 Pro | official | DeepSeek', provider: 'deepseek' },
          { id: officialDeepSeekV4FlashModel, label: 'DeepSeek V4 Flash | official | DeepSeek', provider: 'deepseek' },
          { id: infronDeepSeekV4ProModel, label: 'DeepSeek V4 Pro | throughput | Infron', provider: 'infron' },
          { id: infronDeepSeekV4FlashModel, label: 'DeepSeek V4 Flash | throughput | Infron', provider: 'infron' },
          { id: infronGemini31FlashLiteModel, label: 'Gemini 3.1 Flash Lite | throughput | Infron', provider: 'infron' },
          { id: infronGemini25FlashModel, label: 'Gemini 2.5 Flash | throughput | Infron', provider: 'infron' },
          { id: infronGemini3FlashPreviewModel, label: 'Gemini 3 Flash Preview | throughput | Infron', provider: 'infron' },
          { id: infronKimiK25Model, label: 'Kimi K2.5 | throughput | Infron', provider: 'infron' },
          { id: infronQwen35EaricaModel, label: 'Qwen3.5 27B Earica Derestricted | throughput | Infron', provider: 'infron' },
          { id: infronQwen36FlashModel, label: 'Qwen3.6 Flash | throughput | Infron', provider: 'infron' },
          { id: infronQwen36PlusModel, label: 'Qwen3.6 Plus | throughput | Infron', provider: 'infron' },
          { id: infronXiaomiMimo25Model, label: 'Xiaomi MiMo V2.5 | throughput | Infron', provider: 'infron' },
          { id: infronGlm47FlashxModel, label: 'GLM 4.7 FlashX | throughput | Infron', provider: 'infron' },
          { id: infronGlm51Model, label: 'GLM 5.1 | throughput | Infron', provider: 'infron' },
          { id: infronGrok43Model, label: 'Grok 4.3 | throughput | Infron', provider: 'infron' },
          { id: googleAiStudioGemini31FlashLiteModel, label: 'Gemini 3.1 Flash Lite | AI Studio | Google', provider: 'google-ai-studio' },
          { id: cerebrasQwenModel, label: 'Qwen 3 235B A22B Instruct 2507 | fast | Cerebras', provider: 'cerebras' },
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
          infron: {
            baseUrl: providerBaseUrl('infron'),
            hasApiKey: providerHasApiKey('infron'),
            providerSort: 'throughput',
            reasoningEffort: '',
            reasoningEfforts: ['', ...Array.from(infronReasoningEfforts)],
          },
          cerebras: {
            baseUrl: providerBaseUrl('cerebras'),
            hasApiKey: providerHasApiKey('cerebras'),
          },
          googleAiStudio: {
            baseUrl: providerBaseUrl('google-ai-studio'),
            hasApiKey: providerHasApiKey('google-ai-studio'),
          },
        },
        baseUrl: providerBaseUrl('deepseek'),
        hasApiKey: providerHasApiKey('deepseek'),
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/prompt-profile') {
      const body = await readBody(req)
      const input = JSON.parse(body) as PromptProfileRequest
      const promptProfile = normalizePromptProfile(input.promptProfile)
      writeActivePromptProfile(promptProfile)
      sendJson(res, 200, { ok: true, promptProfile, promptProfiles })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/save-state') {
      sendJson(res, 200, { state: readSaveState() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/provider-test') {
      const body = await readBody(req)
      const input = JSON.parse(body) as ProviderTestRequest
      sendJson(res, 200, await testProvider(input))
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
