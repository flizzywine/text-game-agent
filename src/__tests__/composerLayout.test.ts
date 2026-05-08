import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('composer layout', () => {
  it('keeps the free input area compact for reading-first play', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'web/index.html'), 'utf-8')
    const css = fs.readFileSync(path.join(process.cwd(), 'web/styles.css'), 'utf-8')

    expect(html).toContain('<textarea id="playerInput" rows="2"')
    expect(css).toContain('min-height: 52px;')
    expect(css).toContain('max-height: 118px;')
    expect(css).toContain('padding: 9px 12px;')
  })
})
