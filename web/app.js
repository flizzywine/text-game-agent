const storageKey = 'text-game-agent.web-state.v2'
const legacyStorageKey = 'text-game-agent.web-state.v1'
const deepSeekApiKeyStorageKey = 'text-game-agent.deepseek-api-key'
const fireworksApiKeyStorageKey = 'text-game-agent.fireworks-api-key'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const defaultModel = officialDeepSeekV4FlashModel
const modelOptions = new Set([fireworksDeepSeekV4ProPriorityModel, officialDeepSeekV4ProModel, officialDeepSeekV4FlashModel])

const appState = loadAppState()
let state = getCurrentStory()
let builtinModules = []
let storyLibraryAssets = []
let selectedNewGameAssetId = ''
let generationBusy = false
let evaluationBusy = false
let config = {
  model: defaultModel,
  baseUrl: 'https://api.deepseek.com',
  hasApiKey: false,
  providers: {
    deepseek: { baseUrl: 'https://api.deepseek.com', hasApiKey: false },
    fireworks: { baseUrl: 'https://api.fireworks.ai/inference/v1', hasApiKey: false },
  },
}

const els = {
  connectionStatus: document.querySelector('#connectionStatus'),
  turnStatus: document.querySelector('#turnStatus'),
  modelSelect: document.querySelector('#modelSelect'),
  temperatureInput: document.querySelector('#temperatureInput'),
  apiKeyButton: document.querySelector('#apiKeyButton'),
  providerTestButton: document.querySelector('#providerTestButton'),
  apiKeyDialog: document.querySelector('#apiKeyDialog'),
  apiKeyForm: document.querySelector('#apiKeyForm'),
  apiKeyTitle: document.querySelector('#apiKeyTitle'),
  apiKeyHelp: document.querySelector('#apiKeyHelp'),
  apiKeyLabel: document.querySelector('#apiKeyLabel'),
  apiKeyInput: document.querySelector('#apiKeyInput'),
  clearApiKeyButton: document.querySelector('#clearApiKeyButton'),
  cancelApiKeyButton: document.querySelector('#cancelApiKeyButton'),
  directorControlButton: document.querySelector('#directorControlButton'),
  directorControlDialog: document.querySelector('#directorControlDialog'),
  directorControlForm: document.querySelector('#directorControlForm'),
  directorLongRangeInput: document.querySelector('#directorLongRangeInput'),
  cancelDirectorControlButton: document.querySelector('#cancelDirectorControlButton'),
  moduleConfigButton: document.querySelector('#moduleConfigButton'),
  moduleConfigDialog: document.querySelector('#moduleConfigDialog'),
  closeModuleConfigButton: document.querySelector('#closeModuleConfigButton'),
  resetButton: document.querySelector('#resetButton'),
  storySelect: document.querySelector('#storySelect'),
  storyNameInput: document.querySelector('#storyNameInput'),
  storyLibraryButton: document.querySelector('#storyLibraryButton'),
  newStoryButton: document.querySelector('#newStoryButton'),
  deleteStoryButton: document.querySelector('#deleteStoryButton'),
  saveArchiveButton: document.querySelector('#saveArchiveButton'),
  loadArchiveButton: document.querySelector('#loadArchiveButton'),
  deleteSaveButton: document.querySelector('#deleteSaveButton'),
  newGameDialog: document.querySelector('#newGameDialog'),
  newGameForm: document.querySelector('#newGameForm'),
  newGameName: document.querySelector('#newGameName'),
  storyAssetList: document.querySelector('#storyAssetList'),
  newGamePreview: document.querySelector('#newGamePreview'),
  cancelNewGameButton: document.querySelector('#cancelNewGameButton'),
  storyLibraryDialog: document.querySelector('#storyLibraryDialog'),
  importStoryAssetButton: document.querySelector('#importStoryAssetButton'),
  initializeStoryAssetButton: document.querySelector('#initializeStoryAssetButton'),
  refreshStoryLibraryButton: document.querySelector('#refreshStoryLibraryButton'),
  storyLibraryFileInput: document.querySelector('#storyLibraryFileInput'),
  storyLibraryStatus: document.querySelector('#storyLibraryStatus'),
  libraryAssetList: document.querySelector('#libraryAssetList'),
  libraryPreview: document.querySelector('#libraryPreview'),
  storySettingsForm: document.querySelector('#storySettingsForm'),
  saveStorySettingsButton: document.querySelector('#saveStorySettingsButton'),
  storyWorldviewInput: document.querySelector('#storyWorldviewInput'),
  storyOpeningTextInput: document.querySelector('#storyOpeningTextInput'),
  storyDirectorStyleInput: document.querySelector('#storyDirectorStyleInput'),
  storyNarratorStyleInput: document.querySelector('#storyNarratorStyleInput'),
  storyStatusSchemaInput: document.querySelector('#storyStatusSchemaInput'),
  storyStatusPanelInput: document.querySelector('#storyStatusPanelInput'),
  storyGlobalContextSeedInput: document.querySelector('#storyGlobalContextSeedInput'),
  closeStoryLibraryButton: document.querySelector('#closeStoryLibraryButton'),
  moduleList: document.querySelector('#moduleList'),
  jumpTurnStartButton: document.querySelector('#jumpTurnStartButton'),
  jumpLatestButton: document.querySelector('#jumpLatestButton'),
  conversation: document.querySelector('#conversation'),
  optionTray: document.querySelector('#optionTray'),
  playForm: document.querySelector('#playForm'),
  playerInput: document.querySelector('#playerInput'),
  retryStageButton: document.querySelector('#retryStageButton'),
  regenerateButton: document.querySelector('#regenerateButton'),
  sendButton: document.querySelector('#sendButton'),
  statusPanelView: document.querySelector('#statusPanelView'),
  storyTrackingView: document.querySelector('#storyTrackingView'),
  toggleDebugButton: document.querySelector('#toggleDebugButton'),
  statsView: document.querySelector('#statsView'),
  debugOutput: document.querySelector('#debugOutput'),
  evaluationTargetSelect: document.querySelector('#evaluationTargetSelect'),
  refreshEvaluationButton: document.querySelector('#refreshEvaluationButton'),
  evaluateTurnButton: document.querySelector('#evaluateTurnButton'),
  evaluationStatus: document.querySelector('#evaluationStatus'),
  evaluationReport: document.querySelector('#evaluationReport'),
  evaluationInput: document.querySelector('#evaluationInput'),
  emptyConversationTemplate: document.querySelector('#emptyConversationTemplate'),
}

init()

async function init() {
  bindEvents()
  await loadConfig()
  await loadModules()
  await loadServerState()
  applyLegacyMigrations()
  render()
  loadLatestEvaluationArtifacts()
}

function defaultStory(name = '未选择故事') {
  const now = new Date().toISOString()
  return {
    id: makeId('story-slot'),
    name,
    createdAt: now,
    updatedAt: now,
    messages: [],
    characters: [
      {
        id: makeId('character'),
        name: '玩家',
        role: '玩家操控角色',
        mood: '克制',
        location: '当前场景',
        health: '正常',
        trust: '',
        notes: '不替玩家锁死长期选择。',
      },
    ],
    moduleEnabled: {},
    openingText: '',
    worldview: '',
    currentSituation: '',
    chapterSummary: '',
    outline: '',
    longRangeOutline: '',
    directorStyle: '',
    narratorStyle: '',
    plotLines: [],
    feedbackMemory: [],
    storyAssetId: '',
    programConfigFile: '',
    statusSchema: ['位置', '姿势', '外显状态', '情绪', '已知信息', '对玩家态度', '手上物', '可触达区域'],
    statusRoster: ['玩家'],
    statusState: {},
    globalContext: '',
    playerOptions: [],
    evaluationTarget: 'external-api',
    model: defaultModel,
    runtimeStats: null,
    lastTurnSnapshot: null,
    debug: {},
  }
}

function buildStoryContextForRequest() {
  const worldview = String(state.worldview || '').trim()
  return worldview ? `## 世界观\n${worldview}` : ''
}

function defaultAppState() {
  const story = defaultStory()
  return {
    currentStoryId: story.id,
    stories: [story],
    multiSpatialMigration: true,
    reviewerPatchMigration: true,
    removeSpatialStatusPanelMigration: true,
  }
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) return normalizeAppState(JSON.parse(raw))

    const legacyRaw = localStorage.getItem(legacyStorageKey)
    if (legacyRaw) {
      const story = normalizeStory(JSON.parse(legacyRaw), '旧存档')
      return {
        currentStoryId: story.id,
        stories: [story],
        multiSpatialMigration: false,
        reviewerPatchMigration: false,
        removeSpatialStatusPanelMigration: false,
      }
    }

    return defaultAppState()
  } catch {
    return defaultAppState()
  }
}

function normalizeAppState(raw) {
  const base = defaultAppState()
  const stories = Array.isArray(raw?.stories)
    ? raw.stories.map((story, index) => normalizeStory(story, `故事 ${index + 1}`))
    : []
  if (stories.length === 0) return base
  const currentStoryId = stories.some(story => story.id === raw.currentStoryId)
    ? raw.currentStoryId
    : stories[0].id
  return {
    currentStoryId,
    stories,
    multiSpatialMigration: Boolean(raw?.multiSpatialMigration),
    reviewerPatchMigration: Boolean(raw?.reviewerPatchMigration),
    removeSpatialStatusPanelMigration: Boolean(raw?.removeSpatialStatusPanelMigration),
  }
}

function normalizeStory(raw, fallbackName = '故事') {
  const base = defaultStory(fallbackName)
  const rest = { ...(raw || {}) }
  const retiredKeys = [
    'current' + 'Physical' + 'Environment',
    'current' + 'Physical' + 'Environment' + 'Forbidden',
    'normalized' + 'Entries',
    'storybook' + 'Entries',
  ]
  retiredKeys.forEach(key => {
    delete rest[key]
  })
  return {
    ...base,
    ...rest,
    id: raw?.id || base.id,
    name: String(raw?.name || raw?.storyName || fallbackName),
    createdAt: raw?.createdAt || base.createdAt,
    updatedAt: raw?.updatedAt || base.updatedAt,
    messages: Array.isArray(raw?.messages) ? raw.messages : [],
    characters: Array.isArray(raw?.characters) ? raw.characters : base.characters,
    moduleEnabled: raw?.moduleEnabled && typeof raw.moduleEnabled === 'object' ? raw.moduleEnabled : {},
    openingText: String(raw?.openingText || ''),
    worldview: String(raw?.worldview || ''),
    currentSituation: String(raw?.currentSituation || ''),
    chapterSummary: cleanHistoricalGlobalContext(String(raw?.chapterSummary || raw?.currentSituation || '')),
    outline: String(raw?.outline || ''),
    longRangeOutline: String(raw?.longRangeOutline || ''),
    directorStyle: String(raw?.directorStyle || ''),
    narratorStyle: String(raw?.narratorStyle || ''),
    plotLines: Array.isArray(raw?.plotLines) ? raw.plotLines : [],
    feedbackMemory: normalizeFeedbackMemory(raw?.feedbackMemory),
    storyAssetId: String(raw?.storyAssetId || ''),
    programConfigFile: String(raw?.programConfigFile || ''),
    statusSchema: normalizeStatusSchema(raw?.statusSchema),
    statusRoster: normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []),
    statusState: normalizeStatusState(raw?.statusState, normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []), Array.isArray(raw?.characters) ? raw.characters : []),
    globalContext: cleanHistoricalGlobalContext(String(raw?.globalContext || '')),
    playerOptions: Array.isArray(raw?.playerOptions) ? raw.playerOptions : [],
    evaluationTarget: normalizeEvaluationTarget(raw?.evaluationTarget),
    model: normalizeModel(raw?.model || base.model),
    runtimeStats: raw?.runtimeStats && typeof raw.runtimeStats === 'object' ? raw.runtimeStats : null,
    lastTurnSnapshot: normalizeTurnSnapshot(raw?.lastTurnSnapshot),
    debug: raw?.debug && typeof raw.debug === 'object' ? raw.debug : {},
  }
}

function cleanHistoricalGlobalContext(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      const text = line.replace(/^-\s*/, '').trim()
      if (/^历史总结[:：]?$/.test(text)) return false
      return text && !isStoryMetadataLine(text)
    })
    .join('\n')
}

function isStoryMetadataLine(text) {
  return /^(当前故事资料|世界观|状态追踪人物|资料文件|初始化配置|开场白|故事导演风格|故事叙事风格|历史总结)：/.test(text)
}

function normalizeFeedbackMemory(items) {
  if (!Array.isArray(items)) return []
  return items
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const text = String(item.text || '').trim()
      if (!text) return null
      const ttl = Number.isFinite(Number(item.ttl)) ? Number(item.ttl) : 5
      return {
        type: normalizeFeedbackType(item.type),
        text,
        ttl: Math.max(1, Math.min(5, Math.floor(ttl))),
      }
    })
    .filter(Boolean)
    .slice(-15)
}

const defaultStatusSchema = ['位置', '姿势', '外显状态', '情绪', '已知信息', '对玩家态度', '手上物', '可触达区域']

function normalizeStatusSchema(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n|[,，、]/) : []
  const fields = items.map(item => String(item || '').replace(/^[-*]\s*/, '').split(/[：:]/)[0].trim()).filter(Boolean)
  return [...new Set(fields.length ? fields : defaultStatusSchema)]
}

function normalizeStatusRoster(value, characters = []) {
  const names = (Array.isArray(value) ? value : [])
    .map(item => typeof item === 'string' ? item : item?.name)
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(Boolean)
  return [...new Set(['玩家', ...names, ...characterNames])]
}

function normalizeStatusState(value, roster, characters = []) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const byName = new Map(characters.map(character => [String(character.name || '').trim(), character]))
  const output = {}
  for (const name of roster) {
    const record = source[name] && typeof source[name] === 'object' ? source[name] : {}
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

function mergeStatusSchema(current, patch) {
  return [...new Set([...normalizeStatusSchema(current), ...normalizeStatusSchema(patch)])]
}

function mergeStatusRoster(current, patch, characters = [], statePatch = {}) {
  const patchNames = statePatch && typeof statePatch === 'object' && !Array.isArray(statePatch) ? Object.keys(statePatch) : []
  return normalizeStatusRoster([...(Array.isArray(current) ? current : []), ...(Array.isArray(patch) ? patch : []), ...patchNames], characters)
}

function mergeStatusState(current, patch, roster, characters = []) {
  const base = normalizeStatusState(current, roster, characters)
  const delta = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}
  for (const [name, record] of Object.entries(delta)) {
    if (!roster.includes(name) || !record || typeof record !== 'object') continue
    base[name] = { ...(base[name] || {}), ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? '').trim()]).filter(([, value]) => value)) }
  }
  return base
}

function normalizeFeedbackType(type) {
  const value = String(type || '').trim()
  if (value === 'planExecution' || value === 'narrativeConstraint' || value === 'directorProgress') return value
  return 'quality'
}

function renderFeedbackMemory(items = state.feedbackMemory) {
  return normalizeFeedbackMemory(items)
    .map(item => {
      const label = {
        planExecution: '执行',
        narrativeConstraint: '约束',
        directorProgress: '导演',
      }[item.type] || '反馈'
      return `- [${label}｜剩${item.ttl}轮] ${item.text}`
    })
    .join('\n')
}

function mergeFeedbackMemory(existing, payload) {
  const aged = normalizeFeedbackMemory(existing)
    .map(item => ({ ...item, ttl: item.ttl - 1 }))
    .filter(item => item.ttl > 0)
  const incoming = [
    ['planExecution', payload.planExecutionFeedback],
    ['narrativeConstraint', payload.narrativeConstraintFeedback],
    ['directorProgress', payload.directorProgressFeedback],
  ]
    .map(([type, value]) => ({ type, text: String(value || '').trim(), ttl: 5 }))
    .filter(item => item.text)
  const merged = [...aged]
  for (const item of incoming) {
    const index = merged.findIndex(old => old.type === item.type && old.text === item.text)
    if (index >= 0) {
      merged[index] = { ...merged[index], ttl: 5 }
    } else {
      merged.push(item)
    }
  }
  return normalizeFeedbackMemory(merged)
}

function applyLegacyMigrations() {
  const shouldPersistMultiSpatial = !appState.multiSpatialMigration
  const shouldSwitchToReviewerPatch = !appState.reviewerPatchMigration
  const shouldRemoveSpatialStatusPanel = !appState.removeSpatialStatusPanelMigration
  const shouldPersistMultiCharacterStatus = !appState.multiCharacterStatusMigration
  for (const story of appState.stories) {
    story.statusSchema = normalizeStatusSchema(story.statusSchema)
    story.statusRoster = normalizeStatusRoster(story.statusRoster, story.characters)
    story.statusState = normalizeStatusState(story.statusState, story.statusRoster, story.characters)
  }
  if (!shouldPersistMultiSpatial && !shouldSwitchToReviewerPatch && !shouldRemoveSpatialStatusPanel && !shouldPersistMultiCharacterStatus) return
  appState.multiSpatialMigration = true
  appState.reviewerPatchMigration = true
  appState.removeSpatialStatusPanelMigration = true
  appState.multiCharacterStatusMigration = true
  saveState()
}

function getCurrentStory() {
  let story = appState.stories.find(item => item.id === appState.currentStoryId)
  if (!story) {
    story = appState.stories[0] || defaultStory()
    appState.stories = [story]
    appState.currentStoryId = story.id
  }
  return story
}

function saveState() {
  if (state) state.updatedAt = new Date().toISOString()
  appState.currentStoryId = state.id
  localStorage.setItem(storageKey, JSON.stringify(appState))
  persistServerState()
}

async function loadServerState() {
  if (localStorage.getItem(storageKey)) return
  try {
    const response = await fetch('/api/save-state')
    const payload = await response.json()
    if (!payload.state) return
    const normalized = normalizeAppState(payload.state)
    Object.assign(appState, normalized)
    state = getCurrentStory()
    localStorage.setItem(storageKey, JSON.stringify(appState))
  } catch {
    // Local browser state remains the fallback.
  }
}

function persistServerState() {
  fetch('/api/save-state', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(appState),
  }).catch(() => {
    // Browser localStorage remains the immediate save.
  })
}

function makeId(prefix) {
  if (crypto.randomUUID) return `${prefix}.${crypto.randomUUID()}`
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`
}

function normalizeModel(value) {
  const model = String(value || '').trim()
  return modelOptions.has(model) ? model : defaultModel
}

function providerForModel(model) {
  const normalized = normalizeModel(model)
  if (normalized === fireworksDeepSeekV4ProPriorityModel) return 'fireworks'
  return 'deepseek'
}

function normalizeEvaluationTarget(value) {
  return String(value || '') === 'codex' ? 'codex' : 'external-api'
}

function providerLabel(provider) {
  if (provider === 'fireworks') return 'Fireworks'
  return 'DeepSeek'
}

function modelLabel(model) {
  return {
    [officialDeepSeekV4ProModel]: 'V4 Pro Official',
    [officialDeepSeekV4FlashModel]: 'V4 Flash Official',
    [fireworksDeepSeekV4ProPriorityModel]: 'V4 Pro Fireworks Priority',
  }[model] || model
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config')
    config = normalizeRuntimeConfig(await response.json())
    state.model = normalizeModel(state.model || config.model)
    els.modelSelect.value = state.model
    renderConnection()
  } catch (error) {
    els.connectionStatus.textContent = `配置读取失败：${error.message}`
  }
}

function normalizeRuntimeConfig(raw) {
  return {
    model: normalizeModel(raw?.model || defaultModel),
    baseUrl: String(raw?.baseUrl || raw?.providers?.deepseek?.baseUrl || 'https://api.deepseek.com'),
    hasApiKey: Boolean(raw?.hasApiKey || raw?.providers?.deepseek?.hasApiKey),
    providers: {
      deepseek: {
        baseUrl: String(raw?.providers?.deepseek?.baseUrl || raw?.baseUrl || 'https://api.deepseek.com'),
        hasApiKey: Boolean(raw?.providers?.deepseek?.hasApiKey || raw?.hasApiKey),
      },
      fireworks: {
        baseUrl: String(raw?.providers?.fireworks?.baseUrl || 'https://api.fireworks.ai/inference/v1'),
        hasApiKey: Boolean(raw?.providers?.fireworks?.hasApiKey),
      },
    },
  }
}

async function loadModules() {
  try {
    const response = await fetch('/api/modules')
    const payload = await response.json()
    builtinModules = Array.isArray(payload.modules) ? payload.modules : []
  } catch {
    builtinModules = []
  }
}

function bindEvents() {
  els.playForm.addEventListener('submit', event => {
    event.preventDefault()
    submitTurn()
  })

  els.retryStageButton.addEventListener('click', () => {
    continueUnfinishedTurn()
  })

  els.regenerateButton.addEventListener('click', () => {
    regenerateLastTurn()
  })

  els.evaluationTargetSelect?.addEventListener('change', () => {
    state.evaluationTarget = normalizeEvaluationTarget(els.evaluationTargetSelect.value)
    saveState()
    renderEvaluation()
  })

  els.evaluateTurnButton?.addEventListener('click', () => {
    evaluateLatestTurn()
  })

  els.refreshEvaluationButton?.addEventListener('click', () => {
    loadLatestEvaluationArtifacts({ force: true })
  })

  els.jumpTurnStartButton.addEventListener('click', () => {
    scrollToLatestAssistantStart()
  })

  els.jumpLatestButton.addEventListener('click', () => {
    scrollToConversationBottom()
  })

  els.apiKeyButton.addEventListener('click', () => {
    renderApiKeyDialog()
    els.apiKeyDialog.showModal()
  })

  els.providerTestButton.addEventListener('click', () => {
    testCurrentProvider()
  })

  els.cancelApiKeyButton.addEventListener('click', () => {
    els.apiKeyDialog.close()
  })

  els.clearApiKeyButton.addEventListener('click', () => {
    localStorage.removeItem(apiKeyStorageKeyForProvider(currentProvider()))
    els.apiKeyInput.value = ''
    els.apiKeyDialog.close()
    renderConnection()
  })

  els.moduleConfigButton.addEventListener('click', () => {
    renderModules()
    els.moduleConfigDialog.showModal()
  })

  els.closeModuleConfigButton.addEventListener('click', () => {
    els.moduleConfigDialog.close()
  })

  els.directorControlButton.addEventListener('click', () => {
    openDirectorControl()
  })

  els.cancelDirectorControlButton.addEventListener('click', () => {
    els.directorControlDialog.close()
  })

  els.directorControlForm.addEventListener('submit', event => {
    event.preventDefault()
    saveDirectorControl()
  })

  els.apiKeyForm.addEventListener('submit', event => {
    event.preventDefault()
    const provider = currentProvider()
    const key = els.apiKeyInput.value.trim()
    if (provider === 'deepseek' && key && !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) {
      alert('API Key 格式不对。DeepSeek key 通常以 sk- 开头，请重新粘贴完整 key。')
      return
    }
    if (key) localStorage.setItem(apiKeyStorageKeyForProvider(provider), key)
    else localStorage.removeItem(apiKeyStorageKeyForProvider(provider))
    els.apiKeyDialog.close()
    renderConnection()
  })

  els.modelSelect.addEventListener('change', event => {
    state.model = normalizeModel(event.target.value)
    saveState()
    renderConnection()
    if (els.apiKeyDialog.open) renderApiKeyDialog()
  })

  els.resetButton.addEventListener('click', () => {
    if (!confirm('清空当前故事的对话、人物、故事书和上下文？')) return
    const replacement = defaultStory(state.name)
    replacement.id = state.id
    replacement.createdAt = state.createdAt
    const index = appState.stories.findIndex(story => story.id === state.id)
    appState.stories[index] = replacement
    state = replacement
    saveState()
    render()
  })

  els.storySelect.addEventListener('change', event => {
    switchStory(event.target.value)
  })

  els.storyNameInput.addEventListener('input', event => {
    state.name = event.target.value.trim() || '未命名故事'
    saveState()
    renderStoryControls()
  })

  els.storyLibraryButton.addEventListener('click', () => {
    openStoryLibraryDialog()
  })

  els.newStoryButton.addEventListener('click', () => {
    openNewGameDialog()
  })

  els.deleteStoryButton.addEventListener('click', () => {
    if (appState.stories.length <= 1) {
      alert('至少保留一个故事。')
      return
    }
    if (!confirm(`删除故事“${state.name}”？此操作只删除浏览器里的本地故事槽。`)) return
    appState.stories = appState.stories.filter(story => story.id !== state.id)
    appState.currentStoryId = appState.stories[0].id
    state = getCurrentStory()
    saveState()
    render()
  })

  els.saveArchiveButton.addEventListener('click', () => {
    saveState()
    alert('已保存到 save/current-state.json。')
  })

  els.loadArchiveButton.addEventListener('click', () => {
    loadDiskSave()
  })

  els.deleteSaveButton.addEventListener('click', async () => {
    if (!confirm('删除 save/current-state.json，并清空当前浏览器进度？')) return
    await fetch('/api/save-state', { method: 'DELETE' }).catch(() => {})
    localStorage.removeItem(storageKey)
    const fresh = defaultAppState()
    Object.assign(appState, fresh)
    state = getCurrentStory()
    render()
  })

  els.cancelNewGameButton.addEventListener('click', () => {
    els.newGameDialog.close()
  })

  els.importStoryAssetButton.addEventListener('click', () => {
    els.storyLibraryFileInput.click()
  })

  els.storyLibraryFileInput.addEventListener('change', async event => {
    const files = Array.from(event.target.files || [])
    for (const file of files) {
      const imported = await importStoryFile(file)
      const asset = storyAssetFromImported(file.name, imported)
      storyLibraryAssets.unshift(asset)
      selectedNewGameAssetId = asset.id
    }
    event.target.value = ''
    renderStoryLibraryAssets()
    renderNewGameAssets()
  })

  els.initializeStoryAssetButton.addEventListener('click', () => {
    initializeSelectedStoryAsset()
  })

  els.refreshStoryLibraryButton.addEventListener('click', async () => {
    await loadStoryLibrary()
    renderStoryLibraryAssets()
  })

  els.saveStorySettingsButton.addEventListener('click', () => {
    saveSelectedStorySettings()
  })

  els.closeStoryLibraryButton.addEventListener('click', () => {
    els.storyLibraryDialog.close()
  })

  els.newGameForm.addEventListener('submit', async event => {
    event.preventDefault()
    const asset = storyLibraryAssets.find(item => item.id === selectedNewGameAssetId)
    if (!asset) {
      alert('请先选择或导入一个故事资料。')
      return
    }
    if (!asset.programConfig) {
      alert('这个故事还没有初始化。请先到“故事库”点击初始化。')
      return
    }
    try {
      await startNewGameFromAsset(asset, els.newGameName.value.trim())
    } catch (error) {
      alert(error.message)
      renderNewGameAssets()
    }
  })

  els.toggleDebugButton.addEventListener('click', () => {
    document.querySelector('.debug-panel').classList.toggle('collapsed')
  })
}

function render() {
  renderConnection()
  renderStoryControls()
  renderModules()
  renderStatusPanel()
  renderStoryTracking()
  renderConversation()
  renderOptions()
  renderReadingJumpControls()
  renderRetryStageButton()
  renderRegenerateButton()
  els.modelSelect.value = normalizeModel(state.model || config.model)
  renderStats()
  renderDebug()
  renderEvaluation()
  if (els.evaluationTargetSelect) els.evaluationTargetSelect.value = normalizeEvaluationTarget(state.evaluationTarget)
}

function renderDebug() {
  const debug = state.debug || {}
  const progress = Array.isArray(debug.progress) ? debug.progress : []
  if (progress.length === 0 && Object.keys(debug).length === 0) {
    els.debugOutput.textContent = '暂无流水线输出。'
    return
  }

  const lines = []
  if (debug.status) lines.push(`status: ${debug.status}`)
  if (debug.pipelineMode) lines.push(`mode: ${debug.pipelineMode}`)
  if (debug.note) lines.push(`note: ${debug.note}`)
  if (debug.error) lines.push(`error: ${debug.error}`)
  if (progress.length) {
    lines.push('', 'progress:')
    for (const item of progress) {
      lines.push(`- ${item.label || item.stage}: ${item.status}${item.message ? `｜${item.message}` : ''}`)
      if (Array.isArray(item.logs) && item.logs.length) {
        for (const log of item.logs.slice(-4)) lines.push(`  · ${log}`)
      }
    }
  }

  const payload = {
    initializer: debug.initializer,
    director: debug.director,
    narrator: debug.narrator,
    postprocess: debug.postprocess,
    evaluator: debug.evaluator,
  }
  if (Object.values(payload).some(Boolean)) {
    lines.push('', 'stages:', JSON.stringify(payload, null, 2))
  }
  els.debugOutput.textContent = lines.join('\n')
}

function evaluationArtifactMatchesCurrentStory(artifact) {
  if (!artifact || typeof artifact !== 'object') return false
  const storyId = String(artifact.storyId || '').trim()
  const storyName = String(artifact.storyName || artifact.story || '').trim()
  if (storyId) return storyId === state.id
  if (storyName) return storyName === state.name
  return false
}

function extractEvaluationReportPayload(value) {
  if (!value || typeof value !== 'object') return null
  if (value.evaluation && typeof value.evaluation === 'object') return value.evaluation
  if ('score' in value || Array.isArray(value.issues)) return value
  return null
}

async function loadLatestEvaluationArtifacts({ force = false } = {}) {
  try {
    const response = await fetch('/api/evaluation-latest')
    if (!response.ok) throw new Error('读取评估文件失败')
    const payload = await response.json()
    const material = payload.material && typeof payload.material === 'object' ? payload.material : null
    const reportContainer = payload.report && typeof payload.report === 'object' ? payload.report : null
    const report = extractEvaluationReportPayload(reportContainer)
    let changed = false

    state.debug = state.debug || {}
    if (material && evaluationArtifactMatchesCurrentStory(material)) {
      state.debug.evaluatorPrompt = String(material.evaluatorPrompt || state.debug.evaluatorPrompt || '')
      state.debug.evaluationMaterialFile = String(material.file || payload.materialFile || '')
      state.debug.latestEvaluationMaterialFile = String(payload.latestEvaluationMaterialFile || '')
      state.debug.evaluationRun = state.debug.evaluationRun && typeof state.debug.evaluationRun === 'object'
        ? state.debug.evaluationRun
        : {}
      if (!state.debug.evaluationRun.status || state.debug.evaluationRun.status === 'idle') {
        state.debug.evaluationRun.status = 'material-ready'
      }
      changed = true
    }

    if (reportContainer && report && evaluationArtifactMatchesCurrentStory(reportContainer)) {
      state.debug.evaluationReport = report
      state.debug.evaluator = report
      state.debug.evaluationFile = String(reportContainer.file || payload.reportFile || '')
      state.debug.latestEvaluationFile = String(payload.latestEvaluationFile || '')
      state.debug.evaluationRun = state.debug.evaluationRun && typeof state.debug.evaluationRun === 'object'
        ? state.debug.evaluationRun
        : {}
      state.debug.evaluationRun.status = 'done'
      changed = true
    }

    if (changed || force) {
      if (force && !changed) {
        state.debug.evaluationRun = {
          ...(state.debug.evaluationRun || {}),
          status: 'error',
          error: '没有找到当前故事的评估文件。',
        }
      }
      saveState()
      renderEvaluation()
      renderDebug()
    }
  } catch (error) {
    if (!force) return
    state.debug = state.debug || {}
    state.debug.evaluationRun = {
      ...(state.debug.evaluationRun || {}),
      status: 'error',
      error: error.message,
    }
    saveState()
    renderEvaluation()
  }
}

function renderEvaluation() {
  if (!els.evaluationTargetSelect || !els.refreshEvaluationButton || !els.evaluateTurnButton || !els.evaluationStatus || !els.evaluationInput || !els.evaluationReport) return
  const debug = state.debug || {}
  const run = debug.evaluationRun && typeof debug.evaluationRun === 'object' ? debug.evaluationRun : {}
  const report = debug.evaluationReport || debug.evaluator || null
  const prompt = String(debug.evaluatorPrompt || '').trim()
  const progress = Array.isArray(run.progress) ? run.progress : []
  const pendingPostprocess = Boolean(getPendingPostprocess())
  const canEvaluate = Boolean(buildEvaluationPayloadFromState()) && !generationBusy && !pendingPostprocess
  const evaluationFile = String(debug.evaluationFile || debug.latestEvaluationFile || '').trim()
  const materialFile = String(debug.evaluationMaterialFile || debug.latestEvaluationMaterialFile || '').trim()
  const evaluationTarget = normalizeEvaluationTarget(state.evaluationTarget)

  els.evaluationTargetSelect.value = evaluationTarget
  els.refreshEvaluationButton.disabled = evaluationBusy
  els.evaluateTurnButton.disabled = evaluationBusy || !canEvaluate
  els.evaluateTurnButton.textContent = evaluationBusy ? '评估中' : '评估上一轮'
  els.evaluateTurnButton.title = pendingPostprocess
    ? '上一轮 Postprocess 完成后才能评估。'
    : canEvaluate
      ? (evaluationTarget === 'codex' ? '把评估材料写给 Codex。' : '调用外部 API 评估最近一轮正文。')
      : '暂无可评估正文。'

  const statusParts = []
  if (evaluationBusy) statusParts.push('评估中')
  else if (run.status === 'material-ready') statusParts.push('评估材料已准备')
  else if (run.status === 'prepared') statusParts.push('已写入 Codex 待评估材料')
  else if (run.status === 'done') statusParts.push('评估完成')
  else if (run.status === 'error') statusParts.push('评估失败')
  else statusParts.push('未评估')
  statusParts.push(`执行者：${evaluationTarget === 'codex' ? 'Codex' : '外部 API'}`)
  if (run.error) statusParts.push(run.error)
  if (materialFile) statusParts.push(`材料：${materialFile}`)
  if (evaluationFile) statusParts.push(`文件：${evaluationFile}`)
  if (progress.length) {
    const last = progress[progress.length - 1]
    statusParts.push(`${last.label || last.stage}: ${last.status}${last.message ? `｜${last.message}` : ''}`)
  }
  els.evaluationStatus.textContent = `${statusParts.join('。')}。`
  els.evaluationInput.textContent = prompt || '点击评估后显示完整输入。'
  els.evaluationReport.innerHTML = run.status === 'prepared'
    ? renderCodexEvaluationNotice(evaluationFile)
    : renderEvaluationReport(report, debug.evaluationMetrics)
}

function renderCodexEvaluationNotice(file) {
  return `
    <p class="evaluation-summary">评估材料已经写入本地文件，未调用外部 API。接下来在对话里说“看最新评估”，Codex 会读取这份材料并给出评估。</p>
    ${file ? `<p class="meta no-indent">文件：${escapeHtml(file)}</p>` : ''}
  `
}

function renderEvaluationReport(report, metrics) {
  if (!report || typeof report !== 'object') {
    return '<p class="meta no-indent">暂无评估报告。</p>'
  }
  const issues = Array.isArray(report.issues) ? report.issues : []
  const strengths = Array.isArray(report.strengths) ? report.strengths : []
  const nextActions = Array.isArray(report.nextActions) ? report.nextActions : []
  return `
    <div class="evaluation-score">
      <span>score</span>
      <strong>${escapeHtml(report.score ?? '-')}</strong>
    </div>
    <p class="evaluation-summary">${escapeHtml(report.summary || '无总评。')}</p>
    ${issues.length ? issues.map(renderEvaluationIssue).join('') : '<p class="meta no-indent">未发现明确问题。</p>'}
    ${renderEvaluationList('保留项', strengths)}
    ${renderEvaluationList('下一步', nextActions)}
    ${metrics ? `
      <details class="stats-detail">
        <summary>评估耗时</summary>
        <pre>${escapeHtml(formatEvaluationMetrics(metrics))}</pre>
      </details>
    ` : ''}
  `
}

function renderEvaluationIssue(issue) {
  if (!issue || typeof issue !== 'object') return ''
  const title = `${issue.severity || 'P?'} · ${issue.type || 'issue'}`
  return `
    <article class="evaluation-issue">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(issue.rootCause || 'unclear')}</span>
      </header>
      <p><strong>证据：</strong>${escapeHtml(issue.evidence || '未提供')}</p>
      <p><strong>建议：</strong>${escapeHtml(issue.recommendation || '未提供')}</p>
    </article>
  `
}

function renderEvaluationList(title, items) {
  if (!items.length) return ''
  return `
    <div>
      <p class="meta no-indent">${escapeHtml(title)}</p>
      <ul class="evaluation-list">
        ${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </div>
  `
}

function formatEvaluationMetrics(metrics) {
  const lines = [
    `模型：${modelLabel(metrics.model || state.model)}`,
    `首次应答：${formatMs(metrics.firstResponseMs)}`,
    `总耗时：${formatMs(metrics.totalMs)}`,
    `TPS：${formatTps(metrics.tps)}`,
    `输出 tokens：${formatNumber(metrics.outputTokens)}`,
    `总 tokens：${formatNumber(metrics.totalTokens)}`,
  ]
  if (Array.isArray(metrics.stages)) {
    lines.push('', ...metrics.stages.map(formatStageStatsLine))
  }
  return lines.join('\n')
}

function renderStats() {
  if (!els.statsView) return
  const stats = state.runtimeStats
  if (!stats || typeof stats !== 'object') {
    els.statsView.innerHTML = '<p class="meta no-indent">暂无统计。发送一轮后显示耗时。</p>'
    return
  }
  const stageRows = Array.isArray(stats.stages) ? stats.stages : []
  els.statsView.innerHTML = `
    <div class="stat-grid">
      ${renderStatItem('模型', modelLabel(stats.model || state.model))}
      ${renderStatItem('首次应答', formatMs(stats.firstResponseMs))}
      ${renderStatItem('总耗时', formatMs(stats.totalMs))}
      ${renderStatItem('TPS', formatTps(stats.tps))}
      ${renderStatItem('输出 tokens', formatNumber(stats.outputTokens))}
      ${renderStatItem('总 tokens', formatNumber(stats.totalTokens))}
    </div>
    ${stageRows.length ? `
      <details class="stats-detail">
        <summary>分层耗时</summary>
        <pre>${escapeHtml(stageRows.map(formatStageStatsLine).join('\n'))}</pre>
      </details>
    ` : ''}
  `
}

function renderStatItem(label, value) {
  return `<div class="stat-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
}

function formatStageStatsLine(row) {
  const label = row.label || row.stage
  const parts = [
    `TTFT ${formatMs(row.ttftMs)}`,
    `总 ${formatMs(row.durationMs)}`,
    `out ${formatNumber(row.outputTokens)}`,
  ].filter(Boolean)
  return `${label}: ${parts.join(' · ')}`
}

function formatMs(value) {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function formatTps(value) {
  const tps = Number(value)
  if (!Number.isFinite(tps) || tps <= 0) return '-'
  return `${tps.toFixed(1)}/s`
}

function formatNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '-'
  return String(Math.round(n))
}

function updateRuntimeStatsFromPipeline() {
  if (!state.debug?.startedAt) return
  state.runtimeStats = buildClientRuntimeStats()
  renderStats()
}

function buildClientRuntimeStats(payload = {}) {
  const debug = state.debug || {}
  const startedAt = Number(state.debug.startedAt || Date.now())
  const now = Date.now()
  const progress = Array.isArray(debug.progress) ? debug.progress : []
  const stages = progress.map(row => buildClientStageStat(row, now))
  const visibleText = lastVisibleAssistantText()
  const visibleOutputTokens = estimateClientTokens(visibleText)
  const outputTokens = stages.reduce((sum, row) => sum + (Number(row.outputTokens) || 0), 0) || visibleOutputTokens
  const totalMs = Math.max(0, now - startedAt)
  const firstEventAt = Number(debug.firstEventAtMs || 0)
  return {
    source: 'client',
    model: normalizeModel(payload.model || state.model || config.model),
    firstResponseMs: firstEventAt > startedAt ? firstEventAt - startedAt : totalMs,
    totalMs,
    tps: totalMs > 0 && outputTokens > 0 ? outputTokens / (totalMs / 1000) : 0,
    inputTokens: 0,
    outputTokens,
    totalTokens: outputTokens,
    visibleOutputTokens,
    stages,
  }
}

function buildClientStageStat(row, now) {
  const startedAt = Number(row.startedAtMs || 0)
  const endedAt = Number(row.endedAtMs || 0)
  const updatedAt = Number(row.updatedAtMs || 0)
  const effectiveEnd = endedAt || (row.status === 'running' ? now : updatedAt)
  return {
    stage: row.stage,
    label: row.label || row.stage,
    model: normalizeModel(state.model || config.model),
    durationMs: startedAt && effectiveEnd ? Math.max(0, effectiveEnd - startedAt) : 0,
    ttftMs: Number(row.ttftMs || 0),
    inputTokens: 0,
    outputTokens: Number(row.outputTokens || 0),
    totalTokens: Number(row.outputTokens || 0),
  }
}

function lastVisibleAssistantText() {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index]
    if (message?.role === 'assistant') return String(message.content || '')
  }
  return ''
}

function estimateClientTokens(text) {
  const value = String(text || '').trim()
  if (!value) return 0
  return Math.ceil(value.length / 1.6)
}

function parseOutputTokens(message) {
  const match = String(message || '').match(/输出\s+(\d+)\s+tokens/)
  return match ? Number(match[1]) : 0
}

function renderStoryControls() {
  els.storySelect.innerHTML = appState.stories.map(story => `
    <option value="${escapeAttr(story.id)}" ${story.id === state.id ? 'selected' : ''}>
      ${escapeHtml(story.name || '未命名故事')}
    </option>
  `).join('')
  els.storyNameInput.value = state.name || ''
  els.deleteStoryButton.disabled = appState.stories.length <= 1
}

function switchStory(id) {
  const next = appState.stories.find(story => story.id === id)
  if (!next) return
  appState.currentStoryId = next.id
  state = next
  saveState()
  render()
}

async function openNewGameDialog() {
  await loadStoryLibrary()
  selectedNewGameAssetId = storyLibraryAssets[0]?.id || ''
  els.newGameName.value = selectedNewGameAssetId
    ? assetDefaultStoryName(storyLibraryAssets[0])
    : `新故事 ${appState.stories.length + 1}`
  renderNewGameAssets()
  els.newGameDialog.showModal()
}

async function openStoryLibraryDialog() {
  await loadStoryLibrary()
  selectedNewGameAssetId = storyLibraryAssets[0]?.id || ''
  setStoryLibraryStatus(storyLibraryAssets.some(asset => asset.programConfig)
    ? '已有已初始化故事，可以开始新游戏。'
    : '请选择故事资料并点击初始化。')
  renderStoryLibraryAssets()
  els.storyLibraryDialog.showModal()
}

async function loadStoryLibrary() {
  try {
    const response = await fetch('/api/story-assets')
    const payload = await response.json()
    storyLibraryAssets = Array.isArray(payload.assets) ? payload.assets : []
  } catch {
    storyLibraryAssets = []
  }
}

function renderNewGameAssets() {
  if (storyLibraryAssets.length === 0) {
    els.storyAssetList.innerHTML = '<p class="meta no-indent">还没有故事资料。请先进入“故事库”导入并初始化。</p>'
    els.newGamePreview.innerHTML = ''
    return
  }

  const readyAssets = storyLibraryAssets.filter(asset => asset.programConfig)
  if (readyAssets.length === 0) {
    els.storyAssetList.innerHTML = '<p class="meta no-indent">还没有已初始化故事。请先进入“故事库”初始化。</p>'
    els.newGamePreview.innerHTML = ''
    return
  }
  if (!readyAssets.some(asset => asset.id === selectedNewGameAssetId)) selectedNewGameAssetId = readyAssets[0].id

  els.storyAssetList.innerHTML = readyAssets.map(asset => `
    <label class="asset-choice">
      <input type="radio" name="new-game-asset" value="${escapeAttr(asset.id)}" ${asset.id === selectedNewGameAssetId ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(assetDefaultStoryName(asset))}</strong>
        <small>${escapeHtml(asset.sourceName || asset.id)} · ${(asset.entries || []).length} 条资料 · ${(asset.characters || []).length} 个人物 · ${asset.programConfigFile || asset.programConfig ? '已初始化' : '待初始化'}</small>
      </span>
    </label>
  `).join('')

  els.storyAssetList.querySelectorAll('input[name="new-game-asset"]').forEach(input => {
    input.addEventListener('change', event => {
      selectedNewGameAssetId = event.target.value
      const asset = readyAssets.find(item => item.id === selectedNewGameAssetId)
      if (asset) els.newGameName.value = assetDefaultStoryName(asset)
      renderNewGameAssets()
    })
  })

  const selected = readyAssets.find(asset => asset.id === selectedNewGameAssetId)
  if (selected) els.newGameName.value = assetDefaultStoryName(selected)
  renderNewGamePreview(selected)
}

function renderStoryLibraryAssets() {
  if (storyLibraryAssets.length === 0) {
    els.libraryAssetList.innerHTML = '<p class="meta no-indent">还没有故事资料。先导入人物卡、故事书或世界书。</p>'
    els.libraryPreview.innerHTML = ''
    renderStorySettingsForm(null)
    return
  }

  els.libraryAssetList.innerHTML = storyLibraryAssets.map(asset => `
    <label class="asset-choice">
      <input type="radio" name="library-asset" value="${escapeAttr(asset.id)}" ${asset.id === selectedNewGameAssetId ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(assetDefaultStoryName(asset))} ${asset.programConfigFile || asset.programConfig ? '<em class="status-pill ready">已初始化</em>' : '<em class="status-pill pending">待初始化</em>'}</strong>
        <small>${escapeHtml(asset.sourceName || asset.id)} · ${(asset.entries || []).length} 条资料 · ${(asset.characters || []).length} 个人物${asset.programConfig?.generatedAt ? ` · ${escapeHtml(formatTime(asset.programConfig.generatedAt))}` : ''}</small>
      </span>
    </label>
  `).join('')

  els.libraryAssetList.querySelectorAll('input[name="library-asset"]').forEach(input => {
    input.addEventListener('change', event => {
      selectedNewGameAssetId = event.target.value
      renderStoryLibraryAssets()
    })
  })

  const selected = storyLibraryAssets.find(asset => asset.id === selectedNewGameAssetId)
  renderStorySettingsForm(selected)
  renderAssetPreview(els.libraryPreview, selected)
}

function renderStorySettingsForm(asset) {
  const config = storyProgramConfigForEdit(asset)
  const disabled = !asset?.programConfig
  els.saveStorySettingsButton.disabled = disabled
  const fields = [
    els.storyWorldviewInput,
    els.storyOpeningTextInput,
    els.storyDirectorStyleInput,
    els.storyNarratorStyleInput,
    els.storyStatusSchemaInput,
    els.storyStatusPanelInput,
    els.storyGlobalContextSeedInput,
  ]
  fields.forEach(field => {
    field.disabled = disabled
  })
  els.storyWorldviewInput.value = config.worldview
  els.storyOpeningTextInput.value = config.openingText
  els.storyDirectorStyleInput.value = config.directorStyle
  els.storyNarratorStyleInput.value = config.narratorStyle
  els.storyStatusSchemaInput.value = config.statusSchema.join('\n')
  els.storyStatusPanelInput.value = JSON.stringify(config.statusState, null, 2)
  els.storyGlobalContextSeedInput.value = config.globalContextSeed
}

function storyProgramConfigForEdit(asset) {
  const config = asset?.programConfig || {}
  return {
    worldview: String(config.worldview || ''),
    openingText: String(config.openingText || ''),
    directorStyle: String(config.directorStyle || ''),
    narratorStyle: String(config.narratorStyle || ''),
    statusSchema: normalizeStatusSchema(config.statusSchema),
    statusRoster: normalizeStatusRoster(config.statusRoster, config.cast || []),
    statusState: normalizeStatusState(config.statusState, normalizeStatusRoster(config.statusRoster, config.cast || []), config.cast || []),
    globalContextSeed: String(config.globalContextSeed || ''),
  }
}

async function saveSelectedStorySettings() {
  const asset = storyLibraryAssets.find(item => item.id === selectedNewGameAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  if (!asset.programConfig) {
    alert('这个故事还没有初始化，不能保存程序设定。')
    return
  }
  const patch = {
    worldview: els.storyWorldviewInput.value.trim(),
    openingText: els.storyOpeningTextInput.value.trim(),
    directorStyle: els.storyDirectorStyleInput.value.trim(),
    narratorStyle: els.storyNarratorStyleInput.value.trim(),
    statusSchema: normalizeStatusSchema(els.storyStatusSchemaInput.value),
    statusState: (() => { try { return JSON.parse(els.storyStatusPanelInput.value || '{}') } catch { return {} } })(),
    globalContextSeed: els.storyGlobalContextSeedInput.value.trim(),
  }
  els.saveStorySettingsButton.disabled = true
  setStoryLibraryStatus('正在保存故事设定。', 'running')
  try {
    const response = await fetch(`/api/story-assets/${encodeURIComponent(selectedNewGameAssetId)}/program-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '保存故事设定失败')
    asset.programConfig = payload.config
    if (!asset.programConfigFile && asset.id) asset.programConfigFile = `story/${asset.id}/program-config.json`
    applyProgramConfigToCurrentStory(asset, payload.config)
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
    setStoryLibraryStatus(`已保存故事设定：${assetDefaultStoryName(asset)}。`, 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    const selected = storyLibraryAssets.find(item => item.id === selectedNewGameAssetId)
    els.saveStorySettingsButton.disabled = !selected?.programConfig
  }
}

function applyProgramConfigToCurrentStory(asset, config) {
  if (!asset || !config) return
  if (state.storyAssetId !== asset.id && state.programConfigFile !== asset.programConfigFile) return
  state.worldview = String(config.worldview || state.worldview || '')
  state.openingText = String(config.openingText || state.openingText || '')
  state.directorStyle = String(config.directorStyle || '')
  state.narratorStyle = String(config.narratorStyle || '')
  state.statusSchema = normalizeStatusSchema(config.statusSchema || state.statusSchema)
  state.statusRoster = normalizeStatusRoster(config.statusRoster || state.statusRoster, state.characters)
  state.statusState = normalizeStatusState(config.statusState || state.statusState, state.statusRoster, state.characters)
  state.globalContext = cleanHistoricalGlobalContext(state.globalContext)
  saveState()
  renderStoryTracking()
}

function setStoryLibraryStatus(message, tone = '') {
  if (!els.storyLibraryStatus) return
  els.storyLibraryStatus.textContent = message || ''
  els.storyLibraryStatus.dataset.tone = tone
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

function renderNewGamePreview(asset) {
  renderAssetPreview(els.newGamePreview, asset)
}

function renderAssetPreview(container, asset) {
  if (!asset) {
    container.innerHTML = ''
    return
  }
  container.innerHTML = `
    <div class="preview-block">
      <strong>程序配置</strong>
      <pre>${escapeHtml(renderAssetProgramConfigPreview(asset))}</pre>
    </div>
    <div class="preview-block">
      <strong>初始化人物</strong>
      <pre>${escapeHtml(renderAssetCharactersPreview(asset))}</pre>
    </div>
    <div class="preview-block">
      <strong>初始化资料</strong>
      <pre>${escapeHtml(renderAssetEntriesPreview(asset))}</pre>
    </div>
  `
}

function renderAssetCharactersPreview(asset) {
  const characters = asset.characters || []
  if (characters.length === 0) return '玩家'
  return ['玩家', ...characters.map(character => [
    character.name || '未命名人物',
    character.role ? `｜${character.role}` : '',
    character.notes ? `\n${character.notes}` : '',
  ].join(''))].join('\n\n')
}

function renderAssetEntriesPreview(asset) {
  const entries = asset.entries || []
  if (entries.length === 0) return '无资料条目'
  return entries.slice(0, 8).map(entry => [
    entry.title || entry.id,
    entry.type ? `｜${storyEntryTypeLabel(entry.type)}` : '',
    entry.tags?.length ? `｜${entry.tags.join(', ')}` : '',
  ].join('')).join('\n')
}

function renderAssetProgramConfigPreview(asset) {
  const config = asset.programConfig
  return [
    asset.programConfigFile ? `文件：${asset.programConfigFile}` : '文件：未初始化，请在故事库点击初始化',
    config?.worldview ? `世界观：${String(config.worldview).slice(0, 120)}` : '',
    config?.directorStyle ? `导演风格：${String(config.directorStyle).slice(0, 120)}` : '',
    config?.narratorStyle ? `叙事风格：${String(config.narratorStyle).slice(0, 120)}` : '',
    config?.statusRoster?.length ? `状态追踪：${config.statusRoster.join('、').slice(0, 80)}` : '',
    Array.isArray(config?.initialPlayerOptions) ? `初始选项：${config.initialPlayerOptions.length} 个` : '',
  ].filter(Boolean).join('\n')
}

function storyAssetFromImported(sourceName, imported) {
  const sourceFiles = imported.entries?.find(entry => entry.sourceFiles)?.sourceFiles
  return {
    id: storyAssetIdFromSourceFiles(sourceFiles) || makeId('story-asset.imported'),
    sourceName,
    importedAt: new Date().toISOString(),
    originalFile: sourceFiles?.original,
    markdownFile: sourceFiles?.markdown,
    programConfigFile: sourceFiles?.programConfig,
    programConfig: imported.programConfig,
    entries: imported.entries || [],
    characters: imported.characters || [],
  }
}

function storyAssetIdFromSourceFiles(sourceFiles) {
  return String(sourceFiles?.dir || '').split('/').filter(Boolean).pop()
}

function assetDefaultStoryName(asset) {
  return String(asset.sourceName || asset.id || '新故事').replace(/\.[^.]+$/, '')
}

async function startNewGameFromAsset(asset, requestedName) {
  const init = asset.programConfig
  assertInitializedProgramConfig(init)
  const story = defaultStory(requestedName || assetDefaultStoryName(asset))
  const player = story.characters.find(character => character.name === '玩家')
  const characterSeeds = Array.isArray(init.cast) && init.cast.length > 0
    ? init.cast
    : Array.isArray(init.characterSeeds) && init.characterSeeds.length > 0
      ? init.characterSeeds
      : asset.characters || []
  story.characters = [
    player,
    ...characterSeeds.filter(character => character?.name !== '玩家').map(character => ({
      ...character,
      id: makeId('character'),
    })),
  ].filter(Boolean)
  story.openingText = String(init.openingText || extractOpeningText(asset.entries || []))
  story.worldview = String(init.worldview || '')
  story.currentSituation = ''
  story.chapterSummary = ''
  story.outline = ''
  story.longRangeOutline = String(init.longRangeOutline || '')
  story.directorStyle = String(init.directorStyle || '')
  story.narratorStyle = String(init.narratorStyle || '')
  story.plotLines = []
  story.feedbackMemory = []
  story.storyAssetId = String(asset.id || '')
  story.programConfigFile = String(asset.programConfigFile || init.programConfigFile || '')
  story.statusSchema = normalizeStatusSchema(init.statusSchema)
  story.statusRoster = normalizeStatusRoster(init.statusRoster, story.characters)
  story.statusState = normalizeStatusState(init.statusState, story.statusRoster, story.characters)
  story.globalContext = ''
  story.messages = []
  story.playerOptions = normalizeInitialPlayerOptions(init.initialPlayerOptions || init.playerOptions)
  story.debug = {}
  appState.stories.push(story)
  appState.currentStoryId = story.id
  state = story
  saveState()
  render()
  els.newGameDialog.close()
}

async function initializeSelectedStoryAsset() {
  const asset = storyLibraryAssets.find(item => item.id === selectedNewGameAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  const provider = currentProvider()
  if (!hasRuntimeApiKey(provider)) {
    alert(`请先配置 ${providerLabel(provider)} API Key。`)
    return
  }

  state.debug = {
    status: 'running',
    pipelineMode: 'initializer',
    note: 'Initializer 只生成世界观、人物介绍、第一轮交互、初始选项和人物状态 schema。',
    progress: [],
    initializer: null,
  }
  renderDebug()
  els.initializeStoryAssetButton.disabled = true
  els.initializeStoryAssetButton.textContent = '初始化中'
  setStoryLibraryStatus(`初始化中：正在等待 ${providerLabel(provider)} 返回结构化故事配置。`, 'running')

  try {
    const payload = await initializeStoryAssetStream(asset, true)
    asset.programConfig = payload
    if (!asset.programConfigFile && asset.id) asset.programConfigFile = `story/${asset.id}/program-config.json`
    state.debug.status = 'done'
    state.debug.initializer = payload
    renderDebug()
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
    setStoryLibraryStatus(`初始化完成：${assetDefaultStoryName(asset)} 已写入 program-config，可以开始新游戏。`, 'done')
  } catch (error) {
    state.debug.status = 'error'
    state.debug.error = error.message
    renderDebug()
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    els.initializeStoryAssetButton.disabled = false
    els.initializeStoryAssetButton.textContent = '初始化选中故事'
  }
}

async function initializeStoryAssetStream(asset, force = true) {
  const response = await fetch('/api/initialize-story-stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetId: asset.id,
      sourceName: asset.sourceName || asset.id,
      entries: asset.entries || [],
      characters: asset.characters || [],
      model: normalizeModel(state.model || config.model),
      apiKey: getLocalApiKey(providerForModel(state.model || config.model)),
      force,
    }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || '故事初始化失败。')
  }
  const payload = await readNdjsonStream(response, event => {
    handlePipelineEvent(event)
    if (event.stage === 'initializer' && event.message) setStoryLibraryStatus(event.message, 'running')
  })
  if (!payload) throw new Error('故事初始化失败：没有收到 program-config。')
  assertInitializedProgramConfig(payload)
  return payload
}

function assertInitializedProgramConfig(config) {
  const missing = []
  if (!config || typeof config !== 'object') missing.push('program-config')
  if (!String(config?.openingText || '').trim()) missing.push('openingText')
  if (!String(config?.worldview || '').trim()) missing.push('worldview')
  if (!Array.isArray(config?.cast) || config.cast.length === 0) missing.push('cast')
  if (!Array.isArray(config?.statusSchema) || config.statusSchema.length === 0) missing.push('statusSchema')
  if (!Array.isArray(config?.statusRoster) || config.statusRoster.length === 0) missing.push('statusRoster')
  if (!config?.statusState || typeof config.statusState !== 'object') missing.push('statusState')
  if (!Array.isArray(config?.initialPlayerOptions) || config.initialPlayerOptions.length !== 3) missing.push('initialPlayerOptions')
  if (missing.length) {
    throw new Error(`故事尚未完成初始化，缺少：${missing.join('、')}。不能开始游戏。`)
  }
}

function normalizeInitialPlayerOptions(options) {
  if (!Array.isArray(options)) return []
  return options.slice(0, 3).map((option, index) => {
    const id = ['A', 'B', 'C'][index]
    if (typeof option === 'string') {
      return { id, label: option, description: '', inputText: option }
    }
    return {
      id: option.id || id,
      label: option.label || option.inputText || `选项 ${id}`,
      description: option.description || '',
      inputText: option.inputText || option.label || option.description || '',
    }
  })
}

function extractOpeningText(entries) {
  const candidates = entries || []
  const preferred = candidates.find(entry => {
    const text = `${entry.title || ''} ${entry.type || ''} ${(entry.tags || []).join(' ')}`
    return /开场|开局|opening|greeting|first/i.test(text)
  }) || candidates[0]
  return String(preferred?.content || '').trim()
}

async function loadDiskSave() {
  try {
    const response = await fetch('/api/save-state')
    const payload = await response.json()
    if (!payload.state) {
      alert('没有找到 save/current-state.json。')
      return
    }
    const normalized = normalizeAppState(payload.state)
    Object.assign(appState, normalized)
    state = getCurrentStory()
    localStorage.setItem(storageKey, JSON.stringify(appState))
    render()
  } catch (error) {
    alert(`读取存档失败：${error.message}`)
  }
}

function renderConnection() {
  const model = normalizeModel(state.model || config.model)
  const provider = providerForModel(model)
  const providerConfig = getProviderConfig(provider)
  const keyState = hasRuntimeApiKey(provider) ? 'key ready' : 'no API key'
  const mode = 'narrator + postprocess'
  els.connectionStatus.textContent = `${providerConfig.baseUrl} · ${modelLabel(model)} · ${providerLabel(provider)} · ${mode} · ${keyState}`
  renderTurnStatus()
}

async function testCurrentProvider() {
  const model = normalizeModel(state.model || config.model)
  const provider = providerForModel(model)
  const startedAt = Date.now()
  els.providerTestButton.disabled = true
  els.providerTestButton.textContent = '测试中'
  els.connectionStatus.textContent = `${providerLabel(provider)} 连通性测试中 · ${modelLabel(model)}`
  try {
    const response = await fetch('/api/provider-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        apiKey: getLocalApiKey(provider),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || '连接测试失败')
    }
    const durationMs = Number(payload.durationMs || Date.now() - startedAt)
    els.connectionStatus.textContent = `${providerLabel(provider)} 可用 · ${modelLabel(model)} · ${durationMs}ms · ${String(payload.reply || '').slice(0, 40)}`
  } catch (error) {
    els.connectionStatus.textContent = `${providerLabel(provider)} 不可用 · ${modelLabel(model)} · ${error.message}`
  } finally {
    els.providerTestButton.disabled = false
    els.providerTestButton.textContent = '测试连接'
  }
}

function openDirectorControl() {
  els.directorLongRangeInput.value = state.longRangeOutline || ''
  els.directorControlDialog.showModal()
}

function saveDirectorControl() {
  state.longRangeOutline = els.directorLongRangeInput.value.trim()
  saveState()
  renderStoryTracking()
  els.directorControlDialog.close()
}

function renderTurnStatus() {
  const completed = completedAssistantTurnCount()
  const generating = Boolean(generationBusy && state.debug?.startedAt)
  const target = generating ? nextAssistantTurnIndex() : completed
  els.turnStatus.textContent = generating
    ? `正在生成第 ${target} 轮`
    : `当前第 ${completed} 轮`
}

function currentProvider() {
  return providerForModel(state.model || config.model)
}

function getProviderConfig(provider) {
  if (config.providers?.[provider]) return config.providers[provider]
  if (provider === 'fireworks') return { baseUrl: 'https://api.fireworks.ai/inference/v1', hasApiKey: false }
  return { baseUrl: config.baseUrl || 'https://api.deepseek.com', hasApiKey: config.hasApiKey }
}

function apiKeyStorageKeyForProvider(provider) {
  if (provider === 'fireworks') return fireworksApiKeyStorageKey
  return deepSeekApiKeyStorageKey
}

function getLocalApiKey(provider = currentProvider()) {
  return localStorage.getItem(apiKeyStorageKeyForProvider(provider)) || ''
}

function hasRuntimeApiKey(provider = currentProvider()) {
  return Boolean(getLocalApiKey(provider) || getProviderConfig(provider).hasApiKey)
}

function renderApiKeyDialog() {
  const provider = currentProvider()
  const model = normalizeModel(state.model || config.model)
  els.apiKeyTitle.textContent = `${providerLabel(provider)} API Key`
  const helpByProvider = {
    fireworks: `当前模型：${modelLabel(model)}。请填写 Fireworks API key，Key 只保存在当前浏览器本地。`,
    deepseek: `当前模型：${modelLabel(model)}。请填写 DeepSeek API key，Key 只保存在当前浏览器本地。`,
  }
  els.apiKeyHelp.textContent = helpByProvider[provider] || helpByProvider.deepseek
  els.apiKeyLabel.textContent = provider === 'fireworks' ? 'Fireworks Key' : 'DeepSeek Key'
  els.apiKeyInput.placeholder = provider === 'fireworks' ? 'FIREWORKS_API_KEY' : 'sk-...'
  els.apiKeyInput.value = getLocalApiKey(provider)
}

function allModules() {
  return enforceSingleEnabledStyles(builtinModules.map(module => ({
    ...module,
    enabled: state.moduleEnabled[module.id] ?? module.enabled,
  })))
}

function renderModules() {
  const modules = allModules()
  if (modules.length === 0) {
    els.moduleList.innerHTML = '<p class="meta">暂无模块</p>'
    return
  }

  const groups = groupModules(modules)
  els.moduleList.innerHTML = groups.map(group => `
    <section class="module-group">
      <div class="module-group-head">
        <h3>${escapeHtml(group.name)}</h3>
        <span>${group.enabledCount}/${group.modules.length}</span>
      </div>
      ${group.modules.map(module => `
    <article class="module-item">
      <div class="rowline">
        <label>
          <input type="checkbox" data-module-toggle="${escapeAttr(module.id)}" ${module.enabled ? 'checked' : ''} />
          <strong>${escapeHtml(module.name || module.id)}</strong>
        </label>
        <span class="tag">${escapeHtml(`单选 · ${moduleLayerLabel(module)}`)}</span>
      </div>
      <p class="meta">${escapeHtml(module.description || module.id)}</p>
      ${module.file ? `<p class="meta">文件：${escapeHtml(module.file)}</p>` : ''}
      <details class="module-content">
        <summary>查看内容</summary>
        <pre>${escapeHtml(module.prompt || '')}</pre>
      </details>
    </article>
      `).join('')}
    </section>
  `).join('')

  els.moduleList.querySelectorAll('[data-module-toggle]').forEach(input => {
    input.addEventListener('change', event => {
      setModuleEnabled(event.target.dataset.moduleToggle, event.target.checked)
    })
  })
}

function groupModules(modules) {
  const order = [
    '导演风格',
    '叙事风格',
  ]
  const buckets = new Map()
  for (const module of modules) {
    const name = moduleLayerGroupName(module)
    if (!buckets.has(name)) buckets.set(name, [])
    buckets.get(name).push(module)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b, 'zh-Hans-CN')
    })
    .map(([name, groupModules]) => ({
      name,
      modules: groupModules.sort((a, b) => moduleSortName(a).localeCompare(moduleSortName(b), 'zh-Hans-CN')),
      enabledCount: groupModules.filter(module => module.enabled).length,
    }))
}

function moduleLayerGroupName(module) {
  return {
    'director': '导演风格',
    'narrator': '叙事风格',
  }[module.layer] || '叙事风格'
}

function moduleLayerLabel(module) {
  return {
    director: 'Director',
    narrator: 'Narrator',
  }[module.layer] || 'Narrator'
}

function moduleStyleExclusiveGroup(module) {
  return module?.layer === 'director' ? 'director-style' : 'narrator-style'
}

function moduleSortName(module) {
  const group = module.group ? `${module.group} / ` : ''
  return `${group}${module.name || module.id}`
}

function enforceSingleEnabledStyles(modules) {
  const enabledGroups = new Set()
  return modules.map(module => {
    if (!module.enabled) return module
    const group = moduleStyleExclusiveGroup(module)
    if (enabledGroups.has(group)) return { ...module, enabled: false }
    enabledGroups.add(group)
    return module
  })
}

function setModuleEnabled(id, enabled) {
  const target = allModules().find(module => module.id === id)
  if (enabled && target) {
    const targetGroup = moduleStyleExclusiveGroup(target)
    for (const module of allModules()) {
      if (module.id === id || moduleStyleExclusiveGroup(module) !== targetGroup) continue
      state.moduleEnabled[module.id] = false
    }
  }
  state.moduleEnabled[id] = enabled
  saveState()
  renderModules()
}

function renderStatusPanel() {
  if (!state.statusRoster?.length) {
    els.statusPanelView.innerHTML = '<p class="meta no-indent">未初始化状态栏</p>'
    return
  }
  els.statusPanelView.innerHTML = `
    <div class="status-card">
      <pre class="status-json">${escapeHtml(JSON.stringify(state.statusState || {}, null, 2))}</pre>
    </div>
    ${state.statusSchema?.length ? `
      <details class="status-schema">
        <summary>查看状态字段</summary>
        <pre>${escapeHtml(state.statusSchema.join('\\n'))}</pre>
      </details>
    ` : ''}
  `
}

function renderStoryTracking() {
  const summary = state.chapterSummary || deriveGlobalContextBlock('summary')
  const currentPlot = state.outline || state.currentSituation || formatDirectorOutline(state.debug?.director)
  const longRangeOutline = state.longRangeOutline || ''
  els.storyTrackingView.innerHTML = `
    ${renderTrackerSection('历史总结', summary || '暂无历史总结。')}
    ${renderTrackerSection('当前剧情', currentPlot || '暂无当前剧情。')}
    ${renderTrackerSection('故事风格', formatStoryStyleForTracker() || '暂无故事风格。')}
    ${renderTrackerSection('当前剧情目标', longRangeOutline || '暂无当前剧情目标。')}
    ${renderFeedbackMemory() ? renderTrackerSection('写作负反馈', renderFeedbackMemory()) : ''}
  `
}

function formatStoryStyleForTracker() {
  return [
    state.directorStyle ? `导演风格：${state.directorStyle}` : '',
    state.narratorStyle ? `叙事风格：${state.narratorStyle}` : '',
  ].filter(Boolean).join('\n')
}

function renderTrackerSection(title, content) {
  return `
    <section class="tracker-section">
      <h3>${escapeHtml(title)}</h3>
      <pre>${escapeHtml(formatTrackerText(content))}</pre>
    </section>
  `
}

function formatTrackerText(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

function deriveGlobalContextBlock(type) {
  const lines = String(state.globalContext || '').split('\n').map(line => line.trim()).filter(Boolean)
  const picked = []
  for (const line of lines) {
    const text = line.replace(/^-\s*/, '')
    if (type === 'outline' && text.includes('[大纲]')) {
      picked.push(text.replace(/^\[(当前剧情|大纲)\]\s*/, ''))
    }
    if (type === 'logic' && text.includes('[逻辑]')) picked.push(text.replace(/^\[逻辑\]\s*/, ''))
    if (type === 'summary' && isLegacySummaryLine(text)) {
      picked.push(text)
    }
  }
  return picked.slice(-8).map(line => `- ${line}`).join('\n')
}

function isLegacySummaryLine(text) {
  if (!text) return false
  if (text.includes('[伏笔') || text.includes('[当前剧情]') || text.includes('[大纲]') || text.includes('[逻辑]')) return false
  return !isStoryMetadataLine(text)
}

function formatDirectorOutline(director) {
  if (!director || typeof director !== 'object') return ''
  const guidance = director.outlineGuidance
  if (!guidance || typeof guidance !== 'object') return ''
  const rows = []
  for (const [key, label] of [['follow', '顺应'], ['avoid', '避免'], ['revise', '修正']]) {
    const values = Array.isArray(guidance[key]) ? guidance[key] : []
    for (const value of values) {
      const text = String(value || '').trim()
      if (text) rows.push(`- ${label}：${text}`)
    }
  }
  return rows.join('\n')
}

function storyEntryTypeLabel(type) {
  return {
    'character-card': '人物卡',
    'character-book': '角色书',
    'world-book': '世界书',
    worldview: '世界观',
    'character-profile': '人物介绍',
    'story-book': '故事书',
    markdown: 'Markdown',
    manual: '手动条目',
    text: '文本',
    json: 'JSON',
  }[type] || type || '故事资料'
}

function renderConversation({ scrollTarget = 'bottom' } = {}) {
  const previousScrollTop = els.conversation.scrollTop
  const wasNearBottom = isConversationNearBottom()
  if (state.messages.length === 0) {
    els.conversation.innerHTML = renderEmptyConversation()
    renderReadingJumpControls()
    return
  }
  els.conversation.innerHTML = state.messages.map((message, index) => `
    <article class="message ${message.role}" data-message-index="${index}" data-message-role="${escapeAttr(message.role)}">
      <small>${message.role === 'user' ? 'PLAYER' : message.role === 'error' ? 'ERROR' : 'AGENT'}</small>
      ${escapeHtml(message.content)}
    </article>
  `).join('')
  applyConversationScroll(scrollTarget, previousScrollTop, wasNearBottom)
  renderReadingJumpControls()
}

function renderReadingJumpControls() {
  const hasMessages = Array.isArray(state.messages) && state.messages.length > 0
  const hasAssistant = hasMessages && state.messages.some(message => message.role === 'assistant')
  els.jumpTurnStartButton.disabled = !hasAssistant
  els.jumpLatestButton.disabled = !hasMessages
}

function applyConversationScroll(scrollTarget, previousScrollTop, wasNearBottom) {
  if (scrollTarget === 'latest-assistant-start') {
    scrollToLatestAssistantStart()
    return
  }
  if (scrollTarget === 'bottom' || (scrollTarget === 'preserve-if-reading' && wasNearBottom)) {
    scrollToConversationBottom()
    return
  }
  els.conversation.scrollTop = Math.min(previousScrollTop, Math.max(0, els.conversation.scrollHeight - els.conversation.clientHeight))
}

function isConversationNearBottom() {
  const distance = els.conversation.scrollHeight - els.conversation.scrollTop - els.conversation.clientHeight
  return distance <= 80
}

function scrollToLatestAssistantStart() {
  const latestAssistant = Array.from(els.conversation.querySelectorAll('.message.assistant')).at(-1)
  if (!latestAssistant) {
    scrollToConversationBottom()
    return
  }
  const conversationRect = els.conversation.getBoundingClientRect()
  const assistantRect = latestAssistant.getBoundingClientRect()
  const targetTop = els.conversation.scrollTop + assistantRect.top - conversationRect.top - 10
  els.conversation.scrollTop = Math.max(0, targetTop)
}

function scrollToConversationBottom() {
  els.conversation.scrollTop = els.conversation.scrollHeight
}

function renderEmptyConversation() {
  const opening = state.openingText || ''
  return `
    <div class="empty-state">
      <strong>${escapeHtml(state.name || '未选择故事')}</strong>
      <span>${opening ? '开场白已加载，输入第一句玩家行动开始。' : '请先点“开始新游戏”，选择或导入故事资料。'}</span>
      ${opening ? `<pre>${escapeHtml(opening)}</pre>` : ''}
    </div>
  `
}

function renderOptions() {
  const options = normalizeInitialPlayerOptions(state.playerOptions || [])
  if (options.length === 0) {
    els.optionTray.innerHTML = ''
    return
  }
  els.optionTray.innerHTML = options.map(option => `
    <button class="option-button" type="button" data-option-input="${escapeAttr(option.inputText || option.label || '')}">
      <strong>${escapeHtml(option.label || option.id || '选项')}</strong>
      <span>${escapeHtml(option.description || option.inputText || '')}</span>
    </button>
  `).join('')

  els.optionTray.querySelectorAll('[data-option-input]').forEach(button => {
    button.addEventListener('click', event => {
      els.playerInput.value = event.currentTarget.dataset.optionInput
      els.playerInput.focus()
    })
  })
}

function renderRegenerateButton() {
  const hasSnapshot = Boolean(getRegenerationSnapshot())
  const pending = Boolean(getPendingPostprocess())
  els.regenerateButton.disabled = generationBusy || pending || !hasSnapshot
  els.regenerateButton.title = pending
    ? '先继续未完成阶段，避免丢失上一轮状态。'
    : hasSnapshot
    ? '删除上次 AI 回复，恢复本轮前状态，并用当前模型重新生成'
    : '发送一轮后才能重新生成'
}

function renderRetryStageButton() {
  const pending = getPendingPostprocess()
  const canContinueGeneration = state.debug?.status === 'error' && Boolean(getRegenerationSnapshot())
  els.retryStageButton.disabled = generationBusy || (!pending && !canContinueGeneration)
  els.retryStageButton.title = pending
    ? '上一轮正文已生成，但 Postprocess 未完成。点击只重试后处理。'
    : canContinueGeneration
      ? '按当前状态重新执行未完成流程。'
      : '没有未完成阶段。'
}

function nextAssistantTurnIndex() {
  return completedAssistantTurnCount() + 1
}

function completedAssistantTurnCount() {
  return state.messages.filter(message => message.role === 'assistant').length
}

async function submitTurn() {
  const playerInput = els.playerInput.value.trim()
  if (!playerInput) return

  const snapshot = createTurnSnapshot(playerInput)
  await generateTurn(playerInput, { snapshot, modeLabel: 'running' })
}

async function regenerateLastTurn() {
  const snapshot = getRegenerationSnapshot()
  if (!snapshot) {
    alert('没有可重新生成的上一轮。')
    return
  }
  if (!snapshot.playerInput) {
    alert('上一轮玩家输入为空，不能重新生成。')
    return
  }
  restoreTurnSnapshot(snapshot)
  await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'regenerating' })
}

async function continueUnfinishedTurn() {
  const pending = getPendingPostprocess()
  if (pending) {
    await retryPendingPostprocess(pending)
    return
  }
  const snapshot = getRegenerationSnapshot()
  if (state.debug?.status === 'error' && snapshot?.playerInput) {
    restoreTurnSnapshot(snapshot)
    await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'continuing' })
    return
  }
  alert('没有可继续的未完成阶段。')
}

function getPendingPostprocess() {
  const pending = state.debug?.pendingPostprocess
  if (!state.debug?.postprocessPending) return null
  if (!pending || typeof pending !== 'object') return buildPendingPostprocessFromState()
  if (!String(pending.finalText || '').trim()) return null
  return pending
}

function buildPendingPostprocessFromState() {
  const messages = Array.isArray(state.messages) ? state.messages : []
  let assistantIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') {
      assistantIndex = index
      break
    }
  }
  if (assistantIndex < 0) return null
  let userIndex = -1
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      userIndex = index
      break
    }
  }
  const playerInput = String(messages[userIndex]?.content || '').trim()
  const finalText = String(messages[assistantIndex]?.content || '').trim()
  if (!playerInput || !finalText) return null
  return {
    playerInput,
    finalText,
    director: state.debug?.director || {},
    recentTurns: messages
      .slice(Math.max(0, assistantIndex - 12), assistantIndex)
      .filter(message => message.role === 'user' || message.role === 'assistant'),
    characters: state.characters,
    userModules: allModules().filter(module => module.enabled),
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    longRangeOutline: state.longRangeOutline,
    feedbackText: renderFeedbackMemory(),
    feedbackMemory: state.feedbackMemory,
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: completedAssistantTurnCount(),
    model: normalizeModel(state.model || config.model),
    temperature: Number(els.temperatureInput.value || 0.8),
    createdAt: new Date().toISOString(),
  }
}

async function retryPendingPostprocess(pending) {
  setBusy(true)
  state.debug.status = '重试 Postprocess'
  state.debug.error = ''
  state.debug.note = '正在重试上一轮未完成的 Postprocess；完成后会补上状态、总结和候选项。'
  state.runtimeStats = buildClientRuntimeStats()
  render()

  try {
    const response = await fetch('/api/postprocess-stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...pending,
        apiKey: getLocalApiKey(),
        model: normalizeModel(state.model || config.model),
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Postprocess 重试失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('Postprocess 重试失败：没有收到最终结果。')

    removeTrailingErrorMessages()
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : []
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingPostprocess = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
    state.debug.postprocess = payload.postprocess
    state.runtimeStats = payload.metrics || buildClientRuntimeStats(payload)
    state.model = normalizeModel(payload.model || state.model)
    applyPostprocess(payload)
    persistPostprocessResult()
    await prepareEvaluationMaterialFromState()
    persistPostprocessResult()
  } catch (error) {
    state.debug.status = 'error'
    state.debug.postprocessPending = true
    state.debug.error = error.message
    state.debug.note = 'Postprocess 仍未完成。可再次点击“继续未完成”。'
    persistAndRender()
  } finally {
    setBusy(false)
  }
}

function buildEvaluationPayloadFromState() {
  const base = buildPendingPostprocessFromState()
  if (!base) return null
  return {
    ...base,
    storyId: state.id,
    storyName: state.name,
    narrator: state.debug?.narrator || {},
    postprocess: state.debug?.postprocess || {},
    storyContext: buildStoryContextForRequest(),
    globalContext: state.globalContext,
    feedbackText: renderFeedbackMemory(),
    feedbackMemory: state.feedbackMemory,
    playerOptions: state.playerOptions,
  }
}

async function prepareEvaluationMaterialFromState() {
  const payload = buildEvaluationPayloadFromState()
  if (!payload) return null
  try {
    const response = await fetch('/api/evaluation-material', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        model: normalizeModel(state.model || config.model),
      }),
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      throw new Error(errorPayload.error || '评估材料写入失败')
    }
    const result = await response.json()
    state.debug = state.debug || {}
    state.debug.evaluationRun = {
      ...(state.debug.evaluationRun || {}),
      status: 'material-ready',
      updatedAt: new Date().toISOString(),
    }
    state.debug.evaluationMaterialFile = String(result.evaluationMaterialFile || '')
    state.debug.latestEvaluationMaterialFile = String(result.latestEvaluationMaterialFile || '')
    state.debug.evaluatorPrompt = String(result.evaluatorPrompt || '')
    return result
  } catch (error) {
    state.debug = state.debug || {}
    state.debug.evaluationRun = {
      ...(state.debug.evaluationRun || {}),
      status: 'error',
      error: error.message,
    }
    return null
  }
}

async function evaluateLatestTurn() {
  const pendingPostprocess = getPendingPostprocess()
  if (pendingPostprocess) {
    alert('上一轮 Postprocess 还没完成。先点“继续未完成”，再评估。')
    return
  }
  const payload = buildEvaluationPayloadFromState()
  if (!payload) {
    alert('没有可评估的上一轮正文。')
    return
  }
  evaluationBusy = true
  state.debug = state.debug || {}
  state.debug.evaluationRun = {
    status: 'running',
    progress: [],
    startedAt: new Date().toISOString(),
  }
  state.debug.evaluationReport = null
  state.debug.evaluatorPrompt = ''
  state.debug.evaluationMetrics = null
  renderEvaluation()

  try {
    const response = await fetch('/api/evaluate-stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        apiKey: getLocalApiKey(),
        model: normalizeModel(state.model || config.model),
        evaluationTarget: normalizeEvaluationTarget(state.evaluationTarget),
      }),
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      throw new Error(errorPayload.error || '评估失败')
    }
    const result = await readNdjsonStream(response, handleEvaluationEvent)
    if (!result) throw new Error('评估失败：没有收到最终报告。')

    state.debug.evaluationRun.status = 'done'
    if (result.pipelineMode === 'codex-evaluation-request') {
      state.debug.evaluationRun.status = 'prepared'
    }
    state.debug.evaluationReport = result.evaluation
    state.debug.evaluatorPrompt = String(result.evaluatorPrompt || '')
    state.debug.evaluationMetrics = result.metrics || null
    state.debug.evaluationMaterialFile = String(result.evaluationMaterialFile || state.debug.evaluationMaterialFile || '')
    state.debug.latestEvaluationMaterialFile = String(result.latestEvaluationMaterialFile || state.debug.latestEvaluationMaterialFile || '')
    state.debug.evaluationFile = String(result.evaluationFile || '')
    state.debug.latestEvaluationFile = String(result.latestEvaluationFile || '')
    state.debug.evaluator = result.evaluation
    state.model = normalizeModel(result.model || state.model)
    saveState()
    renderEvaluation()
    renderDebug()
  } catch (error) {
    state.debug.evaluationRun = state.debug.evaluationRun || {}
    state.debug.evaluationRun.status = 'error'
    state.debug.evaluationRun.error = error.message
    saveState()
    renderEvaluation()
  } finally {
    evaluationBusy = false
    renderEvaluation()
  }
}

function handleEvaluationEvent(event) {
  const stage = event.stage
  if (!stage) return
  state.debug = state.debug || {}
  const run = state.debug.evaluationRun && typeof state.debug.evaluationRun === 'object'
    ? state.debug.evaluationRun
    : { status: 'running', progress: [] }
  const progress = Array.isArray(run.progress) ? run.progress : []
  let row = progress.find(item => item.stage === stage)
  if (!row) {
    row = { stage, label: event.label || stage, status: 'pending', logs: [] }
    progress.push(row)
  }
  row.label = event.label || row.label
  if (event.type === 'stage_start') {
    row.status = 'running'
    row.message = event.message || row.message || ''
  }
  if (event.type === 'stage_tick') {
    row.status = 'running'
    row.logs = Array.isArray(row.logs) ? row.logs : []
    if (event.message) row.logs.push(event.message)
    row.message = event.message || row.message || ''
  }
  if (event.type === 'stage_result') {
    row.status = 'done'
    row.message = event.message || row.message || ''
    run.report = event.json
  }
  row.updatedAt = event.at || new Date().toISOString()
  run.progress = progress
  state.debug.evaluationRun = run
  renderEvaluation()
}

async function generateTurn(playerInput, { snapshot, modeLabel = 'running' } = {}) {
  setBusy(true)
  const startedAt = Date.now()
  if (snapshot) state.lastTurnSnapshot = snapshot
  state.messages.push({ role: 'user', content: playerInput })
  state.playerOptions = []
  state.debug = {
    status: modeLabel,
    startedAt,
    pipelineMode: 'narrator+postprocess',
    note: modeLabel === 'regenerating'
      ? '正在回滚并重新生成本次对话；会使用当前模型和配置完整重跑。'
      : modeLabel === 'continuing'
        ? '继续未完成：按当前状态重新执行未完成流程。'
        : 'Narrator 正文会直接显示；Postprocess 继续后台更新状态，完成前不能发送下一轮。',
    visibleTextShown: false,
    postprocessPending: false,
    progress: [],
    director: null,
    narrator: null,
    postprocess: null,
    pendingPostprocess: null,
    postprocessRecoveryBase: null,
  }
  state.runtimeStats = buildClientRuntimeStats()
  els.playerInput.value = ''
  render()

  try {
    const requestPayload = buildGenerateRequestPayload(playerInput)
    state.debug.postprocessRecoveryBase = sanitizePostprocessRecoveryBase(requestPayload)
    const response = await fetch('/api/generate-stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || '生成失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('生成失败：没有收到最终结果。')

    if (state.debug.visibleTextShown) {
      const last = state.messages[state.messages.length - 1]
      if (last?.role === 'assistant' && payload.finalText) last.content = payload.finalText
    } else {
      state.messages.push({ role: 'assistant', content: payload.finalText || '' })
    }
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : []
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingPostprocess = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode
    state.debug.director = payload.director
    state.debug.narrator = payload.narrator
    state.debug.postprocess = payload.postprocess
    state.runtimeStats = payload.metrics || buildClientRuntimeStats(payload)
    state.model = normalizeModel(payload.model || state.model)
    applyPostprocess(payload)
    persistPostprocessResult()
    await prepareEvaluationMaterialFromState()
    persistPostprocessResult()
  } catch (error) {
    state.debug.status = 'error'
    state.debug.error = error.message
    markRunningPipelineStageError(error.message)
    if (state.debug.visibleTextShown && state.debug.postprocessPending) {
      state.debug.note = '正文已显示，但 Postprocess 未完成。点击“继续未完成”补上状态、总结和候选项。'
    } else {
      state.messages.push({ role: 'error', content: error.message })
    }
    persistAndRender()
  } finally {
    setBusy(false)
  }
}

function buildGenerateRequestPayload(playerInput) {
  return {
    playerInput,
    storyContext: buildStoryContextForRequest(),
    globalContext: state.globalContext,
    feedbackText: renderFeedbackMemory(),
    feedbackMemory: state.feedbackMemory,
    longRangeOutline: state.longRangeOutline,
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: nextAssistantTurnIndex(),
    recentTurns: buildRecentTurnsForRequest(playerInput),
    characters: state.characters,
    userModules: allModules().filter(module => module.enabled),
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    model: normalizeModel(state.model || config.model),
    apiKey: getLocalApiKey(),
    temperature: Number(els.temperatureInput.value || 0.8),
  }
}

function buildRecentTurnsForRequest(playerInput) {
  const turns = Array.isArray(state.messages) ? state.messages : []
  const last = turns[turns.length - 1]
  const inputText = String(playerInput || '').trim()
  const withoutPendingUser = last?.role === 'user' && String(last.content || '').trim() === inputText
    ? turns.slice(0, -1)
    : turns
  return withoutPendingUser.slice(-6)
}

function createTurnSnapshot(playerInput) {
  return {
    playerInput,
    storyState: pickRegenerableStoryState(state),
    createdAt: new Date().toISOString(),
  }
}

function normalizeTurnSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  const playerInput = String(value.playerInput || '').trim()
  const storyState = value.storyState && typeof value.storyState === 'object' ? value.storyState : null
  if (!playerInput || !storyState) return null
  return {
    playerInput,
    storyState: deepClone(storyState),
    createdAt: String(value.createdAt || ''),
  }
}

function getRegenerationSnapshot() {
  return normalizeTurnSnapshot(state.lastTurnSnapshot) || inferRegenerationSnapshotFromMessages()
}

function inferRegenerationSnapshotFromMessages() {
  const messages = Array.isArray(state.messages) ? state.messages : []
  let userIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      userIndex = index
      break
    }
  }
  if (userIndex < 0) return null
  const playerInput = String(messages[userIndex]?.content || '').trim()
  if (!playerInput) return null
  const storyState = pickRegenerableStoryState(state)
  storyState.messages = messages.slice(0, userIndex)
  storyState.playerOptions = []
  storyState.runtimeStats = null
  storyState.debug = {}
  return {
    playerInput,
    storyState,
    createdAt: '',
  }
}

function restoreTurnSnapshot(snapshot) {
  Object.assign(state, deepClone(snapshot.storyState))
  state.lastTurnSnapshot = snapshot
  state.model = normalizeModel(state.model || config.model)
}

function sanitizePostprocessRecoveryBase(payload) {
  const { apiKey, ...safePayload } = payload
  return deepClone(safePayload)
}

function pickRegenerableStoryState(story) {
  const fields = [
    'messages',
    'characters',
    'openingText',
    'worldview',
    'currentSituation',
    'chapterSummary',
    'outline',
    'longRangeOutline',
    'directorStyle',
    'narratorStyle',
    'plotLines',
    'feedbackMemory',
    'storyAssetId',
    'programConfigFile',
    'statusSchema',
    'statusRoster',
    'statusState',
    'globalContext',
    'playerOptions',
    'evaluationTarget',
    'runtimeStats',
    'debug',
  ]
  const snapshot = {}
  for (const field of fields) snapshot[field] = deepClone(story[field])
  return snapshot
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

async function readNdjsonStream(response, onEvent) {
  const reader = response.body?.getReader()
  if (!reader) return response.json()

  const decoder = new TextDecoder()
  let buffer = ''
  let finalPayload = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === 'error') throw new Error(event.error || '生成失败')
      if (event.type === 'final') finalPayload = event.payload
      else onEvent(event)
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer)
    if (event.type === 'error') throw new Error(event.error || '生成失败')
    if (event.type === 'final') finalPayload = event.payload
    else onEvent(event)
  }

  return finalPayload
}

function handlePipelineEvent(event) {
  if (event.type === 'visible_text') {
    applyVisibleTextEvent(event)
    return
  }

  const stage = event.stage
  if (!stage) return
  const eventMs = Date.parse(event.at || '') || Date.now()
  if (!state.debug.firstEventAtMs) state.debug.firstEventAtMs = eventMs
  const progress = Array.isArray(state.debug.progress) ? state.debug.progress : []
  let row = progress.find(item => item.stage === stage)
  if (!row) {
    row = { stage, label: event.label || stage, status: 'pending' }
    progress.push(row)
  }
  row.label = event.label || row.label
  if (event.type === 'stage_tick') {
    row.logs = Array.isArray(row.logs) ? row.logs : []
    if (event.message) row.logs.push(event.message)
    const outputTokens = parseOutputTokens(event.message)
    if (outputTokens) row.outputTokens = outputTokens
  } else {
    row.message = event.message || row.message || ''
  }
  row.updatedAt = event.at || new Date().toISOString()
  row.updatedAtMs = eventMs

  if (event.type === 'stage_start') {
    row.status = 'running'
    row.startedAtMs = row.startedAtMs || eventMs
  }
  if (event.type === 'stage_tick') row.status = 'running'
  if (event.type === 'stage_skip') {
    row.status = 'skipped'
    row.endedAtMs = eventMs
  }
  if (event.type === 'stage_result') {
    row.status = 'done'
    row.endedAtMs = eventMs
    state.debug[stage] = event.json
  }

  state.debug.progress = progress
  updateRuntimeStatsFromPipeline()
  renderDebug()
}

function markRunningPipelineStageError(message) {
  const progress = Array.isArray(state.debug?.progress) ? state.debug.progress : []
  const row = [...progress].reverse().find(item => item.status === 'running')
  if (!row) return

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  row.status = 'error'
  row.message = message || row.message || '阶段失败'
  row.updatedAt = nowIso
  row.updatedAtMs = now
  row.endedAtMs = now
  state.debug.progress = progress
  updateRuntimeStatsFromPipeline()
}

function applyVisibleTextEvent(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  const finalText = String(payload.finalText || event.finalText || '').trim()
  if (!finalText) return

  if (state.debug.visibleTextShown) {
    const last = state.messages[state.messages.length - 1]
    if (last?.role === 'assistant') last.content = finalText
  } else {
    state.messages.push({ role: 'assistant', content: finalText })
  }

  state.debug.visibleTextShown = true
  state.debug.postprocessPending = true
  state.debug.pendingPostprocess = {
    ...(state.debug.postprocessRecoveryBase || {}),
    finalText,
    director: state.debug.director || {},
    createdAt: new Date().toISOString(),
  }
  state.debug.status = '状态更新中'
  state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
  state.debug.note = '正文已显示；Postprocess 正在后台更新状态，完成前不能发送下一轮。'

  updateRuntimeStatsFromPipeline()
  renderConversation({ scrollTarget: 'latest-assistant-start' })
  renderOptions()
  renderReadingJumpControls()
  renderDebug()
  renderRetryStageButton()
  renderRegenerateButton()
  els.sendButton.textContent = '状态更新中'
  els.regenerateButton.textContent = '状态更新中'
}

function applyPostprocess(payload) {
  const contextLines = []
  if (payload.turnSummary) contextLines.push(payload.turnSummary)
  if (contextLines.length) {
    state.globalContext = `${state.globalContext || ''}\n${contextLines.map(line => `- ${line}`).join('\n')}`.trim()
  }
  if (payload.turnSummary) {
    state.chapterSummary = appendBulletText(state.chapterSummary, payload.turnSummary)
    state.currentSituation = String(payload.turnSummary).trim()
    state.outline = String(payload.turnSummary).trim()
  }
  if (typeof payload.longRangeOutline === 'string' && payload.longRangeOutline.trim()) {
    state.longRangeOutline = payload.longRangeOutline.trim()
  }
  state.feedbackMemory = mergeFeedbackMemory(state.feedbackMemory, payload)
  const statusPatch = payload.postprocess && typeof payload.postprocess === 'object' ? payload.postprocess : payload
  if (Array.isArray(payload.statusSchema)) {
    state.statusSchema = normalizeStatusSchema(payload.statusSchema)
  } else {
    state.statusSchema = mergeStatusSchema(state.statusSchema, statusPatch.statusSchemaPatch)
  }
  if (Array.isArray(payload.statusRoster)) {
    state.statusRoster = normalizeStatusRoster(payload.statusRoster, state.characters)
  } else {
    state.statusRoster = mergeStatusRoster(state.statusRoster, statusPatch.statusRosterPatch, state.characters, statusPatch.statusStatePatch)
  }
  state.statusRoster = mergeStatusRoster(state.statusRoster, statusPatch.statusRosterPatch, state.characters, statusPatch.statusStatePatch)
  if (payload.statusState && typeof payload.statusState === 'object') {
    state.statusState = normalizeStatusState(payload.statusState, state.statusRoster, state.characters)
  } else {
    state.statusState = mergeStatusState(state.statusState, statusPatch.statusStatePatch, state.statusRoster, state.characters)
  }
  state.statusState = mergeStatusState(state.statusState, statusPatch.statusStatePatch, state.statusRoster, state.characters)
}

function appendBulletText(existing, next, limit = Number.POSITIVE_INFINITY) {
  const text = String(next || '').trim()
  if (!text) return String(existing || '')
  const lines = String(existing || '')
    .split('\n')
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
  if (lines[lines.length - 1] !== text) lines.push(text)
  const kept = Number.isFinite(limit) ? lines.slice(-limit) : lines
  return kept.map(line => `- ${line}`).join('\n')
}

function removeTrailingErrorMessages() {
  while (state.messages[state.messages.length - 1]?.role === 'error') {
    state.messages.pop()
  }
}

function setBusy(isBusy) {
  generationBusy = isBusy
  const postprocessPending = Boolean(getPendingPostprocess())
  const canContinueGeneration = state.debug?.status === 'error' && Boolean(getRegenerationSnapshot())
  els.sendButton.disabled = isBusy || postprocessPending
  els.retryStageButton.disabled = isBusy || (!postprocessPending && !canContinueGeneration)
  els.regenerateButton.disabled = isBusy || postprocessPending || !getRegenerationSnapshot()
  els.sendButton.textContent = isBusy
    ? (postprocessPending ? '状态更新中' : '生成中')
    : postprocessPending ? '等待状态更新' : '发送'
  els.retryStageButton.textContent = isBusy && postprocessPending ? '继续中' : '继续未完成'
  els.regenerateButton.textContent = isBusy
    ? (postprocessPending ? '状态更新中' : '生成中')
    : '重新生成本次对话'
  if (els.evaluateTurnButton) {
    const canEvaluate = Boolean(buildEvaluationPayloadFromState()) && !isBusy && !postprocessPending
    els.evaluateTurnButton.disabled = evaluationBusy || !canEvaluate
    els.evaluateTurnButton.textContent = evaluationBusy ? '评估中' : '评估上一轮'
  }
  renderTurnStatus()
}

async function importStoryFile(file) {
  let imported
  let originalBase64 = ''
  let originalText

  if (/\.png$/i.test(file.name)) {
    const arrayBuffer = await file.arrayBuffer()
    originalBase64 = arrayBufferToBase64(arrayBuffer)
    const card = await parsePngCharacterCard(arrayBuffer)
    imported = card
      ? convertCharacterCardFile(file.name, card)
      : { entries: [plainStoryEntry(file.name.replace(/\.[^.]+$/, ''), '未能从 PNG 人物卡中读取 chara 元数据。')], characters: [] }
  } else {
    originalText = await file.text()
    imported = parseStorybookFile(file.name, originalText)
  }

  await persistStoryAsset(file.name, imported, { originalBase64, originalText })
  return imported
}

async function persistStoryAsset(sourceName, imported, original) {
  try {
    const response = await fetch('/api/story-assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceName,
        originalBase64: original.originalBase64 || undefined,
        originalText: original.originalText,
        entries: imported.entries || [],
        characters: imported.characters || [],
        apiKey: getLocalApiKey(),
      }),
    })
    const payload = await response.json()
    if (response.ok && payload.files) {
      for (const entry of imported.entries || []) {
        entry.sourceFiles = payload.files
      }
      if (payload.programConfig) imported.programConfig = payload.programConfig
    }
  } catch {
    // The imported content still remains in the current browser session.
  }
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function parseStorybookFile(filename, text) {
  const cleanName = filename.replace(/\.[^.]+$/, '')
  if (/\.json$/i.test(filename)) {
    try {
      const parsed = JSON.parse(text)
      if (isCharacterCard(parsed)) return convertCharacterCardFile(cleanName, parsed)
      const normalized = normalizeJsonStoryEntries(parsed, filename)
      if (normalized.entries.length > 0) {
        return {
          entries: normalized.entries.map((entry, index) => storyEntryFromRaw(cleanName, entry, index, normalized.type)),
          characters: [],
        }
      }
    } catch {
      return { entries: [plainStoryEntry(cleanName, text)], characters: [] }
    }
  }

  const sections = splitMarkdownSections(text)
  return {
    entries: sections.length > 0
      ? sections.map((section, index) => ({
      id: makeId(`story.${slug(cleanName)}.${index + 1}`),
      title: section.title,
      type: 'markdown',
      tags: [cleanName],
      content: section.content,
      enabled: true,
    }))
      : [plainStoryEntry(cleanName, text)],
    characters: [],
  }
}

async function parsePngCharacterCard(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((value, index) => bytes[index] === value)) return null

  const decoder = new TextDecoder('latin1')
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset)
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > bytes.length) return null
    const data = bytes.slice(dataStart, dataEnd)

    if (type === 'tEXt') {
      const zero = data.indexOf(0)
      if (zero > 0) {
        const keyword = decoder.decode(data.slice(0, zero))
        const value = decoder.decode(data.slice(zero + 1))
        if (keyword === 'chara') return decodeCharacterCardPayload(value)
      }
    }

    if (type === 'iTXt') {
      const text = new TextDecoder().decode(data)
      if (text.startsWith('chara')) {
        const value = text.split('\u0000').filter(Boolean).pop()
        if (value) return decodeCharacterCardPayload(value)
      }
    }

    offset = dataEnd + 4
  }
  return null
}

function decodeCharacterCardPayload(value) {
  const trimmed = value.trim()
  const candidates = [
    trimmed,
    decodeBase64Utf8(trimmed),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // try next candidate
    }
  }
  return null
}

function decodeBase64Utf8(value) {
  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function isCharacterCard(raw) {
  const card = raw?.data || raw
  return Boolean(card && typeof card === 'object' && (
    raw.spec === 'chara_card_v2' ||
    card.name && (card.description || card.personality || card.scenario || card.first_mes || card.mes_example || card.char_persona)
  ))
}

function normalizeCharacterCard(raw) {
  const data = raw?.data || raw || {}
  return {
    name: String(data.name || data.char_name || '未命名角色'),
    description: String(data.description || data.char_persona || ''),
    personality: String(data.personality || ''),
    scenario: String(data.scenario || data.world_scenario || ''),
    firstMes: String(data.first_mes || data.char_greeting || ''),
    mesExample: String(data.mes_example || data.example_dialogue || ''),
    systemPrompt: String(data.system_prompt || ''),
    postHistoryInstructions: String(data.post_history_instructions || ''),
    creatorNotes: String(data.creator_notes || data.creator_notes_multilingual || ''),
    alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.map(String) : [],
    characterBook: data.character_book || data.characterBook || null,
  }
}

function convertCharacterCardFile(sourceName, rawCard) {
  const card = normalizeCharacterCard(rawCard)
  const base = slug(card.name)
  const entries = []

  entries.push({
    id: makeId(`character-card.${base}.profile`),
    title: `${card.name}｜角色设定`,
    type: 'character-card',
    tags: ['character', card.name],
    content: [
      `姓名：${card.name}`,
      card.description ? `\n【描述】\n${card.description}` : '',
      card.personality ? `\n【性格】\n${card.personality}` : '',
      card.scenario ? `\n【情景】\n${card.scenario}` : '',
      card.systemPrompt ? `\n【系统提示】\n${card.systemPrompt}` : '',
      card.postHistoryInstructions ? `\n【后历史指令】\n${card.postHistoryInstructions}` : '',
      card.creatorNotes ? `\n【作者备注】\n${card.creatorNotes}` : '',
    ].filter(Boolean).join('\n'),
    enabled: true,
  })

  if (card.firstMes || card.alternateGreetings.length > 0) {
    entries.push({
      id: makeId(`character-card.${base}.greetings`),
      title: `${card.name}｜开场白`,
      type: 'character-card',
      tags: ['greeting', card.name],
      content: [
        card.firstMes ? `【默认开场】\n${card.firstMes}` : '',
        ...card.alternateGreetings.map((item, index) => `【备选开场 ${index + 1}】\n${item}`),
      ].filter(Boolean).join('\n\n'),
      enabled: true,
    })
  }

  if (card.mesExample) {
    entries.push({
      id: makeId(`character-card.${base}.examples`),
      title: `${card.name}｜对话范例`,
      type: 'character-card',
      tags: ['dialogue', card.name],
      content: card.mesExample,
      enabled: true,
    })
  }

  for (const [index, bookEntry] of normalizeCharacterBookEntries(card.characterBook).entries()) {
    entries.push(storyEntryFromRaw(`${card.name}-角色书`, {
      ...bookEntry,
      comment: bookEntry.comment || bookEntry.name || `${card.name}｜角色书 ${index + 1}`,
      key: bookEntry.keys || bookEntry.key,
    }, index, 'character-book'))
  }

  return {
    entries,
    characters: [{
      id: makeId(`character.${base}`),
      name: card.name,
      role: 'NPC',
      mood: '',
      location: '',
      health: '正常',
      trust: '',
      notes: [
        `来源：${sourceName}`,
        card.personality ? `性格：${card.personality}` : '',
        card.scenario ? `情景：${card.scenario}` : '',
      ].filter(Boolean).join('\n'),
    }],
  }
}

function normalizeCharacterBookEntries(characterBook) {
  if (!characterBook) return []
  if (Array.isArray(characterBook.entries)) return characterBook.entries
  if (characterBook.entries && typeof characterBook.entries === 'object') return Object.values(characterBook.entries)
  if (Array.isArray(characterBook)) return characterBook
  return []
}

function upsertCharacter(character) {
  const existing = state.characters.find(item => item.name === character.name)
  if (!existing) {
    state.characters.push(character)
    return
  }
  existing.role = existing.role || character.role
  existing.mood = existing.mood || character.mood
  existing.location = existing.location || character.location
  existing.health = existing.health || character.health
  existing.trust = existing.trust || character.trust
  existing.notes = [existing.notes, character.notes].filter(Boolean).join('\n')
}

function normalizeJsonStoryEntries(parsed, filename = '') {
  if (!parsed || typeof parsed !== 'object') {
    return { entries: [{ content: parsed }], type: 'story-book' }
  }
  if (parsed.world_info?.entries) {
    return { entries: valuesOfEntries(parsed.world_info.entries), type: 'world-book' }
  }
  if (Array.isArray(parsed)) {
    return { entries: parsed, type: detectEntryCollectionType(parsed, filename) }
  }
  if (Array.isArray(parsed.entries) || parsed.entries && typeof parsed.entries === 'object') {
    const entries = valuesOfEntries(parsed.entries)
    return { entries, type: detectEntryCollectionType(entries, filename) }
  }
  if (parsed.world || parsed.lore || parsed.setting || /世界|world|lore/i.test(filename)) {
    return { entries: [parsed], type: 'world-book' }
  }
  return { entries: [parsed], type: 'story-book' }
}

function valuesOfEntries(entries) {
  if (Array.isArray(entries)) return entries
  if (entries && typeof entries === 'object') return Object.values(entries)
  return []
}

function detectEntryCollectionType(entries, filename) {
  if (/世界|world|lore/i.test(filename)) return 'world-book'
  const sample = entries.find(entry => entry && typeof entry === 'object') || {}
  const worldInfoKeys = ['key', 'keys', 'keysecondary', 'secondary_keys', 'constant', 'selective', 'position', 'order']
  return worldInfoKeys.some(key => key in sample) ? 'world-book' : 'story-book'
}

function storyEntryFromRaw(sourceName, raw, index, fallbackType = 'story-book') {
  const row = raw && typeof raw === 'object' ? raw : { content: raw }
  const title = row.comment || row.name || row.title || row.key || `${sourceName}-${index + 1}`
  const primaryKeys = Array.isArray(row.keys)
    ? row.keys
    : Array.isArray(row.key)
      ? row.key
      : typeof row.key === 'string'
        ? [row.key]
        : []
  const secondaryKeys = Array.isArray(row.keysecondary)
    ? row.keysecondary
    : Array.isArray(row.secondary_keys)
      ? row.secondary_keys
      : typeof row.keysecondary === 'string'
        ? [row.keysecondary]
        : []
  return {
    id: makeId(`story.${slug(sourceName)}.${index + 1}`),
    title: String(title),
    type: row.type || fallbackType,
    tags: [...primaryKeys, ...secondaryKeys].map(String).filter(Boolean),
    content: String(row.content || row.text || row.prompt || JSON.stringify(row, null, 2)),
    enabled: row.disable !== true,
  }
}

function splitMarkdownSections(text) {
  const lines = text.split(/\r?\n/)
  const sections = []
  let current = null
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/)
    if (match) {
      if (current && current.content.trim()) sections.push(current)
      current = { title: match[1].trim(), content: '' }
    } else if (current) {
      current.content += `${line}\n`
    }
  }
  if (current && current.content.trim()) sections.push(current)
  return sections
}

function plainStoryEntry(title, text) {
  return {
    id: makeId(`story.${slug(title)}`),
    title,
    type: 'text',
    tags: [title],
    content: text,
    enabled: true,
  }
}

function splitTags(value) {
  return value.split(/[,，\s]+/).map(tag => tag.trim()).filter(Boolean)
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'entry'
}

function persistAndRender() {
  saveState()
  render()
}

function persistPostprocessResult() {
  saveState()
  renderPostprocessSideEffects()
}

function renderPostprocessSideEffects() {
  renderStatusPanel()
  renderStoryTracking()
  renderOptions()
  renderRetryStageButton()
  renderRegenerateButton()
  renderStats()
  renderDebug()
  renderEvaluation()
  renderTurnStatus()
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]))
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;')
}
