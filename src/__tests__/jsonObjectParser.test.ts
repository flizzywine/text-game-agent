import { describe, expect, it } from 'vitest'
import { parseJsonObject } from '../jsonObjectParser'

describe('parseJsonObject', () => {
  it('parses normal JSON objects', () => {
    expect(parseJsonObject('{"sourceName":"demo"}')).toEqual({ sourceName: 'demo' })
  })

  it('extracts JSON from markdown fences', () => {
    expect(parseJsonObject('```json\n{"sourceName":"demo"}\n```')).toEqual({ sourceName: 'demo' })
  })

  it('repairs unquoted keys, single quoted strings, and trailing commas', () => {
    expect(parseJsonObject("{sourceName:'demo', initialPlayerOptions: [],}")).toEqual({
      sourceName: 'demo',
      initialPlayerOptions: [],
    })
  })

  it('repairs accidental double object braces from template syntax', () => {
    expect(parseJsonObject('{{"sourceName":"demo"}}')).toEqual({ sourceName: 'demo' })
  })

  it('extracts the object when the model adds surrounding text', () => {
    expect(parseJsonObject('下面是 JSON：\n{"sourceName":"demo"}\n结束')).toEqual({ sourceName: 'demo' })
  })

  it('does not strip URLs while removing comments outside strings', () => {
    expect(parseJsonObject('{sourceName:"demo", url:"https://example.com/a//b", // comment\n entries:[]}')).toEqual({
      sourceName: 'demo',
      url: 'https://example.com/a//b',
      entries: [],
    })
  })

  it('repairs bare Chinese keys and fullwidth colons', () => {
    expect(parseJsonObject('{故事名："demo", 人物: []}')).toEqual({
      故事名: 'demo',
      人物: [],
    })
  })
})
