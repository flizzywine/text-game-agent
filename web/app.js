const storageKey = 'text-game-agent.web-state.v2'
const legacyStorageKey = 'text-game-agent.web-state.v1'
const deepSeekApiKeyStorageKey = 'text-game-agent.deepseek-api-key'
const fireworksApiKeyStorageKey = 'text-game-agent.fireworks-api-key'
const infronApiKeyStorageKey = 'text-game-agent.infron-api-key'
const cerebrasApiKeyStorageKey = 'text-game-agent.cerebras-api-key'
const googleAiStudioApiKeyStorageKey = 'text-game-agent.google-ai-studio-api-key'
const infronReasoningStorageKey = 'text-game-agent.infron-reasoning-effort'
const preferredModelStorageKey = 'text-game-agent.preferred-model'
const preferredModelVersionStorageKey = 'text-game-agent.preferred-model-version'
const fireworksDeepSeekV4ProPriorityModel = 'accounts/fireworks/models/deepseek-v4-pro:priority'
const fireworksKimiK2P5Model = 'accounts/fireworks/models/kimi-k2p5'
const fireworksQwen3235BA22BModel = 'accounts/fireworks/models/qwen3-235b-a22b'
const fireworksQwen36PlusModel = 'accounts/fireworks/models/qwen3p6-plus'
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
const defaultModel = officialDeepSeekV4FlashModel
const defaultModelVersion = 'official-deepseek-v4-flash'
const modelOptions = new Set([fireworksDeepSeekV4ProPriorityModel, fireworksKimiK2P5Model, fireworksQwen3235BA22BModel, fireworksQwen36PlusModel, officialDeepSeekV4ProModel, officialDeepSeekV4FlashModel, infronDeepSeekV4ProModel, infronDeepSeekV4FlashModel, infronGemini31FlashLiteModel, infronGemini25FlashModel, infronGemini3FlashPreviewModel, infronKimiK25Model, infronQwen35EaricaModel, infronQwen36FlashModel, infronQwen36PlusModel, infronXiaomiMimo25Model, infronGlm47FlashxModel, infronGlm51Model, infronGrok43Model, googleAiStudioGemini31FlashLiteModel, cerebrasQwenModel])
const providerOptions = ['deepseek', 'infron', 'fireworks', 'google-ai-studio', 'cerebras']
const modelCatalog = [
  { id: officialDeepSeekV4ProModel, provider: 'deepseek' },
  { id: officialDeepSeekV4FlashModel, provider: 'deepseek' },
  { id: infronDeepSeekV4ProModel, provider: 'infron' },
  { id: infronDeepSeekV4FlashModel, provider: 'infron' },
  { id: infronGemini31FlashLiteModel, provider: 'infron' },
  { id: infronGemini25FlashModel, provider: 'infron' },
  { id: infronGemini3FlashPreviewModel, provider: 'infron' },
  { id: infronKimiK25Model, provider: 'infron' },
  { id: infronQwen35EaricaModel, provider: 'infron' },
  { id: infronQwen36FlashModel, provider: 'infron' },
  { id: infronQwen36PlusModel, provider: 'infron' },
  { id: infronXiaomiMimo25Model, provider: 'infron' },
  { id: infronGlm47FlashxModel, provider: 'infron' },
  { id: infronGlm51Model, provider: 'infron' },
  { id: infronGrok43Model, provider: 'infron' },
  { id: fireworksDeepSeekV4ProPriorityModel, provider: 'fireworks' },
  { id: fireworksKimiK2P5Model, provider: 'fireworks' },
  { id: fireworksQwen3235BA22BModel, provider: 'fireworks' },
  { id: fireworksQwen36PlusModel, provider: 'fireworks' },
  { id: googleAiStudioGemini31FlashLiteModel, provider: 'google-ai-studio' },
  { id: cerebrasQwenModel, provider: 'cerebras' },
]
const requiredStatusSchema = ['性别', '身份', '外貌', '性格', '姿势']
const fallbackStatusSchema = ['性别', '身份', '外貌', '性格', '姿势', '位置']

const appState = loadAppState()
let state = getCurrentStory()
let storyLibraryAssets = []
let selectedNewGameAssetId = ''
let generationBusy = false
let interceptionPromptSnapshot = null
let persistController = null
let activeStreamController = null
let postprocessQueueRunning = false
let pendingModelSelection = null
let config = {
  model: defaultModel,
  baseUrl: 'https://api.deepseek.com',
  hasApiKey: false,
  providers: {
    deepseek: { baseUrl: 'https://api.deepseek.com', hasApiKey: false },
    fireworks: { baseUrl: 'https://api.fireworks.ai/inference/v1', hasApiKey: false },
    infron: { baseUrl: 'https://llm.onerouter.pro/v1', hasApiKey: false, providerSort: 'throughput' },
    cerebras: { baseUrl: 'https://api.cerebras.ai/v1', hasApiKey: false },
    googleAiStudio: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', hasApiKey: false },
  },
}

const els = {
  connectionStatus: document.querySelector('#connectionStatus'),
  pipelineModelGrid: document.querySelector('#pipelineModelGrid'),
  turnStatus: document.querySelector('#turnStatus'),
  providerSelect: document.querySelector('#providerSelect'),
  modelSelect: document.querySelector('#modelSelect'),
  applyModelSelectionButton: document.querySelector('#applyModelSelectionButton'),
  infronReasoningSelect: document.querySelector('#infronReasoningSelect'),
  temperatureInput: document.querySelector('#temperatureInput'),
  apiKeyButton: document.querySelector('#apiKeyButton'),
  providerTestButton: document.querySelector('#providerTestButton'),
  providerSpeedTestButton: document.querySelector('#providerSpeedTestButton'),
  apiKeyHelp: document.querySelector('#apiKeyHelp'),
  apiKeyLabel: document.querySelector('#apiKeyLabel'),
  apiKeyInput: document.querySelector('#apiKeyInput'),
  clearApiKeyButton: document.querySelector('#clearApiKeyButton'),
  modelManagementButton: document.querySelector('#modelManagementButton'),
  modelManagementPage: document.querySelector('#modelManagementPage'),
  closeModelManagementButton: document.querySelector('#closeModelManagementButton'),
  modelManagementStatus: document.querySelector('#modelManagementStatus'),
  modelTestResults: document.querySelector('#modelTestResults'),
  buildInterceptionPromptButton: document.querySelector('#buildInterceptionPromptButton'),
  interceptionPromptFile: document.querySelector('#interceptionPromptFile'),
  interceptionInstructionFiles: document.querySelector('#interceptionInstructionFiles'),
  runInterceptionTestButton: document.querySelector('#runInterceptionTestButton'),
  interceptionStatus: document.querySelector('#interceptionStatus'),
  interceptionSystemInput: document.querySelector('#interceptionSystemInput'),
  interceptionResultOutput: document.querySelector('#interceptionResultOutput'),
  directorControlButton: document.querySelector('#directorControlButton'),
  directorControlDialog: document.querySelector('#directorControlDialog'),
  directorControlForm: document.querySelector('#directorControlForm'),
  directorPlotGoalInput: document.querySelector('#directorPlotGoalInput'),
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
  promptPreviewButton: document.querySelector('#promptPreviewButton'),
  promptPreviewDialog: document.querySelector('#promptPreviewDialog'),
  closePromptPreviewButton: document.querySelector('#closePromptPreviewButton'),
  promptPreviewStatus: document.querySelector('#promptPreviewStatus'),
  promptPreviewList: document.querySelector('#promptPreviewList'),
  saveSlotsDialog: document.querySelector('#saveSlotsDialog'),
  saveSlotsForm: document.querySelector('#saveSlotsForm'),
  saveSlotsList: document.querySelector('#saveSlotsList'),
  saveSlotsStatus: document.querySelector('#saveSlotsStatus'),
  closeSaveSlotsButton: document.querySelector('#closeSaveSlotsButton'),
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
  rollbackTurnButton: document.querySelector('#rollbackTurnButton'),
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
  processPostprocessQueue()
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
    plotGoal: '',
    physicalConstraints: [],
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
    postprocessQueue: [],
    model: readPreferredModelFromStorage(),
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
    defaultModelVersion,
    preferredModel: story.model,
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
  const modelVersion = String(raw?.defaultModelVersion || '')
  const stories = Array.isArray(raw?.stories)
    ? raw.stories.map((story, index) => normalizeStory(story, `故事 ${index + 1}`, modelVersion))
    : []
  if (stories.length === 0) return base
  const currentStoryId = stories.some(story => story.id === raw.currentStoryId)
    ? raw.currentStoryId
    : stories[0].id
  const rawCurrentStory = stories.find(story => story.id === currentStoryId) || stories[0]
  return {
    defaultModelVersion,
    preferredModel: normalizePersistedModel(raw?.preferredModel, modelVersion) || readStoredPreferredModel() || normalizePersistedModel(rawCurrentStory?.model, modelVersion) || base.preferredModel || defaultModel,
    currentStoryId,
    stories,
    multiSpatialMigration: Boolean(raw?.multiSpatialMigration),
    reviewerPatchMigration: Boolean(raw?.reviewerPatchMigration),
    removeSpatialStatusPanelMigration: Boolean(raw?.removeSpatialStatusPanelMigration),
  }
}

function normalizeStory(raw, fallbackName = '故事', modelVersion = defaultModelVersion) {
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
    plotGoal: String(raw?.plotGoal || ''),
    physicalConstraints: normalizePhysicalConstraints(raw?.physicalConstraints),
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
    postprocessQueue: Array.isArray(raw?.postprocessQueue) ? raw.postprocessQueue.filter(item => item && typeof item === 'object') : [],
    model: normalizePersistedModel(raw?.model, modelVersion) || base.model,
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

function normalizePhysicalConstraints(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : []
  return items
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5)
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
    output[name] = {}
    for (const field of normalizeStatusSchema(schema)) {
      output[name][field] = statusFieldValue(field, record, character, name)
    }
  }
  return output
}

function statusFieldValue(field, record, character, name) {
  if (record[field] !== undefined && record[field] !== null) return String(record[field])
  const fallbackByField = {
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
  if (value === 'narrativeRepetition') return value
  return 'narrativeRepetition'
}

function renderFeedbackMemory(items = state.feedbackMemory) {
  return normalizeFeedbackMemory(items)
    .map(item => {
      const label = {
        narrativeRepetition: '存在重复',
      }[item.type] || '反馈'
      return `- [${label}｜剩${item.ttl}轮] ${baselineLogText(item.text)}`
    })
    .join('\n')
}

function mergeFeedbackMemory(existing, payload) {
  const aged = normalizeFeedbackMemory(existing)
    .map(item => ({ ...item, ttl: item.ttl - 1 }))
    .filter(item => item.ttl > 0)
  const incoming = [
    ['narrativeRepetition', payload.存在重复 || payload.narrativeRepetitionFeedback],
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
  setPreferredModel(appState.preferredModel || state.model || config.model)
  appState.defaultModelVersion = defaultModelVersion
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
    state.model = getActiveModel()
    localStorage.setItem(storageKey, JSON.stringify(appState))
  } catch {
    // Local browser state remains the fallback.
  }
}

function persistServerState() {
  if (persistController) persistController.abort()
  persistController = new AbortController()
  const snapshot = JSON.stringify(appState)
  fetch('/api/save-state', {
    method: 'POST',
    signal: persistController.signal,
    headers: { 'content-type': 'application/json' },
    body: snapshot,
  }).catch(error => {
    if (error?.name === 'AbortError') return
    // Browser localStorage remains the immediate save.
  })
}

function beginActiveStream() {
  abortActiveStream()
  activeStreamController = new AbortController()
  return activeStreamController
}

function abortActiveStream() {
  if (activeStreamController) activeStreamController.abort()
  activeStreamController = null
}

function finishActiveStream(controller) {
  if (activeStreamController === controller) activeStreamController = null
}

function makeId(prefix) {
  if (crypto.randomUUID) return `${prefix}.${crypto.randomUUID()}`
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`
}

function normalizeModel(value) {
  const model = String(value || '').trim()
  return modelOptions.has(model) ? model : defaultModel
}

function readPreferredModelFromStorage() {
  return readStoredPreferredModel() || defaultModel
}

function readStoredPreferredModel() {
  try {
    const model = String(localStorage.getItem(preferredModelStorageKey) || '').trim()
    const version = String(localStorage.getItem(preferredModelVersionStorageKey) || '').trim()
    if (version !== defaultModelVersion && model === infronGrok43Model) return ''
    return modelOptions.has(model) ? model : ''
  } catch {
    return ''
  }
}

function normalizePersistedModel(value, version = defaultModelVersion) {
  const model = String(value || '').trim()
  if (version !== defaultModelVersion && model === infronGrok43Model) return ''
  return modelOptions.has(model) ? model : ''
}

function getActiveModel() {
  return normalizeModel(appState.preferredModel || state?.model || config.model || defaultModel)
}

function setPreferredModel(model) {
  const normalized = normalizeModel(model)
  appState.preferredModel = normalized
  if (state) state.model = normalized
  try {
    localStorage.setItem(preferredModelStorageKey, normalized)
    localStorage.setItem(preferredModelVersionStorageKey, defaultModelVersion)
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
  return normalized
}

function providerForModel(model) {
  const normalized = normalizeModel(model)
  if (normalized === fireworksDeepSeekV4ProPriorityModel || normalized === fireworksKimiK2P5Model || normalized === fireworksQwen3235BA22BModel || normalized === fireworksQwen36PlusModel) return 'fireworks'
  if (normalized === infronDeepSeekV4ProModel || normalized === infronDeepSeekV4FlashModel || normalized === infronGemini31FlashLiteModel || normalized === infronGemini25FlashModel || normalized === infronGemini3FlashPreviewModel || normalized === infronKimiK25Model || normalized === infronQwen35EaricaModel || normalized === infronQwen36FlashModel || normalized === infronQwen36PlusModel || normalized === infronXiaomiMimo25Model || normalized === infronGlm47FlashxModel || normalized === infronGlm51Model || normalized === infronGrok43Model) return 'infron'
  if (normalized === cerebrasQwenModel) return 'cerebras'
  if (normalized === googleAiStudioGemini31FlashLiteModel) return 'google-ai-studio'
  return 'deepseek'
}

function providerLabel(provider) {
  if (provider === 'fireworks') return 'Fireworks'
  if (provider === 'infron') return 'Infron'
  if (provider === 'cerebras') return 'Cerebras'
  if (provider === 'google-ai-studio') return 'Google AI Studio'
  return 'DeepSeek'
}

function normalizeProvider(value) {
  const provider = String(value || '').trim()
  return providerOptions.includes(provider) ? provider : providerForModel(defaultModel)
}

function modelsForProvider(provider) {
  return modelCatalog.filter(item => item.provider === normalizeProvider(provider))
}

function defaultModelForProvider(provider) {
  if (normalizeProvider(provider) === providerForModel(defaultModel)) return defaultModel
  return modelsForProvider(provider)[0]?.id || defaultModel
}

function modelLabel(model) {
  return {
    [officialDeepSeekV4ProModel]: 'DeepSeek V4 Pro | official | DeepSeek',
    [officialDeepSeekV4FlashModel]: 'DeepSeek V4 Flash | official | DeepSeek',
    [fireworksDeepSeekV4ProPriorityModel]: 'DeepSeek V4 Pro | priority | Fireworks',
    [fireworksKimiK2P5Model]: 'Kimi K2.5 | Fireworks',
    [fireworksQwen3235BA22BModel]: 'Qwen3 235B A22B | Fireworks',
    [fireworksQwen36PlusModel]: 'Qwen3.6 Plus | Fireworks',
    [infronDeepSeekV4ProModel]: 'DeepSeek V4 Pro | throughput | Infron',
    [infronDeepSeekV4FlashModel]: 'DeepSeek V4 Flash | throughput | Infron',
    [infronGemini31FlashLiteModel]: 'Gemini 3.1 Flash Lite | throughput | Infron',
    [infronGemini25FlashModel]: 'Gemini 2.5 Flash | throughput | Infron',
    [infronGemini3FlashPreviewModel]: 'Gemini 3 Flash Preview | throughput | Infron',
    [infronKimiK25Model]: 'Kimi K2.5 | throughput | Infron',
    [infronQwen35EaricaModel]: 'Qwen3.5 27B Earica Derestricted | throughput | Infron',
    [infronQwen36FlashModel]: 'Qwen3.6 Flash | throughput | Infron',
    [infronQwen36PlusModel]: 'Qwen3.6 Plus | throughput | Infron',
    [infronXiaomiMimo25Model]: 'Xiaomi MiMo V2.5 | throughput | Infron',
    [infronGlm47FlashxModel]: 'GLM 4.7 FlashX | throughput | Infron',
    [infronGlm51Model]: 'GLM 5.1 | throughput | Infron',
    [infronGrok43Model]: 'Grok 4.3 | throughput | Infron',
    [googleAiStudioGemini31FlashLiteModel]: 'Gemini 3.1 Flash Lite | AI Studio | Google',
    [cerebrasQwenModel]: 'Qwen 3 235B A22B Instruct 2507 | fast | Cerebras',
  }[model] || model
}

function normalizeInfronReasoningEffort(value) {
  const effort = String(value || '').trim()
  return ['none', 'low', 'medium', 'high'].includes(effort) ? effort : ''
}

function getInfronReasoningEffort() {
  return normalizeInfronReasoningEffort(localStorage.getItem(infronReasoningStorageKey) || '')
}

function setInfronReasoningEffort(value) {
  const effort = normalizeInfronReasoningEffort(value)
  if (effort) localStorage.setItem(infronReasoningStorageKey, effort)
  else localStorage.removeItem(infronReasoningStorageKey)
  return effort
}

async function loadConfig() {
  try {
    config = await fetchRuntimeConfig()
    state.model = getActiveModel()
    els.modelSelect.value = state.model
    renderConnection()
  } catch (error) {
    els.connectionStatus.textContent = `配置读取失败：${error.message}`
  }
}

async function fetchRuntimeConfig() {
  const response = await fetch('/api/config', { cache: 'no-store' })
  if (!response.ok) throw new Error('配置读取失败')
  return normalizeRuntimeConfig(await response.json())
}

function normalizeRuntimeConfig(raw) {
  return {
    model: normalizeModel(raw?.model || defaultModel),
    pipelineModels: raw?.pipelineModels || {
      director: defaultModel,
      narrator: defaultModel,
      postprocess: defaultModel,
      initializer: defaultModel,
    },
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
      infron: {
        baseUrl: String(raw?.providers?.infron?.baseUrl || 'https://llm.onerouter.pro/v1'),
        hasApiKey: Boolean(raw?.providers?.infron?.hasApiKey),
        providerSort: String(raw?.providers?.infron?.providerSort || 'throughput'),
        reasoningEffort: normalizeInfronReasoningEffort(raw?.providers?.infron?.reasoningEffort || ''),
      },
      cerebras: {
        baseUrl: String(raw?.providers?.cerebras?.baseUrl || 'https://api.cerebras.ai/v1'),
        hasApiKey: Boolean(raw?.providers?.cerebras?.hasApiKey),
      },
      googleAiStudio: {
        baseUrl: String(raw?.providers?.googleAiStudio?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai'),
        hasApiKey: Boolean(raw?.providers?.googleAiStudio?.hasApiKey),
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

  els.rollbackTurnButton.addEventListener('click', () => {
    rollbackUnfinishedTurn()
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

  els.modelManagementButton.addEventListener('click', () => {
    openModelManagementPage()
  })

  els.promptPreviewButton.addEventListener('click', () => {
    openPromptPreview()
  })

  els.closePromptPreviewButton.addEventListener('click', () => {
    els.promptPreviewDialog.close()
  })

  els.providerTestButton.addEventListener('click', () => {
    testCurrentProvider()
  })

  els.providerSpeedTestButton.addEventListener('click', () => {
    testCurrentProviderSpeed()
  })

  els.applyModelSelectionButton.addEventListener('click', () => {
    applyModelSelection()
  })

  els.providerSelect.addEventListener('change', event => {
    pendingModelSelection = defaultModelForProvider(event.target.value)
    renderModelManagementPage()
  })

  els.infronReasoningSelect.addEventListener('change', () => {
    setInfronReasoningEffort(els.infronReasoningSelect.value)
    renderModelManagementPage()
  })

  els.buildInterceptionPromptButton.addEventListener('click', () => {
    buildCurrentInterceptionPrompt()
  })

  els.interceptionPromptFile.addEventListener('change', () => {
    loadInterceptionPromptFile()
  })

  els.interceptionInstructionFiles.addEventListener('change', () => {
    loadInterceptionInstructionFiles()
  })

  els.runInterceptionTestButton.addEventListener('click', () => {
    runContentInterceptionTest()
  })

  els.clearApiKeyButton.addEventListener('click', () => {
    localStorage.removeItem(apiKeyStorageKeyForProvider(selectedProviderForManagement()))
    els.apiKeyInput.value = ''
    renderModelManagementPage()
    renderConnection()
  })

  els.closeModelManagementButton.addEventListener('click', () => {
    closeModelManagementPage()
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

  els.apiKeyButton.addEventListener('click', () => {
    const provider = selectedProviderForManagement()
    const key = els.apiKeyInput.value.trim()
    if (provider === 'deepseek' && key && !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) {
      alert('API Key 格式不对。DeepSeek key 通常以 sk- 开头，请重新粘贴完整 key。')
      return
    }
    if (key) localStorage.setItem(apiKeyStorageKeyForProvider(provider), key)
    else localStorage.removeItem(apiKeyStorageKeyForProvider(provider))
    renderModelManagementPage()
    renderConnection()
  })

  els.modelSelect.addEventListener('change', event => {
    pendingModelSelection = normalizeModel(event.target.value)
    renderModelManagementPage()
  })

  document.querySelectorAll('[data-provider-model]').forEach(button => {
    button.addEventListener('click', () => {
      pendingModelSelection = defaultModelForProvider(providerForModel(button.dataset.providerModel))
      renderModelManagementPage()
    })
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

  els.saveArchiveButton.addEventListener('click', async () => {
    await saveCurrentSlot()
  })

  els.loadArchiveButton.addEventListener('click', () => {
    openSaveSlotsDialog()
  })

  els.closeSaveSlotsButton.addEventListener('click', () => {
    els.saveSlotsDialog.close()
  })

  els.saveSlotsForm.addEventListener('submit', event => {
    event.preventDefault()
  })

  els.saveSlotsList.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action][data-id]')
    if (!button) return
    const id = button.dataset.id
    const action = button.dataset.action
    if (action === 'load') await loadSaveSlot(id)
    if (action === 'favorite') await toggleSaveSlotFavorite(id, button.dataset.favorite !== 'true')
    if (action === 'delete') await deleteSaveSlot(id, button.dataset.name || id)
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
  renderRollbackTurnButton()
  renderRegenerateButton()
  state.model = getActiveModel()
  els.modelSelect.value = state.model
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
  if (debug.note) lines.push(`note: ${baselineLogText(debug.note)}`)
  if (debug.error) lines.push(`error: ${baselineLogText(debug.error)}`)
  if (progress.length) {
    lines.push('', 'progress:')
    for (const item of progress) {
      const elapsed = formatPipelineElapsed(item)
      lines.push(`- ${item.label || item.stage}: ${item.status}${elapsed ? `｜${elapsed}` : ''}${item.message ? `｜${baselineLogText(item.message)}` : ''}`)
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
    lines.push('', 'stages:', baselineLogText(JSON.stringify(payload, null, 2)))
  }
  els.debugOutput.textContent = lines.join('\n')
}

function baselineLogText(value) {
  return String(value ?? '')
    .replaceAll('花色观察', '人物状态')
    .replaceAll('花色特性', '状态字段')
    .replaceAll('花语计划', '导演计划')
    .replaceAll('花语校验', '剧情校验')
    .replaceAll('花神的嘱咐', '上轮反重复提醒')
    .replaceAll('预言故事', '正文')
    .replaceAll('预言方向', '剧情方向')
    .replaceAll('命运分叉', '可选行动')
    .replaceAll('顾客需求', '玩家输入')
    .replaceAll('顾客', '玩家')
    .replaceAll('花语', '剧情')
    .replaceAll('预言', '剧情')
    .replaceAll('花朵', '故事')
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
  const text = baselineLogText(log)
  return elapsed ? `${elapsed}｜${text}` : text
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
  state.model = getActiveModel()
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
  els.modelManagementPage.hidden = true
}

function closeStoryLibraryPage() {
  els.storyLibraryPage.hidden = true
  els.gamePage.hidden = false
  render()
}

function openModelManagementPage() {
  pendingModelSelection = getActiveModel()
  renderModelManagementPage()
  els.gamePage.hidden = true
  els.storyLibraryPage.hidden = true
  els.modelManagementPage.hidden = false
}

function closeModelManagementPage() {
  pendingModelSelection = null
  els.modelManagementPage.hidden = true
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
  abortActiveStream()
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
  story.plotGoal = String(init.plotGoal || '')
  story.physicalConstraints = []
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
      model: getActiveModel(),
      apiKey: getPipelineApiKey(),
      apiKeys: getPipelineApiKeys(),
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
  return options.slice(0, 3).map(option => {
    if (typeof option === 'string') {
      return { inputText: option }
    }
    const inputText = String(option?.inputText || option?.label || option?.description || '').trim()
    return {
      inputText,
    }
  }).filter(option => option.inputText)
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
    state.model = getActiveModel()
    localStorage.setItem(storageKey, JSON.stringify(appState))
    render()
  } catch (error) {
    alert(`读取存档失败：${error.message}`)
  }
}

function saveSlotDefaultName() {
  return `${state.name || '未命名故事'} - 第${completedAssistantTurnCount()}轮 - ${formatSaveTimestamp(new Date())}`
}

function formatSaveTimestamp(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function saveCurrentSlot() {
  const defaultName = saveSlotDefaultName()
  const name = prompt('存档名', defaultName)
  if (name === null) return
  const trimmedName = name.trim() || defaultName
  saveState()
  const response = await fetch('/api/save-slots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: trimmedName,
      storyName: state.name,
      turnIndex: completedAssistantTurnCount(),
      state: { story: deepClone(state) },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    alert(payload.error || '保存失败。')
    return
  }
  alert(`已保存：${payload.slot?.name || trimmedName}`)
}

async function openSaveSlotsDialog() {
  els.saveSlotsDialog.showModal()
  await refreshSaveSlots()
}

async function refreshSaveSlots() {
  els.saveSlotsStatus.textContent = '读取中。'
  els.saveSlotsStatus.dataset.tone = 'running'
  try {
    const response = await fetch('/api/save-slots')
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || '读取失败')
    renderSaveSlots(payload.slots || [])
    els.saveSlotsStatus.textContent = payload.slots?.length ? `共 ${payload.slots.length} 个存档。` : '暂无手动存档。'
    els.saveSlotsStatus.dataset.tone = payload.slots?.length ? 'done' : ''
  } catch (error) {
    els.saveSlotsList.innerHTML = ''
    els.saveSlotsStatus.textContent = `读取失败：${error.message}`
    els.saveSlotsStatus.dataset.tone = 'error'
  }
}

function renderSaveSlots(slots) {
  els.saveSlotsList.innerHTML = slots.length ? slots.map(slot => `
    <article class="save-slot-item">
      <div>
        <strong>${slot.favorite ? '★ ' : ''}${escapeHtml(slot.name)}</strong>
        <p>${escapeHtml(slot.storyName || '未命名故事')} · 第 ${Number(slot.turnIndex || 0)} 轮 · ${escapeHtml(slot.savedAt || '')}</p>
      </div>
      <div class="save-slot-actions">
        <button type="button" class="ghost-button" data-action="load" data-id="${escapeAttr(slot.id)}">读取</button>
        <button type="button" class="ghost-button" data-action="favorite" data-id="${escapeAttr(slot.id)}" data-favorite="${slot.favorite ? 'true' : 'false'}">${slot.favorite ? '取消收藏' : '收藏'}</button>
        <button type="button" class="ghost-button" data-action="delete" data-id="${escapeAttr(slot.id)}" data-name="${escapeAttr(slot.name)}">删除</button>
      </div>
    </article>
  `).join('') : '<div class="empty-state"><strong>暂无存档</strong><span>点击“保存游戏”创建一个手动存档。</span></div>'
}

async function loadSaveSlot(id) {
  try {
    abortActiveStream()
    const response = await fetch(`/api/save-slots/${encodeURIComponent(id)}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || '读取失败')
    const savedStory = payload.slot?.state?.story || payload.slot?.state
    if (!savedStory || typeof savedStory !== 'object') throw new Error('存档内容无效。')
    const loadedStory = normalizeStory(savedStory, payload.slot?.name || '读取存档')
    appState.stories = appState.stories.filter(story => story.id !== loadedStory.id)
    appState.stories.push(loadedStory)
    appState.currentStoryId = loadedStory.id
    state = getCurrentStory()
    saveState()
    els.saveSlotsDialog.close()
    render()
  } catch (error) {
    els.saveSlotsStatus.textContent = `读取失败：${error.message}`
    els.saveSlotsStatus.dataset.tone = 'error'
  }
}

async function toggleSaveSlotFavorite(id, favorite) {
  const response = await fetch(`/api/save-slots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ favorite }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    els.saveSlotsStatus.textContent = payload.error || '更新失败。'
    els.saveSlotsStatus.dataset.tone = 'error'
    return
  }
  await refreshSaveSlots()
}

async function deleteSaveSlot(id, name) {
  if (!confirm(`删除存档“${name}”？`)) return
  const response = await fetch(`/api/save-slots/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    els.saveSlotsStatus.textContent = payload.error || '删除失败。'
    els.saveSlotsStatus.dataset.tone = 'error'
    return
  }
  await refreshSaveSlots()
}

function renderConnection() {
  const model = getActiveModel()
  const provider = providerForModel(model)
  const providerConfig = getProviderConfig(provider)
  const keyState = hasRuntimeApiKey(provider) ? 'key ready' : `no ${providerLabel(provider)} key`
  const pipelineModels = pipelineModelsForSelection(model)
  const route = provider === 'infron' ? ' · sort=throughput' : ''
  els.connectionStatus.textContent = `${providerConfig.baseUrl} · 当前选择 ${modelLabel(model)} · ${providerLabel(provider)} · ${keyState}${route}`
  renderPipelineModelGrid(model, pipelineModels)
  renderTurnStatus()
}

function renderPipelineModelGrid(selectedModel, pipelineModels) {
  if (!els.pipelineModelGrid) return
  const rows = [
    ['导演', 'director'],
    ['叙事', 'narrator'],
    ['后处理', 'postprocess'],
    ['初始化', 'initializer'],
  ]
  els.pipelineModelGrid.innerHTML = rows.map(([label, key]) => {
    const model = normalizeModel(pipelineModels?.[key] || selectedModel)
    const tag = model === selectedModel ? '当前模型' : '旧配置'
    return `
      <div class="pipeline-model-card">
        <span class="pipeline-model-role">${escapeHtml(label)}</span>
        <strong>${escapeHtml(modelLabel(model))}</strong>
        <small>${escapeHtml(providerLabel(providerForModel(model)))} · ${escapeHtml(tag)}</small>
      </div>
    `
  }).join('')
}

function pipelineModelsForSelection(model) {
  const normalized = normalizeModel(model)
  return {
    director: normalized,
    narrator: normalized,
    postprocess: normalized,
    initializer: normalized,
  }
}

async function testCurrentProvider() {
  const model = selectedModelForManagement()
  const provider = selectedProviderForManagement()
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
        reasoningEffort: provider === 'infron' ? getInfronReasoningEffort() : '',
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || '连接测试失败')
    }
    const durationMs = Number(payload.durationMs || Date.now() - startedAt)
    renderModelTestResult({
      type: '连通性',
      provider: providerLabel(provider),
      model: modelLabel(model),
      durationMs,
      ttftMs: '-',
      tps: '-',
      outputTokens: '-',
      reply: '成功',
      ok: true,
    })
    els.connectionStatus.textContent = `${providerLabel(provider)} 可用 · ${modelLabel(model)} · 连通性 ${durationMs}ms`
  } catch (error) {
    renderModelTestResult({
      type: '连通性',
      provider: providerLabel(provider),
      model: modelLabel(model),
      error: error.message,
      ok: false,
    })
    els.connectionStatus.textContent = `${providerLabel(provider)} 不可用 · ${modelLabel(model)} · ${error.message}`
  } finally {
    els.providerTestButton.disabled = false
    els.providerTestButton.textContent = '连通性测试'
  }
}

async function testCurrentProviderSpeed() {
  const model = selectedModelForManagement()
  const provider = selectedProviderForManagement()
  els.providerSpeedTestButton.disabled = true
  els.providerSpeedTestButton.textContent = '测速中'
  els.connectionStatus.textContent = `${providerLabel(provider)} 速度测试中 · ${modelLabel(model)}`
  try {
    const response = await fetch('/api/provider-speed-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        apiKey: getLocalApiKey(provider),
        reasoningEffort: provider === 'infron' ? getInfronReasoningEffort() : '',
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || '速度测试失败')
    }
    const outputTokens = Number(payload.usage?.outputTokens || payload.usage?.estimatedOutputTokens || 0)
    renderModelTestResult({
      type: '速度',
      provider: providerLabel(provider),
      model: modelLabel(model),
      durationMs: Number(payload.durationMs || 0),
      ttftMs: Number(payload.ttftMs || 0),
      tps: Number(payload.tps || 0),
      outputTokens,
      reply: String(payload.reply || '').slice(0, 40),
      ok: true,
    })
    els.connectionStatus.textContent = `${providerLabel(provider)} 速度测试完成 · ${modelLabel(model)} · TTFT ${Number(payload.ttftMs || 0)}ms · TPS ${Number(payload.tps || 0)}`
  } catch (error) {
    renderModelTestResult({
      type: '速度',
      provider: providerLabel(provider),
      model: modelLabel(model),
      error: error.message,
      ok: false,
    })
    els.connectionStatus.textContent = `${providerLabel(provider)} 速度测试失败 · ${modelLabel(model)} · ${error.message}`
  } finally {
    els.providerSpeedTestButton.disabled = false
    els.providerSpeedTestButton.textContent = '速度测试'
  }
}

function latestPlayerInputForInterception() {
  const typed = String(els.playerInput.value || '').trim()
  if (typed) return typed
  const recoveryInput = String(state.debug?.postprocessRecoveryBase?.playerInput || '').trim()
  if (recoveryInput) return recoveryInput
  const messages = Array.isArray(state.messages) ? state.messages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return String(messages[index].content || '').trim()
  }
  return '内容拦截测试：使用当前存档状态生成 Narrator prompt。'
}

function isSyntheticPromptInput(value) {
  return String(value || '').trim() === '内容拦截测试：使用当前存档状态生成 Narrator prompt。'
}

function latestPlayerInputForPromptPreview() {
  const typed = String(els.playerInput.value || '').trim()
  if (typed && !isSyntheticPromptInput(typed)) return typed
  const recoveryInput = String(state.debug?.postprocessRecoveryBase?.playerInput || '').trim()
  if (recoveryInput && !isSyntheticPromptInput(recoveryInput)) return recoveryInput
  const messages = Array.isArray(state.messages) ? state.messages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      const content = String(messages[index].content || '').trim()
      if (content && !isSyntheticPromptInput(content)) return content
    }
  }
  return ''
}

function buildInterceptionRequestPayload() {
  const payload = buildGenerateRequestPayload(latestPlayerInputForInterception())
  delete payload.apiKey
  delete payload.apiKeys
  return {
    ...payload,
    director: state.debug?.director || {},
  }
}

function buildPromptPreviewRequestPayload() {
  const payload = buildGenerateRequestPayload(latestPlayerInputForPromptPreview())
  delete payload.apiKey
  delete payload.apiKeys
  payload.recentTurns = Array.isArray(payload.recentTurns)
    ? payload.recentTurns.filter(turn => !isSyntheticPromptInput(turn?.content))
    : []
  return {
    ...payload,
    director: state.debug?.director || {},
    finalText: latestAssistantTextForPromptPreview(),
  }
}

function latestAssistantTextForPromptPreview() {
  const messages = Array.isArray(state.messages) ? state.messages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') return String(messages[index].content || '')
  }
  return ''
}

async function openPromptPreview() {
  els.promptPreviewDialog.showModal()
  els.promptPreviewStatus.textContent = '正在拼接当前全部任务 prompt...'
  els.promptPreviewList.innerHTML = ''
  try {
    const response = await fetch('/api/prompt-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPromptPreviewRequestPayload()),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Prompt 预览生成失败')
    renderPromptPreview(payload)
  } catch (error) {
    els.promptPreviewStatus.textContent = error.message
    els.promptPreviewList.innerHTML = ''
  }
}

function renderPromptPreview(payload) {
  const prompts = Array.isArray(payload.prompts) ? payload.prompts : []
  els.promptPreviewStatus.textContent = `模型：${modelLabel(payload.model || state.model)}；共 ${prompts.length} 个任务。`
  els.promptPreviewList.innerHTML = prompts.map(item => `
    <section class="prompt-preview-item">
      <div class="prompt-preview-title">
        <strong>${escapeHtml(item.task || 'Task')}</strong>
        <span>${escapeHtml(item.model || '')}</span>
        <small>${Number(item.userLength || 0)} 字</small>
      </div>
      <label>
        <span>prompt</span>
        <textarea readonly spellcheck="false">${escapeHtml(item.user || '')}</textarea>
      </label>
    </section>
  `).join('')
}

async function buildCurrentInterceptionPrompt() {
  els.buildInterceptionPromptButton.disabled = true
  els.interceptionStatus.textContent = '正在拼接当前 Narrator prompt...'
  els.interceptionStatus.dataset.tone = ''
  try {
    const response = await fetch('/api/content-interception/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInterceptionRequestPayload()),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) throw new Error(payload.error || '生成测试 prompt 失败')
    interceptionPromptSnapshot = payload
    els.interceptionStatus.textContent = `已落盘：${payload.file}；可读版：${payload.textFile}；System ${payload.systemLength} 字，User ${payload.userLength} 字。`
    els.interceptionResultOutput.value = ''
  } catch (error) {
    interceptionPromptSnapshot = null
    els.interceptionStatus.textContent = error.message
    els.interceptionStatus.dataset.tone = 'error'
  } finally {
    els.buildInterceptionPromptButton.disabled = false
  }
}

async function loadInterceptionInstructionFiles() {
  const files = Array.from(els.interceptionInstructionFiles.files || [])
  if (files.length === 0) return
  const parts = []
  for (const file of files) {
    const text = await file.text()
    parts.push(`# ${file.name}\n\n${text}`)
  }
  els.interceptionSystemInput.value = parts.join('\n\n---\n\n')
  els.interceptionStatus.textContent = `已拼接系统指令文件：${files.map(file => file.name).join('、')}`
  els.interceptionStatus.dataset.tone = ''
}

async function loadInterceptionPromptFile() {
  const file = els.interceptionPromptFile.files?.[0]
  if (!file) return
  const text = await file.text()
  interceptionPromptSnapshot = {
    source: 'file',
    fileName: file.name,
    narratorSystem: '',
    narratorUser: text,
    systemLength: 0,
    userLength: text.length,
  }
  els.interceptionResultOutput.value = ''
  els.interceptionStatus.textContent = `已选择 Prompt 文件：${file.name}；${text.length} 字。`
  els.interceptionStatus.dataset.tone = ''
}

async function runContentInterceptionTest() {
  if (!interceptionPromptSnapshot) {
    await buildCurrentInterceptionPrompt()
    if (!interceptionPromptSnapshot) return
  }
  const model = selectedModelForManagement()
  const provider = selectedProviderForManagement()
  els.runInterceptionTestButton.disabled = true
  els.interceptionStatus.textContent = `${providerLabel(provider)} 内容拦截测试中 · ${modelLabel(model)}`
  els.interceptionStatus.dataset.tone = ''
  try {
    const response = await fetch('/api/content-interception/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        apiKey: getLocalApiKey(provider),
        temperature: Number(els.temperatureInput.value || 0.8),
        reasoningEffort: provider === 'infron' ? getInfronReasoningEffort() : '',
        systemInstruction: els.interceptionSystemInput.value,
        narratorSystem: interceptionPromptSnapshot.narratorSystem,
        narratorUser: interceptionPromptSnapshot.narratorUser,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '内容拦截测试失败')
    if (payload.ok) {
      els.interceptionResultOutput.value = String(payload.raw || '')
      els.interceptionStatus.textContent = `测试完成：${payload.responseFile}；请求：${payload.requestFile}；${payload.durationMs}ms · TTFT ${payload.ttftMs}ms · TPS ${payload.tps}`
    } else {
      els.interceptionResultOutput.value = String(payload.error || '')
      els.interceptionStatus.textContent = `模型报错/拦截：${payload.errorFile}；请求：${payload.requestFile}`
      els.interceptionStatus.dataset.tone = 'error'
    }
  } catch (error) {
    els.interceptionResultOutput.value = error.message
    els.interceptionStatus.textContent = error.message
    els.interceptionStatus.dataset.tone = 'error'
  } finally {
    els.runInterceptionTestButton.disabled = false
  }
}

function renderModelTestResult(result) {
  if (!els.modelTestResults) return
  const row = result.ok
    ? `<tr><td>${escapeHtml(result.type || '测试')}</td><td>${escapeHtml(result.provider)}</td><td>${escapeHtml(result.model)}</td><td>${result.durationMs}</td><td>${result.ttftMs}</td><td>${result.tps}</td><td>${result.outputTokens}</td><td>${escapeHtml(result.reply)}</td></tr>`
    : `<tr><td>${escapeHtml(result.type || '测试')}</td><td>${escapeHtml(result.provider)}</td><td>${escapeHtml(result.model)}</td><td colspan="5">${escapeHtml(result.error)}</td></tr>`
  const existing = els.modelTestResults.querySelector('tbody')?.innerHTML || ''
  els.modelTestResults.innerHTML = `
    <table>
      <thead><tr><th>类型</th><th>Provider</th><th>Model</th><th>耗时(ms)</th><th>TTFT(ms)</th><th>TPS</th><th>输出</th><th>返回</th></tr></thead>
      <tbody>${row}${existing}</tbody>
    </table>
  `
}

function openDirectorControl() {
  els.directorPlotGoalInput.value = state.plotGoal || ''
  els.directorControlDialog.showModal()
}

function saveDirectorControl() {
  state.plotGoal = els.directorPlotGoalInput.value.trim()
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
  return providerForModel(getActiveModel())
}

function getProviderConfig(provider) {
  if (config.providers?.[provider]) return config.providers[provider]
  if (provider === 'fireworks') return { baseUrl: 'https://api.fireworks.ai/inference/v1', hasApiKey: false }
  if (provider === 'infron') return { baseUrl: 'https://llm.onerouter.pro/v1', hasApiKey: false, providerSort: 'throughput' }
  if (provider === 'cerebras') return { baseUrl: 'https://api.cerebras.ai/v1', hasApiKey: false }
  if (provider === 'google-ai-studio') return { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', hasApiKey: false }
  return { baseUrl: config.baseUrl || 'https://api.deepseek.com', hasApiKey: config.hasApiKey }
}

function apiKeyStorageKeyForProvider(provider) {
  if (provider === 'fireworks') return fireworksApiKeyStorageKey
  if (provider === 'infron') return infronApiKeyStorageKey
  if (provider === 'cerebras') return cerebrasApiKeyStorageKey
  if (provider === 'google-ai-studio') return googleAiStudioApiKeyStorageKey
  return deepSeekApiKeyStorageKey
}

function getLocalApiKey(provider = currentProvider()) {
  return localStorage.getItem(apiKeyStorageKeyForProvider(provider)) || ''
}

function getPipelineApiKey() {
  return getLocalApiKey(currentProvider())
}

function getPipelineApiKeys() {
  return {
    deepseek: getLocalApiKey('deepseek'),
    fireworks: getLocalApiKey('fireworks'),
    infron: getLocalApiKey('infron'),
    cerebras: getLocalApiKey('cerebras'),
    'google-ai-studio': getLocalApiKey('google-ai-studio'),
  }
}

function selectedModelForManagement() {
  return normalizeModel(pendingModelSelection || getActiveModel())
}

function selectedProviderForManagement() {
  return providerForModel(selectedModelForManagement())
}

async function applyModelSelection() {
  const model = selectedModelForManagement()
  setPreferredModel(model)
  els.applyModelSelectionButton.disabled = true
  els.modelManagementStatus.textContent = `正在保存：${modelLabel(model)}`
  els.modelManagementStatus.dataset.tone = ''
  try {
    pendingModelSelection = null
    saveState()
    renderModelManagementPage()
    renderConnection()
    els.modelManagementStatus.textContent = `已应用：${modelLabel(model)}`
    els.modelManagementStatus.dataset.tone = 'done'
  } catch (error) {
    els.modelManagementStatus.textContent = error.message
    els.modelManagementStatus.dataset.tone = 'error'
    renderModelManagementPage()
  }
}

function getRequestReasoningEffort() {
  return currentProvider() === 'infron' ? getInfronReasoningEffort() : ''
}

function hasRuntimeApiKey(provider = currentProvider()) {
  return Boolean(getLocalApiKey(provider) || getProviderConfig(provider).hasApiKey)
}

function renderModelManagementPage() {
  const model = selectedModelForManagement()
  const provider = selectedProviderForManagement()
  const appliedModel = getActiveModel()
  els.providerSelect.value = provider
  els.modelSelect.innerHTML = modelsForProvider(provider).map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(modelLabel(item.id))}</option>`).join('')
  els.modelSelect.value = model
  els.infronReasoningSelect.value = getInfronReasoningEffort()
  els.infronReasoningSelect.disabled = provider !== 'infron'
  const helpByProvider = {
    fireworks: `当前模型：${modelLabel(model)}。请填写 Fireworks API key，Key 只保存在当前浏览器本地。`,
    infron: `当前模型：${modelLabel(model)}。请填写 Infron API key；请求会按 throughput 排序路由。Key 只保存在当前浏览器本地。`,
    cerebras: `当前模型：${modelLabel(model)}。请填写 Cerebras API key，Key 只保存在当前浏览器本地。`,
    'google-ai-studio': `当前模型：${modelLabel(model)}。请填写 Google AI Studio / Gemini API key，Key 只保存在当前浏览器本地。`,
    deepseek: `当前模型：${modelLabel(model)}。请填写 DeepSeek API key，Key 只保存在当前浏览器本地。`,
  }
  els.apiKeyHelp.textContent = helpByProvider[provider] || helpByProvider.deepseek
  els.apiKeyLabel.textContent = provider === 'fireworks' ? 'Fireworks Key' : provider === 'infron' ? 'Infron Key' : provider === 'cerebras' ? 'Cerebras Key' : provider === 'google-ai-studio' ? 'Gemini Key' : 'DeepSeek Key'
  els.apiKeyInput.placeholder = provider === 'fireworks' ? 'FIREWORKS_API_KEY' : provider === 'infron' ? 'INFRON_API_KEY' : provider === 'cerebras' ? 'CEREBRAS_API_KEY' : provider === 'google-ai-studio' ? 'GEMINI_API_KEY' : 'sk-...'
  els.apiKeyInput.value = getLocalApiKey(provider)
  document.querySelectorAll('[data-provider-model]').forEach(button => {
    button.classList.toggle('selected', providerForModel(button.dataset.providerModel) === provider)
  })
  const hasPendingChange = model !== appliedModel
  els.applyModelSelectionButton.disabled = !hasPendingChange
  const reasoningLabel = provider === 'infron' ? ` · reasoning ${getInfronReasoningEffort() || 'default'}` : ''
  const pendingLabel = hasPendingChange ? '待确定' : '已应用'
  els.modelManagementStatus.textContent = `${providerLabel(provider)} · ${modelLabel(model)} · ${pendingLabel}${reasoningLabel} · ${hasRuntimeApiKey(provider) ? 'Key ready' : 'No key'}`
  els.modelManagementStatus.dataset.tone = ''
}

function renderStatusPanel() {
  if (!state.statusRoster?.length) {
    els.statusPanelView.innerHTML = '<p class="meta no-indent">人物状态为空</p>'
    return
  }
  els.statusPanelView.innerHTML = `<pre class="status-json">${escapeHtml(JSON.stringify(state.statusState || {}, null, 2))}</pre>`
}

function renderStoryTracking() {
  const summary = state.chapterSummary || deriveGlobalContextBlock('summary')
  els.storyTrackingView.innerHTML = `
    ${renderTrackerSection('历史总结', formatHistoricalSummaryForTracker(summary) || '暂无历史总结。')}
    ${renderTrackerSection('故事风格', formatStoryStyleForTracker() || '暂无故事风格。')}
    ${renderTrackerSection('当前剧情目标', state.plotGoal || '暂无当前剧情目标。')}
    ${renderFeedbackMemory() ? renderTrackerSection('上轮反重复提醒', renderFeedbackMemory()) : ''}
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
    <button class="option-button" type="button" data-option-input="${escapeAttr(option.inputText || '')}">
      <span>${escapeHtml(option.inputText || '')}</span>
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
  els.regenerateButton.disabled = generationBusy || !hasSnapshot
  els.regenerateButton.title = hasSnapshot
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

function renderRollbackTurnButton() {
  const canRollback = Boolean(normalizeTurnSnapshot(state.lastTurnSnapshot))
  els.rollbackTurnButton.disabled = generationBusy || !canRollback
  els.rollbackTurnButton.title = canRollback
    ? '撤销上一轮，恢复到发送前；只能连续回退一轮。'
    : '没有可回退的上一轮。'
}

function nextAssistantTurnIndex() {
  return completedAssistantTurnCount() + 1
}

function completedAssistantTurnCount() {
  return state.messages.filter(message => message.role === 'assistant').length
}

function normalizePostprocessJob(value) {
  if (!value || typeof value !== 'object') return null
  const playerInput = String(value.playerInput || '').trim()
  const finalText = String(value.finalText || '').trim()
  if (!playerInput || !finalText) return null
  return {
    ...deepClone(value),
    id: String(value.id || makeId('postprocess-job')),
    status: ['queued', 'running', 'error'].includes(value.status) ? value.status : 'queued',
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
  }
}

function enqueuePostprocessJob(job) {
  const normalized = normalizePostprocessJob(job)
  if (!normalized) return
  state.postprocessQueue = Array.isArray(state.postprocessQueue) ? state.postprocessQueue : []
  if (!state.postprocessQueue.some(item => item.id === normalized.id)) state.postprocessQueue.push(normalized)
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
  const recovery = state.debug?.postprocessRecoveryBase
  const director = state.debug?.director
  const snapshot = getRegenerationSnapshot()
  if (state.debug?.status === 'error' && recovery?.playerInput && snapshot?.playerInput) {
    restoreTurnSnapshot(snapshot)
    await generateTurn(recovery.playerInput, {
      snapshot,
      modeLabel: 'continuing',
      playerFeedback: recovery.playerFeedback || snapshot.playerFeedback || '',
      requestPayload: {
        ...recovery,
        director: director && typeof director === 'object' ? director : recovery.director,
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        reasoningEffort: getRequestReasoningEffort(),
        model: getActiveModel(),
      },
    })
    return
  }
  if (state.debug?.status === 'error' && snapshot?.playerInput) {
    restoreTurnSnapshot(snapshot)
    await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'continuing', playerFeedback: snapshot.playerFeedback || '' })
    return
  }
  alert('没有可继续的未完成阶段。')
}

function rollbackUnfinishedTurn() {
  const snapshot = normalizeTurnSnapshot(state.lastTurnSnapshot)
  if (!snapshot) {
    alert('没有可回退的上一轮。')
    return
  }
  restoreTurnSnapshot(snapshot)
  state.lastTurnSnapshot = null
  state.debug = {
    ...(state.debug || {}),
    status: 'rolled_back',
    note: '已回退到上一轮发送前；本次回退快照已清空，不能继续向前回退。',
    error: '',
  }
  els.playerInput.value = snapshot.playerInput || ''
  els.playerFeedback.value = snapshot.playerFeedback || state.playerFeedback || ''
  saveState()
  render()
}

function getPendingPostprocess() {
  const queuedError = Array.isArray(state.postprocessQueue) ? state.postprocessQueue.find(item => item?.status === 'error') : null
  if (queuedError) return queuedError
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
    storyId: state.id,
    storyName: state.name,
    playerInput,
    finalText,
    director: state.debug?.director || {},
    recentTurns: messages
      .slice(Math.max(0, assistantIndex - 10), assistantIndex)
      .filter(message => message.role === 'user' || message.role === 'assistant'),
    characters: state.characters,
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    playerOptions: state.playerOptions,
    physicalConstraints: state.physicalConstraints,
    plotGoal: state.plotGoal,
    playerFeedback: state.debug?.postprocessRecoveryBase?.playerFeedback || '',
    feedbackText: renderFeedbackMemory(),
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: completedAssistantTurnCount(),
    model: getActiveModel(),
    temperature: Number(els.temperatureInput.value || 0.8),
    createdAt: new Date().toISOString(),
  }
}

async function retryPendingPostprocess(pending) {
  const streamController = beginActiveStream()
  setBusy(true)
  state.debug.status = '重试 Postprocess'
  state.debug.error = ''
  state.debug.note = '正在重试上一轮未完成的 Postprocess；完成后会补上状态、总结和反重复提醒。'
  render()

  try {
    const response = await fetch('/api/postprocess-stream', {
      method: 'POST',
      signal: streamController.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...pending,
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        model: getActiveModel(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Postprocess 重试失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('Postprocess 重试失败：没有收到最终结果。')

    removeTrailingErrorMessages()
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : state.playerOptions
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingPostprocess = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
    state.debug.postprocess = payload.postprocess
    if (pending.id) state.postprocessQueue = (state.postprocessQueue || []).filter(item => item.id !== pending.id)
    setPreferredModel(payload.model || getActiveModel())
    applyPostprocess(payload)
    persistPostprocessResult()
  } catch (error) {
    if (streamController.signal.aborted) return
    state.debug.status = 'error'
    state.debug.postprocessPending = true
    state.debug.error = error.message
    state.debug.note = 'Postprocess 仍未完成。可再次点击“继续未完成”。'
    if (pending.id) {
      const queued = (state.postprocessQueue || []).find(item => item.id === pending.id)
      if (queued) {
        queued.status = 'error'
        queued.error = error.message
        queued.updatedAt = new Date().toISOString()
      }
    }
    persistAndRender()
  } finally {
    const shouldClearBusy = activeStreamController === streamController || !activeStreamController
    finishActiveStream(streamController)
    if (shouldClearBusy) setBusy(false)
  }
}

async function processPostprocessQueue() {
  if (postprocessQueueRunning) return
  state.postprocessQueue = Array.isArray(state.postprocessQueue) ? state.postprocessQueue : []
  const job = state.postprocessQueue.find(item => item?.status === 'queued' || item?.status === 'error')
  if (!job) return
  postprocessQueueRunning = true
  job.status = 'running'
  job.updatedAt = new Date().toISOString()
  state.debug = {
    ...(state.debug || {}),
    postprocessPending: false,
    pendingPostprocess: null,
    note: 'Postprocess 队列正在后台更新总结、状态和反重复提醒；不阻塞下一轮输入。',
  }
  saveState()
  renderPostprocessSideEffects()

  try {
    const response = await fetch('/api/postprocess-stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...job,
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        model: getActiveModel(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Postprocess 队列任务失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('Postprocess 队列任务失败：没有收到最终结果。')
    state.postprocessQueue = state.postprocessQueue.filter(item => item.id !== job.id)
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : state.playerOptions
    state.debug.postprocess = payload.postprocess
    state.debug.postprocessPending = false
    state.debug.pendingPostprocess = null
    state.debug.note = 'Postprocess 队列已完成一个任务。'
    setPreferredModel(payload.model || getActiveModel())
    applyPostprocess(payload)
    persistPostprocessResult()
  } catch (error) {
    job.status = 'error'
    job.error = error.message
    job.updatedAt = new Date().toISOString()
    state.debug.postprocessPending = true
    state.debug.pendingPostprocess = job
    state.debug.note = 'Postprocess 队列任务失败；可点击“继续未完成”重试，不影响继续游戏。'
    state.debug.error = error.message
    saveState()
    renderPostprocessSideEffects()
  } finally {
    postprocessQueueRunning = false
    if (state.postprocessQueue?.some(item => item?.status === 'queued')) processPostprocessQueue()
  }
}

async function generateTurn(playerInput, { snapshot, modeLabel = 'running', playerFeedback = '', requestPayload = null } = {}) {
  const streamController = beginActiveStream()
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
    pipelineMode: 'narrator+postprocess-queued',
    note: modeLabel === 'regenerating'
      ? '正在回滚并重新生成本次对话；会使用当前模型和配置完整重跑。'
      : modeLabel === 'continuing'
        ? '继续未完成：按当前状态重新执行未完成流程。'
        : 'Narrator 正文会直接显示；Postprocess 进入独立队列，不阻塞下一轮输入。',
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
    const effectiveRequestPayload = requestPayload || buildGenerateRequestPayload(playerInput)
    const requestModel = normalizeModel(effectiveRequestPayload.model || getActiveModel())
    setPreferredModel(requestModel)
    state.debug.postprocessRecoveryBase = sanitizePostprocessRecoveryBase(effectiveRequestPayload)
    const response = await fetch('/api/generate-stream', {
      method: 'POST',
      signal: streamController.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(effectiveRequestPayload),
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
    state.physicalConstraints = normalizePhysicalConstraints(payload.physicalConstraints || state.physicalConstraints)
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingPostprocess = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode
    state.debug.director = payload.director
    state.debug.narrator = payload.narrator
    state.debug.postprocess = null
    setPreferredModel(payload.model || requestModel)
    enqueuePostprocessJob(payload.pendingPostprocess)
    saveState()
    render()
    processPostprocessQueue()
  } catch (error) {
    if (streamController.signal.aborted) return
    state.debug.status = 'error'
    state.debug.error = error.message
    markRunningPipelineStageError(error.message)
    if (state.debug.visibleTextShown && state.debug.postprocessPending) {
      state.debug.note = '正文已显示，但 Postprocess 未完成。点击“继续未完成”补上状态、总结和反重复提醒。'
    } else {
      state.messages.push({ role: 'error', content: error.message })
    }
    persistAndRender()
  } finally {
    const shouldClearBusy = activeStreamController === streamController || !activeStreamController
    finishActiveStream(streamController)
    if (shouldClearBusy) setBusy(false)
  }
}

function buildGenerateRequestPayload(playerInput) {
  return {
    storyId: state.id,
    storyName: state.name,
    playerInput,
    playerFeedback: state.playerFeedback,
    storyContext: buildStoryContextForRequest(),
    globalContext: state.globalContext,
    feedbackText: renderFeedbackMemory(),
    physicalConstraints: state.physicalConstraints,
    plotGoal: state.plotGoal,
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: nextAssistantTurnIndex(),
    recentTurns: buildRecentTurnsForRequest(playerInput),
    characters: state.characters,
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    model: getActiveModel(),
    apiKey: getPipelineApiKey(),
    apiKeys: getPipelineApiKeys(),
    temperature: Number(els.temperatureInput.value || 0.8),
    reasoningEffort: getRequestReasoningEffort(),
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
  return withOpening.slice(-11)
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
  state.model = getActiveModel()
}

function sanitizePostprocessRecoveryBase(payload) {
  const { apiKey, apiKeys, ...safePayload } = payload
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
    'plotGoal',
    'physicalConstraints',
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
    if (event.json) state.debug[stage] = event.json
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
  state.debug.postprocessPending = false
  state.debug.pendingPostprocess = null
  state.debug.status = '生成中'
  state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
  state.debug.note = '正文已显示；Postprocess 会进入独立队列，不阻塞下一轮输入。'

  renderConversation({ scrollTarget: 'latest-assistant-start' })
  renderOptions()
  renderReadingJumpControls()
  renderDebug()
  renderRetryStageButton()
  renderRollbackTurnButton()
  renderRegenerateButton()
  els.sendButton.textContent = '发送'
  els.regenerateButton.textContent = '重新生成本次对话'
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
  if (typeof payload.plotGoal === 'string') state.plotGoal = payload.plotGoal.trim()
  state.physicalConstraints = normalizePhysicalConstraints(payload.physicalConstraints || state.physicalConstraints)
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
  const canRollback = Boolean(normalizeTurnSnapshot(state.lastTurnSnapshot))
  els.sendButton.disabled = isBusy
  els.retryStageButton.disabled = isBusy || (!postprocessPending && !canContinueGeneration)
  els.rollbackTurnButton.disabled = isBusy || !canRollback
  els.regenerateButton.disabled = isBusy || !getRegenerationSnapshot()
  els.sendButton.textContent = isBusy
    ? '生成中'
    : '发送'
  els.retryStageButton.textContent = isBusy && postprocessPending ? '继续中' : '继续未完成'
  els.rollbackTurnButton.textContent = '回退上一轮'
  els.regenerateButton.textContent = isBusy
    ? '生成中'
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
      apiKey: getPipelineApiKey(),
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
  renderRollbackTurnButton()
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
