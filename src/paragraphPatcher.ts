export interface DraftParagraph {
  id: string
  text: string
}

export interface AppliedParagraphPatch {
  index: number
  paragraphId: string
  reason: string
}

export interface FailedParagraphPatch {
  index: number
  paragraphId: string
  reason: string
  patchReason: string
}

export interface ParagraphPatchReport {
  applied: AppliedParagraphPatch[]
  failed: FailedParagraphPatch[]
}

export interface ParagraphPatchResult {
  paragraphs: DraftParagraph[]
  finalText: string
  report: ParagraphPatchReport
}

interface NormalizedParagraphPatch {
  paragraphId: string
  replaceText: string
  withText: string
  reason: string
}

export function normalizeDraftParagraphs(value: unknown, fallbackText = ''): DraftParagraph[] {
  const fromValue = normalizeParagraphArray(value)
  if (fromValue.length > 0) return fromValue

  const paragraphs = String(fallbackText || '')
    .split(/\n{2,}/)
    .map(text => text.trim())
    .filter(Boolean)

  return paragraphs.map((text, index) => ({
    id: `p${index + 1}`,
    text,
  }))
}

export function applyParagraphPatches(paragraphs: DraftParagraph[], value: unknown): ParagraphPatchResult {
  const nextParagraphs = paragraphs.map(paragraph => ({ ...paragraph }))
  const report: ParagraphPatchReport = { applied: [], failed: [] }
  const patches = normalizePatchArray(value)

  patches.forEach((patch, index) => {
    const paragraph = nextParagraphs.find(item => item.id === patch.paragraphId)
    if (!paragraph) {
      report.failed.push({
        index,
        paragraphId: patch.paragraphId,
        reason: 'paragraphId not found',
        patchReason: patch.reason,
      })
      return
    }

    if (!paragraph.text.includes(patch.replaceText)) {
      report.failed.push({
        index,
        paragraphId: patch.paragraphId,
        reason: 'replaceText not found',
        patchReason: patch.reason,
      })
      return
    }

    paragraph.text = paragraph.text.replace(patch.replaceText, patch.withText)
    report.applied.push({
      index,
      paragraphId: patch.paragraphId,
      reason: patch.reason,
    })
  })

  return {
    paragraphs: nextParagraphs,
    finalText: joinParagraphs(nextParagraphs),
    report,
  }
}

export function joinParagraphs(paragraphs: DraftParagraph[]): string {
  return paragraphs.map(paragraph => paragraph.text.trim()).filter(Boolean).join('\n\n')
}

function normalizeParagraphArray(value: unknown): DraftParagraph[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const text = String(record.text || '').trim()
      if (!text) return null
      const id = String(record.id || `p${index + 1}`).trim() || `p${index + 1}`
      return { id, text }
    })
    .filter((item): item is DraftParagraph => Boolean(item))
}

function normalizePatchArray(value: unknown): NormalizedParagraphPatch[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const paragraphId = String(record.paragraphId || record.id || '').trim()
      const replaceText = String(record.replaceText || '').trim()
      const withText = String(record.withText ?? '').trim()
      const reason = String(record.reason || '').trim()
      if (!paragraphId || !replaceText) return null
      return { paragraphId, replaceText, withText, reason }
    })
    .filter((item): item is NormalizedParagraphPatch => Boolean(item))
}
