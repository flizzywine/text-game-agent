import { describe, expect, it } from 'vitest'
import { mergeItemState, normalizeItemState, renderItemState } from '../itemState'

describe('item state', () => {
  it('normalizes only lightweight key item fields', () => {
    const state = normalizeItemState({
      手机: {
        holder: '艾莉',
        location: '客厅沙发缝',
        random: 'ignore',
      },
      环境: { location: '客厅' },
      a: { location: '短名忽略' },
    })

    expect(state).toEqual({
      手机: {
        持有人: '艾莉',
        位置: '客厅沙发缝',
      },
    })
  })

  it('merges item holder and location patches', () => {
    const state = mergeItemState(
      {
        手机: {
          持有人: '艾莉',
          位置: '客厅沙发缝',
        },
      },
      {
        手机: {
          持有人: '洪世贤',
          位置: '右手',
        },
      },
      8,
    )

    expect(state.手机).toEqual({
      持有人: '洪世贤',
      位置: '右手',
    })
  })

  it('renders item state as a compact JSON input block', () => {
    expect(renderItemState({ 手机: { 持有人: '艾莉' } })).toContain('"手机"')
    expect(renderItemState({})).toBe('（无）')
  })
})
