export function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = stripJsonEnvelope(raw)
  const candidates = jsonCandidates(cleaned)
  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      return toJsonObject(JSON.parse(candidate))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    try {
      return toJsonObject(JSON.parse(repairJsonLikeText(candidate)))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  const snippet = cleaned.slice(0, 240).replace(/\s+/g, ' ')
  throw new Error(`模型没有返回合法 JSON；已尝试自动修复但失败。解析错误：${errors.slice(-1)[0] || errors[0] || 'unknown parse error'}；返回开头：${snippet}`)
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('模型返回值不是 JSON object')
  }
  return value as Record<string, unknown>
}

function stripJsonEnvelope(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function jsonCandidates(value: string): string[] {
  const candidates = new Set<string>()
  candidates.add(value)

  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.add(value.slice(start, end + 1))

  for (const candidate of [...candidates]) {
    const trimmed = candidate.trim()
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
      candidates.add(trimmed.slice(1, -1).trim())
    }
  }

  return [...candidates].filter(Boolean)
}

function repairJsonLikeText(value: string): string {
  let repaired = value.trim()
  if (repaired.startsWith('{{') && repaired.endsWith('}}')) repaired = repaired.slice(1, -1).trim()

  repaired = removeCommentsOutsideStrings(repaired)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([^\s"'{}\[\],:：]+)(\s*)：/gu, '$1"$2":')
    .replace(/([{,]\s*)([^\s"'{}\[\],:：]+)(\s*:)/gu, '$1"$2"$3')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match: string, text: string) => JSON.stringify(text.replace(/\\'/g, "'")))

  return repaired
}

function removeCommentsOutsideStrings(value: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const next = value[index + 1]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }

    if (char === '/' && next === '/') {
      while (index < value.length && value[index] !== '\n') index += 1
      output += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      index += 2
      while (index < value.length && !(value[index] === '*' && value[index + 1] === '/')) index += 1
      index += 1
      continue
    }

    output += char
  }

  return output
}
