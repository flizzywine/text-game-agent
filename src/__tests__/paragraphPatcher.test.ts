import { describe, expect, it } from 'vitest'
import { applyParagraphPatches, normalizeDraftParagraphs } from '../paragraphPatcher'

describe('normalizeDraftParagraphs', () => {
  it('keeps narrator supplied paragraph ids and text', () => {
    const paragraphs = normalizeDraftParagraphs([
      { id: 'beat-1', text: '第一段。' },
      { id: 'beat-2', text: '第二段。' },
    ], '')

    expect(paragraphs).toEqual([
      { id: 'beat-1', text: '第一段。' },
      { id: 'beat-2', text: '第二段。' },
    ])
  })

  it('splits fallback draft text into generated paragraph ids', () => {
    const paragraphs = normalizeDraftParagraphs(undefined, '第一段。\n\n第二段。\n第三行。')

    expect(paragraphs).toEqual([
      { id: 'p1', text: '第一段。' },
      { id: 'p2', text: '第二段。\n第三行。' },
    ])
  })
})

describe('applyParagraphPatches', () => {
  it('applies exact local replacements and preserves paragraph order', () => {
    const result = applyParagraphPatches(
      [
        { id: 'p1', text: '她趴在床沿，手掌压住被单。' },
        { id: 'p2', text: '他从背后靠近，却伸手摸向她胸口。' },
      ],
      [
        {
          paragraphId: 'p2',
          replaceText: '却伸手摸向她胸口',
          withText: '先侧身绕到床边，再伸手扶住她的肩',
          reason: '修正身体位置不可达',
        },
      ],
    )

    expect(result.finalText).toBe([
      '她趴在床沿，手掌压住被单。',
      '他从背后靠近，先侧身绕到床边，再伸手扶住她的肩。',
    ].join('\n\n'))
    expect(result.report.applied).toHaveLength(1)
    expect(result.report.failed).toEqual([])
  })

  it('records failed patches without mutating the paragraph when exact text is missing', () => {
    const result = applyParagraphPatches(
      [{ id: 'p1', text: '门外的雨声压低了屋里的呼吸。' }],
      [
        {
          paragraphId: 'p1',
          replaceText: '不存在的原文',
          withText: '替换文本',
          reason: '模型给错锚点',
        },
      ],
    )

    expect(result.finalText).toBe('门外的雨声压低了屋里的呼吸。')
    expect(result.report.applied).toEqual([])
    expect(result.report.failed).toEqual([
      {
        index: 0,
        paragraphId: 'p1',
        reason: 'replaceText not found',
        patchReason: '模型给错锚点',
      },
    ])
  })
})
