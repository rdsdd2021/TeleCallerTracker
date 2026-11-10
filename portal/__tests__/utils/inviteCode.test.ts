import { describe, it, expect } from 'vitest'
import { generateInviteCode } from '@/lib/utils/inviteCode'
import { isValidInviteCode } from '@/lib/utils/validation'

describe('generateInviteCode', () => {
  it('generates a string of exactly 8 characters', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
  })

  it('generates only uppercase alphanumeric characters', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[A-Z0-9]{8}$/)
  })

  it('generates different codes on successive calls (probabilistic)', () => {
    // The probability of two identical 8-char codes is ~1 in 36^8 — negligible
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()))
    expect(codes.size).toBeGreaterThan(1)
  })

  it('generates codes that pass isValidInviteCode', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidInviteCode(generateInviteCode())).toBe(true)
    }
  })
})
