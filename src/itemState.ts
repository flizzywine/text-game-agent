export type ItemState = Record<string, Record<string, string>>

const itemFieldAliases: Record<string, string> = {
  holder: '持有人',
  owner: '持有人',
  carrier: '持有人',
  location: '位置',
  place: '位置',
}

const allowedItemFields = new Set(['持有人', '位置'])

export function normalizeItemState(value: unknown): ItemState {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const output: ItemState = {}
  for (const [name, raw] of Object.entries(source).slice(0, 16)) {
    const itemName = normalizeItemName(name)
    if (!itemName) continue
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const item: Record<string, string> = {}
    for (const [field, rawValue] of Object.entries(record)) {
      const normalizedField = normalizeItemField(field)
      const text = String(rawValue ?? '').trim()
      if (!normalizedField || !text) continue
      item[normalizedField] = text
    }
    if (Object.keys(item).length) output[itemName] = item
  }
  return output
}

export function mergeItemState(current: unknown, patch: unknown, turnIndex?: number): ItemState {
  const base = normalizeItemState(current)
  const delta = normalizeItemState(patch)
  void turnIndex
  for (const [name, record] of Object.entries(delta)) {
    base[name] = {
      ...(base[name] || {}),
      ...record,
    }
  }
  return base
}

export function renderItemState(value: unknown): string {
  const state = normalizeItemState(value)
  return Object.keys(state).length ? JSON.stringify(state) : '（无）'
}

function normalizeItemName(value: unknown): string {
  const text = String(value || '').trim()
  if (text.length < 2) return ''
  if (/^(环境|场景|人物|玩家|当前操控人物|未知|其他|物品|道具|无)$/i.test(text)) return ''
  return text
}

function normalizeItemField(value: unknown): string {
  const text = String(value || '').trim()
  const normalized = itemFieldAliases[text] || text
  return allowedItemFields.has(normalized) ? normalized : ''
}
