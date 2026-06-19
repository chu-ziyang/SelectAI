import { describe, it, expect } from 'vitest'
import { compareSemver } from './semver'

describe('compareSemver', () => {
  it('equal', () => expect(compareSemver('1.2.3', '1.2.3')).toBe(0))
  it('less', () => expect(compareSemver('1.2.3', '1.2.4')).toBe(-1))
  it('greater', () => expect(compareSemver('1.2.4', '1.2.3')).toBe(1))
  it('major diff', () => expect(compareSemver('2.0.0', '1.9.9')).toBe(1))
  it('handles v prefix', () => expect(compareSemver('v1.2.3', '1.2.4')).toBe(-1))
  it('handles garbage', () => expect(compareSemver('abc', '1.2.3')).toBe(0))
})