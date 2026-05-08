import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

function readIndexHtml(): string {
  return fs.readFileSync(path.join(process.cwd(), 'web/index.html'), 'utf-8')
}

function extractAside(html: string, className: string): string {
  const match = html.match(new RegExp(`<aside class="${className}">([\\s\\S]*?)</aside>`))
  return match?.[1] || ''
}

describe('frontend layout', () => {
  it('keeps user modules in a config dialog and reserves the left rail for pipeline', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const leftRail = extractAside(html, 'left-rail')
    const rightRail = extractAside(html, 'right-rail')
    const moduleDialog = html.match(/<dialog id="moduleConfigDialog"[\s\S]*?<\/dialog>/)?.[0] || ''

    expect(html).toContain('id="moduleConfigButton"')
    expect(moduleDialog).toContain('用户配置模块')
    expect(moduleDialog).toContain('Postprocess 使用固定通用规则')
    expect(moduleDialog).toContain('id="moduleList"')

    expect(leftRail).toContain('全局流水线')
    expect(leftRail).toContain('id="debugOutput"')
    expect(leftRail).not.toContain('id="moduleList"')

    expect(rightRail).toContain('AI 速度评估')
    expect(rightRail).toContain('id="statsView"')
    expect(rightRail).not.toContain('id="debugOutput"')

    expect(appJs).toContain('function moduleLayerGroupName')
    expect(appJs).toContain("'director': '导演风格'")
    expect(appJs).toContain("'narrator': '叙事风格'")
    expect(appJs).not.toContain("'postprocess': '后处理风格'")
    expect(appJs).toContain('moduleLayerLabel(module)')
    expect(appJs).toContain('function moduleStyleExclusiveGroup')
    expect(appJs).toContain('moduleStyleExclusiveGroup(target)')
    expect(appJs).not.toContain('全部注入')
    expect(appJs).not.toContain('可多选')
  })

  it('exposes a regenerate button for the latest turn', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="regenerateButton"')
    expect(appJs).toContain('lastTurnSnapshot')
    expect(appJs).toContain('function regenerateLastTurn()')
  })

  it('keeps the free input composer compact to leave room for reading', () => {
    const html = readIndexHtml()
    const css = fs.readFileSync(path.join(process.cwd(), 'web/styles.css'), 'utf-8')

    expect(html).toContain('<textarea id="playerInput" rows="2"')
    expect(css).toContain('min-height: 52px;')
    expect(css).toContain('max-height: 118px;')
    expect(css).toContain('padding: 9px 12px;')
  })

  it('exposes a director control dialog for god-mode story steering', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="directorControlButton"')
    expect(html).toContain('id="directorControlDialog"')
    expect(html).toContain('id="directorLongRangeInput"')
    expect(html).toContain('id="directorGuidanceInput"')
    expect(html).toContain('导演控制台')
    expect(appJs).toContain("directorGuidance: ''")
    expect(appJs).toContain('directorGuidance: String(raw?.directorGuidance || \'\')')
    expect(appJs).toContain('function openDirectorControl')
    expect(appJs).toContain('function saveDirectorControl')
    expect(appJs).toContain('state.directorGuidance = els.directorGuidanceInput.value.trim()')
    expect(appJs).toContain('directorGuidance: state.directorGuidance')
  })

  it('fully bypasses director and narrator caches when regenerating', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(appJs).toContain('bypassGenerationCache: modeLabel === \'regenerating\'')
    expect(serverTs).toContain('bypassGenerationCache?: boolean')
    expect(serverTs).toContain('if (input.bypassGenerationCache)')
    expect(serverTs).toContain('input.bypassGenerationCache ? null : getDirectorCacheEntry')
    expect(serverTs).toContain('input.bypassGenerationCache ? null : getNarratorCacheEntry')
    expect(serverTs).toContain('重新生成：跳过 Director 缓存，完整重跑导演层。')
    expect(serverTs).toContain('重新生成：跳过 Narrator 缓存，完整重跑叙事层。')
  })

  it('shows the current completed turn count in the header', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="turnStatus"')
    expect(appJs).toContain('function renderTurnStatus')
    expect(appJs).toContain('function completedAssistantTurnCount')
    expect(appJs).toContain('当前第')
    expect(appJs).toContain('正在生成第')
  })

  it('supports showing edited text before background postprocess completes', () => {
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(serverTs).toContain("type: 'visible_text'")
    expect(appJs).toContain('function applyVisibleTextEvent')
    expect(appJs).toContain("event.type === 'visible_text'")
    expect(appJs).toContain('状态更新中')
  })

  it('anchors cached visible text at the latest turn start instead of the bottom', () => {
    const html = readIndexHtml()
    const css = fs.readFileSync(path.join(process.cwd(), 'web/styles.css'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="jumpTurnStartButton"')
    expect(html).toContain('id="jumpLatestButton"')
    expect(css).toContain('.reading-jump-bar')
    expect(appJs).toContain('function isConversationNearBottom')
    expect(appJs).toContain('function scrollToLatestAssistantStart')
    expect(appJs).toContain('function scrollToConversationBottom')
    expect(appJs).toContain('data-message-index')
    expect(appJs).toContain("renderConversation({ scrollTarget: 'latest-assistant-start' })")
    expect(appJs).toContain("scrollTarget === 'latest-assistant-start'")
    expect(appJs).toContain("scrollTarget === 'bottom'")
    expect(appJs).toContain('function renderReadingJumpControls')
  })

  it('does not rerender the conversation when background postprocess completes', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function persistPostprocessResult')
    expect(appJs).toContain('renderPostprocessSideEffects')
    expect(appJs).toContain('renderStatusPanel()')
    expect(appJs).toContain('renderStoryTracking()')
    expect(appJs).toContain('renderOptions()')
    expect(appJs).toContain('renderStats()')
    expect(appJs).toContain('renderDebug()')
    expect(appJs).toContain('applyPostprocess(payload)\n    persistPostprocessResult()')
    expect(appJs).not.toContain('applyPostprocess(payload)\n    persistAndRender()')
  })

  it('removes editor refinement from the runtime pipeline', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(html).not.toContain('id="refineToggle"')
    expect(html).not.toContain('开启全文精修')
    expect(appJs).not.toContain('enableEditor')
    expect(serverTs).not.toContain('input.enableEditor')
    expect(serverTs).not.toContain("readPrompt('editor/prompt.md')")
    expect(serverTs).not.toContain("stage: 'editor'")
    expect(serverTs).toContain("stage: 'narrator'")
    expect(serverTs).toContain("pipelineMode: 'narrator+postprocess'")
  })

  it('keeps AI speed stats visible even before final server metrics arrive', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function updateRuntimeStatsFromPipeline')
    expect(appJs).toContain('function buildClientRuntimeStats')
    expect(appJs).toContain('state.debug.startedAt')
    expect(appJs).toContain('payload.metrics || buildClientRuntimeStats')
  })

  it('can retry a failed postprocess before the next player turn', () => {
    const html = readIndexHtml()
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="retryStageButton"')
    expect(html).toContain('重试未完成阶段')
    expect(serverTs).toContain("url.pathname === '/api/postprocess-stream'")
    expect(serverTs).toContain('async function runPostprocess')
    expect(appJs).toContain('function retryUnfinishedStage')
    expect(appJs).toContain('function renderRetryStageButton')
    expect(appJs).toContain('pendingPostprocess')
  })

  it('prewarms next-turn director and narrator outputs from player options', () => {
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(serverTs).toContain("url.pathname === '/api/director-prewarm'")
    expect(serverTs).toContain('director-cache.json')
    expect(serverTs).toContain('narrator-cache.json')
    expect(serverTs).toContain('function startDirectorPrewarm')
    expect(serverTs).toContain('function startNarratorPrewarm')
    expect(serverTs).toContain('function buildNarratorPromptPayload')
    expect(serverTs).toContain('narratorPrewarmJobs')
    expect(serverTs).toContain('等待命中的后台 Narrator 预热草稿。')
    expect(serverTs).toContain('Promise.allSettled(jobs)')
    expect(serverTs).toContain('function cancelPrewarmJobsExcept')
    expect(serverTs).toContain('function awaitPrewarmJob')
    expect(serverTs).toContain('prewarmWaitMs')
    expect(serverTs).toContain("cancelPrewarmJobsExcept(new Set([directorPayload.cacheKey]), 'director')")
    expect(serverTs).toContain("cancelPrewarmJobsExcept(new Set([narratorPayload.cacheKey]), 'narrator')")
    expect(serverTs).not.toContain('story-curator-needed')
    expect(appJs).toContain('function triggerDirectorPrewarm')
    expect(appJs).toContain('let prewarmController')
    expect(appJs).toContain('function cancelClientPrewarm')
    expect(appJs).toContain("cancelClientPrewarm('player-input')")
    expect(appJs).toContain('signal: prewarmController.signal')
    expect(appJs).toContain("error.name === 'AbortError'")
    expect(appJs).toContain('function updatePrewarmProgress')
    expect(appJs).toContain('function buildRecentTurnsForRequest')
    expect(appJs).toContain('withoutPendingUser.slice(-12)')
    expect(appJs).toContain('Next Turn Prewarm')
    expect(appJs).toContain("fetch('/api/director-prewarm'")
    expect(appJs).toContain('cache hit')
    expect(appJs).toContain('Narrator')
  })

  it('keeps current plot as the latest turn instead of accumulating history', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('const currentPlot = state.outline || state.currentSituation')
    expect(appJs).toContain('state.outline = String(payload.turnSummary).trim()')
    expect(appJs).not.toContain('payload.outlinePatch')
    expect(appJs).not.toContain('payload.globalContextPatch')
    expect(appJs).not.toContain('appendBulletText(state.outline, payload.outlinePatch')
  })

  it('persists writing quality feedback as a disposable next-turn constraint', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain("qualityFeedback: ''")
    expect(appJs).toContain('qualityFeedback: state.qualityFeedback')
    expect(appJs).toContain('state.qualityFeedback = String(payload.qualityFeedback || \'\').trim()')
    expect(appJs).toContain("renderTrackerSection('写作负反馈'")
    expect(appJs).not.toContain('logicGuidance')
    expect(appJs).not.toContain("renderTrackerSection('逻辑提醒'")
    expect(appJs).not.toContain('characterUpdates: state.characterUpdates')
  })

  it('tracks sceneState as a four-field scene clock', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function defaultSceneState')
    expect(appJs).toContain('function normalizeSceneState')
    expect(appJs).toContain('function renderSceneState')
    expect(appJs).toContain('currentScene')
    expect(appJs).toContain('nextScene')
    expect(appJs).toContain('transitionRule')
    expect(appJs).toContain('currentSceneForbidden')
    expect(appJs).toContain('sceneState: state.sceneState')
    expect(appJs).toContain('state.sceneState = normalizeSceneState(payload.sceneState, state.sceneState)')
    expect(appJs).toContain("renderTrackerSection('环境状态'")
    expect(appJs).not.toContain('allowedTransitions')
    expect(appJs).not.toContain('phaseTransition')
  })

  it('shows long arc instead of round-based future outline', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain("renderTrackerSection('当前长期剧情'")
    expect(appJs).toContain('暂无当前长期剧情')
    expect(appJs).toContain("story.longRangeOutline = ''")
    expect(appJs).not.toContain("missing.push('longRangeOutline')")
    expect(appJs).not.toContain('formatDirectorLongRange')
    expect(appJs).not.toContain('longRangeUpdate')
    expect(appJs).toContain('state.longRangeOutline = payload.longRangeOutline.trim()')
  })

  it('tracks foreshadow payoff status instead of keeping every clue active', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(appJs).toContain('foreshadowStatusLabel')
    expect(appJs).toContain('function mergeForeshadowRecords')
    expect(appJs).toContain("if (type === 'payoff' || type === 'drop')")
    expect(appJs).toContain('function isSimilarForeshadow')
    expect(appJs).toContain('age <= 8')
    expect(appJs).toContain('foreshadowRecords: state.foreshadowRecords')
    expect(serverTs).toContain('renderForeshadowContext')
    expect(serverTs).toContain('到期：优先payoff/drop')
    expect(serverTs).toContain("block('当前伏笔'")
  })

  it('renders status panel as fields instead of raw JSON code', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function renderStatusPanelBody')
    expect(appJs).toContain('function tryParseJsonStatusPanel')
    expect(appJs).toContain('status-field')
    expect(appJs).not.toContain('<pre>${escapeHtml(body)}</pre>')
  })

  it('only exposes official V4 Pro and Fireworks Priority models', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('value="accounts/fireworks/models/deepseek-v4-pro:priority"')
    expect(html).toContain('value="deepseek-v4-pro"')
    expect(html).not.toContain('deepseek-v4-flash')
    expect(html).not.toContain('gemini-3.1-flash-lite-preview')
    expect(html).not.toContain('qwen/qwen3.5-flash-02-23')
    expect(html).not.toContain('gemma-4-uncensored')
    expect(html).not.toContain('value="accounts/fireworks/models/deepseek-v4-pro"')
    expect(appJs).toContain('fireworksApiKeyStorageKey')
    expect(appJs).toContain('fireworksDeepSeekV4ProPriorityModel')
    expect(appJs).toContain('const defaultModel = fireworksDeepSeekV4ProPriorityModel')
    expect(appJs).toContain('Fireworks')
    expect(appJs).toContain('api.fireworks.ai/inference/v1')
    expect(appJs).not.toContain('googleApiKeyStorageKey')
    expect(appJs).not.toContain('openRouterApiKeyStorageKey')
    expect(appJs).not.toContain('veniceApiKeyStorageKey')
  })
})
