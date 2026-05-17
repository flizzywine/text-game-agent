import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface RecallKeywordInput {
  playerInput?: string
  controlledCharacterName?: string
  statusRoster?: string[]
  statusState?: Record<string, Record<string, string>>
}

export interface RawTurnLogEntry {
  storyId?: string
  storyName?: string
  turnIndex: number
  playerInput: string
  finalText: string
  createdAt: string
}

export interface RecallSearchOptions {
  storyId?: string
  currentTurnIndex?: number
  excludeRecentTurnCount?: number
  maxResults?: number
}

export interface RecallResult extends RawTurnLogEntry {
  matchedKeywords: string[]
  source: string
  text: string
}

export interface HistoricalSummaryRenderOptions {
  currentTurnIndex: number
  excludeRecentTurnCount: number
  limit?: number
}

interface TurnSummaryEntry {
  startTurn: number
  endTurn: number
  text: string
  raw: string
}

const stopWords = new Set([
  '之前',
  '上次',
  '刚才',
  '后来',
  '那个',
  '这个',
  '这里',
  '那里',
  '什么',
  '怎么',
  '为什么',
  '还记得',
  '记得',
  '一下',
])

export function extractRecallKeywords(input: RecallKeywordInput): string[] {
  const keywords: string[] = []
  const add = (value: unknown) => {
    const text = String(value || '').trim()
    if (!text || text.length < 2 || stopWords.has(text)) return
    if (!keywords.includes(text)) keywords.push(text)
  }

  for (const name of input.statusRoster || []) add(name)
  add(input.controlledCharacterName)

  for (const [name, state] of Object.entries(input.statusState || {})) {
    add(name)
    add(state?.位置)
  }

  const text = String(input.playerInput || '')
  const cjkChunks = text.match(/[\p{Script=Han}A-Za-z0-9_]{2,}/gu) || []
  for (const chunk of cjkChunks) {
    const compact = chunk.trim()
    if (!compact || stopWords.has(compact)) continue
    if (compact.length <= 6) {
      add(compact)
      continue
    }
    for (const part of compact.split(/[，。！？、；：,.!?;:\s]+/u)) add(part)
    for (let size = 2; size <= 3; size += 1) {
      for (let i = 0; i <= compact.length - size; i += 1) add(compact.slice(i, i + size))
    }
  }

  return keywords.slice(0, 24)
}

export function appendRawTurnLog(filePath: string, entry: RawTurnLogEntry): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf-8')
  fs.appendFileSync(rawTurnStoryTextPath(filePath), renderStoryTextEntry(entry), 'utf-8')
}

export function appendTurnSummary(filePath: string, turnIndex: number, summary: unknown): void {
  const text = normalizeTurnSummaryLine(turnIndex, summary)
  if (!text) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
  const lines = current.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const prefix = `第${turnIndex}轮：`
  const kept = lines.filter(line => !line.startsWith(prefix))
  kept.push(text)
  fs.writeFileSync(filePath, `${kept.join('\n')}\n`, 'utf-8')
}

export function appendTurnSummaryL2(filePath: string, startTurn: number, endTurn: number, summary: unknown): void {
  const text = normalizeTurnSummaryL2Line(startTurn, endTurn, summary)
  if (!text) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
  const lines = current.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const prefix = `第${Math.max(1, Math.floor(startTurn))}-${Math.max(1, Math.floor(endTurn))}轮：`
  const kept = lines.filter(line => !line.startsWith(prefix))
  kept.push(text)
  fs.writeFileSync(filePath, `${kept.join('\n')}\n`, 'utf-8')
}

export function renderTurnSummariesFile(filePath: string, summaries: unknown): void {
  const lines = normalizeTurnSummaryLines(summaries)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, lines.length ? `${lines.join('\n')}\n` : '', 'utf-8')
}

export function readTurnSummaries(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8').trim()
}

export function readTurnSummaryL2(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8').trim()
}

export function renderHistoricalSummariesWithL2(
  l1Summaries: unknown,
  l2Summaries: unknown,
  options: HistoricalSummaryRenderOptions,
): string {
  const cutoff = Number(options.currentTurnIndex) - options.excludeRecentTurnCount
  const replacementMaxEndTurn = Number(options.currentTurnIndex) - 15
  const l2ByStart = new Map(parseTurnSummaryEntries(l2Summaries)
    .filter(entry => entry.startTurn >= 1 && entry.endTurn - entry.startTurn === 9 && entry.endTurn <= replacementMaxEndTurn)
    .map(entry => [entry.startTurn, entry]))
  const lines: string[] = []
  const emittedL2 = new Set<number>()

  for (const entry of parseTurnSummaryEntries(l1Summaries)) {
    if (entry.endTurn >= cutoff) continue
    const blockStart = Math.floor((entry.startTurn - 1) / 10) * 10 + 1
    const l2 = l2ByStart.get(blockStart)
    if (l2 && entry.startTurn >= l2.startTurn && entry.endTurn <= l2.endTurn) {
      if (!emittedL2.has(l2.startTurn)) {
        lines.push(l2.raw)
        emittedL2.add(l2.startTurn)
      }
      continue
    }
    lines.push(entry.raw)
  }

  const kept = Number.isFinite(options.limit) ? lines.slice(-Math.max(0, Number(options.limit))) : lines
  return kept.map(line => `- ${line}`).join('\n')
}

export function readStoryTurnsByIndex(filePath: string, turnIndexes: number[]): RecallResult[] {
  const indexes = new Set(turnIndexes.map(item => Math.floor(Number(item))).filter(item => Number.isFinite(item) && item >= 0).slice(0, 2))
  const storyPath = rawTurnStoryTextPath(filePath)
  if (!indexes.size || !fs.existsSync(storyPath)) return []
  const results: RecallResult[] = []
  const text = fs.readFileSync(storyPath, 'utf-8')
  for (const turnIndex of indexes) {
    const match = text.match(new RegExp(`(?:^|\\n)(第${turnIndex}轮 玩家输入[\\s\\S]*?第${turnIndex}轮 正文[\\s\\S]*?)(?=\\n第\\d+轮 玩家输入|$)`))
    const block = match?.[1]?.trim()
    if (!block) continue
      results.push({
        storyId: '',
        storyName: '',
        turnIndex,
        playerInput: extractSectionText(block, '玩家输入'),
        finalText: extractSectionText(block, '正文'),
        createdAt: '',
        matchedKeywords: [],
        source: `story.txt#第${turnIndex}轮`,
        text: block,
      })
  }
  return results.sort((a, b) => a.turnIndex - b.turnIndex)
}

export function searchRawTurnLogWithGrep(
  filePath: string,
  keywords: string[],
  options: RecallSearchOptions = {},
): RecallResult[] {
  const cleanKeywords = Array.from(new Set(keywords.map(item => String(item || '').trim()).filter(item => item.length >= 2))).slice(0, 12)
  if (!cleanKeywords.length || !fs.existsSync(filePath)) return []

  const storyPath = rawTurnStoryTextPath(filePath)
  const searchPath = fs.existsSync(storyPath) ? storyPath : filePath
  if (!fs.existsSync(searchPath)) return []

  const pattern = cleanKeywords.map(escapeExtendedRegex).join('|')
  const grep = spawnSync('rg', ['-i', '-n', '-C', '2', '-e', pattern, searchPath], {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  })
  if (grep.status !== 0 && grep.status !== 1) return []

  const seen = new Set<string>()
  const rows: RecallResult[] = []
  for (const block of parseRgBlocks(String(grep.stdout || ''))) {
    const text = block.lines.map(line => line.text).join('\n').trim()
    const turnIndex = findTurnIndex(text)
    if (!turnIndex) continue
    if (Number.isFinite(options.currentTurnIndex)) {
      const cutoff = Number(options.currentTurnIndex) - (options.excludeRecentTurnCount ?? 5)
      if (turnIndex >= cutoff) continue
    }
    const key = String(turnIndex)
    if (seen.has(key)) continue
    const matchedKeywords = cleanKeywords.filter(keyword => text.toLowerCase().includes(keyword.toLowerCase()))
    if (!matchedKeywords.length) continue
    seen.add(key)
    rows.push({
      storyId: options.storyId || '',
      storyName: '',
      turnIndex,
      playerInput: extractSectionText(text, '玩家输入'),
      finalText: extractSectionText(text, '正文'),
      createdAt: '',
      matchedKeywords,
      source: `${path.basename(searchPath)}#第${turnIndex}轮:${block.startLine}-${block.endLine}`,
      text,
    })
  }

  return rows
    .sort((a, b) => Math.abs((options.currentTurnIndex ?? a.turnIndex) - a.turnIndex) - Math.abs((options.currentTurnIndex ?? b.turnIndex) - b.turnIndex))
    .slice(0, options.maxResults ?? 4)
}

export function buildRecallEvidenceBlock(results: RecallResult[]): string {
  if (!results.length) return '（无）'
  return results.map(result => {
    const matchText = result.matchedKeywords.length ? `，匹配：${result.matchedKeywords.join('、')}` : ''
    return `- ${result.source}（第${result.turnIndex}轮${matchText}）\n${compactRecallText(result.text, 1200)}`
  }).join('\n')
}

export function buildRecallSnippetBlock(results: RecallResult[], maxTurns = 2, maxCharsPerTurn = 1800): string {
  const picked = results.slice(0, Math.max(0, Math.floor(maxTurns)))
  if (!picked.length) return '（无）'
  return picked.map(result => {
    return [
      `## 旧正文摘录：${result.source}`,
      compactRecallText(result.text, maxCharsPerTurn),
    ].join('\n')
  }).join('\n\n')
}

function escapeExtendedRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

function compactText(value: unknown, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

export function rawTurnStoryTextPath(filePath: string): string {
  return path.join(path.dirname(filePath), 'story.txt')
}

export function turnSummariesPath(filePath: string): string {
  return path.join(path.dirname(filePath), 'turn-summaries.txt')
}

export function turnSummaryL2Path(filePath: string): string {
  return path.join(path.dirname(filePath), 'turn-summaries-l2.txt')
}

export function renderStoryTextEntry(entry: RawTurnLogEntry): string {
  const lines = [
    '',
    `第${entry.turnIndex}轮 玩家输入`,
    ...paragraphLines(entry.playerInput),
    '',
    `第${entry.turnIndex}轮 正文`,
    ...paragraphLines(entry.finalText),
    '',
  ]
  return `${lines.join('\n')}\n`
}

function paragraphLines(value: unknown): string[] {
  const lines = String(value || '')
    .split(/\n{2,}|\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return lines.length ? lines : ['（空）']
}

function parseRgBlocks(output: string): Array<{ startLine: number; endLine: number; lines: Array<{ lineNumber: number; text: string }> }> {
  const blocks: Array<{ startLine: number; endLine: number; lines: Array<{ lineNumber: number; text: string }> }> = []
  let current: Array<{ lineNumber: number; text: string }> = []
  const flush = () => {
    if (!current.length) return
    blocks.push({
      startLine: current[0].lineNumber,
      endLine: current[current.length - 1].lineNumber,
      lines: current,
    })
    current = []
  }
  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine) continue
    if (rawLine === '--') {
      flush()
      continue
    }
    const match = rawLine.match(/^(\d+)([:-])(.*)$/s)
    if (!match) continue
    current.push({
      lineNumber: Number(match[1]),
      text: match[3],
    })
  }
  flush()
  return blocks
}

function findTurnIndex(text: string): number {
  const match = text.match(/第(\d+)轮\s+(?:玩家输入|正文)/)
  return match ? Number(match[1]) : 0
}

function extractSectionText(text: string, section: '玩家输入' | '正文'): string {
  const match = text.match(new RegExp(`第\\d+轮\\s+${section}\\n([\\s\\S]*?)(?=\\n第\\d+轮\\s+(?:玩家输入|正文)|$)`))
  return compactText(match?.[1], 180)
}

function compactRecallText(value: unknown, maxLength: number): string {
  const text = String(value || '').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function normalizeTurnSummaryLine(turnIndex: number, summary: unknown): string {
  const text = String(summary || '').trim().replace(/^-\s*/, '')
  if (!text) return ''
  if (/^第\d+轮[:：]/.test(text)) return text.replace(/^第(\d+)轮[:：]\s*/, (_match, index) => `第${index}轮：`)
  return `第${Math.max(0, Math.floor(turnIndex))}轮：${text}`
}

function normalizeTurnSummaryL2Line(startTurn: number, endTurn: number, summary: unknown): string {
  const start = Math.max(1, Math.floor(Number(startTurn)))
  const end = Math.max(start, Math.floor(Number(endTurn)))
  const text = String(summary || '').trim().replace(/^-\s*/, '').replace(/^第\d+-\d+轮[:：]\s*/, '')
  if (!text) return ''
  return `第${start}-${end}轮：${text}`
}

function parseTurnSummaryEntries(value: unknown): TurnSummaryEntry[] {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
    .map(line => {
      const range = line.match(/^第(\d+)-(\d+)轮[:：]\s*(.+)$/)
      if (range) {
        return {
          startTurn: Number(range[1]),
          endTurn: Number(range[2]),
          text: range[3].trim(),
          raw: `第${Number(range[1])}-${Number(range[2])}轮：${range[3].trim()}`,
        }
      }
      const single = line.match(/^第(\d+)轮[:：]\s*(.+)$/)
      if (single) {
        return {
          startTurn: Number(single[1]),
          endTurn: Number(single[1]),
          text: single[2].trim(),
          raw: `第${Number(single[1])}轮：${single[2].trim()}`,
        }
      }
      return null
    })
    .filter((entry): entry is TurnSummaryEntry => Boolean(entry && Number.isFinite(entry.startTurn) && Number.isFinite(entry.endTurn) && entry.text))
    .sort((a, b) => a.startTurn - b.startTurn || a.endTurn - b.endTurn)
}

function normalizeTurnSummaryLines(summaries: unknown): string[] {
  const lines = String(summaries || '')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)
  return lines
    .map((line, index) => {
      if (/^第\d+轮[:：]/.test(line)) return line.replace(/^第(\d+)轮[:：]\s*/, (_match, turn) => `第${turn}轮：`)
      if (/^摘要[:：]/.test(line)) return line
      return normalizeTurnSummaryLine(index + 1, line)
    })
    .filter(Boolean)
}
