const storageKey = 'text-game-agent.web-state.v2'
const legacyStorageKey = 'text-game-agent.web-state.v1'
const deepSeekApiKeyStorageKey = 'text-game-agent.deepseek-api-key'
const fireworksApiKeyStorageKey = 'text-game-agent.fireworks-api-key'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const defaultModel = officialDeepSeekV4FlashModel
const modelOptions = new Set([fireworksDeepSeekV4ProPriorityModel, officialDeepSeekV4ProModel, officialDeepSeekV4FlashModel])
const requiredStatusSchema = ['性别', '身份', '外貌', '性格']
const fallbackStatusSchema = ['性别', '身份', '外貌', '性格', '位置']

const appState = loadAppState()
let state = getCurrentStory()
let storyLibraryAssets = []
let selectedNewGameAssetId = ''
let generationBusy = false
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
  resetButton: document.querySelector('#resetButton'),
  storySelect: document.querySelector('#storySelect'),
  storyNameInput: document.querySelector('#storyNameInput'),
  storyLibraryButton: document.querySelector('#storyLibraryButton'),
  newStoryButton: document.querySelector('#newStoryButton'),
  deleteStoryButton: document.querySelector('#deleteStoryButton'),
  saveArchiveButton: document.querySelector('#saveArchiveButton'),
  loadArchiveButton: document.querySelector('#loadArchiveButton'),
  deleteSaveButton: document.querySelector('#deleteSaveButton'),
  gamePage: document.querySelector('#gamePage'),
  storyLibraryPage: document.querySelector('#storyLibraryPage'),
  newGameDialog: document.querySelector('#newGameDialog'),
  newGameForm: document.querySelector('#newGameForm'),
  newGameName: document.querySelector('#newGameName'),
  storyAssetList: document.querySelector('#storyAssetList'),
  newGamePreview: document.querySelector('#newGamePreview'),
  cancelNewGameButton: document.querySelector('#cancelNewGameButton'),
  importStoryAssetButton: document.querySelector('#importStoryAssetButton'),
  initializeStoryAssetButton: document.querySelector('#initializeStoryAssetButton'),
  deleteStoryAssetButton: document.querySelector('#deleteStoryAssetButton'),
  refreshStoryLibraryButton: document.querySelector('#refreshStoryLibraryButton'),
  storyLibraryFileInput: document.querySelector('#storyLibraryFileInput'),
  storyLibraryStatus: document.querySelector('#storyLibraryStatus'),
  libraryAssetList: document.querySelector('#libraryAssetList'),
  libraryPreview: document.querySelector('#libraryPreview'),
  storySettingsForm: document.querySelector('#storySettingsForm'),
  saveStorySettingsButton: document.querySelector('#saveStorySettingsButton'),
  storyProgramConfigInput: document.querySelector('#storyProgramConfigInput'),
  closeStoryLibraryButton: document.querySelector('#closeStoryLibraryButton'),
  jumpTurnStartButton: document.querySelector('#jumpTurnStartButton'),
  jumpLatestButton: document.querySelector('#jumpLatestButton'),
  conversation: document.querySelector('#conversation'),
  optionTray: document.querySelector('#optionTray'),
  playForm: document.querySelector('#playForm'),
  playerFeedback: document.querySelector('#playerFeedback'),
  playerInput: document.querySelector('#playerInput'),
  retryStageButton: document.querySelector('#retryStageButton'),
  regenerateButton: document.querySelector('#regenerateButton'),
  sendButton: document.querySelector('#sendButton'),
  statusPanelView: document.querySelector('#statusPanelView'),
  storyTrackingView: document.querySelector('#storyTrackingView'),
  toggleDebugButton: document.querySelector('#toggleDebugButton'),
  debugOutput: document.querySelector('#debugOutput'),
  emptyConversationTemplate: document.querySelector('#emptyConversationTemplate'),
}

init()

async function init() {
  bindEvents()
  await loadConfig()
  await loadServerState()
  applyLegacyMigrations()
  render()
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
        gender: '未设定',
        role: '玩家操控角色',
        mood: '克制',
        location: '当前场景',
        health: '正常',
        trust: '',
        notes: '不替玩家锁死长期选择。',
      },
    ],
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
    playerFeedback: '',
    storyAssetId: '',
    programConfigFile: '',
    statusSchema: fallbackStatusSchema,
    statusRoster: ['玩家'],
    statusState: {},
    globalContext: '',
    playerOptions: [],
    model: defaultModel,
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
  const messages = Array.isArray(raw?.messages) ? raw.messages : []
  const openingText = String(raw?.openingText || '')
  const existingChapterSummary = cleanHistoricalGlobalContext(String(raw?.chapterSummary || raw?.currentSituation || ''))
  const existingGlobalContext = cleanHistoricalGlobalContext(String(raw?.globalContext || ''))
  const openingHistory = openingTurnHistory(openingText)
  const openingHistoryLine = openingHistory ? `- ${openingHistory}` : ''
  const hasNoInteraction = messages.length === 0
  const chapterSummary = hasNoInteraction && isOpeningHistorySummary(existingChapterSummary, openingHistory) ? '' : existingChapterSummary
  const globalContext = hasNoInteraction && isOpeningHistorySummary(existingGlobalContext, openingHistoryLine) ? '' : existingGlobalContext
  const retiredKeys = [
    'current' + 'Physical' + 'Environment',
    'current' + 'Physical' + 'Environment' + 'Forbidden',
    'normalized' + 'Entries',
    'storybook' + 'Entries',
    'module' + 'Enabled',
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
    messages,
    characters: Array.isArray(raw?.characters) ? raw.characters : base.characters,
    openingText,
    worldview: String(raw?.worldview || ''),
    currentSituation: String(raw?.currentSituation || openingText || ''),
    chapterSummary,
    outline: String(raw?.outline || openingText || ''),
    longRangeOutline: String(raw?.longRangeOutline || ''),
    directorStyle: String(raw?.directorStyle || ''),
    narratorStyle: String(raw?.narratorStyle || ''),
    plotLines: Array.isArray(raw?.plotLines) ? raw.plotLines : [],
    feedbackMemory: normalizeFeedbackMemory(raw?.feedbackMemory),
    playerFeedback: String(raw?.playerFeedback || ''),
    storyAssetId: String(raw?.storyAssetId || ''),
    programConfigFile: String(raw?.programConfigFile || ''),
    statusSchema: normalizeStatusSchema(raw?.statusSchema),
    statusRoster: normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []),
    statusState: normalizeStatusState(raw?.statusState, normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []), Array.isArray(raw?.characters) ? raw.characters : [], normalizeStatusSchema(raw?.statusSchema)),
    globalContext,
    playerOptions: Array.isArray(raw?.playerOptions) ? raw.playerOptions : [],
    model: normalizeModel(raw?.model || base.model),
    lastTurnSnapshot: normalizeTurnSnapshot(raw?.lastTurnSnapshot),
    debug: raw?.debug && typeof raw.debug === 'object' ? raw.debug : {},
  }
}

function openingTurnHistory(openingText) {
  const text = String(openingText || '').trim()
  if (!text) return ''
  return /^第0轮[:：]/.test(text) ? text : `第0轮：${text}`
}

function isOpeningHistorySummary(value, openingHistory) {
  const text = String(value || '').replace(/^-\s*/, '').trim()
  const opening = String(openingHistory || '').replace(/^-\s*/, '').trim()
  if (!text) return false
  if (/^第0轮[:：]/.test(text)) return true
  return Boolean(opening && text === opening)
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
      const ttl = Number.isFinite(Number(item.ttl)) ? Number(item.ttl) : 1
      return {
        type: normalizeFeedbackType(item.type),
        text,
        ttl: Math.max(1, Math.min(1, Math.floor(ttl))),
      }
    })
    .filter(Boolean)
    .slice(-15)
}

function parseStatusSchemaFields(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n|[,，、]/) : []
  return items.map(item => String(item || '').replace(/^[-*]\s*/, '').split(/[：:]/)[0].trim()).filter(Boolean)
}

function normalizeStatusSchema(value, fallback = fallbackStatusSchema) {
  const fields = parseStatusSchemaFields(value)
  const source = fields.length ? fields : fallback
  return [...new Set([...requiredStatusSchema, ...source])]
}

function normalizeStatusRoster(value, characters = []) {
  const names = (Array.isArray(value) ? value : [])
    .map(item => typeof item === 'string' ? item : item?.name)
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(Boolean)
  return [...new Set(['玩家', ...names, ...characterNames])]
}

function normalizeStatusState(value, roster, characters = [], schema = fallbackStatusSchema) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const byName = new Map(characters.map(character => [String(character.name || '').trim(), character]))
  const output = {}
  for (const name of roster) {
    const record = source[name] && typeof source[name] === 'object' ? source[name] : {}
    const character = byName.get(name)
    const base = {
      性别: String(record.性别 || record.gender || character?.gender || '未揭示'),
      身份: String(record.身份 || record.role || character?.role || (name === '玩家' ? '玩家操控角色' : '未揭示')),
      位置: String(record.位置 || record.location || character?.location || '未知'),
      姿势: String(record.姿势 || '未知'),
      外显状态: String(record.外显状态 || record.health || character?.health || '未知'),
      外貌: String(record.外貌 || record.appearance || character?.appearance || '未揭示'),
      性格: String(record.性格 || record.personality || character?.personality || '未揭示'),
      情绪: String(record.情绪 || record.mood || character?.mood || '未知'),
      已知信息: String(record.已知信息 || '未揭示'),
      对玩家态度: String(record.对玩家态度 || record.trust || (name === '玩家' ? '玩家本人' : character?.trust || '未知')),
      手上物: String(record.手上物 || '未知'),
      可触达区域: String(record.可触达区域 || '未知'),
    }
    output[name] = {}
    for (const field of normalizeStatusSchema(schema)) {
      output[name][field] = String(record[field] || base[field] || '未知')
    }
  }
  return output
}

function mergeStatusSchema(current, patch) {
  return normalizeStatusSchema([...parseStatusSchemaFields(current), ...parseStatusSchemaFields(patch)])
}

function mergeStatusRoster(current, patch, characters = [], statePatch = {}) {
  const patchNames = statePatch && typeof statePatch === 'object' && !Array.isArray(statePatch) ? Object.keys(statePatch) : []
  return normalizeStatusRoster([...(Array.isArray(current) ? current : []), ...(Array.isArray(patch) ? patch : []), ...patchNames], characters)
}

function mergeStatusState(current, patch, roster, characters = [], schema = fallbackStatusSchema) {
  const base = normalizeStatusState(current, roster, characters, schema)
  const delta = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}
  for (const [name, record] of Object.entries(delta)) {
    if (!roster.includes(name) || !record || typeof record !== 'object') continue
    base[name] = { ...(base[name] || {}), ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value ?? '').trim()]).filter(([, value]) => value)) }
  }
  return base
}

function normalizeFeedbackType(type) {
  const value = String(type || '').trim()
  if ([
    'planExecution',
    'narrativeConstraint',
    'narrativeRepetition',
    'narrativePacing',
    'directorProgress',
    'directorPhysical',
  ].includes(value)) return value
  return 'quality'
}

function renderFeedbackMemory(items = state.feedbackMemory) {
  return normalizeFeedbackMemory(items)
    .map(item => {
      const label = {
        planExecution: '执行',
        narrativeConstraint: '约束',
        narrativeRepetition: '重复',
        narrativePacing: '节奏',
        directorProgress: '导演',
        directorPhysical: '物理',
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
    ['narrativeRepetition', payload.narrativeRepetitionFeedback],
    ['narrativePacing', payload.narrativePacingFeedback],
    ['directorProgress', payload.directorProgressFeedback],
    ['directorPhysical', payload.directorPhysicalFeedback],
  ]
    .map(([type, value]) => ({ type, text: String(value || '').trim(), ttl: 1 }))
    .filter(item => item.text)
  const merged = [...aged]
  for (const item of incoming) {
    const index = merged.findIndex(old => old.type === item.type && old.text === item.text)
    if (index >= 0) {
      merged[index] = { ...merged[index], ttl: 1 }
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
    story.statusState = normalizeStatusState(story.statusState, story.statusRoster, story.characters, story.statusSchema)
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

  els.playerFeedback.addEventListener('change', () => {
    state.playerFeedback = els.playerFeedback.value.trim()
    saveState()
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
    try {
      for (const file of files) {
        setStoryLibraryStatus(`正在导入：${file.name}`, 'running')
        const imported = await importStoryFile(file)
        const asset = storyAssetFromImported(file.name, imported)
        storyLibraryAssets.unshift(asset)
        selectedNewGameAssetId = asset.id
      }
      if (files.length) setStoryLibraryStatus('导入完成。请选择资料并初始化。', 'done')
    } catch (error) {
      setStoryLibraryStatus(error.message, 'error')
      alert(error.message)
    }
    event.target.value = ''
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
  })

  els.initializeStoryAssetButton.addEventListener('click', () => {
    initializeSelectedStoryAsset()
  })

  els.deleteStoryAssetButton.addEventListener('click', () => {
    deleteSelectedStoryAsset()
  })

  els.refreshStoryLibraryButton.addEventListener('click', async () => {
    await loadStoryLibrary()
    renderStoryLibraryAssets()
  })

  els.saveStorySettingsButton.addEventListener('click', () => {
    saveSelectedStorySettings()
  })

  els.closeStoryLibraryButton.addEventListener('click', () => {
    closeStoryLibraryPage()
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
  renderPlayerFeedback()
  renderStatusPanel()
  renderStoryTracking()
  renderConversation()
  renderOptions()
  renderReadingJumpControls()
  renderRetryStageButton()
  renderRegenerateButton()
  els.modelSelect.value = normalizeModel(state.model || config.model)
  renderDebug()
}

function renderPlayerFeedback() {
  if (document.activeElement === els.playerFeedback) return
  els.playerFeedback.value = state.playerFeedback || ''
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
      const elapsed = formatPipelineElapsed(item)
      lines.push(`- ${item.label || item.stage}: ${item.status}${elapsed ? `｜${elapsed}` : ''}${item.message ? `｜${item.message}` : ''}`)
      if (Array.isArray(item.logs) && item.logs.length) {
        for (const log of item.logs.slice(-4)) lines.push(`  · ${formatPipelineLog(item, log)}`)
      }
    }
  }

  const payload = {
    initializer: debug.initializer,
    director: debug.director,
    narrator: debug.narrator,
    postprocess: debug.postprocess,
  }
  if (Object.values(payload).some(Boolean)) {
    lines.push('', 'stages:', JSON.stringify(payload, null, 2))
  }
  els.debugOutput.textContent = lines.join('\n')
}

function formatPipelineElapsed(item, now = Date.now()) {
  const startedAt = Number(item.startedAtMs || 0)
  const endedAt = Number(item.endedAtMs || 0)
  const updatedAt = Number(item.updatedAtMs || 0)
  const end = endedAt || (item.status === 'running' ? now : updatedAt)
  if (!startedAt || !end || end < startedAt) return ''
  return `耗时 ${formatPipelineMs(end - startedAt)}`
}

function formatPipelineLog(item, log) {
  const elapsed = formatPipelineElapsed(item)
  return elapsed ? `${elapsed}｜${log}` : log
}

function formatPipelineMs(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return '-'
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
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
  openStoryLibraryPage()
}

async function openStoryLibraryPage() {
  await loadStoryLibrary()
  selectedNewGameAssetId = storyLibraryAssets[0]?.id || ''
  setStoryLibraryStatus(storyLibraryAssets.some(asset => asset.programConfig)
    ? '已有已初始化故事，可以开始新游戏。'
    : '请选择故事资料并点击初始化。')
  renderStoryLibraryAssets()
  els.gamePage.hidden = true
  els.storyLibraryPage.hidden = false
}

function closeStoryLibraryPage() {
  els.storyLibraryPage.hidden = true
  els.gamePage.hidden = false
  render()
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
    if (els.libraryPreview) els.libraryPreview.innerHTML = ''
    renderStorySettingsForm(null)
    els.deleteStoryAssetButton.disabled = true
    return
  }
  els.deleteStoryAssetButton.disabled = !selectedNewGameAssetId

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
  if (els.libraryPreview) renderAssetPreview(els.libraryPreview, selected)
}

async function deleteSelectedStoryAsset() {
  const asset = storyLibraryAssets.find(item => item.id === selectedNewGameAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  if (!confirm(`删除故事资料“${assetDefaultStoryName(asset)}”？会删除本地 story 目录里的导入文件和 program-config。`)) return
  els.deleteStoryAssetButton.disabled = true
  setStoryLibraryStatus(`正在删除：${assetDefaultStoryName(asset)}。`, 'running')
  try {
    const response = await fetch(`/api/story-assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '删除故事资料失败')
    if (state.storyAssetId === asset.id) {
      state.storyAssetId = ''
      state.programConfigFile = ''
      saveState()
    }
    await loadStoryLibrary()
    selectedNewGameAssetId = storyLibraryAssets[0]?.id || ''
    renderStoryLibraryAssets()
    renderNewGameAssets()
    setStoryLibraryStatus('已删除故事资料，可以重新选择文件导入。', 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    els.deleteStoryAssetButton.disabled = storyLibraryAssets.length === 0
  }
}

function renderStorySettingsForm(asset) {
  const config = storyProgramConfigForEdit(asset)
  const disabled = !asset?.programConfig
  els.saveStorySettingsButton.disabled = disabled
  els.storyProgramConfigInput.disabled = disabled
  els.storyProgramConfigInput.value = asset?.programConfig
    ? JSON.stringify(config, null, 2)
    : ''
}

function storyProgramConfigForEdit(asset) {
  const config = asset?.programConfig || {}
  return {
    ...config,
    worldview: String(config.worldview || ''),
    openingText: String(config.openingText || ''),
    directorStyle: String(config.directorStyle || ''),
    narratorStyle: String(config.narratorStyle || ''),
    statusSchema: normalizeStatusSchema(config.statusSchema),
    statusRoster: normalizeStatusRoster(config.statusRoster),
    statusState: normalizeStatusState(config.statusState, normalizeStatusRoster(config.statusRoster), [], normalizeStatusSchema(config.statusSchema)),
    initialPlayerOptions: Array.isArray(config.initialPlayerOptions) ? config.initialPlayerOptions : [],
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
  let patch
  try {
    patch = parseEditableJson(els.storyProgramConfigInput.value || '{}')
  } catch (error) {
    alert(`JSON 格式错误：${error.message}`)
    return
  }
  els.saveStorySettingsButton.disabled = true
  setStoryLibraryStatus('正在保存故事设定。', 'running')
  try {
    const config = await saveStoryAssetProgramConfig(asset, patch)
    applyProgramConfigToCurrentStory(asset, config)
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

function parseEditableJson(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    const repaired = escapeControlCharactersInJsonStrings(text)
    if (repaired === text) throw error
    try {
      return JSON.parse(repaired)
    } catch {
      throw error
    }
  }
}

function escapeControlCharactersInJsonStrings(text) {
  let output = ''
  let inString = false
  let escaped = false
  for (const char of String(text || '')) {
    if (!inString) {
      output += char
      if (char === '"') inString = true
      continue
    }
    if (escaped) {
      output += char
      escaped = false
      continue
    }
    if (char === '\\') {
      output += char
      escaped = true
      continue
    }
    if (char === '"') {
      output += char
      inString = false
      continue
    }
    if (char === '\n') {
      output += '\\n'
      continue
    }
    if (char === '\r') {
      output += '\\r'
      continue
    }
    if (char === '\t') {
      output += '\\t'
      continue
    }
    if (char < ' ') {
      output += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
      continue
    }
    output += char
  }
  return output
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
  state.statusState = normalizeStatusState(config.statusState || state.statusState, state.statusRoster, state.characters, state.statusSchema)
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
  const config = storyProgramConfigForEdit(asset)
  container.innerHTML = `
    <div class="preview-block">
      <strong>Program Config JSON</strong>
      <pre>${escapeHtml(asset.programConfig ? JSON.stringify(config, null, 2) : '未初始化，请在故事库点击初始化。')}</pre>
    </div>
  `
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
  const characterSeeds = characterSeedsFromStatus(init, asset.characters || [])
  story.characters = [
    player,
    ...characterSeeds.filter(character => character?.name !== '玩家').map(character => ({
      ...character,
      id: makeId('character'),
    })),
  ].filter(Boolean)
  story.openingText = String(init.openingText || extractOpeningText(asset.entries || []))
  const openingSummary = String(story.openingText || '').trim()
  story.worldview = String(init.worldview || '')
  story.currentSituation = openingSummary
  story.chapterSummary = ''
  story.outline = openingSummary
  story.longRangeOutline = String(init.longRangeOutline || '')
  story.directorStyle = String(init.directorStyle || '')
  story.narratorStyle = String(init.narratorStyle || '')
  story.plotLines = []
  story.feedbackMemory = []
  story.storyAssetId = String(asset.id || '')
  story.programConfigFile = String(asset.programConfigFile || init.programConfigFile || '')
  story.statusSchema = normalizeStatusSchema(init.statusSchema)
  story.statusRoster = normalizeStatusRoster(init.statusRoster, story.characters)
  story.statusState = normalizeStatusState(init.statusState, story.statusRoster, story.characters, story.statusSchema)
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
    const savedConfig = await saveStoryAssetProgramConfig(asset, payload)
    state.debug.status = 'done'
    state.debug.initializer = savedConfig
    renderDebug()
    await loadStoryLibrary()
    const confirmed = storyLibraryAssets.find(item => item.id === asset.id)
    if (!confirmed?.programConfig) throw new Error('Initializer 已返回 JSON，但 program-config 未落盘。请重新导入资料后再初始化。')
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

async function saveStoryAssetProgramConfig(asset, config) {
  const response = await fetch(`/api/story-assets/${encodeURIComponent(asset.id)}/program-config`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'program-config 写入失败')
  asset.programConfig = payload.config
  if (!asset.programConfigFile && asset.id) asset.programConfigFile = `story/${asset.id}/program-config.json`
  return payload.config
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
  if (!Array.isArray(config?.statusSchema) || config.statusSchema.length === 0) missing.push('statusSchema')
  if (!Array.isArray(config?.statusRoster) || config.statusRoster.length === 0) missing.push('statusRoster')
  if (!config?.statusState || typeof config.statusState !== 'object') missing.push('statusState')
  if (!Array.isArray(config?.initialPlayerOptions) || config.initialPlayerOptions.length !== 3) missing.push('initialPlayerOptions')
  if (missing.length) {
    throw new Error(`故事尚未完成初始化，缺少：${missing.join('、')}。不能开始游戏。`)
  }
}

function characterSeedsFromStatus(config, fallbackCharacters = []) {
  if (Array.isArray(config?.cast) && config.cast.length > 0) return config.cast
  if (Array.isArray(config?.characterSeeds) && config.characterSeeds.length > 0) return config.characterSeeds
  const roster = normalizeStatusRoster(config?.statusRoster)
  const status = config?.statusState && typeof config.statusState === 'object' ? config.statusState : {}
  const seeds = roster.map(name => {
    const record = status[name] && typeof status[name] === 'object' ? status[name] : {}
    return {
      name,
      gender: String(record.性别 || ''),
      role: String(record.身份 || ''),
      mood: String(record.情绪 || ''),
      location: String(record.位置 || ''),
      health: String(record.外显状态 || ''),
      trust: String(record.对玩家态度 || ''),
      appearance: String(record.外貌 || ''),
      personality: String(record.性格 || ''),
    }
  })
  return seeds.length ? seeds : fallbackCharacters
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
  const longRangeOutline = state.longRangeOutline || ''
  els.storyTrackingView.innerHTML = `
    ${renderTrackerSection('历史总结', formatHistoricalSummaryForTracker(summary) || '暂无历史总结。')}
    ${renderTrackerSection('故事风格', formatStoryStyleForTracker() || '暂无故事风格。')}
    ${renderTrackerSection('当前剧情目标', longRangeOutline || '暂无当前剧情目标。')}
    ${renderFeedbackMemory() ? renderTrackerSection('写作负反馈', renderFeedbackMemory()) : ''}
  `
}

function formatHistoricalSummaryForTracker(value) {
  const lines = String(value || '')
    .split('\n')
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
  return lines.map((line, index) => {
    if (/^第\d+轮[:：]/.test(line)) return `- ${line}`
    return `- 第${index + 1}轮：${line}`
  }).join('\n')
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

function renderConversation({ scrollTarget = 'bottom' } = {}) {
  const previousScrollTop = els.conversation.scrollTop
  const wasNearBottom = isConversationNearBottom()
  if (state.messages.length === 0 && !String(state.openingText || '').trim()) {
    els.conversation.innerHTML = renderEmptyConversation()
    renderReadingJumpControls()
    return
  }
  const messagesHtml = state.messages.map((message, index) => `
    <article class="message ${message.role}" data-message-index="${index}" data-message-role="${escapeAttr(message.role)}">
      <small>${message.role === 'user' ? 'PLAYER' : message.role === 'error' ? 'ERROR' : 'AGENT'}</small>
      ${escapeHtml(message.content)}
    </article>
  `).join('')
  els.conversation.innerHTML = `${renderOpeningMessage()}${messagesHtml}`
  applyConversationScroll(scrollTarget, previousScrollTop, wasNearBottom)
  renderReadingJumpControls()
}

function renderReadingJumpControls() {
  const hasOpening = Boolean(String(state.openingText || '').trim())
  const hasMessages = hasOpening || (Array.isArray(state.messages) && state.messages.length > 0)
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
  return `
    <div class="empty-state">
      <strong>${escapeHtml(state.name || '未选择故事')}</strong>
      <span>请先点“开始新游戏”，选择或导入故事资料。</span>
    </div>
  `
}

function renderOpeningMessage() {
  const opening = String(state.openingText || '').trim()
  if (!opening) return ''
  return `
    <article class="message assistant opening-message" data-message-index="-1" data-message-role="opening">
      <small>AGENT · 第0轮</small>
      ${escapeHtml(opening)}
    </article>
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
  const playerFeedback = els.playerFeedback.value.trim()
  if (!playerInput) return

  state.playerFeedback = playerFeedback
  const snapshot = createTurnSnapshot(playerInput, playerFeedback)
  await generateTurn(playerInput, { snapshot, modeLabel: 'running', playerFeedback })
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
  await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'regenerating', playerFeedback: snapshot.playerFeedback || '' })
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
    await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'continuing', playerFeedback: snapshot.playerFeedback || '' })
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
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    longRangeOutline: state.longRangeOutline,
    playerFeedback: state.debug?.postprocessRecoveryBase?.playerFeedback || '',
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
    state.model = normalizeModel(payload.model || state.model)
    applyPostprocess(payload)
    persistPostprocessResult()
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

async function generateTurn(playerInput, { snapshot, modeLabel = 'running', playerFeedback = '' } = {}) {
  const currentTurnPlayerFeedback = String(playerFeedback || snapshot?.playerFeedback || '').trim()
  state.playerFeedback = currentTurnPlayerFeedback
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
    state.model = normalizeModel(payload.model || state.model)
    applyPostprocess(payload)
    persistPostprocessResult()
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
    playerFeedback: state.playerFeedback,
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
  const openingRecentTurn = buildOpeningRecentTurn()
  const withOpening = openingRecentTurn ? [openingRecentTurn, ...withoutPendingUser] : withoutPendingUser
  return withOpening.slice(-15)
}

function buildOpeningRecentTurn() {
  const opening = String(state.openingText || '').trim()
  if (!opening) return null
  return {
    role: 'assistant',
    content: `第0轮：${opening}`,
  }
}

function createTurnSnapshot(playerInput, playerFeedback = '') {
  return {
    playerInput,
    playerFeedback,
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
    playerFeedback: String(value.playerFeedback || ''),
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
  storyState.debug = {}
  return {
    playerInput,
    playerFeedback: state.debug?.postprocessRecoveryBase?.playerFeedback || '',
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
    'playerFeedback',
    'storyAssetId',
    'programConfigFile',
    'statusSchema',
    'statusRoster',
    'statusState',
    'globalContext',
    'playerOptions',
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
  const turnSummary = String(payload.turnSummary || '').trim()
  const labeledTurnSummary = labelTurnSummary(turnSummary, completedAssistantTurnCount())
  const contextLines = []
  if (labeledTurnSummary) contextLines.push(labeledTurnSummary)
  if (contextLines.length) {
    state.globalContext = `${state.globalContext || ''}\n${contextLines.map(line => `- ${line}`).join('\n')}`.trim()
  }
  if (turnSummary) {
    state.chapterSummary = appendBulletText(state.chapterSummary, labeledTurnSummary)
    state.currentSituation = turnSummary
    state.outline = turnSummary
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
    state.statusState = normalizeStatusState(payload.statusState, state.statusRoster, state.characters, state.statusSchema)
  } else {
    state.statusState = mergeStatusState(state.statusState, statusPatch.statusStatePatch, state.statusRoster, state.characters, state.statusSchema)
  }
  state.statusState = mergeStatusState(state.statusState, statusPatch.statusStatePatch, state.statusRoster, state.characters, state.statusSchema)
}

function labelTurnSummary(summary, turnIndex) {
  const text = String(summary || '').trim()
  if (!text) return ''
  if (/^第\d+轮[:：]/.test(text)) return text
  const index = Number.isFinite(Number(turnIndex)) && Number(turnIndex) > 0 ? Number(turnIndex) : completedAssistantTurnCount()
  return `第${Math.max(1, index)}轮：${text}`
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
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `导入失败：${sourceName}`)
  if (!payload.files?.dir) throw new Error(`导入失败：${sourceName} 未写入本地 story 目录`)
  for (const entry of imported.entries || []) {
    entry.sourceFiles = payload.files
  }
  if (payload.programConfig) imported.programConfig = payload.programConfig
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
      gender: '',
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
  existing.gender = existing.gender || character.gender
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
  renderDebug()
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
