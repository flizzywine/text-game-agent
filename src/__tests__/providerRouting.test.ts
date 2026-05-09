import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function readServerSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
}

describe('provider routing', () => {
  it('allows official DeepSeek V4 Pro, official V4 Flash, and Fireworks Priority by default', () => {
    const source = readServerSource()

    expect(source).toContain("const defaultModel = fireworksDeepSeekV4ProPriorityModel")
    expect(source).toContain("officialDeepSeekV4ProModel")
    expect(source).toContain("officialDeepSeekV4FlashModel")
    expect(source).toContain("fireworksDeepSeekV4ProPriorityModel")
    expect(source).toContain("{ id: officialDeepSeekV4ProModel")
    expect(source).toContain("{ id: officialDeepSeekV4FlashModel")
    expect(source).toContain("{ id: fireworksDeepSeekV4ProPriorityModel")
    expect(source).not.toContain("gemini-3.1-flash-lite-preview")
    expect(source).not.toContain("qwen/qwen3.5-flash-02-23")
    expect(source).not.toContain("gemma-4-uncensored")
  })

  it('routes Fireworks DeepSeek V4 Pro through Fireworks chat completions', () => {
    const source = readServerSource()

    expect(source).toContain('accounts/fireworks/models/deepseek-v4-pro')
    expect(source).toContain('accounts/fireworks/models/deepseek-v4-pro:priority')
    expect(source).toContain('api.fireworks.ai/inference/v1')
    expect(source).toContain('function requestFireworksContent')
    expect(source).toContain('FIREWORKS_API_KEY')
    expect(source).toContain('Fireworks API Key')
    expect(source).toContain('Fireworks 上游错误')
    expect(source).not.toContain('stream: true')
    expect(source).not.toContain('stream_options')
    expect(source).not.toContain('function readFireworksStream')
    expect(source).not.toContain('choice.delta?.content')
    expect(source).toContain('choices?: Array<{ message?: { content?: string } }>')
    expect(source).toContain('const raw = payload.choices?.[0]?.message?.content?.trim()')
    expect(source).toContain('service_tier')
    expect(source).toContain('x-session-affinity')
    expect(source).not.toContain('const streamed = await readFireworksStream')
    expect(source).not.toContain('FIREWORKS_STREAM_IDLE_TIMEOUT_MS')
    expect(source).not.toContain('function readFireworksChunkWithIdleTimeout')
    expect(source).toContain('if (isAbortError(error))')
    expect(source).toContain('function fetchWithTransientRetry')
    expect(source).toContain('LLM_FETCH_RETRY_COUNT')
    expect(source).toContain('Fireworks 网络请求失败')
    expect(source.indexOf('const text = await response.text()')).toBeLessThan(source.indexOf('clearTimeout(timer)', source.indexOf('function requestFireworksContent')))
  })

  it('does not let long range director block a completed turn', () => {
    const source = readServerSource()

    expect(source).toContain("label: 'LongRangeDirector'")
    expect(source).toContain('LONG_RANGE_DIRECTOR_TIMEOUT_MS')
    expect(source).toContain('maxTokens: 1200')
    expect(source).toContain('timeoutMs: longRangeDirectorTimeoutMs')
    expect(source).toContain('超过 ${Math.round(Number(options.timeoutMs) / 1000)} 秒未完成')
    expect(source).toContain("type: 'stage_skip'")
    expect(source).toContain('高级导演层未返回，已跳过以免阻塞本轮')
  })

  it('bounds foreground narrator calls instead of waiting for the global provider timeout', () => {
    const source = readServerSource()

    expect(source).toContain('NARRATOR_TIMEOUT_MS')
    expect(source).toContain('timeoutMs: narratorTimeoutMs')
    expect(source).toContain('Narrator')
  })

  it('exposes a small provider connectivity probe', () => {
    const source = readServerSource()

    expect(source).toContain('interface ProviderTestRequest')
    expect(source).toContain("url.pathname === '/api/provider-test'")
    expect(source).toContain('async function testProvider')
    expect(source).toContain('providerApiKey(provider, input.apiKey)')
    expect(source).toContain('requestModelContent(apiKey')
    expect(source).toContain('ProviderTest')
    expect(source).toContain('12_000')
  })

  it('bounds director calls so regeneration cannot hang forever', () => {
    const source = readServerSource()

    expect(source).toContain('DIRECTOR_TIMEOUT_MS')
    expect(source).toContain('const directorTimeoutMs = Number(process.env.DIRECTOR_TIMEOUT_MS || 300_000)')
    expect(source).toContain('DIRECTOR_MAX_TOKENS')
    expect(source).toContain('const directorMaxTokens = Number(process.env.DIRECTOR_MAX_TOKENS || 1200)')
    expect(source).toContain('const directorTemperature = Math.min(temperature, 0.4)')
    expect(source).toContain('timeoutMs: directorTimeoutMs')
    expect(source).toContain('maxTokens: directorMaxTokens')
    expect(source).toContain('temperature: directorPayload.temperature')
    expect(source).toContain("label: `${label}-timeout`")
    expect(source).toContain('Director')
    expect(source).toContain('超过 ${Math.round(Number(options.timeoutMs) / 1000)} 秒未完成')
  })
})
