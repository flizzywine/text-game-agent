const storageKey = 'text-game-agent.web-state.v2'
const legacyStorageKey = 'text-game-agent.web-state.v1'
const deepSeekApiKeyStorageKey = 'text-game-agent.deepseek-api-key'
const infronApiKeyStorageKey = 'text-game-agent.infron-api-key'
const preferredModelStorageKey = 'text-game-agent.preferred-model'
const preferredModelVersionStorageKey = 'text-game-agent.preferred-model-version'
const officialDeepSeekV4ProModel = 'deepseek-v4-pro'
const officialDeepSeekV4FlashModel = 'deepseek-v4-flash'
const infronGemini31FlashLiteModel = 'google/gemini-3.1-flash-lite'
const defaultModel = officialDeepSeekV4FlashModel
const defaultModelVersion = 'official-deepseek-v4-flash'
const defaultTemperature = 0.8
const novelImportCharacterLimit = 20_000
const providerOptions = ['deepseek', 'infron']
const providerKeyStorageKeys = {
  deepseek: deepSeekApiKeyStorageKey,
  infron: infronApiKeyStorageKey,
}
const modelCatalog = [
  { id: officialDeepSeekV4FlashModel, provider: 'deepseek', label: 'DeepSeek V4 Flash | official | DeepSeek' },
  { id: officialDeepSeekV4ProModel, provider: 'deepseek', label: 'DeepSeek V4 Pro | official | DeepSeek' },
  { id: infronGemini31FlashLiteModel, provider: 'infron', label: 'Gemini 3.1 Flash Lite | Infron' },
]
const modelOptions = new Set(modelCatalog.map(item => item.id))
const pipelineStages = ['initializer', 'director', 'narrator', 'optionStrategist', 'summary']
const pipelineStageLabels = {
  initializer: '初始化',
  director: '导演',
  narrator: '叙事者',
  optionStrategist: '选项策略',
  summary: 'Summary',
}
const fallbackGenerationPipeline = {
  mode: 'director-audit+narrator+option-strategist+summary-queued+recall-worker',
  note: 'Director 输出计划和审查；Narrator 输出正文；OptionStrategist 生成战略候选项；Summary 后台更新总结和状态；RecallWorker 旁路选择旧轮次并预取最多两轮正文。',
  stages: [
    { stage: 'director', label: 'Director' },
    { stage: 'narrator', label: 'Narrator' },
    { stage: 'optionStrategist', label: 'OptionStrategist' },
    { stage: 'postprocessSummary', label: 'Summary' },
  ],
}
const narrativePerspectiveOptions = new Set(['third_person'])
const requiredStatusSchema = ['性别', '身份', '外貌', '性格', '情绪', '姿势']
const fallbackStatusSchema = ['性别', '身份', '外貌', '性格', '情绪', '姿势', '位置']

const appState = loadAppState()
let state = getCurrentStory()
let storyLibraryAssets = []
let selectedNewGameAssetId = ''
let selectedLibraryAssetId = ''
let generationBusy = false
let persistController = null
let activeStreamController = null
let postprocessQueueRunning = false
let pendingModelSelection = null
let pendingPipelineModelSelection = null
let pendingApiKeyProviderSelection = 'deepseek'
let pendingNarrativePerspectiveSelection = null
let storyInitializationTimer = null
let pipelineDebugTimer = null
let recallWorkerPollTimer = null
let recallWorkerPollDeadlineMs = 0
let lastRecallWorkerEventId = ''
let conversationAutoScrollSuppressed = false
let programmaticConversationScrollUntil = 0
const openingSummaryBackfillInFlight = new Set()
let config = {
  model: defaultModel,
  baseUrl: 'https://api.deepseek.com',
  hasApiKey: false,
  providers: {
    deepseek: { baseUrl: 'https://api.deepseek.com', hasApiKey: false },
    infron: { baseUrl: 'https://llm.onerouter.pro/v1', hasApiKey: false },
  },
  pipelines: {
    generation: fallbackGenerationPipeline,
  },
}

const els = {
  connectionStatus: document.querySelector('#connectionStatus'),
  turnStatus: document.querySelector('#turnStatus'),
  modelSelect: document.querySelector('#modelSelect'),
  narrativePerspectiveSelect: document.querySelector('#narrativePerspectiveSelect'),
  pipelineModelSelects: {
    initializer: document.querySelector('#pipelineInitializerModel'),
    director: document.querySelector('#pipelineDirectorModel'),
    narrator: document.querySelector('#pipelineNarratorModel'),
    optionStrategist: document.querySelector('#pipelineOptionStrategistModel'),
    summary: document.querySelector('#pipelineSummaryModel'),
  },
  applyModelSelectionButton: document.querySelector('#applyModelSelectionButton'),
  apiKeyProviderSelect: document.querySelector('#apiKeyProviderSelect'),
  apiKeyButton: document.querySelector('#apiKeyButton'),
  apiKeyHelp: document.querySelector('#apiKeyHelp'),
  apiKeyLabel: document.querySelector('#apiKeyLabel'),
  apiKeyInput: document.querySelector('#apiKeyInput'),
  clearApiKeyButton: document.querySelector('#clearApiKeyButton'),
  modelManagementButton: document.querySelector('#modelManagementButton'),
  modelManagementPage: document.querySelector('#modelManagementPage'),
  closeModelManagementButton: document.querySelector('#closeModelManagementButton'),
  modelManagementStatus: document.querySelector('#modelManagementStatus'),
  storyLibraryButton: document.querySelector('#storyLibraryButton'),
  newStoryButton: document.querySelector('#newStoryButton'),
  saveArchiveButton: document.querySelector('#saveArchiveButton'),
  loadArchiveButton: document.querySelector('#loadArchiveButton'),
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
  newGamePlayerCharacter: document.querySelector('#newGamePlayerCharacter'),
  storyAssetList: document.querySelector('#storyAssetList'),
  newGamePreview: document.querySelector('#newGamePreview'),
  cancelNewGameButton: document.querySelector('#cancelNewGameButton'),
  importStoryAssetButton: document.querySelector('#importStoryAssetButton'),
  initializeStoryAssetButton: document.querySelector('#initializeStoryAssetButton'),
  renameStoryAssetButton: document.querySelector('#renameStoryAssetButton'),
  deleteStoryAssetButton: document.querySelector('#deleteStoryAssetButton'),
  refreshStoryLibraryButton: document.querySelector('#refreshStoryLibraryButton'),
  storyLibraryFileInput: document.querySelector('#storyLibraryFileInput'),
  storyLibraryStatus: document.querySelector('#storyLibraryStatus'),
  libraryAssetList: document.querySelector('#libraryAssetList'),
  libraryPreview: document.querySelector('#libraryPreview'),
  storySettingsForm: document.querySelector('#storySettingsForm'),
  reviseStorySettingsButton: document.querySelector('#reviseStorySettingsButton'),
  applyStorySettingsToCurrentButton: document.querySelector('#applyStorySettingsToCurrentButton'),
  saveStorySettingsButton: document.querySelector('#saveStorySettingsButton'),
  storyProgramConfigInput: document.querySelector('#storyProgramConfigInput'),
  closeStoryLibraryButton: document.querySelector('#closeStoryLibraryButton'),
  jumpTurnStartButton: document.querySelector('#jumpTurnStartButton'),
  jumpLatestButton: document.querySelector('#jumpLatestButton'),
  conversation: document.querySelector('#conversation'),
  optionTray: document.querySelector('#optionTray'),
  playForm: document.querySelector('#playForm'),
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
  await syncPromptVersionState()
  applyLegacyMigrations()
  render()
  processSummaryQueue()
  ensureRecallWorkerForLatestTurn()
}

function defaultStory(name = '未选择故事') {
  const now = new Date().toISOString()
  return {
    id: makeId('story-slot'),
    name,
    createdAt: now,
    updatedAt: now,
    messages: [],
    characters: [],
    openingText: '',
    worldview: '',
    currentSituation: '',
    chapterSummary: '',
    outline: '',
    physicalConstraints: [],
    keyInfo: [],
    longTermState: {},
    directorStyle: '',
    narratorStyle: '',
    plotLines: [],
    feedbackMemory: [],
    directorHistory: [],
    controlledCharacterName: '',
    storyAssetId: '',
    programConfigFile: '',
    statusSchema: fallbackStatusSchema,
    statusRoster: [],
    statusState: {},
    itemState: {},
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
  const controlledCharacterName = normalizeControlledCharacterName(state.controlledCharacterName)
  const perspective = normalizeNarrativePerspective(appState.narrativePerspective)
  const perspectiveText = renderNarrativePerspectiveInstruction(perspective, controlledCharacterName)
  const controlledBlock = controlledCharacterName
    ? `## 当前焦点人物\n${controlledCharacterName}\n玩家不是在控制单一角色，而是在选择整个世界的剧情方向。所有用户输入都只代表未来剧情方向，不是正文素材，不是角色台词、动作或心理；以【剧情方向选择】开头时，去掉前缀后仍按剧情方向处理。当前焦点人物可以随剧情切换。\n\n## 叙事人称\n${perspectiveText}`
    : ''
  return [worldview ? `## 世界观\n${worldview}` : '', controlledBlock].filter(Boolean).join('\n\n')
}

function normalizeNarrativePerspective(value) {
  const perspective = String(value || '').trim()
  return narrativePerspectiveOptions.has(perspective) ? perspective : 'third_person'
}

function narrativePerspectiveLabel(value) {
  return '全知第三人称'
}

function renderNarrativePerspectiveInstruction(value, controlledCharacterName = '') {
  const name = controlledCharacterName || '当前焦点人物'
  return `全知第三人称。正文使用人物名、称谓或“她/他”叙述，不使用“我”。叙述者可以展示每个角色的行动、心理、隐瞒、误判和未说出口的欲望；角色自身仍受知识边界限制，不能因为叙述者全知而知道不该知道的信息。当前焦点可以从“${name}”切换到其他关键人物，但每次切换必须有清楚场景或段落边界。`
}

function defaultAppState() {
  const story = defaultStory()
  return {
    defaultModelVersion,
    promptVersion: '',
    preferredModel: story.model,
    pipelineModels: defaultPipelineModelOverrides(),
    narrativePerspective: 'third_person',
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
    promptVersion: String(raw?.promptVersion || ''),
    preferredModel: normalizePersistedModel(raw?.preferredModel, modelVersion) || readStoredPreferredModel() || normalizePersistedModel(rawCurrentStory?.model, modelVersion) || base.preferredModel || defaultModel,
    pipelineModels: normalizePipelineModelOverrides(raw?.pipelineModels),
    narrativePerspective: normalizeNarrativePerspective(raw?.narrativePerspective),
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
  const openingText = String(raw?.openingText || '')
  const messages = stripOpeningMessages(Array.isArray(raw?.messages) ? raw.messages : [], openingText)
  const existingChapterSummary = cleanHistoricalGlobalContext(String(raw?.chapterSummary || raw?.currentSituation || ''))
  const existingGlobalContext = cleanHistoricalGlobalContext(String(raw?.globalContext || ''))
  const chapterSummary = existingChapterSummary
  const globalContext = existingGlobalContext
  const retiredKeys = [
    'current' + 'Physical' + 'Environment',
    'current' + 'Physical' + 'Environment' + 'Forbidden',
    'normalized' + 'Entries',
    'storybook' + 'Entries',
    'module' + 'Enabled',
    'optional' + 'Disturbance',
    '可选' + '扰动源',
  ]
  retiredKeys.forEach(key => {
    delete rest[key]
  })
  const debug = normalizeDebugState(raw?.debug)
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
    physicalConstraints: normalizePhysicalConstraints(raw?.physicalConstraints),
    keyInfo: normalizeKeyInfo(raw?.keyInfo),
    longTermState: normalizeLongTermState(raw?.longTermState, raw),
    directorStyle: String(raw?.directorStyle || ''),
    narratorStyle: String(raw?.narratorStyle || ''),
    plotLines: Array.isArray(raw?.plotLines) ? raw.plotLines : [],
    feedbackMemory: normalizeFeedbackMemory(raw?.feedbackMemory),
    directorHistory: normalizeDirectorHistory(raw?.directorHistory),
    controlledCharacterName: normalizeControlledCharacterName(raw?.controlledCharacterName),
    storyAssetId: String(raw?.storyAssetId || ''),
    programConfigFile: String(raw?.programConfigFile || ''),
    statusSchema: normalizeStatusSchema(raw?.statusSchema),
    statusRoster: normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []),
    statusState: normalizeStatusState(raw?.statusState, normalizeStatusRoster(raw?.statusRoster, Array.isArray(raw?.characters) ? raw.characters : []), Array.isArray(raw?.characters) ? raw.characters : [], normalizeStatusSchema(raw?.statusSchema)),
    itemState: {},
    globalContext,
    playerOptions: Array.isArray(raw?.playerOptions) ? raw.playerOptions : [],
    postprocessQueue: Array.isArray(raw?.postprocessQueue) ? raw.postprocessQueue.map(normalizeSummaryJob).filter(Boolean) : [],
    model: normalizePersistedModel(raw?.model, modelVersion) || base.model,
    lastTurnSnapshot: normalizeTurnSnapshot(raw?.lastTurnSnapshot),
    debug,
  }
}

function hasRetiredDirectorPlanFields(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false
  return [
    'beat1',
    'beat2',
    'beat3',
    'beats',
    'ending',
    'goalStep',
    'turnIntent',
    'plotStep',
    'plotFrame',
    'writingPlan',
    'narrativeStrategy',
    'pacing',
    'focusLens',
    'languageStyle',
  ].some(key => Object.prototype.hasOwnProperty.call(plan, key))
}

function normalizeDirectorPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null
  if (hasRetiredDirectorPlanFields(plan)) return null
  return deepClone(plan)
}

function normalizeDebugState(debug) {
  if (!debug || typeof debug !== 'object' || Array.isArray(debug)) return {}
  const normalized = { ...debug }
  if (normalized.director) {
    const director = normalizeDirectorPlan(normalized.director)
    if (director) {
      normalized.director = director
    } else {
      delete normalized.director
    }
  }
  return normalized
}

function stripOpeningMessages(messages, openingText) {
  const opening = normalizeOpeningCompareText(openingText)
  if (!opening || !Array.isArray(messages) || messages.length === 0) return messages
  const firstUserIndex = messages.findIndex(message => message?.role === 'user')
  const head = firstUserIndex >= 0 ? messages.slice(0, firstUserIndex) : messages
  if (!head.length || !head.every(message => message?.role === 'assistant')) return messages
  const headText = normalizeOpeningCompareText(head.map(message => message.content).join('\n'))
  if (!headText) return messages
  if (opening.includes(headText) || headText.includes(opening)) return messages.slice(head.length)
  return messages
}

function normalizeOpeningCompareText(value) {
  return String(value || '')
    .replace(/^第0轮[:：]/, '')
    .replace(/\s+/g, '')
    .trim()
}

function openingTurnHistory(openingText) {
  const text = String(openingText || '').trim()
  if (!text) return ''
  return /^第0轮[:：]/.test(text) ? text : `第0轮：${text}`
}

function hasOpeningSummaryLine(summary) {
  const current = String(summary || '').trim()
  return /(^|\n)-?\s*第0轮[:：]/.test(current)
}

function prependOpeningSummary(summary, openingSummary) {
  const current = String(summary || '').trim()
  const text = String(openingSummary || '').trim()
  if (!text || hasOpeningSummaryLine(current)) return current
  return [`- 第0轮：${text}`, current].filter(Boolean).join('\n')
}

function needsOpeningSummaryBackfill(story = state) {
  if (!story) return false
  if (!String(story.openingText || '').trim()) return false
  return !hasOpeningSummaryLine(story.chapterSummary || story.globalContext)
}

async function ensureOpeningSummaryBackfill() {
  const target = state
  if (!needsOpeningSummaryBackfill(target)) return
  if (openingSummaryBackfillInFlight.has(target.id)) return
  openingSummaryBackfillInFlight.add(target.id)
  renderStoryTracking()
  try {
    const openingSummary = await summarizeOpeningTextForHistory(target.openingText, target)
    if (!openingSummary || state.id !== target.id) return
    state.chapterSummary = prependOpeningSummary(state.chapterSummary, openingSummary)
    state.globalContext = prependOpeningSummary(state.globalContext, openingSummary)
    if (!String(state.currentSituation || '').trim() || state.currentSituation === state.openingText) {
      state.currentSituation = openingSummary
    }
    saveState()
    renderStoryTracking()
  } finally {
    openingSummaryBackfillInFlight.delete(target.id)
    if (state.id === target.id) renderStoryTracking()
  }
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
    .slice(-6)
}

function normalizePhysicalConstraints(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : []
  return items
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function normalizeKeyInfo(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? value.split(/\r?\n/) : []
  return [...new Set(items
    .map(item => String(item || '').replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(item => item.length > 120 ? item.slice(0, 120).trim() : item)
  )].slice(0, 8)
}

function normalizeLongTermState(value, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    characterStatus: normalizeStatusState(source.characterStatus || source.人物状态 || fallback.statusState, normalizeStatusRoster(fallback.statusRoster, Array.isArray(fallback.characters) ? fallback.characters : []), Array.isArray(fallback.characters) ? fallback.characters : [], normalizeStatusSchema(fallback.statusSchema)),
    keyInfo: normalizeKeyInfo(source.keyInfo || source.关键信息 || fallback.keyInfo),
    physicalConstraints: normalizePhysicalConstraints(source.physicalConstraints || source.物理约束 || fallback.physicalConstraints),
  }
}

function buildLongTermStateFromState() {
  return normalizeLongTermState(state.longTermState, {
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    keyInfo: state.keyInfo,
    physicalConstraints: state.physicalConstraints,
    characters: state.characters,
  })
}

function buildLongTermStateFromStory(story) {
  return normalizeLongTermState(story?.longTermState, {
    statusSchema: story?.statusSchema,
    statusRoster: story?.statusRoster,
    statusState: story?.statusState,
    keyInfo: story?.keyInfo,
    physicalConstraints: story?.physicalConstraints,
    characters: story?.characters,
  })
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

function normalizeControlledCharacterName(value) {
  const text = String(value || '').trim()
  return text === '玩家' ? '' : text
}

function normalizeStatusRoster(value, characters = []) {
  const names = (Array.isArray(value) ? value : [])
    .map(item => typeof item === 'string' ? item : item?.name)
    .map(item => String(item || '').trim())
    .filter(isValidStatusSubjectName)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(isValidStatusSubjectName)
  return [...new Set([...names, ...characterNames])]
}

function isValidStatusSubjectName(name) {
  const text = String(name || '').trim()
  if (!text) return false
  if (text.startsWith('_')) return false
  return !/^(玩家|环境|场景|候选项|选项|旁白|系统|剧情|总结|世界观|状态|未知|其他)$/i.test(text)
}

function normalizeStatusState(value, roster, characters = [], schema = fallbackStatusSchema) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const output = {}
  for (const name of Array.isArray(roster) ? roster : []) {
    const record = source[name] && typeof source[name] === 'object' && !Array.isArray(source[name]) ? source[name] : {}
    output[name] = {}
    for (const field of normalizeStatusSchema(schema)) {
      output[name][field] = String(record[field] ?? '')
    }
  }
  return output
}

function normalizeItemState(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const output = {}
  const fieldAliases = {
    holder: '持有人',
    owner: '持有人',
    carrier: '持有人',
    location: '位置',
    place: '位置',
  }
  const allowed = new Set(['持有人', '位置'])
  for (const [name, raw] of Object.entries(source).slice(0, 16)) {
    const itemName = String(name || '').trim()
    if (itemName.length < 2 || /^(环境|场景|人物|玩家|当前操控人物|未知|其他|物品|道具|无)$/i.test(itemName)) continue
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    const item = {}
    for (const [field, rawValue] of Object.entries(record)) {
      const normalizedField = fieldAliases[field] || String(field || '').trim()
      const text = String(rawValue ?? '').trim()
      if (!allowed.has(normalizedField) || !text) continue
      item[normalizedField] = text
    }
    if (Object.keys(item).length) output[itemName] = item
  }
  return output
}

function normalizeFeedbackType(type) {
  const value = String(type || '').trim()
  if (value === 'narrativeRepetition') return value
  if (value === 'plotDesignRepetition') return value
  if (value === 'plotPacingDrag') return value
  return 'narrativeRepetition'
}

function renderFeedbackMemory(items = state.feedbackMemory, target = 'all') {
  return normalizeFeedbackMemory(items)
    .filter(item => {
      if (target !== 'narrator') return true
      return item.type === 'narrativeRepetition'
    })
    .map(item => {
      const label = {
        narrativeRepetition: '文字细节重复',
        plotDesignRepetition: '剧情设计重复',
        plotPacingDrag: '剧情速度拖沓',
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
    ['narrativeRepetition', payload.文字细节重复 || payload.存在重复 || payload.narrativeRepetitionFeedback],
    ['plotDesignRepetition', payload.剧情设计重复 || payload.plotDesignRepetitionFeedback],
    ['plotPacingDrag', payload.剧情速度拖沓 || payload.plotPacingDragFeedback],
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
  return normalizeFeedbackMemory(merged).slice(-6)
}

function renderDirectorFeedbackMemory() {
  return renderFeedbackMemory(state.feedbackMemory, 'director')
}

function normalizeDirectorHistory(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => normalizeDirectorPlan(item))
    .filter(Boolean)
    .slice(-5)
}

function appendDirectorHistory(history, directorPlan) {
  const plan = directorPlan && typeof directorPlan === 'object' && !Array.isArray(directorPlan) ? directorPlan : null
  const normalized = normalizeDirectorHistory(history)
  if (!plan || Object.keys(plan).length === 0) return normalized
  return [...normalized, deepClone(plan)].slice(-5)
}

function currentDirectorPlanForRequest() {
  const plan = normalizeDirectorPlan(state.debug?.director) || {}
  const normalized = Object.keys(plan).length ? plan : {}
  return normalized
}

function applyDirectorPlanState(directorPlan) {
  if (!directorPlan || typeof directorPlan !== 'object' || Array.isArray(directorPlan)) return
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
    story.itemState = {}
    story.keyInfo = normalizeKeyInfo(story.keyInfo)
    story.longTermState = buildLongTermStateFromStory(story)
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
  stopPipelineDebugTimer()
}

function finishActiveStream(controller) {
  if (activeStreamController === controller) activeStreamController = null
  refreshPipelineDebugTimer()
}

function makeId(prefix) {
  if (crypto.randomUUID) return `${prefix}.${crypto.randomUUID()}`
  return `${prefix}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`
}

function normalizeModel(value) {
  const model = String(value || '').trim()
  return modelOptions.has(model) ? model : defaultModel
}

function defaultPipelineModelOverrides() {
  return Object.fromEntries(pipelineStages.map(stage => [stage, '']))
}

function normalizePipelineModelOverrides(value) {
  const record = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    pipelineStages.map(stage => {
      const value = record[stage] || (stage === 'summary' ? record.postprocess : '')
      return [stage, value ? normalizeModel(value) : '']
    }),
  )
}

function readPreferredModelFromStorage() {
  return readStoredPreferredModel() || defaultModel
}

function readStoredPreferredModel() {
  try {
    const model = String(localStorage.getItem(preferredModelStorageKey) || '').trim()
    return modelOptions.has(model) ? model : ''
  } catch {
    return ''
  }
}

function normalizePersistedModel(value) {
  const model = String(value || '').trim()
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
  return modelCatalog.find(item => item.id === normalized)?.provider || 'deepseek'
}

function providerLabel(provider) {
  return {
    deepseek: 'DeepSeek Official',
    infron: 'Infron',
  }[normalizeProvider(provider)]
}

function normalizeProvider(value) {
  const provider = String(value || '').trim()
  return providerOptions.includes(provider) ? provider : providerForModel(defaultModel)
}

function modelsForProvider(provider) {
  return modelCatalog.filter(item => item.provider === normalizeProvider(provider))
}

function modelLabel(model) {
  return modelCatalog.find(item => item.id === model)?.label || model
}

function getPipelineModelOverrides() {
  return normalizePipelineModelOverrides(appState.pipelineModels)
}

function getPipelineModelsForRequest(baseModel = getActiveModel(), overrides = appState.pipelineModels) {
  const selectedModel = normalizeModel(baseModel)
  const normalizedOverrides = normalizePipelineModelOverrides(overrides)
  return Object.fromEntries(
    pipelineStages.map(stage => [stage, normalizedOverrides[stage] || selectedModel]),
  )
}

function requiredProvidersForPipeline(models = getPipelineModelsForRequest()) {
  return [...new Set(Object.values(models).map(providerForModel))]
}

function formatPipelineModelSummary(models = getPipelineModelsForRequest(), overridesInput = appState.pipelineModels) {
  const overrides = normalizePipelineModelOverrides(overridesInput)
  const changed = pipelineStages.filter(stage => overrides[stage])
  if (!changed.length) return '全部跟随当前模型'
  return changed.map(stage => `${pipelineStageLabels[stage]}:${modelLabel(models[stage])}`).join(' / ')
}

async function loadConfig() {
  try {
    config = await fetchRuntimeConfig()
    await syncPromptVersionState()
    state.model = getActiveModel()
    els.modelSelect.value = state.model
    renderConnection()
  } catch (error) {
    els.connectionStatus.textContent = `配置读取失败：${error.message}`
  }
}

async function syncPromptVersionState() {
  const nextVersion = String(config.promptVersion || '').trim()
  if (!nextVersion || appState.promptVersion === nextVersion) return
  const previousVersion = appState.promptVersion
  appState.promptVersion = nextVersion
  if (previousVersion) {
    await clearPromptRuntimeCache()
    saveState()
  }
}

async function clearPromptRuntimeCache() {
  try {
    await fetch('/api/prompt-runtime-cache/clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storyId: state?.id || '', storyName: state?.name || '' }),
    })
  } catch {
    // Prompt files are still read fresh from disk; cache clearing is best-effort.
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
    promptVersion: String(raw?.promptVersion || ''),
    pipelineModels: raw?.pipelineModels || getPipelineModelsForRequest(raw?.model || defaultModel),
    pipelines: normalizeRuntimePipelines(raw?.pipelines),
    baseUrl: String(raw?.baseUrl || raw?.providers?.deepseek?.baseUrl || 'https://api.deepseek.com'),
    hasApiKey: Boolean(raw?.hasApiKey || raw?.providers?.deepseek?.hasApiKey),
    providers: {
      deepseek: {
        baseUrl: String(raw?.providers?.deepseek?.baseUrl || raw?.baseUrl || 'https://api.deepseek.com'),
        hasApiKey: Boolean(raw?.providers?.deepseek?.hasApiKey || raw?.hasApiKey),
      },
      infron: {
        baseUrl: String(raw?.providers?.infron?.baseUrl || 'https://llm.onerouter.pro/v1'),
        hasApiKey: Boolean(raw?.providers?.infron?.hasApiKey),
      },
    },
  }
}

function normalizeRuntimePipelines(raw) {
  const generation = raw?.generation && typeof raw.generation === 'object' ? raw.generation : {}
  return {
    generation: {
      mode: String(generation.mode || fallbackGenerationPipeline.mode),
      note: String(generation.note || fallbackGenerationPipeline.note),
      stages: Array.isArray(generation.stages) ? generation.stages : fallbackGenerationPipeline.stages,
    },
    postprocess: raw?.postprocess && typeof raw.postprocess === 'object' ? raw.postprocess : null,
  }
}

function runtimeGenerationPipeline() {
  return config?.pipelines?.generation || fallbackGenerationPipeline
}

function pendingPipelineProgressRows(pipeline) {
  return (Array.isArray(pipeline?.stages) ? pipeline.stages : [])
    .filter(item => item && item.stage)
    .map(item => ({
      stage: item.stage,
      label: item.label || item.stage,
      status: 'pending',
      message: '',
    }))
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
    conversationAutoScrollSuppressed = true
    scrollToLatestAssistantStart()
  })

  els.jumpLatestButton.addEventListener('click', () => {
    conversationAutoScrollSuppressed = false
    scrollToConversationBottom()
  })

  els.conversation.addEventListener('wheel', event => {
    if (event.deltaY < 0) suppressConversationAutoScrollForReading()
  }, { passive: true })

  els.conversation.addEventListener('touchstart', () => {
    suppressConversationAutoScrollForReading()
  }, { passive: true })

  els.conversation.addEventListener('scroll', () => {
    if (Date.now() < programmaticConversationScrollUntil) return
    if (isConversationNearBottom()) {
      conversationAutoScrollSuppressed = false
      return
    }
    if (state.debug?.visibleTextShown && state.debug?.status === '生成中') {
      conversationAutoScrollSuppressed = true
    }
  })

  els.modelManagementButton.addEventListener('click', () => {
    openModelManagementPage()
  })

  els.applyModelSelectionButton.addEventListener('click', () => {
    applyModelSelection()
  })

  els.clearApiKeyButton.addEventListener('click', async () => {
    await clearProviderApiKey(selectedApiKeyProviderForManagement())
  })

  els.closeModelManagementButton.addEventListener('click', () => {
    closeModelManagementPage()
  })

  els.apiKeyButton.addEventListener('click', async () => {
    const provider = selectedApiKeyProviderForManagement()
    const key = els.apiKeyInput.value.trim()
    if (provider === 'deepseek' && key && !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) {
      alert('API Key 格式不对。DeepSeek key 通常以 sk- 开头，请重新粘贴完整 key。')
      return
    }
    await saveProviderApiKey(provider, key)
  })

  els.modelSelect.addEventListener('change', event => {
    pendingModelSelection = normalizeModel(event.target.value)
    renderModelManagementPage()
  })

  els.narrativePerspectiveSelect.addEventListener('change', event => {
    pendingNarrativePerspectiveSelection = normalizeNarrativePerspective(event.target.value)
    renderModelManagementPage()
  })

  els.apiKeyProviderSelect.addEventListener('change', event => {
    pendingApiKeyProviderSelection = normalizeProvider(event.target.value)
    renderModelManagementPage()
  })

  for (const stage of pipelineStages) {
    els.pipelineModelSelects[stage]?.addEventListener('change', event => {
      pendingPipelineModelSelection = normalizePipelineModelOverrides(pendingPipelineModelSelection || appState.pipelineModels)
      pendingPipelineModelSelection[stage] = event.target.value ? normalizeModel(event.target.value) : ''
      renderModelManagementPage()
    })
  }

  els.storyLibraryButton.addEventListener('click', () => {
    openStoryLibraryDialog()
  })

  els.newStoryButton.addEventListener('click', () => {
    openNewGameDialog()
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
    if (action === 'evaluate') await evaluateSavedSlot(id, { refreshBefore: true })
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
        selectedLibraryAssetId = asset.id
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

  els.renameStoryAssetButton.addEventListener('click', () => {
    renameSelectedStoryAsset()
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

  els.applyStorySettingsToCurrentButton.addEventListener('click', () => {
    applySelectedStorySettingsToCurrentStory()
  })

  els.reviseStorySettingsButton.addEventListener('click', () => {
    reviseSelectedStorySettings()
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
      await startNewGameFromAsset(asset, els.newGameName.value.trim(), els.newGamePlayerCharacter.value)
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
    optionStrategist: debug.optionStrategist,
    postprocessSummary: debug.postprocessSummary,
    recallWorker: normalizeRecallWorkerEventsForDisplay(debug.recallWorkerEvents),
  }
  if (Object.values(payload).some(Boolean)) {
    lines.push('', 'stages:', baselineLogText(JSON.stringify(payload, null, 2)))
  }
  els.debugOutput.textContent = lines.join('\n')
}

function normalizeRecallWorkerEventsForDisplay(events) {
  if (!Array.isArray(events)) return events
  return events.map(event => ({
    id: String(event?.id || ''),
    createdAt: String(event?.createdAt || ''),
    createdAtTurn: Math.floor(Number(event?.createdAtTurn) || 0),
    basis: String(event?.basis || ''),
    output: normalizeRecallWorkerOutputForDisplay(event?.output),
  }))
}

function normalizeRecallWorkerOutputForDisplay(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return { loadedTurnIndexes: [] }
  const normalized = { loadedTurnIndexes: recallWorkerLoadedTurnIndexes(output) }
  if (output.error) normalized.error = String(output.error)
  return normalized
}

function recallWorkerLoadedTurnIndexes(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return []
  const direct = Array.isArray(output.loadedTurnIndexes) ? output.loadedTurnIndexes : []
  const fromSnippets = Array.isArray(output.snippets) ? output.snippets.map(item => item?.turnIndex) : []
  return [...new Set([...direct, ...fromSnippets]
    .map(item => Math.floor(Number(item)))
    .filter(Number.isFinite))]
    .sort((a, b) => a - b)
}

function hasRunningPipelineStage() {
  const progress = Array.isArray(state.debug?.progress) ? state.debug.progress : []
  return progress.some(item => item?.status === 'running')
}

function refreshPipelineDebugTimer() {
  if (hasRunningPipelineStage()) {
    if (!pipelineDebugTimer) {
      pipelineDebugTimer = setInterval(() => {
        if (!hasRunningPipelineStage()) {
          stopPipelineDebugTimer()
          return
        }
        renderDebug()
      }, 500)
    }
    return
  }
  stopPipelineDebugTimer()
}

function stopPipelineDebugTimer() {
  if (!pipelineDebugTimer) return
  clearInterval(pipelineDebugTimer)
  pipelineDebugTimer = null
}

function baselineLogText(value) {
  return String(value ?? '')
    .replaceAll('"questions"', '"turnRequests"')
    .replace(/,\s*"qa"\s*:\s*\[\]/g, '')
    .replace(/\{\s*"qa"\s*:\s*\[\]\s*,\s*/g, '{')
    .replaceAll('花色观察', '人物状态')
    .replaceAll('花色特性', '状态字段')
    .replaceAll('花语计划', '导演计划')
    .replaceAll('花语校验', '剧情校验')
    .replaceAll('花神的嘱咐', '上轮反重复提醒')
    .replaceAll('预言故事', '正文')
    .replaceAll('预言方向', '剧情方向')
    .replaceAll('命运分叉', '可选行动')
    .replaceAll('顾客需求', '用户输入')
    .replaceAll('顾客', '用户')
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
  return
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
  preserveSelectedLibraryAsset()
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
  pendingPipelineModelSelection = getPipelineModelOverrides()
  pendingApiKeyProviderSelection = selectedProviderForManagement()
  pendingNarrativePerspectiveSelection = normalizeNarrativePerspective(appState.narrativePerspective)
  renderModelManagementPage()
  els.gamePage.hidden = true
  els.storyLibraryPage.hidden = true
  els.modelManagementPage.hidden = false
}

function closeModelManagementPage() {
  pendingModelSelection = null
  pendingPipelineModelSelection = null
  pendingNarrativePerspectiveSelection = null
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
    renderNewGamePlayerSelector(null)
    return
  }

  const readyAssets = storyLibraryAssets.filter(asset => asset.programConfig)
  if (readyAssets.length === 0) {
    els.storyAssetList.innerHTML = '<p class="meta no-indent">还没有已初始化故事。请先进入“故事库”初始化。</p>'
    els.newGamePreview.innerHTML = ''
    renderNewGamePlayerSelector(null)
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
  renderNewGamePlayerSelector(selected)
  renderNewGamePreview(selected)
}

function renderNewGamePlayerSelector(asset) {
  if (!els.newGamePlayerCharacter) return
  const candidates = playableCharactersFromConfig(asset?.programConfig)
  els.newGamePlayerCharacter.disabled = !asset || candidates.length <= 1
  if (!asset) {
    els.newGamePlayerCharacter.innerHTML = ''
    return
  }
  const options = candidates.length ? candidates : normalizeStatusRoster(asset?.programConfig?.statusRoster).slice(0, 8)
  const current = options.includes(els.newGamePlayerCharacter.value) ? els.newGamePlayerCharacter.value : options[0] || ''
  els.newGamePlayerCharacter.innerHTML = options.map(name => `<option value="${escapeAttr(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')
}

function renderStoryLibraryAssets() {
  if (storyLibraryAssets.length === 0) {
    els.libraryAssetList.innerHTML = '<p class="meta no-indent">还没有故事资料。先导入人物卡、故事书或世界书。</p>'
    if (els.libraryPreview) els.libraryPreview.innerHTML = ''
    renderStorySettingsForm(null)
    els.renameStoryAssetButton.disabled = true
    els.deleteStoryAssetButton.disabled = true
    return
  }
  preserveSelectedLibraryAsset()
  els.renameStoryAssetButton.disabled = !selectedLibraryAssetId
  els.deleteStoryAssetButton.disabled = !selectedLibraryAssetId

  els.libraryAssetList.innerHTML = storyLibraryAssets.map(asset => `
    <label class="asset-choice">
      <input type="radio" name="library-asset" value="${escapeAttr(asset.id)}" ${asset.id === selectedLibraryAssetId ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(assetDefaultStoryName(asset))} ${asset.programConfigFile || asset.programConfig ? '<em class="status-pill ready">已初始化</em>' : '<em class="status-pill pending">待初始化</em>'}</strong>
        <small>${escapeHtml(asset.sourceName || asset.id)} · ${(asset.entries || []).length} 条资料 · ${(asset.characters || []).length} 个人物${asset.programConfig?.generatedAt ? ` · ${escapeHtml(formatTime(asset.programConfig.generatedAt))}` : ''}</small>
      </span>
    </label>
  `).join('')

  els.libraryAssetList.querySelectorAll('input[name="library-asset"]').forEach(input => {
    input.addEventListener('change', event => {
      selectedLibraryAssetId = event.target.value
      renderStoryLibraryAssets()
    })
  })

  const selected = storyLibraryAssets.find(asset => asset.id === selectedLibraryAssetId)
  renderStorySettingsForm(selected)
  if (els.libraryPreview) renderAssetPreview(els.libraryPreview, selected)
}

async function deleteSelectedStoryAsset() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
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
    selectedLibraryAssetId = storyLibraryAssets[0]?.id || ''
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

async function renameSelectedStoryAsset() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  const currentName = assetDefaultStoryName(asset)
  const nextName = prompt('输入新的故事资料名', currentName)?.trim()
  if (!nextName || nextName === currentName) return
  els.renameStoryAssetButton.disabled = true
  setStoryLibraryStatus(`正在改名：${currentName}。`, 'running')
  try {
    const response = await fetch(`/api/story-assets/${encodeURIComponent(asset.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceName: nextName }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '故事资料改名失败')
    await loadStoryLibrary()
    selectedLibraryAssetId = payload.asset?.id || asset.id
    if (selectedNewGameAssetId === asset.id) {
      const selected = storyLibraryAssets.find(item => item.id === asset.id)
      if (selected) els.newGameName.value = assetDefaultStoryName(selected)
    }
    renderStoryLibraryAssets()
    renderNewGameAssets()
    setStoryLibraryStatus(`已改名：${nextName}。`, 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    els.renameStoryAssetButton.disabled = storyLibraryAssets.length === 0
  }
}

function renderStorySettingsForm(asset) {
  const config = storyProgramConfigForEdit(asset)
  const disabled = !asset?.programConfig
  els.reviseStorySettingsButton.disabled = disabled
  els.applyStorySettingsToCurrentButton.disabled = disabled || !state?.id
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
    playableCharacters: playableCharactersFromConfig(config),
    statusSchema: normalizeStatusSchema(config.statusSchema),
    statusRoster: normalizeStatusRoster(config.statusRoster),
    statusState: normalizeStatusState(config.statusState, normalizeStatusRoster(config.statusRoster), [], normalizeStatusSchema(config.statusSchema)),
    initialPlayerOptions: Array.isArray(config.initialPlayerOptions) ? config.initialPlayerOptions : [],
  }
}

async function saveSelectedStorySettings() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
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
    await saveStoryAssetProgramConfig(asset, patch)
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
    setStoryLibraryStatus(`已保存故事设定：${assetDefaultStoryName(asset)}。`, 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    const selected = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
    els.saveStorySettingsButton.disabled = !selected?.programConfig
  }
}

async function applySelectedStorySettingsToCurrentStory() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  if (!asset.programConfig) {
    alert('这个故事还没有初始化，不能应用到当前存档。')
    return
  }
  let patch
  try {
    patch = parseEditableJson(els.storyProgramConfigInput.value || '{}')
  } catch (error) {
    alert(`JSON 格式错误：${error.message}`)
    return
  }
  const originalText = els.applyStorySettingsToCurrentButton.textContent
  els.applyStorySettingsToCurrentButton.disabled = true
  els.applyStorySettingsToCurrentButton.textContent = '应用中'
  setStoryLibraryStatus('正在保存故事设定并应用到当前存档。', 'running')
  try {
    const config = await saveStoryAssetProgramConfig(asset, patch)
    applyProgramConfigToCurrentStory(config, asset)
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
    saveState()
    render()
    setStoryLibraryStatus(`已应用到当前存档：${state.name}。`, 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    const selected = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
    els.applyStorySettingsToCurrentButton.textContent = originalText
    els.applyStorySettingsToCurrentButton.disabled = !selected?.programConfig || !state?.id
  }
}

function applyProgramConfigToCurrentStory(config, asset) {
  if (!state?.id) throw new Error('当前没有可应用的存档。')
  state.worldview = String(config.worldview || '')
  state.directorStyle = String(config.directorStyle || '')
  state.narratorStyle = String(config.narratorStyle || '')
  if (asset?.id) state.storyAssetId = String(asset.id)
  if (asset?.programConfigFile || config.programConfigFile) {
    state.programConfigFile = String(asset?.programConfigFile || config.programConfigFile || '')
  }
  state.debug = {
    ...(state.debug || {}),
    appliedProgramConfig: {
      storyAssetId: String(asset?.id || ''),
      appliedAt: new Date().toISOString(),
      fields: ['worldview', 'directorStyle', 'narratorStyle'],
    },
  }
}

async function reviseSelectedStorySettings() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  if (!asset.programConfig) {
    alert('这个故事还没有初始化，不能反馈修改。')
    return
  }
  const revisionFeedback = prompt('写下你对初始化结果的不满意或修改要求。')?.trim()
  if (!revisionFeedback) return

  const originalText = els.reviseStorySettingsButton.textContent
  els.reviseStorySettingsButton.disabled = true
  els.reviseStorySettingsButton.textContent = '修改中'
  setStoryLibraryStatus('正在按反馈修改初始化配置。', 'running')
  try {
    const response = await fetch(`/api/story-assets/${encodeURIComponent(asset.id)}/program-config/revise`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revisionFeedback,
        model: getActiveModel(),
        pipelineModels: getPipelineModelsForRequest(),
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '初始化反馈修改失败')
    asset.programConfig = payload.config
    await loadStoryLibrary()
    renderStoryLibraryAssets()
    renderNewGameAssets()
    state.debug = {
      ...(state.debug || {}),
      initializerRevision: payload.config,
    }
    renderDebug()
    setStoryLibraryStatus(`已按反馈修改：${assetDefaultStoryName(asset)}。`, 'done')
  } catch (error) {
    setStoryLibraryStatus(error.message, 'error')
    alert(error.message)
  } finally {
    const selected = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
    els.reviseStorySettingsButton.textContent = originalText
    els.reviseStorySettingsButton.disabled = !selected?.programConfig
  }
}

function preserveSelectedLibraryAsset() {
  if (!storyLibraryAssets.some(asset => asset.id === selectedLibraryAssetId)) {
    selectedLibraryAssetId = storyLibraryAssets[0]?.id || ''
  }
}

function syncSelectedLibraryAssetFromDom() {
  const checked = els.libraryAssetList?.querySelector('input[name="library-asset"]:checked')
  if (checked?.value) selectedLibraryAssetId = checked.value
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

async function startNewGameFromAsset(asset, requestedName, requestedControlledName) {
  abortActiveStream()
  const init = asset.programConfig
  assertInitializedProgramConfig(init)
  const story = defaultStory(requestedName || assetDefaultStoryName(asset))
  const characterSeeds = characterSeedsFromStatus(init, asset.characters || [])
  story.characters = characterSeeds.map(character => ({
    ...character,
    id: makeId('character'),
  })).filter(Boolean)
  const controlledCharacterName = selectedPlayableCharacter(init, requestedControlledName)
  if (!story.characters.some(character => character.name === controlledCharacterName)) {
    const record = init.statusState?.[controlledCharacterName] && typeof init.statusState[controlledCharacterName] === 'object' ? init.statusState[controlledCharacterName] : {}
    story.characters.unshift({
      id: makeId('character'),
      name: controlledCharacterName,
      gender: String(record.性别 || ''),
      role: String(record.身份 || ''),
      mood: String(record.情绪 || ''),
      location: String(record.位置 || ''),
      health: String(record.外显状态 || ''),
      trust: String(record.trust || ''),
      appearance: String(record.外貌 || ''),
      personality: String(record.性格 || ''),
    })
  }
  story.controlledCharacterName = controlledCharacterName
  story.openingText = String(init.openingText || extractOpeningText(asset.entries || []))
  const openingText = String(story.openingText || '').trim()
  const openingSummary = await summarizeOpeningTextForHistory(openingText, { ...init, assetId: asset.id })
  story.worldview = String(init.worldview || '')
  story.currentSituation = openingSummary || openingText
  story.chapterSummary = openingSummary ? `- 第0轮：${openingSummary}` : ''
  story.outline = openingSummary || openingText
  story.physicalConstraints = []
  story.keyInfo = []
  story.directorStyle = String(init.directorStyle || '')
  story.narratorStyle = String(init.narratorStyle || '')
  story.plotLines = []
  story.feedbackMemory = []
  story.storyAssetId = String(asset.id || '')
  story.programConfigFile = String(asset.programConfigFile || init.programConfigFile || '')
  story.statusSchema = normalizeStatusSchema(init.statusSchema)
  story.statusRoster = normalizeStatusRoster(init.statusRoster, story.characters)
  if (controlledCharacterName && !story.statusRoster.includes(controlledCharacterName)) story.statusRoster.unshift(controlledCharacterName)
  story.statusState = normalizeStatusState(init.statusState, story.statusRoster, story.characters, story.statusSchema)
  story.itemState = {}
  story.longTermState = buildLongTermStateFromStory(story)
  story.globalContext = story.chapterSummary
  story.messages = []
  story.playerOptions = normalizeInitialPlayerOptions(init.initialPlayerOptions || init.playerOptions)
  story.debug = {}
  appState.stories = [story]
  appState.currentStoryId = story.id
  state = story
  saveState()
  render()
  els.newGameDialog.close()
}

async function summarizeOpeningTextForHistory(openingText, config = {}) {
  const text = String(openingText || '').trim()
  const existingSummary = String(config.openingSummary || '').trim()
  if (existingSummary) return existingSummary
  if (!text) return ''
  try {
    const response = await fetch('/api/opening-summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assetId: String(config.assetId || config.storyAssetId || ''),
        openingText: text,
        storyContext: String(config.worldview || ''),
        model: getActiveModel(),
        pipelineModels: getPipelineModelsForRequest(),
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '开场摘要失败')
    const summary = String(payload.summary || '').trim()
    if (summary && payload.config && typeof config === 'object') {
      config.openingSummary = summary
    }
    return summary || summarizeOpeningTextLocally(text)
  } catch {
    return summarizeOpeningTextLocally(text)
  }
}

function summarizeOpeningTextLocally(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const sentence = text.match(/^(.{1,160}?[。！？!?])/u)?.[1] || text
  return sentence.slice(0, 160).trim()
}

async function initializeSelectedStoryAsset() {
  syncSelectedLibraryAssetFromDom()
  const asset = storyLibraryAssets.find(item => item.id === selectedLibraryAssetId)
  if (!asset) {
    alert('请先选择一个故事资料。')
    return
  }
  const pipelineModels = getPipelineModelsForRequest()
  const provider = providerForModel(pipelineModels.initializer)
  if (!hasRuntimeApiKey(provider)) {
    alert(`请先配置 ${providerLabel(provider)} API Key。`)
    return
  }

  state.debug = {
    status: 'running',
    pipelineMode: 'initializer',
    note: `Initializer 正在初始化：${assetDefaultStoryName(asset)}。`,
    progress: [],
    initializer: null,
  }
  renderDebug()
  els.initializeStoryAssetButton.disabled = true
  els.initializeStoryAssetButton.textContent = '初始化中'
  startStoryInitializationTimer(asset)

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
    stopStoryInitializationTimer()
    setStoryLibraryStatus(`初始化完成：${assetDefaultStoryName(asset)} 已写入 program-config，可以开始新游戏。`, 'done')
  } catch (error) {
    stopStoryInitializationTimer()
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

function startStoryInitializationTimer(asset) {
  stopStoryInitializationTimer()
  const startedAt = Date.now()
  const name = assetDefaultStoryName(asset)
  const render = (message = '正在等待 DeepSeek V4 Pro 返回结构化故事配置') => {
    setStoryLibraryStatus(`初始化中：${name} · ${message} · 已耗时 ${formatPipelineMs(Date.now() - startedAt)}`, 'running')
  }
  render()
  storyInitializationTimer = {
    assetId: asset.id,
    startedAt,
    render,
    interval: window.setInterval(() => render(), 1000),
  }
}

function updateStoryInitializationStatus(message) {
  if (storyInitializationTimer?.render) {
    storyInitializationTimer.render(message || '正在等待 DeepSeek V4 Pro 返回结构化故事配置')
  }
}

function stopStoryInitializationTimer() {
  if (storyInitializationTimer?.interval) window.clearInterval(storyInitializationTimer.interval)
  storyInitializationTimer = null
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
      pipelineModels: getPipelineModelsForRequest(),
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
    if (event.stage === 'initializer' && event.message) updateStoryInitializationStatus(event.message)
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
  if (playableCharactersFromConfig(config).length === 0) missing.push('playableCharacters')
  const initialOptions = normalizeInitialPlayerOptions(config?.initialPlayerOptions || config?.playerOptions)
  if (initialOptions.length < 5) missing.push('initialPlayerOptions')
  if (missing.length) {
    throw new Error(`故事尚未完成初始化，缺少：${missing.join('、')}。不能开始游戏。`)
  }
}

function playableCharactersFromConfig(config) {
  const explicit = Array.isArray(config?.playableCharacters)
    ? config.playableCharacters.map(name => normalizeControlledCharacterName(name)).filter(isValidStatusSubjectName)
    : []
  if (explicit.length) return [...new Set(explicit)]
  return normalizeStatusRoster(config?.statusRoster).slice(0, 8)
}

function selectedPlayableCharacter(config, requestedName) {
  const candidates = playableCharactersFromConfig(config)
  const requested = normalizeControlledCharacterName(requestedName)
  if (requested && candidates.includes(requested)) return requested
  return candidates[0] || ''
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
      trust: String(record.trust || ''),
      appearance: String(record.外貌 || ''),
      personality: String(record.性格 || ''),
    }
  })
  return seeds.length ? seeds : fallbackCharacters
}

function normalizeInitialPlayerOptions(options) {
  const defaults = [
    { type: '推进', direction: '从当前局面进入一次明确的关系或目标推进' },
    { type: '转折', direction: '引入一个改变判断的新信息、误判或外部压力' },
    { type: '跳过', direction: '略过低价值余波，切到下一个场景或剧情节点' },
    { type: '推进', direction: '把当前拉扯推向承诺、代价或可见结果' },
    { type: '转折', direction: '让已有关系或信息压力改变下一轮重心' },
  ]
  const source = Array.isArray(options) ? options : []
  const seen = new Set()
  return [...source, ...defaults].slice(0, 10).map(option => {
    if (typeof option === 'string') {
      return { direction: option }
    }
    const direction = String(option?.direction || option?.inputText || option?.label || option?.description || '').trim()
    const type = String(option?.type || '').trim()
    return {
      ...(type ? { type } : {}),
      direction,
    }
  }).filter(option => {
    if (!option.direction || seen.has(option.direction)) return false
    seen.add(option.direction)
    return true
  }).slice(0, 5)
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
  alert(`已保存：${payload.slot?.name || trimmedName}。存档评价后台生成中，可在“读取存档”里查看。`)
  evaluateSavedSlot(payload.slot?.id)
}

async function evaluateSavedSlot(id, options = {}) {
  if (!id) return
  if (options.refreshBefore && els.saveSlotsDialog?.open) {
    els.saveSlotsStatus.textContent = '存档评价生成中。'
    els.saveSlotsStatus.dataset.tone = 'running'
    markSaveEvaluationRunning(id)
  }
  try {
    const response = await fetch(`/api/save-slots/${encodeURIComponent(id)}/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: getPipelineApiKey(),
        model: getActiveModel(),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || '存档评价生成失败')
    if (els.saveSlotsDialog?.open) {
      await refreshSaveSlots()
      const evaluation = String(payload.slot?.saveEvaluation || '').trim()
      const status = String(payload.slot?.saveEvaluationStatus || '').trim()
      if (evaluation) {
        els.saveSlotsStatus.textContent = `存档评价已生成：${evaluation}`
        els.saveSlotsStatus.dataset.tone = 'done'
      } else if (status.startsWith('error:')) {
        els.saveSlotsStatus.textContent = `存档评价失败：${status.replace(/^error:\s*/, '')}`
        els.saveSlotsStatus.dataset.tone = 'error'
      }
    }
  } catch (error) {
    if (els.saveSlotsDialog?.open) {
      await refreshSaveSlots()
      els.saveSlotsStatus.textContent = `存档评价失败：${error.message}`
      els.saveSlotsStatus.dataset.tone = 'error'
    }
  }
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
    <article class="save-slot-item" data-save-slot-id="${escapeAttr(slot.id)}">
      <div>
        <strong>${slot.favorite ? '★ ' : ''}${escapeHtml(slot.name)}</strong>
        <p>${escapeHtml(slot.storyName || '未命名故事')} · 第 ${Number(slot.turnIndex || 0)} 轮 · ${escapeHtml(slot.savedAt || '')}<span class="save-evaluation-text">${formatSaveEvaluation(slot)}</span></p>
      </div>
      <div class="save-slot-actions">
        <button type="button" class="ghost-button" data-action="load" data-id="${escapeAttr(slot.id)}">读取</button>
        <button type="button" class="ghost-button" data-action="favorite" data-id="${escapeAttr(slot.id)}" data-favorite="${slot.favorite ? 'true' : 'false'}">${slot.favorite ? '取消收藏' : '收藏'}</button>
        ${renderSaveEvaluationButton(slot)}
        <button type="button" class="ghost-button" data-action="delete" data-id="${escapeAttr(slot.id)}" data-name="${escapeAttr(slot.name)}">删除</button>
      </div>
    </article>
  `).join('') : '<div class="empty-state"><strong>暂无存档</strong><span>点击“保存游戏”创建一个手动存档。</span></div>'
}

function formatSaveEvaluation(slot) {
  const evaluation = String(slot.saveEvaluation || '').trim()
  if (evaluation) return ` · 评价：${escapeHtml(evaluation)}`
  const status = String(slot.saveEvaluationStatus || '').trim()
  if (status === 'pending' || status === 'running') return ' · 评价生成中'
  if (status.startsWith('error:')) return ` · 评价失败：${escapeHtml(status.replace(/^error:\s*/, '').slice(0, 80))}`
  return ' · 未生成评价'
}

function renderSaveEvaluationButton(slot) {
  const evaluation = String(slot.saveEvaluation || '').trim()
  const status = String(slot.saveEvaluationStatus || '').trim()
  if (status === 'running' || status === 'pending') return ''
  const label = evaluation || status.startsWith('error:') ? '重新评价' : '生成评价'
  return `<button type="button" class="ghost-button" data-action="evaluate" data-id="${escapeAttr(slot.id)}">${label}</button>`
}

function markSaveEvaluationRunning(id) {
  const row = els.saveSlotsList.querySelector(`[data-save-slot-id="${cssEscape(id)}"]`)
  if (!row) return
  const text = row.querySelector('.save-evaluation-text')
  if (text) text.textContent = ' · 评价生成中'
  const button = row.querySelector('button[data-action="evaluate"]')
  if (button) {
    button.disabled = true
    button.textContent = '评价生成中'
  }
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
    appState.stories = [loadedStory]
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
  const pipelineModels = getPipelineModelsForRequest(model)
  const keyState = requiredProvidersForPipeline(pipelineModels)
    .map(provider => `${providerLabel(provider)} ${hasRuntimeApiKey(provider) ? 'Key 已配置' : 'Key 未配置'}`)
    .join(' / ')
  els.connectionStatus.textContent = `模型：${modelLabel(model)} · 流水线：${formatPipelineModelSummary(pipelineModels)} · ${keyState}`
  renderTurnStatus()
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
  return { baseUrl: config.baseUrl || 'https://api.deepseek.com', hasApiKey: config.hasApiKey }
}

function apiKeyStorageKeyForProvider(provider) {
  return providerKeyStorageKeys[normalizeProvider(provider)] || deepSeekApiKeyStorageKey
}

function getLocalApiKey(provider = currentProvider()) {
  void provider
  return ''
}

function getPipelineApiKey() {
  return ''
}

function getPipelineApiKeys() {
  return {}
}

async function refreshRuntimeConfig() {
  config = await fetchRuntimeConfig()
}

async function saveProviderApiKey(provider, key) {
  const normalizedProvider = normalizeProvider(provider)
  if (!key) {
    await clearProviderApiKey(normalizedProvider)
    return
  }
  els.apiKeyButton.disabled = true
  els.modelManagementStatus.textContent = `正在保存 ${providerLabel(normalizedProvider)} Key 到后台。`
  els.modelManagementStatus.dataset.tone = ''
  try {
    const response = await fetch('/api/provider-api-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: normalizedProvider, apiKey: key }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'API Key 保存失败')
    els.apiKeyInput.value = ''
    await refreshRuntimeConfig()
    renderModelManagementPage()
    renderConnection()
    els.modelManagementStatus.textContent = `${providerLabel(normalizedProvider)} Key 已保存到后台。`
    els.modelManagementStatus.dataset.tone = 'done'
  } catch (error) {
    els.modelManagementStatus.textContent = error.message
    els.modelManagementStatus.dataset.tone = 'error'
  } finally {
    els.apiKeyButton.disabled = false
  }
}

async function clearProviderApiKey(provider) {
  const normalizedProvider = normalizeProvider(provider)
  els.clearApiKeyButton.disabled = true
  els.modelManagementStatus.textContent = `正在清除 ${providerLabel(normalizedProvider)} 后台 Key。`
  els.modelManagementStatus.dataset.tone = ''
  try {
    const response = await fetch('/api/provider-api-key', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: normalizedProvider }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'API Key 清除失败')
    els.apiKeyInput.value = ''
    await refreshRuntimeConfig()
    renderModelManagementPage()
    renderConnection()
    els.modelManagementStatus.textContent = `${providerLabel(normalizedProvider)} 后台 Key 已清除。`
    els.modelManagementStatus.dataset.tone = 'done'
  } catch (error) {
    els.modelManagementStatus.textContent = error.message
    els.modelManagementStatus.dataset.tone = 'error'
  } finally {
    els.clearApiKeyButton.disabled = false
  }
}

function selectedModelForManagement() {
  return normalizeModel(pendingModelSelection || getActiveModel())
}

function selectedProviderForManagement() {
  return providerForModel(selectedModelForManagement())
}

function selectedApiKeyProviderForManagement() {
  return normalizeProvider(pendingApiKeyProviderSelection || selectedProviderForManagement())
}

async function applyModelSelection() {
  const model = selectedModelForManagement()
  const pipelineModels = normalizePipelineModelOverrides(pendingPipelineModelSelection || appState.pipelineModels)
  const narrativePerspective = normalizeNarrativePerspective(pendingNarrativePerspectiveSelection || appState.narrativePerspective)
  setPreferredModel(model)
  appState.pipelineModels = pipelineModels
  appState.narrativePerspective = narrativePerspective
  els.applyModelSelectionButton.disabled = true
  els.modelManagementStatus.textContent = `正在保存：${modelLabel(model)}`
  els.modelManagementStatus.dataset.tone = ''
  try {
    pendingModelSelection = null
    pendingPipelineModelSelection = null
    pendingNarrativePerspectiveSelection = null
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
  return ''
}

function hasRuntimeApiKey(provider = currentProvider()) {
  return Boolean(getProviderConfig(provider).hasApiKey)
}

function renderModelManagementPage() {
  const model = selectedModelForManagement()
  const apiKeyProvider = selectedApiKeyProviderForManagement()
  const appliedModel = getActiveModel()
  const pipelineModels = normalizePipelineModelOverrides(pendingPipelineModelSelection || appState.pipelineModels)
  const narrativePerspective = normalizeNarrativePerspective(pendingNarrativePerspectiveSelection || appState.narrativePerspective)
  els.modelSelect.innerHTML = modelCatalog.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(modelLabel(item.id))}</option>`).join('')
  els.modelSelect.value = model
  els.narrativePerspectiveSelect.value = narrativePerspective
  const optionHtml = `<option value="">跟随当前模型</option>${modelCatalog.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(modelLabel(item.id))}</option>`).join('')}`
  for (const stage of pipelineStages) {
    const select = els.pipelineModelSelects[stage]
    if (!select) continue
    select.innerHTML = optionHtml
    select.value = pipelineModels[stage] || ''
  }
  els.apiKeyProviderSelect.innerHTML = providerOptions.map(provider => `<option value="${escapeAttr(provider)}">${escapeHtml(providerLabel(provider))}</option>`).join('')
  els.apiKeyProviderSelect.value = apiKeyProvider
  els.apiKeyHelp.textContent = `${providerLabel(apiKeyProvider)} Key 保存在后台本地文件，不回显明文。${hasRuntimeApiKey(apiKeyProvider) ? '当前已配置。' : '当前未配置。'}`
  els.apiKeyLabel.textContent = `${providerLabel(apiKeyProvider)} Key`
  els.apiKeyInput.placeholder = apiKeyProvider === 'deepseek' ? 'sk-...' : '粘贴 API Key'
  els.apiKeyInput.value = ''
  const appliedPipelineModels = normalizePipelineModelOverrides(appState.pipelineModels)
  const hasPendingChange = model !== appliedModel
    || JSON.stringify(pipelineModels) !== JSON.stringify(appliedPipelineModels)
    || narrativePerspective !== normalizeNarrativePerspective(appState.narrativePerspective)
  els.applyModelSelectionButton.disabled = !hasPendingChange
  const pendingLabel = hasPendingChange ? '待确定' : '已应用'
  const effectivePipelineModels = getPipelineModelsForRequest(model, pipelineModels)
  const providers = requiredProvidersForPipeline(effectivePipelineModels)
  const keyState = providers.map(provider => `${providerLabel(provider)}:${hasRuntimeApiKey(provider) ? 'Key ready' : 'No key'}`).join(' / ')
  els.modelManagementStatus.textContent = `${modelLabel(model)} · ${narrativePerspectiveLabel(narrativePerspective)} · ${formatPipelineModelSummary(effectivePipelineModels, pipelineModels)} · ${pendingLabel} · ${keyState}`
  els.modelManagementStatus.dataset.tone = ''
}

function renderStatusPanel() {
  const controlledCharacterName = normalizeControlledCharacterName(state.controlledCharacterName)
  const controlledHtml = controlledCharacterName
    ? `<p class="meta no-indent">当前焦点：${escapeHtml(controlledCharacterName)} · ${escapeHtml(narrativePerspectiveLabel(appState.narrativePerspective))}</p>`
    : '<p class="meta no-indent">当前焦点：未选择</p>'
  const longTermState = buildLongTermStateFromState()
  if (!Object.keys(longTermState.characterStatus || {}).length && !longTermState.keyInfo.length && !longTermState.physicalConstraints.length) {
    els.statusPanelView.innerHTML = `${controlledHtml}<p class="meta no-indent">长期变量为空</p>`
    return
  }
  els.statusPanelView.innerHTML = `${controlledHtml}<p class="meta no-indent">长期变量</p><pre class="status-json">${escapeHtml(JSON.stringify(longTermState, null, 2))}</pre>`
}

function renderStoryTracking() {
  const summary = state.chapterSummary || deriveGlobalContextBlock('summary')
  if (needsOpeningSummaryBackfill()) {
    void ensureOpeningSummaryBackfill()
  }
  const backfillHint = needsOpeningSummaryBackfill() && openingSummaryBackfillInFlight.has(state.id)
    ? '\n- 第0轮：正在调用模型生成开场白总结...'
    : ''
  els.storyTrackingView.innerHTML = `
    ${renderTrackerSection('历史总结', formatHistoricalSummaryForTracker(`${backfillHint}\n${summary}`) || '暂无历史总结。')}
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
      ${renderMessageContent(message)}
    </article>
  `).join('')
  els.conversation.innerHTML = `${renderOpeningMessage()}${messagesHtml}`
  applyConversationScroll(scrollTarget, previousScrollTop, wasNearBottom)
  renderReadingJumpControls()
}

function renderMessageContent(message) {
  const text = String(message?.content || '')
  if (message?.role !== 'assistant') return `<div class="message-body">${escapeHtml(text)}</div>`
  return `<div class="message-body">${renderDecoratedText(text, message)}</div>`
}

function renderDecoratedText(text, message) {
  const parsed = parseInlineMarkdownDecorations(text)
  const decorations = [
    ...parsed.decorations,
    ...collectTextDecorations(parsed.text, message),
  ]
  if (!decorations.length) return renderReadableParagraphs(parsed.text.split('\n').map(escapeHtml))
  const ranges = resolveTextDecorationRanges(parsed.text, decorations)
  let html = ''
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) html += escapeHtml(parsed.text.slice(cursor, range.start))
    html += `<span class="${escapeAttr(range.className)}">${escapeHtml(parsed.text.slice(range.start, range.end))}</span>`
    cursor = range.end
  }
  if (cursor < parsed.text.length) html += escapeHtml(parsed.text.slice(cursor))
  return renderReadableParagraphs(html.split('\n'))
}

function parseInlineMarkdownDecorations(text) {
  const source = String(text || '')
  const decorations = []
  let plain = ''
  for (let index = 0; index < source.length;) {
    if (source.startsWith('**', index)) {
      const end = source.indexOf('**', index + 2)
      if (end > index + 2) {
        const start = plain.length
        plain += source.slice(index + 2, end)
        decorations.push({ start, end: plain.length, className: 'markdown-strong', priority: 4 })
        index = end + 2
        continue
      }
    }
    if (source[index] === '*' && source[index + 1] !== '*') {
      const end = source.indexOf('*', index + 1)
      if (end > index + 1 && source[end + 1] !== '*') {
        const start = plain.length
        plain += source.slice(index + 1, end)
        decorations.push({ start, end: plain.length, className: 'markdown-emphasis', priority: 4 })
        index = end + 1
        continue
      }
    }
    plain += source[index]
    index += 1
  }
  return { text: plain, decorations }
}

function renderReadableParagraphs(lines) {
  return lines.map(line => `<p>${line}</p>`).join('')
}

function collectTextDecorations(text, message) {
  const decorations = []
  const quotePattern = /“[^”]{1,120}”/g
  for (const match of text.matchAll(quotePattern)) {
    decorations.push({ start: match.index, end: match.index + match[0].length, className: 'dialogue-highlight', priority: 2 })
  }
  for (const name of collectCharacterNamesForHighlight()) {
    addExactTextDecorations(decorations, text, name, 'character-highlight', 1)
  }
  return decorations
}

function collectCharacterNamesForHighlight() {
  const names = [
    state.controlledCharacterName,
    ...(Array.isArray(state.statusRoster) ? state.statusRoster : []),
    ...Object.keys(state.statusState || {}),
    ...(Array.isArray(state.characters) ? state.characters.map(character => character?.name) : []),
  ].map(name => String(name || '').trim()).filter(name => name.length >= 2)
  return [...new Set(names)].sort((a, b) => b.length - a.length).slice(0, 40)
}

function addExactTextDecorations(decorations, source, needle, className, priority = 3) {
  const text = String(needle || '').trim()
  if (!text) return
  let index = source.indexOf(text)
  while (index >= 0) {
    decorations.push({ start: index, end: index + text.length, className, priority })
    index = source.indexOf(text, index + text.length)
  }
}

function resolveTextDecorationRanges(text, decorations) {
  return decorations
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.start >= 0 && item.end <= text.length)
    .sort((a, b) => b.priority - a.priority || a.start - b.start || b.end - a.end)
    .reduce((ranges, item) => {
      if (ranges.some(range => item.start < range.end && item.end > range.start)) return ranges
      ranges.push(item)
      return ranges
    }, [])
    .sort((a, b) => a.start - b.start)
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
  if (scrollTarget === 'stream-follow') {
    if (!conversationAutoScrollSuppressed && wasNearBottom) {
      scrollToConversationBottom()
      return
    }
    els.conversation.scrollTop = Math.min(previousScrollTop, Math.max(0, els.conversation.scrollHeight - els.conversation.clientHeight))
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
  markProgrammaticConversationScroll()
  els.conversation.scrollTop = Math.max(0, targetTop)
}

function scrollToConversationBottom() {
  markProgrammaticConversationScroll()
  els.conversation.scrollTop = els.conversation.scrollHeight
}

function markProgrammaticConversationScroll() {
  programmaticConversationScrollUntil = Date.now() + 120
}

function suppressConversationAutoScrollForReading() {
  if (state.debug?.visibleTextShown && state.debug?.status === '生成中') {
    conversationAutoScrollSuppressed = true
  }
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
  const name = String(state.name || '').trim()
  const worldview = String(state.worldview || '').trim()
  if (!opening && !name && !worldview) return ''
  return `
    <article class="message assistant opening-message" data-message-index="-1" data-message-role="opening">
      <small>AGENT · 第0轮</small>
      ${name ? `<h2 class="opening-title">${escapeHtml(name)}</h2>` : ''}
      ${renderOpeningSection('世界观', worldview)}
      ${renderOpeningSection('开场白', opening)}
    </article>
  `
}

function renderOpeningSection(label, value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return `
    <section class="opening-section">
      <strong>${escapeHtml(label)}</strong>
      <div class="message-body">${renderDecoratedText(text, { role: 'assistant' })}</div>
    </section>
  `
}

function renderOptions() {
  const options = normalizeInitialPlayerOptions(state.playerOptions || [])
  if (options.length === 0) {
    els.optionTray.innerHTML = ''
    return
  }
  els.optionTray.innerHTML = options.map(option => `
    <button class="option-button" type="button" data-option-type="${escapeAttr(option.type || '')}" data-option-direction="${escapeAttr(option.direction || '')}">
      <span>${escapeHtml(option.direction || '')}</span>
    </button>
  `).join('')

  els.optionTray.querySelectorAll('[data-option-direction]').forEach(button => {
    button.addEventListener('click', event => {
      const direction = event.currentTarget.dataset.optionDirection || ''
      els.playerInput.value = direction
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
  const pending = getPendingSummary()
  const canContinueGeneration = state.debug?.status === 'error' && Boolean(getRegenerationSnapshot())
  els.retryStageButton.disabled = generationBusy || (!pending && !canContinueGeneration)
  els.retryStageButton.title = pending
    ? '上一轮正文已生成，但 Summary 未完成。点击只重试Summary。'
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

function normalizeSummaryJob(value) {
  if (!value || typeof value !== 'object') return null
  const playerInput = String(value.playerInput || '').trim()
  const finalText = String(value.finalText || '').trim()
  if (!playerInput || !finalText) return null
  const job = deepClone(value)
  return {
    ...job,
    id: String(value.id || makeId('postprocess-job')),
    status: ['queued', 'running', 'error'].includes(value.status) ? value.status : 'queued',
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
    director: job.director || {},
    recentDirectorPlans: normalizeDirectorHistory(job.recentDirectorPlans),
  }
}

function enqueueSummaryJob(job) {
  const normalized = normalizeSummaryJob(job)
  if (!normalized) return
  state.postprocessQueue = Array.isArray(state.postprocessQueue) ? state.postprocessQueue : []
  if (!state.postprocessQueue.some(item => item.id === normalized.id)) state.postprocessQueue.push(normalized)
}

async function submitTurn() {
  const playerInput = els.playerInput.value.trim()
  if (!playerInput) return
  const missingProviders = requiredProvidersForPipeline().filter(provider => !hasRuntimeApiKey(provider))
  if (missingProviders.length) {
    alert(`请先配置 ${missingProviders.map(providerLabel).join('、')} API Key。`)
    return
  }

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
    alert('上一轮用户输入为空，不能重新生成。')
    return
  }
  restoreTurnSnapshot(snapshot)
  await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'regenerating' })
}

async function continueUnfinishedTurn() {
  const pending = getPendingSummary()
  if (pending) {
    await retryPendingSummary(pending)
    return
  }
  const recovery = state.debug?.postprocessRecoveryBase
  const director = state.debug?.director
  const planFeedback = state.debug?.planFeedback
  const snapshot = getRegenerationSnapshot()
  if (state.debug?.status === 'error' && recovery?.playerInput && snapshot?.playerInput) {
    restoreTurnSnapshot(snapshot)
    await generateTurn(recovery.playerInput, {
      snapshot,
      modeLabel: 'continuing',
      requestPayload: {
        ...recovery,
        director: director && typeof director === 'object' ? director : recovery.director,
        planFeedback: planFeedback && typeof planFeedback === 'object' ? planFeedback : recovery.planFeedback,
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        reasoningEffort: getRequestReasoningEffort(),
        model: getActiveModel(),
        pipelineModels: getPipelineModelsForRequest(),
      },
    })
    return
  }
  if (state.debug?.status === 'error' && snapshot?.playerInput) {
    restoreTurnSnapshot(snapshot)
    await generateTurn(snapshot.playerInput, { snapshot, modeLabel: 'continuing' })
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
  saveState()
  render()
}

function getPendingSummary() {
  const queuedError = Array.isArray(state.postprocessQueue) ? state.postprocessQueue.find(item => item?.status === 'error') : null
  if (queuedError) return queuedError
  const pending = state.debug?.pendingSummary
  if (!state.debug?.postprocessPending) return null
  if (!pending || typeof pending !== 'object') return buildPendingSummaryFromState()
  if (!String(pending.finalText || '').trim()) return null
  return pending
}

function buildPendingSummaryFromState() {
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
    director: currentDirectorPlanForRequest(),
    recentDirectorPlans: normalizeDirectorHistory(state.directorHistory),
    recentTurns: messages
      .slice(Math.max(0, assistantIndex - 10), assistantIndex)
      .filter(message => message.role === 'user' || message.role === 'assistant'),
    characters: state.characters,
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    itemState: state.itemState,
    keyInfo: state.keyInfo,
    longTermState: buildLongTermStateFromState(),
    controlledCharacterName: state.controlledCharacterName,
    playerOptions: state.playerOptions,
    physicalConstraints: state.physicalConstraints,
    globalContext: buildHistoricalSummaryForRequest(),
    feedbackText: renderDirectorFeedbackMemory(),
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: completedAssistantTurnCount(),
    model: getActiveModel(),
    promptVersion: config.promptVersion,
    temperature: defaultTemperature,
    createdAt: new Date().toISOString(),
  }
}

async function retryPendingSummary(pending) {
  const streamController = beginActiveStream()
  setBusy(true)
  state.debug.status = '重试 Summary'
  state.debug.error = ''
  state.debug.note = '正在重试上一轮未完成的 Summary；完成后会补上状态、总结和反重复提醒。'
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
        pipelineModels: getPipelineModelsForRequest(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Summary 重试失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('Summary 重试失败：没有收到最终结果。')

    removeTrailingErrorMessages()
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : state.playerOptions
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingSummary = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
    if (payload.postprocessSummary) state.debug.postprocessSummary = payload.postprocessSummary
    if (payload.planFeedback) state.debug.planFeedback = payload.planFeedback
    if (pending.id) state.postprocessQueue = (state.postprocessQueue || []).filter(item => item.id !== pending.id)
    setPreferredModel(payload.model || getActiveModel())
    applySummary(payload)
    persistSummaryResult()
    startRecallWorkerPolling(completedAssistantTurnCount())
  } catch (error) {
    if (streamController.signal.aborted) return
    state.debug.status = 'error'
    state.debug.postprocessPending = true
    state.debug.error = error.message
    state.debug.note = 'Summary 仍未完成。可再次点击“继续未完成”。'
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

async function processSummaryQueue() {
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
    pendingSummary: null,
    note: job.summaryOnly
      ? 'Summary 正在后台更新总结和状态；不阻塞下一轮输入。'
      : 'Summary 正在后台更新总结和状态；不阻塞下一轮输入。',
  }
  saveState()
  renderSummarySideEffects()

  try {
    const response = await fetch('/api/postprocess-stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...job,
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        model: getActiveModel(),
        pipelineModels: getPipelineModelsForRequest(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Summary 队列任务失败')
    }
    const payload = await readNdjsonStream(response, handlePipelineEvent)
    if (!payload) throw new Error('Summary 队列任务失败：没有收到最终结果。')
    state.postprocessQueue = state.postprocessQueue.filter(item => item.id !== job.id)
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : state.playerOptions
    if (payload.postprocessSummary) state.debug.postprocessSummary = payload.postprocessSummary
    if (payload.planFeedback) state.debug.planFeedback = payload.planFeedback
    state.debug.postprocessPending = false
    state.debug.pendingSummary = null
    state.debug.note = 'Summary 队列已完成一个任务。'
    setPreferredModel(payload.model || getActiveModel())
    applySummary(payload)
    persistSummaryResult()
    startRecallWorkerPolling(completedAssistantTurnCount())
  } catch (error) {
    job.status = 'error'
    job.error = error.message
    job.updatedAt = new Date().toISOString()
    state.debug.postprocessPending = true
    state.debug.pendingSummary = job
    state.debug.note = 'Summary 队列任务失败；可点击“继续未完成”重试，不影响继续游戏。'
    state.debug.error = error.message
    saveState()
    renderSummarySideEffects()
  } finally {
    postprocessQueueRunning = false
    if (state.postprocessQueue?.some(item => item?.status === 'queued')) processSummaryQueue()
  }
}

async function generateTurn(playerInput, { snapshot, modeLabel = 'running', requestPayload = null } = {}) {
  await refreshRuntimeConfig()
  await syncPromptVersionState()
  const streamController = beginActiveStream()
  conversationAutoScrollSuppressed = false
  setBusy(true)
  const startedAt = Date.now()
  const generationPipeline = runtimeGenerationPipeline()
  if (snapshot) state.lastTurnSnapshot = snapshot
  state.messages.push({ role: 'user', content: playerInput })
  state.debug = {
    status: modeLabel,
    startedAt,
    pipelineMode: generationPipeline.mode,
    note: modeLabel === 'regenerating'
      ? '正在回滚并重新生成本次对话；会使用当前模型和配置完整重跑。'
      : modeLabel === 'continuing'
        ? '继续未完成：按当前状态重新执行未完成流程。'
        : generationPipeline.note,
    visibleTextShown: false,
    postprocessPending: false,
    progress: pendingPipelineProgressRows(generationPipeline),
    director: null,
    narrator: null,
    postprocess: null,
    pendingSummary: null,
    postprocessRecoveryBase: null,
  }
  els.playerInput.value = ''
  render()

  try {
    const effectiveRequestPayload = requestPayload || buildGenerateRequestPayload(playerInput)
    const requestModel = normalizeModel(effectiveRequestPayload.model || getActiveModel())
    setPreferredModel(requestModel)
    state.debug.postprocessRecoveryBase = sanitizeSummaryRecoveryBase(effectiveRequestPayload)
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
    state.playerOptions = Array.isArray(payload.playerOptions) ? payload.playerOptions : state.playerOptions
    state.feedbackMemory = mergeFeedbackMemory(state.feedbackMemory, payload)
    if (Array.isArray(payload.physicalConstraints)) {
      state.physicalConstraints = normalizePhysicalConstraints(payload.physicalConstraints)
    }
    if (Array.isArray(payload.keyInfo)) {
      state.keyInfo = normalizeKeyInfo(payload.keyInfo)
    }
    if (payload.longTermState && typeof payload.longTermState === 'object') {
      state.longTermState = normalizeLongTermState(payload.longTermState, state)
    }
    state.debug.status = 'done'
    state.debug.postprocessPending = false
    state.debug.pendingSummary = null
    state.debug.postprocessRecoveryBase = null
    state.debug.pipelineMode = payload.pipelineMode
    state.debug.director = payload.director
    applyDirectorPlanState(payload.director)
    state.debug.narrator = payload.narrator
    if (payload.planFeedback) state.debug.planFeedback = payload.planFeedback
    state.debug.postprocess = null
    state.directorHistory = appendDirectorHistory(state.directorHistory, payload.director)
    setPreferredModel(payload.model || requestModel)
    enqueueSummaryJob(payload.pendingSummary)
    saveState()
    renderGenerationCompletionSideEffects()
    processSummaryQueue()
    startRecallWorkerPolling(completedAssistantTurnCount())
  } catch (error) {
    if (streamController.signal.aborted) return
    state.debug.status = 'error'
    state.debug.error = error.message
    markRunningPipelineStageError(error.message)
    if (state.debug.visibleTextShown) {
      state.debug.postprocessPending = true
      state.debug.pendingSummary = buildPendingSummaryFromState()
      state.debug.note = '正文已显示，但前台反馈或后台总结未完成。点击“继续未完成”补上候选项、总结和状态。'
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
    storyContext: buildStoryContextForRequest(),
    globalContext: buildHistoricalSummaryForRequest(),
    feedbackText: renderDirectorFeedbackMemory(),
    physicalConstraints: state.physicalConstraints,
    directorStyle: state.directorStyle,
    narratorStyle: state.narratorStyle,
    turnIndex: nextAssistantTurnIndex(),
    recentTurns: buildRecentTurnsForRequest(playerInput),
    recentDirectorPlans: normalizeDirectorHistory(state.directorHistory),
    characters: state.characters,
    statusSchema: state.statusSchema,
    statusRoster: state.statusRoster,
    statusState: state.statusState,
    itemState: state.itemState,
    keyInfo: state.keyInfo,
    longTermState: buildLongTermStateFromState(),
    controlledCharacterName: state.controlledCharacterName,
    model: getActiveModel(),
    promptVersion: config.promptVersion,
    pipelineModels: getPipelineModelsForRequest(),
    apiKey: getPipelineApiKey(),
    apiKeys: getPipelineApiKeys(),
    temperature: defaultTemperature,
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
  state.model = getActiveModel()
}

function sanitizeSummaryRecoveryBase(payload) {
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
    'physicalConstraints',
    'keyInfo',
    'longTermState',
    'directorStyle',
    'narratorStyle',
    'plotLines',
    'feedbackMemory',
    'directorHistory',
    'controlledCharacterName',
    'storyAssetId',
    'programConfigFile',
    'statusSchema',
    'statusRoster',
    'statusState',
    'itemState',
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

function startRecallWorkerPolling(turnIndex = completedAssistantTurnCount(), durationMs = 90_000) {
  const normalizedTurn = Math.max(0, Math.floor(Number(turnIndex) || 0))
  if (!state.id || !normalizedTurn) return
  recallWorkerPollDeadlineMs = Math.max(recallWorkerPollDeadlineMs, Date.now() + durationMs)
  pollRecallWorkerEvents(normalizedTurn)
  if (recallWorkerPollTimer) return
  recallWorkerPollTimer = setInterval(() => {
    if (Date.now() > recallWorkerPollDeadlineMs) {
      stopRecallWorkerPolling()
      return
    }
    pollRecallWorkerEvents(normalizedTurn)
  }, 1500)
}

function stopRecallWorkerPolling() {
  if (!recallWorkerPollTimer) return
  clearInterval(recallWorkerPollTimer)
  recallWorkerPollTimer = null
}

async function pollRecallWorkerEvents(turnIndex = completedAssistantTurnCount()) {
  try {
    const params = new URLSearchParams({
      storyId: state.id || '',
      storyName: state.name || '',
      turnIndex: String(turnIndex),
    })
    if (lastRecallWorkerEventId) params.set('after', lastRecallWorkerEventId)
    const response = await fetch(`/api/recall-worker-events?${params.toString()}`)
    if (!response.ok) return []
    const payload = await response.json().catch(() => ({}))
    applyRecallWorkerEvents(payload.events)
    return Array.isArray(payload.events) ? payload.events : []
  } catch {
    // RecallWorker 是旁路调试信息，轮询失败不影响主游戏流程。
    return []
  }
}

async function ensureRecallWorkerForLatestTurn() {
  const pending = buildPendingSummaryFromState()
  if (!pending) return
  const turnIndex = completedAssistantTurnCount()
  await pollRecallWorkerEvents(turnIndex)
  if (hasRecallWorkerEventForTurn(turnIndex)) {
    startRecallWorkerPolling(turnIndex, 30_000)
    return
  }
  try {
    const response = await fetch('/api/recall-worker/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...pending,
        basis: 'frontend-retry',
        apiKey: getPipelineApiKey(),
        apiKeys: getPipelineApiKeys(),
        model: getActiveModel(),
        pipelineModels: getPipelineModelsForRequest(),
        reasoningEffort: getRequestReasoningEffort(),
      }),
    })
    if (response.ok) startRecallWorkerPolling(turnIndex)
  } catch {
    // 旁路召回可重试，刷新后会再次尝试。
  }
}

function hasRecallWorkerEventForTurn(turnIndex) {
  const target = Math.max(0, Math.floor(Number(turnIndex) || 0))
  return (state.debug?.recallWorkerEvents || []).some(event => Math.floor(Number(event?.createdAtTurn)) === target)
}

function applyRecallWorkerEvents(events) {
  if (!Array.isArray(events) || !events.length) return
  state.debug = state.debug || {}
  const known = new Set((state.debug.recallWorkerEvents || []).map(item => String(item.id || '')))
  const fresh = events
    .filter(event => event && typeof event === 'object')
    .filter(event => event.id && !known.has(String(event.id)))
    .map(event => ({
      id: String(event.id || ''),
      createdAt: String(event.createdAt || ''),
      createdAtTurn: Math.floor(Number(event.createdAtTurn) || 0),
      basis: String(event.basis || ''),
      output: normalizeRecallWorkerOutputForDisplay(event.output),
    }))
  if (!fresh.length) return

  state.debug.recallWorkerEvents = [
    ...(Array.isArray(state.debug.recallWorkerEvents) ? state.debug.recallWorkerEvents : []),
    ...fresh,
  ].slice(-8)
  lastRecallWorkerEventId = String(fresh[fresh.length - 1].id || lastRecallWorkerEventId)

  const progress = Array.isArray(state.debug.progress) ? state.debug.progress : []
  let row = progress.find(item => item.stage === 'recall')
  if (!row) {
    row = { stage: 'recall', label: 'RecallWorker', status: 'pending', logs: [] }
    progress.push(row)
  }
  row.label = 'RecallWorker'
  row.status = 'done'
  row.logs = Array.isArray(row.logs) ? row.logs : []
  for (const event of fresh) {
    const basis = event.basis || 'recall'
    const turns = Array.isArray(event.output?.loadedTurnIndexes) ? event.output.loadedTurnIndexes : []
    row.logs.push(`${basis}｜召回轮次：${turns.length ? turns.join('、') : '无'}`)
  }
  row.logs = row.logs.slice(-8)
  row.message = '旁路召回已完成，只显示召回轮次。'
  row.updatedAt = fresh[fresh.length - 1].createdAt || new Date().toISOString()
  row.updatedAtMs = Date.parse(row.updatedAt) || Date.now()
  row.endedAtMs = row.updatedAtMs
  state.debug.progress = progress
  saveState()
  renderDebug()
}

function handlePipelineEvent(event) {
  if (event.type === 'visible_text_delta') {
    applyVisibleTextDeltaEvent(event)
    return
  }
  if (event.type === 'visible_text') {
    applyVisibleTextEvent(event)
    return
  }

  const stage = event.stage
  if (!stage) return
  const stateStage = stage
  const eventMs = Date.parse(event.at || '') || Date.now()
  if (!state.debug.firstEventAtMs) state.debug.firstEventAtMs = eventMs
  const progress = Array.isArray(state.debug.progress) ? state.debug.progress : []
  let row = progress.find(item => item.stage === stateStage)
  if (!row) {
    row = { stage: stateStage, label: event.label || stateStage, status: 'pending' }
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
    if (event.json) state.debug[stateStage] = event.json
    if (stage === 'director') applyDirectorPlanState(event.json)
  }
  if (event.type === 'stage_result') {
    row.status = 'done'
    row.endedAtMs = eventMs
    state.debug[stateStage] = event.json
    if (stage === 'director') applyDirectorPlanState(event.json)
  }

  state.debug.progress = progress
  renderDebug()
  refreshPipelineDebugTimer()
}

function applyVisibleTextDeltaEvent(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  const textDelta = String(payload.textDelta || '')
  if (!textDelta) return
  const shouldRenderConversation = !state.debug.visibleTextShown

  if (state.debug.visibleTextShown) {
    const last = state.messages[state.messages.length - 1]
    if (last?.role === 'assistant') last.content = `${last.content || ''}${textDelta}`
  } else {
    state.messages.push({ role: 'assistant', content: textDelta })
  }

  state.debug.visibleTextShown = true
  state.debug.postprocessPending = false
  state.debug.pendingSummary = null
  state.debug.status = '生成中'
  state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
  state.debug.note = '正文流式输出中；候选项稍后生成。'

  renderConversation({ scrollTarget: 'stream-follow' })
  saveState()
  renderReadingJumpControls()
  renderDebug()
  renderRetryStageButton()
  renderRollbackTurnButton()
  renderRegenerateButton()
  els.sendButton.textContent = '发送'
  els.regenerateButton.textContent = '重新生成本次对话'
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
  refreshPipelineDebugTimer()
}

function applyVisibleTextEvent(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  const finalText = String(payload.finalText || event.finalText || '').trim()
  if (!finalText) return
  const shouldRenderConversation = !state.debug.visibleTextShown

  if (state.debug.visibleTextShown) {
    const last = state.messages[state.messages.length - 1]
    if (last?.role === 'assistant') last.content = finalText
  } else {
    state.messages.push({ role: 'assistant', content: finalText })
  }

  if (Array.isArray(payload.playerOptions)) state.playerOptions = payload.playerOptions
  state.debug.visibleTextShown = true
  state.debug.postprocessPending = false
  state.debug.pendingSummary = null
  state.debug.status = '生成中'
  state.debug.pipelineMode = payload.pipelineMode || state.debug.pipelineMode
  state.debug.note = Array.isArray(payload.playerOptions)
    ? '候选项已更新；Summary 稍后后台更新。'
    : '正文已显示；候选项生成中。'

  if (shouldRenderConversation) renderConversation({ scrollTarget: 'latest-assistant-start' })
  renderOptions()
  saveState()
  renderReadingJumpControls()
  renderDebug()
  renderRetryStageButton()
  renderRollbackTurnButton()
  renderRegenerateButton()
  els.sendButton.textContent = '发送'
  els.regenerateButton.textContent = '重新生成本次对话'
}

function renderGenerationCompletionSideEffects() {
  renderStatusPanel()
  renderStoryTracking()
  renderOptions()
  renderReadingJumpControls()
  renderDebug()
  renderRetryStageButton()
  renderRollbackTurnButton()
  renderRegenerateButton()
  renderTurnStatus()
}

function applySummary(payload) {
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
  if (!payload.skipFeedbackMemoryUpdate) state.feedbackMemory = mergeFeedbackMemory(state.feedbackMemory, payload)
  if (Array.isArray(payload.statusSchema)) {
    state.statusSchema = payload.statusSchema
  }
  if (Array.isArray(payload.statusRoster)) {
    state.statusRoster = payload.statusRoster
  }
  if (payload.statusState && typeof payload.statusState === 'object') {
    state.statusState = payload.statusState
  }
  state.itemState = {}
  if (Array.isArray(payload.keyInfo)) {
    state.keyInfo = normalizeKeyInfo(payload.keyInfo)
  }
  if (payload.longTermState && typeof payload.longTermState === 'object') {
    state.longTermState = normalizeLongTermState(payload.longTermState, state)
  } else {
    state.longTermState = buildLongTermStateFromState()
  }
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

function parseHistorySummaryLines(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
}

function formatHistorySummaryLines(lines) {
  return lines.map(line => `- ${String(line || '').trim().replace(/^-\s*/, '')}`).filter(line => line !== '- ').join('\n')
}

function buildHistoricalSummaryForRequest() {
  const lines = parseHistorySummaryLines(state.globalContext || state.chapterSummary)
  if (lines.length <= 5) return ''
  return formatHistorySummaryLines(lines.slice(0, -5))
}

function removeTrailingErrorMessages() {
  while (state.messages[state.messages.length - 1]?.role === 'error') {
    state.messages.pop()
  }
}

function setBusy(isBusy) {
  generationBusy = isBusy
  if (!isBusy) refreshPipelineDebugTimer()
  const postprocessPending = Boolean(getPendingSummary())
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
  } else if (/\.epub$/i.test(file.name)) {
    originalText = await extractEpubText(file)
    imported = parseStorybookFile(file.name, originalText, { type: 'novel-excerpt' })
  } else if (/\.json$/i.test(file.name)) {
    originalText = await file.text()
    imported = parseStorybookFile(file.name, originalText)
  } else {
    originalText = limitNovelText(await file.text())
    imported = parseStorybookFile(file.name, originalText, { type: 'novel-excerpt' })
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

function parseStorybookFile(filename, text, options = {}) {
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
      type: options.type || 'markdown',
      tags: [cleanName],
      content: section.content,
      enabled: true,
    }))
      : [plainStoryEntry(cleanName, text, options.type || 'text')],
    characters: [],
  }
}

function limitNovelText(text) {
  return String(text || '').replace(/\u0000/g, '').slice(0, novelImportCharacterLimit)
}

async function extractEpubText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const entries = readZipEntries(arrayBuffer)
  const readableEntries = entries
    .filter(entry => /\.(xhtml|html|htm|xml|txt)$/i.test(entry.name))
    .filter(entry => !/(^|\/)(META-INF|mimetype|toc\.ncx|container\.xml)(\/|$)/i.test(entry.name))
    .sort((a, b) => epubEntrySortKey(a.name).localeCompare(epubEntrySortKey(b.name), undefined, { numeric: true }))
  const chunks = []
  for (const entry of readableEntries) {
    if (chunks.join('\n\n').length >= novelImportCharacterLimit) break
    const bytes = await readZipEntryBytes(entry)
    const raw = new TextDecoder().decode(bytes)
    const text = /\.(xhtml|html|htm|xml)$/i.test(entry.name) ? htmlToText(raw) : raw
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean) chunks.push(clean)
  }
  const excerpt = limitNovelText(chunks.join('\n\n'))
  if (!excerpt) throw new Error('EPUB 未提取到可用正文。')
  return excerpt
}

function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  let endOffset = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65558); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset
      break
    }
  }
  if (endOffset < 0) throw new Error('EPUB 文件结构无效。')
  const centralDirectorySize = view.getUint32(endOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true)
  const entries = []
  let offset = centralDirectoryOffset
  const end = centralDirectoryOffset + centralDirectorySize
  while (offset < end && view.getUint32(offset, true) === 0x02014b50) {
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength))
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset, bytes })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function readZipEntryBytes(entry) {
  const view = new DataView(entry.bytes.buffer)
  const offset = entry.localHeaderOffset
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`EPUB 条目无效：${entry.name}`)
  const nameLength = view.getUint16(offset + 26, true)
  const extraLength = view.getUint16(offset + 28, true)
  const dataStart = offset + 30 + nameLength + extraLength
  const compressed = entry.bytes.slice(dataStart, dataStart + entry.compressedSize)
  if (entry.method === 0) return compressed
  if (entry.method === 8) return inflateRawBytes(compressed, entry.uncompressedSize)
  throw new Error(`EPUB 压缩格式不支持：${entry.name}`)
}

async function inflateRawBytes(bytes, expectedSize) {
  if (!window.DecompressionStream) throw new Error('当前浏览器不支持解压 EPUB。')
  for (const format of ['deflate-raw', 'deflate']) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))
      const arrayBuffer = await new Response(stream).arrayBuffer()
      const output = new Uint8Array(arrayBuffer)
      if (!expectedSize || output.length === expectedSize) return output
    } catch {
      // try next format
    }
  }
  throw new Error('EPUB 解压失败。')
}

function epubEntrySortKey(name) {
  const normalized = name.toLowerCase()
  const score = /chapter|chap|第.+章|正文|text|content/.test(normalized) ? '0' : '1'
  return `${score}/${normalized}`
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|section|article|li|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function plainStoryEntry(title, text, type = 'text') {
  return {
    id: makeId(`story.${slug(title)}`),
    title,
    type,
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

function persistSummaryResult() {
  saveState()
  renderSummarySideEffects()
}

function renderSummarySideEffects() {
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

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value))
  return String(value).replace(/["\\]/g, '\\$&')
}
