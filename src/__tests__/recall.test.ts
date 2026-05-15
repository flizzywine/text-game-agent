import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendRawTurnLog,
  appendTurnSummary,
  appendTurnSummaryL2,
  buildRecallEvidenceBlock,
  extractRecallKeywords,
  rawTurnStoryTextPath,
  readStoryTurnsByIndex,
  readTurnSummaryL2,
  renderHistoricalSummariesWithL2,
  searchRawTurnLogWithGrep,
  turnSummaryL2Path,
  turnSummariesPath,
} from '../recall'

const tempDirs: string[] = []

function makeTempFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-game-recall-'))
  tempDirs.push(dir)
  return path.join(dir, 'raw-turns.jsonl')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('raw turn recall', () => {
  it('extracts visible keywords from player input and current status', () => {
    const keywords = extractRecallKeywords({
      playerInput: '我问艾莉：还记得上次藏在沙发缝里的手机吗？',
      controlledCharacterName: '洪世贤',
      statusState: {
        洪世贤: { 位置: '客厅', 姿势: '站着' },
        艾莉: { 位置: '客厅' },
      },
      statusRoster: ['洪世贤', '艾莉'],
    })

    expect(keywords).toEqual(expect.arrayContaining(['艾莉', '洪世贤', '客厅', '沙发缝', '手机']))
    expect(keywords).not.toContain('还记得')
  })

  it('appends raw jsonl and story text for grep-style line recall', () => {
    const file = makeTempFile()

    appendRawTurnLog(file, {
      storyId: 'story-a',
      storyName: '测试故事',
      turnIndex: 7,
      playerInput: '我把手机藏进沙发缝。',
      finalText: '艾莉没有看见，客厅只剩下电视声。',
      createdAt: '2026-05-15T00:00:00.000Z',
    })

    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(1)
    const entry = JSON.parse(lines[0])
    expect(entry.turnIndex).toBe(7)
    expect(entry.finalText).toContain('艾莉没有看见')
    expect(entry.searchableText).toBeUndefined()

    const storyText = fs.readFileSync(rawTurnStoryTextPath(file), 'utf-8')
    expect(storyText).toContain('第7轮 玩家输入')
    expect(storyText).toContain('我把手机藏进沙发缝。')
    expect(storyText).toContain('第7轮 正文')
    expect(storyText).toContain('艾莉没有看见，客厅只剩下电视声。')
  })

  it('appends L1 turn summaries and reads selected L0 turns from story.txt by index', () => {
    const file = makeTempFile()
    appendRawTurnLog(file, {
      storyId: 'story-a',
      storyName: '测试故事',
      turnIndex: 0,
      playerInput: '（开场）',
      finalText: '艾莉第一次来到客厅，手机还在茶几上。',
      createdAt: '2026-05-15T00:00:00.000Z',
    })
    appendRawTurnLog(file, {
      storyId: 'story-a',
      storyName: '测试故事',
      turnIndex: 2,
      playerInput: '我把手机藏进沙发缝。',
      finalText: '艾莉没有看见。',
      createdAt: '2026-05-15T00:00:00.000Z',
    })
    appendTurnSummary(turnSummariesPath(file), 0, '艾莉来到客厅，手机在茶几上。')
    appendTurnSummary(turnSummariesPath(file), 2, '手机被藏进沙发缝，艾莉没有发现。')
    appendTurnSummary(turnSummariesPath(file), 2, '手机仍在沙发缝，艾莉不知道。')

    const summaries = fs.readFileSync(turnSummariesPath(file), 'utf-8')
    expect(summaries.trim()).toBe('第0轮：艾莉来到客厅，手机在茶几上。\n第2轮：手机仍在沙发缝，艾莉不知道。')

    const turns = readStoryTurnsByIndex(file, [0, 2, 99])
    expect(turns).toHaveLength(2)
    expect(turns[0].turnIndex).toBe(0)
    expect(turns[0].text).toContain('第0轮 玩家输入')
    expect(turns[1].turnIndex).toBe(2)
    expect(turns[1].text).toContain('第2轮 玩家输入')
    expect(buildRecallEvidenceBlock(turns)).toContain('story.txt#第0轮')
    expect(buildRecallEvidenceBlock(turns)).toContain('story.txt#第2轮')
  })

  it('uses rg against full turn text and reports matched keywords for recalled old turns', () => {
    const file = makeTempFile()
    appendRawTurnLog(file, {
      storyId: 'story-a',
      storyName: '测试故事',
      turnIndex: 2,
      playerInput: '我提到秘密暗号。',
      finalText: '艾莉没有看见，客厅只剩下电视声，手机仍在沙发缝。',
      createdAt: '2026-05-15T00:00:00.000Z',
    })
    appendRawTurnLog(file, {
      storyId: 'story-a',
      storyName: '测试故事',
      turnIndex: 8,
      playerInput: '我追问秘密暗号。',
      finalText: '风吹开窗帘。',
      createdAt: '2026-05-15T00:01:00.000Z',
    })

    const results = searchRawTurnLogWithGrep(file, ['沙发缝', '手机', '秘密暗号'], {
      storyId: 'story-a',
      currentTurnIndex: 8,
      excludeRecentTurnCount: 2,
      maxResults: 3,
    })

    expect(results).toHaveLength(1)
    expect(results[0].turnIndex).toBe(2)
    expect(results[0].matchedKeywords).toEqual(['沙发缝', '手机', '秘密暗号'])
    expect(results[0].source).toMatch(/story\.txt#第2轮:\d+-\d+/)
    expect(results[0].text).toContain('第2轮 玩家输入')
    expect(results[0].text).toContain('第2轮 正文')
    expect(buildRecallEvidenceBlock(results)).toContain('story.txt#第2轮:')
  })

  it('keeps L1 and L2 files intact while replacing old L1 blocks only for long-history prompt rendering', () => {
    const file = makeTempFile()
    const l1Path = turnSummariesPath(file)
    const l2Path = turnSummaryL2Path(file)
    for (let turn = 1; turn <= 25; turn += 1) {
      appendTurnSummary(l1Path, turn, `第${turn}轮事实`)
    }
    appendTurnSummaryL2(l2Path, 1, 10, '1-10轮压缩事实')
    appendTurnSummaryL2(l2Path, 11, 20, '11-20轮压缩事实')

    const l1Text = fs.readFileSync(l1Path, 'utf-8')
    const l2Text = readTurnSummaryL2(l2Path)
    expect(l1Text).toContain('第1轮：第1轮事实')
    expect(l1Text).toContain('第20轮：第20轮事实')
    expect(l2Text).toContain('第1-10轮：1-10轮压缩事实')
    expect(l2Text).toContain('第11-20轮：11-20轮压缩事实')

    const beforeTwentyFive = renderHistoricalSummariesWithL2(l1Text, l2Text, {
      currentTurnIndex: 24,
      excludeRecentTurnCount: 5,
    })
    expect(beforeTwentyFive).toContain('第1轮：第1轮事实')
    expect(beforeTwentyFive).not.toContain('第1-10轮：1-10轮压缩事实')

    const atTwentyFive = renderHistoricalSummariesWithL2(l1Text, l2Text, {
      currentTurnIndex: 25,
      excludeRecentTurnCount: 5,
    })
    expect(atTwentyFive).toContain('第1-10轮：1-10轮压缩事实')
    expect(atTwentyFive).not.toContain('第1轮：第1轮事实')
    expect(atTwentyFive).toContain('第11轮：第11轮事实')

    const atThirtyFive = renderHistoricalSummariesWithL2(l1Text, l2Text, {
      currentTurnIndex: 35,
      excludeRecentTurnCount: 5,
    })
    expect(atThirtyFive).toContain('第1-10轮：1-10轮压缩事实')
    expect(atThirtyFive).toContain('第11-20轮：11-20轮压缩事实')
    expect(atThirtyFive).not.toContain('第11轮：第11轮事实')
    expect(atThirtyFive).toContain('第21轮：第21轮事实')
  })
})
