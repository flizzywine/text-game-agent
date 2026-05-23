import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function readServerSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
}

describe('provider routing', () => {
  it('registers model providers through a shared catalog', () => {
    const source = readServerSource()

    expect(source).toContain("type ModelProvider = 'deepseek' | 'infron'")
    expect(source).toContain("const defaultModel = officialDeepSeekV4FlashModel")
    expect(source).toContain("officialDeepSeekV4ProModel")
    expect(source).toContain("officialDeepSeekV4FlashModel")
    expect(source).toContain("infronGemini31FlashLiteModel")
    expect(source).toContain("provider: 'infron'")
    expect(source).toContain('INFRON_API_KEY')
    expect(source).toContain('ONEROUTER_API_KEY')
    expect(source).toContain('defaultInfronBaseUrl')
    expect(source).not.toContain('FIREWORKS_API_KEY')
    expect(source).not.toContain('CEREBRAS_API_KEY')
    expect(source).not.toContain('GOOGLE_AI_STUDIO_API_KEY')
    expect(source).not.toContain('GEMINI_API_KEY')
    expect(source).not.toContain('requestFireworksContent')
    expect(source).not.toContain('requestCerebrasContent')
    expect(source).not.toContain('requestGoogleAiStudioContent')
    expect(source).not.toContain('accounts/fireworks')
    expect(source).not.toContain('api.cerebras.ai')
    expect(source).not.toContain('generativelanguage.googleapis.com')
    expect(source).toContain('requestOpenAICompatibleContent')
    expect(source).toContain('if (isAbortError(error))')
    expect(source).toContain('function fetchWithTransientRetry')
    expect(source).toContain('LLM_FETCH_RETRY_COUNT')
  })

  it('does not keep a long range director layer', () => {
    const source = readServerSource()

    expect(source).not.toContain("label: 'LongRangeDirector'")
    expect(source).not.toContain('LONG_RANGE_DIRECTOR_TIMEOUT_MS')
    expect(source).not.toContain('longRangeDirectorTimeoutMs')
  })

  it('bounds foreground narrator calls instead of waiting for the global provider timeout', () => {
    const source = readServerSource()

    expect(source).toContain('NARRATOR_TIMEOUT_MS')
    expect(source).toContain('timeoutMs: narratorTimeoutMs')
    expect(source).toContain('Narrator')
  })

  it('keeps LLM response body reads under the provider timeout', () => {
    const source = readServerSource()

    expect(source).toContain('async function readResponseTextWithTimeout')
    expect(source).toContain('return await response.text()')
    expect(source).toContain('clearTimeout(timer)')
    expect(source).toContain('readResponseTextWithTimeout(response, controller, timer, unlinkAbortSignal)')
  })

  it('bounds postprocess calls with a dedicated timeout', () => {
    const source = readServerSource()

    expect(source).toContain('POSTPROCESS_TIMEOUT_MS')
    expect(source).toContain('const postprocessTimeoutMs')
    expect(source).toContain('timeoutMs: postprocessTimeoutMs')
  })

  it('exposes a small provider connectivity probe', () => {
    const source = readServerSource()

    expect(source).toContain('interface ProviderTestRequest')
    expect(source).toContain("url.pathname === '/api/provider-test'")
    expect(source).toContain('async function testProvider')
    expect(source).toContain('providerApiKey(provider, input.apiKey)')
    expect(source).toContain('requestModelContent(apiKey')
    expect(source).toContain('ProviderTest')
    expect(source).toContain('providerConnectivityTimeoutMs')
    expect(source).toContain('30_000')
    const connectivityBody = source.slice(source.indexOf('async function testProvider'), source.indexOf('async function testProviderSpeed'))
    expect(connectivityBody).not.toContain('usage:')
    expect(connectivityBody).not.toContain('reply:')
  })

  it('exposes a streamed provider speed probe with real TTFT and TPS', () => {
    const source = readServerSource()

    expect(source).toContain('interface ProviderSpeedTestRequest')
    expect(source).toContain("url.pathname === '/api/provider-speed-test'")
    expect(source).toContain('async function testProviderSpeed')
    expect(source).toContain('function requestModelStreamProbe')
    expect(source).toContain('function extractStreamDelta')
    expect(source).toContain('function appendSpeedTestRecord')
    expect(source).toContain("const speedTestRecordFile = path.join(docsDir, '模型速度测试记录.md')")
    expect(source).toContain('stream: true')
    expect(source).toContain('providerSpeedTestTimeoutMs')
    expect(source).toContain('100_000')
    expect(source).toContain('约 1200 个汉字')
    expect(source).toContain('firstTokenAt ? firstTokenAt - startedAt : durationMs')
    expect(source).toContain('generationMs = Math.max(1, result.metrics.durationMs - (result.metrics.ttftMs || 0))')
    expect(source).toContain('appendSpeedTestRecord({')
    expect(source).toContain('recordFile: path.relative(rootDir, speedTestRecordFile)')
    expect(source).not.toContain("url.pathname === '/api/prompt-profile'")
    expect(source).not.toContain('writeActivePromptProfile')
  })

  it('does not write per-game pipeline speed records', () => {
    const source = readServerSource()

    expect(source).not.toContain("const speedRecordsDir = path.join(saveDir, 'speed-records')")
    expect(source).not.toContain('function speedRecordFileForGame')
    expect(source).not.toContain('function appendPipelineSpeedRecord')
    expect(source).not.toContain('appendPipelineSpeedRecord({')
    expect(source).not.toContain('无法测真实 TTFT/TPS')
    expect(source).not.toContain('输出tokens/秒(总耗时估算)')
    expect(source).not.toContain('function metricTtftDisplay')
    expect(source).not.toContain('function metricOutputTokensPerSecondEstimate')
    expect(source).not.toContain('function metricTps')
    expect(source).not.toContain('speedRecordFile')
  })

  it('can snapshot the current Narrator prompt and run raw interception tests', () => {
    const source = readServerSource()

    expect(source).toContain('interface InterceptionPromptRequest')
    expect(source).toContain('interface InterceptionTestRequest')
    expect(source).toContain("const interceptionDebugDir = path.join(debugDir, 'content-interception')")
    expect(source).toContain("url.pathname === '/api/content-interception/prompt'")
    expect(source).toContain("url.pathname === '/api/content-interception/test'")
    expect(source).toContain('function buildInterceptionNarratorPrompt')
    expect(source).toContain('function runInterceptionTest')
    expect(source).toContain('缺少测试 Prompt，请先生成快照或选择 Prompt 文件。')
    expect(source).toContain('requestModelContent(apiKey, messages')
    expect(source).toContain('interception-test-request')
    expect(source).toContain('interception-test-response')
    expect(source).not.toContain('callModel(messages, { temperature: Number.isFinite(input.temperature)')
  })

  it('does not use official DeepSeek JSON mode because it can return empty content', () => {
    const source = readServerSource()
    const deepSeekBody = source.slice(source.indexOf('async function requestOpenAICompatibleContent'), source.indexOf('async function repairJsonWithModel'))

    expect(source).toContain("label: `${label}-${provider}-empty`")
    expect(source).toContain('finish_reason')
    expect(source).toContain('returned an empty response${reasonText}；原始返回已保存')
    expect(source).toContain('reasoning_content?: string')
    expect(source).toContain('fallbackJsonFromReasoningContent')
    expect(source).toContain('JSON.stringify(parseJsonObject(text))')
    expect(source).toContain('const defaultMaxTokens = Number(process.env.LLM_MAX_TOKENS || 8192)')
    expect(deepSeekBody).not.toContain('response_format')
    expect(deepSeekBody).not.toContain('json_object')
  })

  it('retries structured JSON calls after parse repair fails', () => {
    const source = readServerSource()

    expect(source).toContain('const structuredJsonRetryCount = Number(process.env.STRUCTURED_JSON_RETRY_COUNT || 1)')
    expect(source).toContain('for (let attempt = 1; attempt <= maxAttempts; attempt += 1)')
    expect(source).toContain("label: `${label}-json-retry-${attempt}`")
    expect(source).toContain('JSON 修复失败后已自动重新调用')
    expect(source).toContain('function mergeLlmCallMetrics')
  })

  it('keeps request types compact through a shared pipeline context', () => {
    const source = readServerSource()

    expect(source).toContain('interface PipelineContext')
    expect(source).toContain('interface GenerateRequest extends PipelineContext')
    expect(source).toContain('interface PostprocessRequest extends PipelineContext')
    expect(source).not.toContain('interface EvaluationRequest')
  })

  it('bounds director calls so regeneration cannot hang forever', () => {
    const source = readServerSource()

    expect(source).toContain('DIRECTOR_TIMEOUT_MS')
    expect(source).toContain('const directorTimeoutMs = Number(process.env.DIRECTOR_TIMEOUT_MS || 300_000)')
    expect(source).toContain('DIRECTOR_MAX_TOKENS')
    expect(source).toContain('const directorMaxTokens = Number(process.env.DIRECTOR_MAX_TOKENS || 6000)')
    expect(source).toContain('const directorTemperature = Math.min(temperature, 0.4)')
    expect(source).toContain('timeoutMs: directorTimeoutMs')
    expect(source).toContain('maxTokens: directorMaxTokens')
    expect(source).toContain('temperature: directorTemperature')
    expect(source).toContain("label: `${label}-timeout`")
    expect(source).toContain('Director')
    expect(source).toContain('超过 ${Math.round(Number(options.timeoutMs) / 1000)} 秒未完成')
  })

  it('defaults every stage to the selected model and allows pipeline overrides', () => {
    const source = readServerSource()

    expect(source).not.toContain('strongLayerModel')
    expect(source).not.toContain('simpleLayerModel')
    expect(source).toContain('const selectedModel = normalizeModel(requestedModel)')
    expect(source).toContain("type PipelineStage = 'initializer' | 'director' | 'narrator' | 'optionStrategist' | 'summary'")
    expect(source).toContain("const value = record[stage] || (stage === 'summary' ? record.postprocess : '')")
    expect(source).not.toContain('initializer: officialDeepSeekV4ProModel')
    expect(source).toContain('function pipelineApiKeyForModel')
    expect(source).toContain('const keyed = input.apiKeys?.[provider]')
    expect(source).toContain('const providerApiKeysFile = path.join(saveDir, \'provider-api-keys.json\')')
    expect(source).toContain('function readSavedProviderApiKeys')
    expect(source).toContain("url.pathname === '/api/provider-api-key'")
    expect(source).toContain('const pipelineModels = buildPipelineModels(requestedModel, input.pipelineModels)')
    expect(source).toContain('const narratorModel = pipelineModels.narrator')
    expect(source).toContain('const optionStrategistModel = pipelineModels.optionStrategist')
    expect(source).toContain('const postprocessModel = pipelineModels.summary')
    expect(source).toContain('model: directorModel')
    expect(source).toContain('model: narratorModel')
    expect(source).toContain('model: optionStrategistModel')
    expect(source).toContain('model: postprocessModel')
    expect(source).toContain('pipelineModels: buildPipelineModels()')
  })

  it('sets explicit max-token budgets for initializer and postprocess', () => {
    const source = readServerSource()

    expect(source).toContain('const initializerMaxTokens = Number(process.env.INITIALIZER_MAX_TOKENS || defaultMaxTokens)')
    expect(source).toContain('const postprocessMaxTokens = Number(process.env.POSTPROCESS_MAX_TOKENS || defaultMaxTokens)')
    expect(source).toContain('maxTokens: initializerMaxTokens')
    expect(source).toContain('maxTokens: postprocessMaxTokens')
    expect(source).toContain('timeoutMs: postprocessTimeoutMs')
  })
})
