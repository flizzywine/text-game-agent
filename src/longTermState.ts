import { mergeItemState, normalizeItemState } from './itemState'

export interface LongTermStateInput {
  characterStatus?: unknown
  keyItems?: unknown
  keyInfo?: unknown
  physicalConstraints?: unknown
}

export interface LongTermState {
  characterStatus: Record<string, Record<string, string>>
  keyItems: Record<string, Record<string, string>>
  keyInfo: string[]
  physicalConstraints: string[]
}

export function normalizeKeyInfo(value: unknown, maxItems = 8, maxLength = 120): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? value.split(/\r?\n/) : []
  return Array.from(new Set(items
    .map(item => String(item || '').replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(item => item.length > maxLength ? item.slice(0, maxLength).trim() : item)
  )).slice(0, maxItems)
}

export function normalizePhysicalConstraintList(value: unknown, maxItems = 5, maxLength = 100): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value] : []
  return Array.from(new Set(items
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(item => item.length > maxLength ? item.slice(0, maxLength).trim() : item)
  )).slice(0, maxItems)
}

export function normalizeLongTermState(value: unknown, fallback: LongTermStateInput = {}): LongTermState {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const characterStatus = objectRecord(firstPresent(source, ['characterStatus', '人物状态']) ?? fallback.characterStatus)
  return {
    characterStatus,
    keyItems: normalizeItemState(firstPresent(source, ['keyItems', 'itemState', '关键道具']) ?? fallback.keyItems),
    keyInfo: normalizeKeyInfo(firstPresent(source, ['keyInfo', '关键信息']) ?? fallback.keyInfo),
    physicalConstraints: normalizePhysicalConstraintList(firstPresent(source, ['physicalConstraints', '物理约束']) ?? fallback.physicalConstraints),
  }
}

export function mergeLongTermState(current: unknown, patch: LongTermStateInput = {}): LongTermState {
  const base = normalizeLongTermState(current)
  return {
    characterStatus: objectRecord(patch.characterStatus ?? base.characterStatus),
    keyItems: mergeItemState(base.keyItems, patch.keyItems ?? {}),
    keyInfo: patch.keyInfo === undefined ? base.keyInfo : normalizeKeyInfo(patch.keyInfo),
    physicalConstraints: patch.physicalConstraints === undefined ? base.physicalConstraints : normalizePhysicalConstraintList(patch.physicalConstraints),
  }
}

export function renderLongTermState(value: unknown, fallback: LongTermStateInput = {}): string {
  const state = normalizeLongTermState(value, fallback)
  return JSON.stringify({
    人物状态: state.characterStatus,
    关键道具: state.keyItems,
    关键信息: state.keyInfo,
    物理约束: state.physicalConstraints,
  })
}

function objectRecord(value: unknown): Record<string, Record<string, string>> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const output: Record<string, Record<string, string>> = {}
  for (const [key, raw] of Object.entries(source)) {
    const name = String(key || '').trim()
    if (!name) continue
    const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
    const normalized: Record<string, string> = {}
    for (const [field, item] of Object.entries(record)) {
      const fieldName = String(field || '').trim()
      const text = String(item ?? '').trim()
      if (fieldName && text) normalized[fieldName] = text
    }
    if (Object.keys(normalized).length) output[name] = normalized
  }
  return output
}

function firstPresent(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}
