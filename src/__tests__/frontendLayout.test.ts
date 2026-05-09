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

  it('exposes editable story settings and story-specific director/narrator styles', () => {
    const html = readIndexHtml()
    const css = fs.readFileSync(path.join(process.cwd(), 'web/styles.css'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(html).toContain('id="storySettingsForm"')
    expect(html).toContain('id="storyWorldviewInput"')
    expect(html).toContain('id="storyOpeningTextInput"')
    expect(html).toContain('id="storyDirectorStyleInput"')
    expect(html).toContain('id="storyNarratorStyleInput"')
    expect(html).toContain('id="saveStorySettingsButton"')

    expect(css).toContain('.story-library-grid')
    expect(css).toContain('.story-settings-form')
    expect(appJs).toContain("directorStyle: ''")
    expect(appJs).toContain("narratorStyle: ''")
    expect(appJs).toContain('directorStyle: String(raw?.directorStyle || \'\')')
    expect(appJs).toContain('narratorStyle: String(raw?.narratorStyle || \'\')')
    expect(appJs).toContain('function renderStorySettingsForm')
    expect(appJs).toContain('function saveSelectedStorySettings')
    expect(appJs).toContain("fetch(`/api/story-assets/${encodeURIComponent(selectedNewGameAssetId)}/program-config`")
    expect(appJs).toContain('directorStyle: state.directorStyle')
    expect(appJs).toContain('narratorStyle: state.narratorStyle')

    expect(serverTs).toContain('directorStyle?: string')
    expect(serverTs).toContain('narratorStyle?: string')
    expect(serverTs).toContain("block('故事导演风格'")
    expect(serverTs).toContain("block('故事叙事风格'")
    expect(serverTs).toContain("url.pathname.match(/^\\/api\\/story-assets\\/([^/]+)\\/program-config$/)")
    expect(serverTs).toContain('function updateStoryAssetProgramConfig')
    expect(serverTs).toContain('## 导演风格')
    expect(serverTs).toContain('## 叙事风格')
  })

  it('can test the current model provider from the toolbar', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(html).toContain('id="providerTestButton"')
    expect(html).toContain('测试连接')
    expect(appJs).toContain('providerTestButton: document.querySelector')
    expect(appJs).toContain('function testCurrentProvider')
    expect(appJs).toContain("fetch('/api/provider-test'")
    expect(appJs).toContain('apiKey: getLocalApiKey(provider)')
    expect(appJs).toContain('连通性测试中')
    expect(appJs).toContain('不可用')
    expect(serverTs).toContain("url.pathname === '/api/provider-test'")
    expect(serverTs).toContain('async function testProvider')
    expect(serverTs).toContain('连通性测试。只输出一个 JSON')
  })

  it('regenerates by running the plain pipeline without cache flags', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(appJs).toContain('正在回滚并重新生成本次对话；会使用当前模型和配置完整重跑。')
    expect(appJs).not.toContain('bypassGenerationCache')
    expect(serverTs).not.toContain('bypassGenerationCache')
    expect(serverTs).not.toContain('getDirectorCacheEntry')
    expect(serverTs).not.toContain('getNarratorCacheEntry')
  })

  it('does not keep director cache fallback or emergency plans', () => {
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(serverTs).not.toContain('function isDirectorTimeoutError')
    expect(serverTs).not.toContain('cachedDirectorFallback')
    expect(serverTs).not.toContain('function buildEmergencyDirectorPlan')
    expect(serverTs).not.toContain('Director 未能及时返回，使用本地应急导演计划继续本轮。')
  })

  it('continues unfinished turns through the same plain generation path', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('继续未完成')
    expect(appJs).toContain('function continueUnfinishedTurn')
    expect(appJs).toContain("modeLabel: 'continuing'")
    expect(appJs).toContain('继续未完成：按当前状态重新执行未完成流程。')
    expect(appJs).not.toContain('preferEmergencyDirectorFallback')
    expect(appJs).not.toContain('function hasDirectorTimeoutDebug')
    expect(appJs).not.toContain('await regenerateLastTurn()')
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

  it('anchors visible text at the latest turn start instead of the bottom', () => {
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

  it('can continue a failed postprocess before the next player turn', () => {
    const html = readIndexHtml()
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('id="retryStageButton"')
    expect(html).toContain('继续未完成')
    expect(serverTs).toContain("url.pathname === '/api/postprocess-stream'")
    expect(serverTs).toContain('async function runPostprocess')
    expect(appJs).toContain('function continueUnfinishedTurn')
    expect(appJs).toContain('function renderRetryStageButton')
    expect(appJs).toContain('pendingPostprocess')
    expect(appJs).toContain('markRunningPipelineStageError')
    expect(appJs).not.toContain('await regenerateLastTurn()')
  })

  it('renders character status as collapsed per-person cards', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'web/styles.css'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function parseStatusPanelPersons')
    expect(appJs).toContain('function renderStatusPersonCard')
    expect(appJs).toContain('<details class="status-person-card"')
    expect(appJs).not.toContain('<details class="status-person-card" open')
    expect(appJs).not.toContain('追踪：${state.statusSubject}')
    expect(appJs).not.toContain('每轮后处理更新')
    expect(css).toContain('.status-people')
    expect(css).toContain('.status-person-card')
    expect(css).toContain('.status-person-card:nth-child(2n)')
    expect(css).toContain('border-left: 4px solid var(--blue);')
  })

  it('exposes a manual evaluator panel with visible model input', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(html).toContain('评估模块')
    expect(html).toContain('id="evaluationTargetSelect"')
    expect(html).toContain('value="codex"')
    expect(html).toContain('id="refreshEvaluationButton"')
    expect(html).toContain('id="evaluateTurnButton"')
    expect(html).toContain('id="evaluationReport"')
    expect(html).toContain('id="evaluationInput"')
    expect(html).toContain('查看评估材料')
    expect(appJs).toContain('function evaluateLatestTurn')
    expect(appJs).toContain('function prepareEvaluationMaterialFromState')
    expect(appJs).toContain("fetch('/api/evaluation-material'")
    expect(appJs).toContain("fetch('/api/evaluation-latest'")
    expect(appJs).toContain('评估材料已准备')
    expect(appJs).toContain('function buildEvaluationPayloadFromState')
    expect(appJs).toContain('function normalizeEvaluationTarget')
    expect(appJs).toContain('evaluationTarget: normalizeEvaluationTarget(state.evaluationTarget)')
    expect(appJs).toContain("fetch('/api/evaluate-stream'")
    expect(appJs).toContain('function renderEvaluation')
    expect(serverTs).toContain("const evaluationMaterialDir = path.join(debugDir, 'evaluation-materials')")
    expect(serverTs).toContain('function writeEvaluationMaterialFile')
    expect(serverTs).toContain("url.pathname === '/api/evaluation-material'")
    expect(serverTs).toContain("url.pathname === '/api/evaluation-latest'")
    expect(serverTs).toContain("url.pathname === '/api/evaluate-stream'")
    expect(serverTs).toContain("readPrompt('evaluator/prompt.md')")
    expect(serverTs).toContain("stage: 'evaluator'")
    expect(serverTs).toContain('debug/evaluations/latest.json')
    expect(serverTs).toContain('function writeEvaluationDebugFile')
    expect(serverTs).toContain('function writeCodexEvaluationRequestFile')
    expect(serverTs).toContain("pipelineMode: 'codex-evaluation-request'")
    expect(appJs).toContain('state.debug.evaluationFile')
  })

  it('keeps generation simple by removing next-turn prewarm caches', () => {
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(serverTs).not.toContain("url.pathname === '/api/director-prewarm'")
    expect(serverTs).not.toContain('director-cache.json')
    expect(serverTs).not.toContain('narrator-cache.json')
    expect(serverTs).not.toContain('postprocess-cache.json')
    expect(serverTs).not.toContain('PREWARM_FULL_PIPELINE')
    expect(serverTs).not.toContain('prewarmEpoch')
    expect(serverTs).not.toContain('function cancelAllPrewarmJobs')
    expect(serverTs).not.toContain("url.pathname === '/api/prewarm-cancel'")
    expect(serverTs).not.toContain('function startDirectorPrewarm')
    expect(serverTs).not.toContain('function startNarratorPrewarm')
    expect(serverTs).not.toContain('function startPostprocessPrewarm')
    expect(serverTs).toContain('function buildNarratorPromptPayload')
    expect(serverTs).toContain('function buildPostprocessPromptPayload')
    expect(serverTs).not.toContain('narratorPrewarmJobs')
    expect(serverTs).not.toContain('postprocessPrewarmJobs')
    expect(serverTs).not.toContain('等待命中的后台 Narrator 预热结果。')
    expect(serverTs).not.toContain('等待命中的后台 Postprocess 预热结果。')
    expect(serverTs).not.toContain('function awaitPrewarmJob')
    expect(serverTs).not.toContain('story-curator-needed')
    expect(appJs).not.toContain('function triggerDirectorPrewarm')
    expect(appJs).not.toContain('let prewarmController')
    expect(appJs).not.toContain('let prewarmEpoch')
    expect(appJs).not.toContain('function nextPrewarmEpoch')
    expect(appJs).not.toContain('function cancelClientPrewarm')
    expect(appJs).not.toContain("fetch('/api/prewarm-cancel'")
    expect(appJs).toContain('function ensureMultiPersonStatusPanelSchema')
    expect(appJs).toContain('function ensurePlayerStatusPanelForPrompt')
    expect(appJs).toContain('multiCharacterStatusMigration')
    expect(appJs).toContain('state.statusPanelSchema = ensureSpatialStatusPanelSchema(statusPanelSchema')
    expect(appJs).toContain('function buildRecentTurnsForRequest')
    expect(appJs).toContain('withoutPendingUser.slice(-12)')
    expect(appJs).not.toContain('Next Turn Prewarm')
    expect(appJs).not.toContain("fetch('/api/director-prewarm'")
    expect(appJs).toContain('Narrator')
    expect(appJs).toContain('Postprocess')
  })

  it('keeps current plot as the latest turn instead of accumulating history', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')
    const postprocessPrompt = fs.readFileSync(path.join(process.cwd(), 'prompts/postprocess/prompt.md'), 'utf-8')
    const serverTs = fs.readFileSync(path.join(process.cwd(), 'scripts/web-server.ts'), 'utf-8')

    expect(appJs).toContain('const currentPlot = state.outline || state.currentSituation')
    expect(appJs).toContain('state.outline = String(payload.turnSummary).trim()')
    expect(appJs).toContain("story.globalContext = ''")
    expect(appJs).not.toContain('story.globalContext = rebuildStoryGlobalContext')
    expect(appJs).not.toContain('state.globalContext = rebuildStoryGlobalContext')
    expect(appJs).toContain('chapterSummary: cleanHistoricalGlobalContext(String(raw?.chapterSummary || raw?.currentSituation || \'\'))')
    expect(appJs).toContain('globalContext: cleanHistoricalGlobalContext(String(raw?.globalContext || \'\'))')
    expect(appJs).toContain('state.globalContext = cleanHistoricalGlobalContext(state.globalContext)')
    expect(appJs).toContain('return text && !isStoryMetadataLine(text)')
    expect(appJs).toContain('故事导演风格|故事叙事风格|当前物理环境|当前物理环境禁止')
    expect(postprocessPrompt).toContain('"turnSummary"')
    expect(postprocessPrompt).toContain('它会被程序追加进历史总结')
    expect(serverTs).toContain('normalizeTurnSummary(postprocess.json.turnSummary, finalText)')
    expect(serverTs).not.toContain('deriveTurnSummaryFromDirectorPlan')
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

  it('tracks only current physical environment constraints', () => {
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(appJs).toContain('function renderPhysicalEnvironment')
    expect(appJs).toContain('currentPhysicalEnvironment')
    expect(appJs).toContain('currentPhysicalEnvironmentForbidden')
    expect(appJs).not.toContain('jumptonextphysicalscene')
    expect(appJs).not.toContain('physicalTransitionRule:')
    expect(appJs).not.toContain('physicalTransitionText:')
    expect(appJs).not.toContain('physicalSceneSkip:')
    expect(appJs).not.toContain('jumpToNextPhysicalScene')
    expect(appJs).toContain('currentPhysicalEnvironment: state.currentPhysicalEnvironment')
    expect(appJs).toContain('state.currentPhysicalEnvironment = String(payload.currentPhysicalEnvironment')
    expect(appJs).toContain("renderTrackerSection('当前物理环境'")
    expect(appJs).not.toContain('plotState')
    expect(appJs).not.toContain('function defaultPlotState')
    expect(appJs).not.toContain('function normalizePlotState')
    expect(appJs).not.toContain('function renderPlotState')
    expect(appJs).not.toContain('nextPlot')
    expect(appJs).not.toContain('currentPlotForbidden')
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

  it('exposes official V4 Pro, official V4 Flash, and Fireworks Priority models', () => {
    const html = readIndexHtml()
    const appJs = fs.readFileSync(path.join(process.cwd(), 'web/app.js'), 'utf-8')

    expect(html).toContain('value="accounts/fireworks/models/deepseek-v4-pro:priority"')
    expect(html).toContain('value="deepseek-v4-pro"')
    expect(html).toContain('value="deepseek-v4-flash"')
    expect(html).not.toContain('gemini-3.1-flash-lite-preview')
    expect(html).not.toContain('qwen/qwen3.5-flash-02-23')
    expect(html).not.toContain('gemma-4-uncensored')
    expect(html).not.toContain('value="accounts/fireworks/models/deepseek-v4-pro"')
    expect(appJs).toContain('fireworksApiKeyStorageKey')
    expect(appJs).toContain('fireworksDeepSeekV4ProPriorityModel')
    expect(appJs).toContain('officialDeepSeekV4FlashModel')
    expect(appJs).toContain('V4 Flash Official')
    expect(appJs).toContain('const defaultModel = fireworksDeepSeekV4ProPriorityModel')
    expect(appJs).toContain('Fireworks')
    expect(appJs).toContain('api.fireworks.ai/inference/v1')
    expect(appJs).not.toContain('googleApiKeyStorageKey')
    expect(appJs).not.toContain('openRouterApiKeyStorageKey')
    expect(appJs).not.toContain('veniceApiKeyStorageKey')
  })
})
