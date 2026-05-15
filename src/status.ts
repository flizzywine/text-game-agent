export interface StatusCharacterState {
  name?: string
  gender?: string
  role?: string
  mood?: string
  location?: string
  health?: string
  trust?: string
  appearance?: string
  personality?: string
}

export const requiredStatusSchema = ['性别', '身份', '外貌', '性格', '情绪', '姿势']
export const fallbackStatusSchema = ['性别', '身份', '外貌', '性格', '情绪', '姿势', '位置']

export function parseStatusSchemaFields(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|[,，、]/)
      : []
  return items.map(item => normalizeStatusFieldName(String(item || '').replace(/^[-*]\s*/, '').split(/[：:]/)[0])).filter(Boolean)
}

export function normalizeStatusFieldName(value: unknown): string {
  const text = String(value || '').trim()
  if (text === '对玩家看法' || text === '对玩家态度') return '对当前操控人物看法'
  return text
}

export function normalizeStatusSchema(value: unknown, fallback: string[] = fallbackStatusSchema): string[] {
  const fields = parseStatusSchemaFields(value)
  const source = fields.length ? fields : fallback
  return [...new Set([...requiredStatusSchema, ...source])]
}

export function normalizeStatusRoster(value: unknown, characters: StatusCharacterState[] = []): string[] {
  const items = Array.isArray(value) ? value : []
  const names = items
    .map(item => typeof item === 'string' ? item : (item && typeof item === 'object' ? (item as Record<string, unknown>).name : ''))
    .map(item => String(item || '').trim())
    .filter(isValidStatusSubjectName)
  const characterNames = characters.map(character => String(character.name || '').trim()).filter(isValidStatusSubjectName)
  return [...new Set([...names, ...characterNames])]
}

export function isValidStatusSubjectName(name: string): boolean {
  const text = String(name || '').trim()
  if (!text) return false
  if (text.startsWith('_')) return false
  return !/^(玩家|环境|场景|候选项|选项|旁白|系统|剧情|总结|世界观|状态|未知|其他)$/i.test(text)
}

export function normalizeStatusState(
  value: unknown,
  roster: string[],
  characters: StatusCharacterState[] = [],
  schema: string[] = fallbackStatusSchema,
): Record<string, Record<string, string>> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const byName = new Map(characters.map(character => [String(character.name || '').trim(), character]))
  const output: Record<string, Record<string, string>> = {}
  for (const name of roster) {
    const raw = source[name]
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const character = byName.get(name)
    output[name] = {}
    for (const field of normalizeStatusSchema(schema)) {
      output[name][field] = statusFieldValue(field, record, character)
    }
  }
  return output
}

function statusFieldValue(field: string, record: Record<string, unknown>, character: StatusCharacterState | undefined): string {
  if (record[field] !== undefined && record[field] !== null) return String(record[field])
  const fallbackByField: Record<string, unknown> = {
    性别: record.gender || character?.gender,
    身份: record.role || character?.role || '',
    位置: record.location || character?.location,
    外显状态: record.health || character?.health,
    外貌: record.appearance || character?.appearance,
    性格: record.personality || character?.personality,
    情绪: record.mood || character?.mood,
    对当前操控人物看法: record.对当前操控人物看法 || record.对玩家看法 || record.对玩家态度 || record.trust || character?.trust || '',
  }
  return String(fallbackByField[field] || '')
}

export function buildStatusModel(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: StatusCharacterState[] }): {
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

export function renderRelevantStatus(input: { statusSchema?: unknown; statusRoster?: unknown; statusState?: unknown; characters?: StatusCharacterState[] }): string {
  const model = buildStatusModel(input)
  return JSON.stringify({ fields: model.statusSchema, people: model.statusRoster, state: model.statusState })
}

export function mergeStatusSchema(current: unknown, patch: unknown): string[] {
  return normalizeStatusSchema([...parseStatusSchemaFields(current), ...parseStatusSchemaFields(patch)])
}

export function mergeStatusRoster(current: unknown, patch: unknown, characters: StatusCharacterState[] = [], statePatch: unknown = {}): string[] {
  const patchNames = statePatch && typeof statePatch === 'object' && !Array.isArray(statePatch)
    ? Object.keys(statePatch as Record<string, unknown>).filter(isValidStatusSubjectName)
    : []
  return normalizeStatusRoster([...(Array.isArray(current) ? current : []), ...(Array.isArray(patch) ? patch : []), ...patchNames], characters)
}

export function normalizeControlledCharacterName(value: unknown): string {
  const text = String(value || '').trim()
  return text === '玩家' ? '' : text
}

export function normalizePlayableCharacters(value: unknown, statusRoster: unknown, characters: StatusCharacterState[] = [], fallback: string[] = []): string[] {
  const explicit = Array.isArray(value)
    ? value.map(item => normalizeControlledCharacterName(item)).filter(isValidStatusSubjectName)
    : []
  if (explicit.length) return [...new Set(explicit)]
  const roster = normalizeStatusRoster(statusRoster, characters)
  const source = roster.length ? roster : fallback
  return [...new Set(source.map(item => normalizeControlledCharacterName(item)).filter(isValidStatusSubjectName))].slice(0, 8)
}

export function mergeStatusState(
  current: unknown,
  patch: unknown,
  roster: string[],
  characters: StatusCharacterState[] = [],
  schema: string[] = fallbackStatusSchema,
): Record<string, Record<string, string>> {
  const base = normalizeStatusState(current, roster, characters, schema)
  const delta = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch as Record<string, unknown> : {}
  for (const [name, value] of Object.entries(delta)) {
    if (!isValidStatusSubjectName(name)) continue
    if (!roster.includes(name)) continue
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    base[name] = {
      ...(base[name] || {}),
      ...Object.fromEntries(Object.entries(record).map(([key, item]) => [key, String(item ?? '').trim()]).filter(([, item]) => item)),
    }
  }
  return base
}

export function normalizeStatusStatePatchSubjects(patch: unknown, controlledCharacterName: unknown): Record<string, unknown> {
  const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch as Record<string, unknown> : {}
  const controlled = normalizeControlledCharacterName(controlledCharacterName)
  if (!controlled) return source
  const output: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(source)) {
    const subject = ['玩家', '我', '当前操控人物'].includes(String(name).trim()) ? controlled : name
    if (!isValidStatusSubjectName(subject)) continue
    const current = output[subject] && typeof output[subject] === 'object' && !Array.isArray(output[subject]) ? output[subject] as Record<string, unknown> : {}
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    output[subject] = {
      ...current,
      ...Object.fromEntries(Object.entries(record).map(([field, item]) => [normalizeStatusFieldName(field), item])),
    }
  }
  return output
}
