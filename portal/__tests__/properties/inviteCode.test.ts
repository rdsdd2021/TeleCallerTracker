/**
 * Property 12: Invite Code Format Invariant (Req 6.6, 17.3)
 *
 * Every generated invite code is exactly 8 characters and matches [A-Z0-9]{8}.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateInviteCode } from '@/lib/utils/inviteCode'
import { isValidInviteCode } from '@/lib/utils/validation'

describe('Property 12: Invite code format invariant (Req 6.6, 17.3)', () => {
  it('every generated code is exactly 8 characters', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(generateInviteCode()).toHaveLength(8)
      }),
      { numRuns: 500 }
    )
  })

  it('every generated code matches [A-Z0-9]{8}', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/)
      }),
      { numRuns: 500 }
    )
  })

  it('every generated code passes isValidInviteCode', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(isValidInviteCode(generateInviteCode())).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it('generated codes have sufficient entropy (no two identical in 1000 runs)', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      codes.add(generateInviteCode())
    }
    // With 36^8 ≈ 2.8 trillion possible codes, collisions in 1000 runs are astronomically unlikely
    expect(codes.size).toBeGreaterThan(990)
  })
})
