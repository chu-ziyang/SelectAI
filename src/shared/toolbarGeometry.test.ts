import { describe, it, expect } from 'vitest'
import { estimateToolbarWidth, resultBounds } from './toolbarGeometry'

describe('estimateToolbarWidth', () => {
  it('returns popupWidth for vertical layout', () => {
    expect(estimateToolbarWidth([{ name: '翻译' }], 320, true, false)).toBe(320)
  })

  it('returns popupWidth for icon-only layout', () => {
    expect(estimateToolbarWidth([{ name: '翻译' }], 320, false, true)).toBe(320)
  })

  it('estimates wider for more actions (when exceeding popupWidth)', () => {
    // Use small popupWidth so content width exceeds it
    const single = estimateToolbarWidth([{ name: '翻译' }], 180, false, false)
    const multi = estimateToolbarWidth([{ name: '翻译' }, { name: '总结' }, { name: '解释' }], 180, false, false)
    expect(multi).toBeGreaterThan(single)
  })

  it('clamps to [180, 720]', () => {
    const min = estimateToolbarWidth([{ name: 'X' }], 10, false, false)
    expect(min).toBeGreaterThanOrEqual(180)
    const max = estimateToolbarWidth([{ name: 'A'.repeat(50) }], 2000, false, false)
    expect(max).toBeLessThanOrEqual(720)
  })

  it('returns at least popupWidth', () => {
    expect(estimateToolbarWidth([{ name: '短' }], 500, false, false)).toBeGreaterThanOrEqual(500)
  })
})

describe('resultBounds', () => {
  it('returns bounded width', () => {
    expect(resultBounds(300, 400).width).toBe(360)   // min 360
    expect(resultBounds(800, 400).width).toBe(720)    // max 720
    expect(resultBounds(500, 400).width).toBe(500)    // in range
  })

  it('returns bounded height', () => {
    expect(resultBounds(500, 100).height).toBe(300)   // min 300
    expect(resultBounds(500, 1000).height).toBe(1000)  // in range
  })
})
