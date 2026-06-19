import { describe, it, expect } from 'vitest'
import { calculatePopupBounds } from './popupGeometry'

const FULL_HD: import('./popupGeometry').WorkArea = {
  x: 0, y: 0, width: 1920, height: 1080,
}

describe('calculatePopupBounds', () => {
  const cfg = {
    placement: 'bottom-right' as const,
    offsetX: 0, offsetY: 8,
    avoidScreenEdge: true,
  }

  it('places popup below-right of cursor with gap', () => {
    const r = calculatePopupBounds({ x: 100, y: 100 }, 200, 68, FULL_HD, cfg)
    expect(r.x).toBe(108)   // 100 + 8 gap
    expect(r.y).toBe(116)   // 100 + 8 + 8
    expect(r.width).toBe(200)
    expect(r.height).toBe(68)
  })

  it('avoids right screen edge', () => {
    const r = calculatePopupBounds({ x: 1900, y: 500 }, 200, 68, FULL_HD, cfg)
    // x + 200 + 12 <= 1920 => x <= 1708
    expect(r.x).toBeLessThanOrEqual(1920 - 200 - 12)
    expect(r.x).toBeGreaterThanOrEqual(12)
  })

  it('avoids bottom screen edge', () => {
    const r = calculatePopupBounds({ x: 500, y: 1070 }, 200, 68, FULL_HD, cfg)
    // y + 68 + 12 <= 1080 => y <= 1000
    expect(r.y).toBeLessThanOrEqual(1080 - 68 - 12)
  })

  it('top-left placement puts popup above-left', () => {
    const r = calculatePopupBounds(
      { x: 500, y: 300 }, 200, 68, FULL_HD,
      { ...cfg, placement: 'top-left' },
    )
    expect(r.x).toBe(500 - 200 - 8)
    expect(r.y).toBe(300 - 68 - 16)
  })

  it('center placement centers popup on cursor', () => {
    const r = calculatePopupBounds(
      { x: 500, y: 500 }, 200, 68, FULL_HD,
      { ...cfg, placement: 'center' },
    )
    // center: x = cursorX - popupW/2 + offsetX, y = cursorY - popupH/2 + offsetY
    // offsetX=0, offsetY=8
    expect(r.x).toBe(500 - 100 + 0)   // 500 - 200/2 + 0
    expect(r.y).toBe(500 - 34 + 8)    // 500 - 68/2 + 8 = 474
  })

  it('offsets are applied', () => {
    const r = calculatePopupBounds(
      { x: 100, y: 100 }, 200, 68, FULL_HD,
      { ...cfg, offsetX: 20, offsetY: 30 },
    )
    expect(r.x).toBe(100 + 8 + 20)   // gapX = 8 + 20
    expect(r.y).toBe(100 + 8 + 30)   // gapY = 8 + 30
  })

  it('returns integer coordinates', () => {
    const r = calculatePopupBounds({ x: 100, y: 100 }, 197, 67, FULL_HD, cfg)
    expect(Number.isInteger(r.x)).toBe(true)
    expect(Number.isInteger(r.y)).toBe(true)
  })
})
