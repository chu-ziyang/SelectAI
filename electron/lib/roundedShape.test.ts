import { describe, it, expect } from 'vitest'
import { getRoundedRectShape } from './roundedShape'

describe('getRoundedRectShape', () => {
  it('returns single rect for zero radius', () => {
    const rects = getRoundedRectShape(100, 50, 0)
    expect(rects).toHaveLength(1)
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  it('returns single rect for negative radius', () => {
    const rects = getRoundedRectShape(100, 50, -5)
    expect(rects).toHaveLength(1)
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })

  it('clamps to minimum 1x1', () => {
    const rects = getRoundedRectShape(0, 0, 5)
    expect(rects).toHaveLength(1)
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('generates symmetric rects for a small radius', () => {
    const rects = getRoundedRectShape(100, 100, 12)
    // First row should have inset > 0
    expect(rects[0].x).toBeGreaterThan(0)
    // Middle row should be full width
    const mid = rects[Math.floor(rects.length / 2)]
    expect(mid.x).toBe(0)
    expect(mid.width).toBe(100)
    // Last row should be symmetric with first
    const last = rects[rects.length - 1]
    expect(last.x).toBe(rects[0].x)
    expect(last.width).toBe(rects[0].width)
  })

  it('all rects fit within the bounding box', () => {
    const w = 320, h = 200, r = 16
    const rects = getRoundedRectShape(w, h, r)
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(w)
      expect(rect.y + rect.height).toBeLessThanOrEqual(h)
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
    }
  })

  it('total area <= w*h (corners are cut)', () => {
    const w = 200, h = 100, r = 10
    const rects = getRoundedRectShape(w, h, r)
    let totalArea = 0
    for (const r of rects) {
      totalArea += r.width * r.height
    }
    // Rounded corners cut area; must be <= full area
    expect(totalArea).toBeLessThanOrEqual(w * h)
    // But zero-radius should equal full area
    const flat = getRoundedRectShape(w, h, 0)
    let flatArea = 0
    for (const r of flat) flatArea += r.width * r.height
    expect(flatArea).toBe(w * h)
  })
})
