import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function readServerSource(): string {
  return fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
}

describe('provider routing', () => {
  it('only allows official DeepSeek V4 Pro and Fireworks Priority by default', () => {
    const source = readServerSource()

    expect(source).toContain("const defaultModel = fireworksDeepSeekV4ProPriorityModel")
    expect(source).toContain("officialDeepSeekV4ProModel")
    expect(source).toContain("fireworksDeepSeekV4ProPriorityModel")
    expect(source).toContain("{ id: officialDeepSeekV4ProModel")
    expect(source).toContain("{ id: fireworksDeepSeekV4ProPriorityModel")
    expect(source).not.toContain("deepseek-v4-flash")
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
    expect(source).toContain('stream: true')
    expect(source).toContain('stream_options: { include_usage: true }')
    expect(source).toContain('function readFireworksStream')
    expect(source).toContain('choice.delta?.content')
    expect(source).toContain('firstTokenMs')
    expect(source).toContain('ttftMs: streamed.firstTokenMs')
    expect(source).toContain('service_tier')
    expect(source).toContain('x-session-affinity')
  })
})
