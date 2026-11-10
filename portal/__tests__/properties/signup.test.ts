/**
 * Property 2 (extended): Sign-Up Creates Org and Owner Membership (Req 1.3, 1.4)
 *
 * Additional sign-up invariant tests focusing on the invite code generation
 * and the uniqueness constraints that the sign-up flow must satisfy.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateInviteCode } from '@/lib/utils/inviteCode'
import { isValidInviteCode } from '@/lib/utils/validation'
import { isValidPassword } from '@/lib/utils/validation'

// ─── Sign-up input validation logic (mirrors signUpAction in actions.ts) ──────

interface SignUpInput {
  email: string
  password: string
  orgName: string
}

interface SignUpValidationResult {
  valid: boolean
  error?: string
}

function validateSignUpInputs(input: SignUpInput): SignUpValidationResult {
  if (input.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' }
  }
  if (!input.orgName.trim()) {
    return { valid: false, error: 'Organisation name is required.' }
  }
  return { valid: true }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const validEmailArb = fc.emailAddress()
const validPasswordArb = fc.string({ minLength: 8, maxLength: 50 })
const validOrgNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)
const shortPasswordArb = fc.string({ minLength: 0, maxLength: 7 })
const emptyOrgNameArb = fc.constantFrom('', '   ', '\t', '\n')

// ─── Sign-up validation property tests ───────────────────────────────────────

describe('Property 2: Sign-up input validation invariants (Req 1.3, 1.4)', () => {
  it('valid inputs always pass validation', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, validOrgNameArb, (email, password, orgName) => {
        const result = validateSignUpInputs({ email, password, orgName })
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  it('password shorter than 8 chars always fails with the correct message', () => {
    fc.assert(
      fc.property(validEmailArb, shortPasswordArb, validOrgNameArb, (email, password, orgName) => {
        const result = validateSignUpInputs({ email, password, orgName })
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Password must be at least 8 characters.')
      }),
      { numRuns: 200 }
    )
  })

  it('empty org name always fails with the correct message', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, emptyOrgNameArb, (email, password, orgName) => {
        const result = validateSignUpInputs({ email, password, orgName })
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Organisation name is required.')
      }),
      { numRuns: 100 }
    )
  })

  it('password validation is consistent with isValidPassword utility', () => {
    fc.assert(
      fc.property(validEmailArb, fc.string({ minLength: 0, maxLength: 20 }), validOrgNameArb,
        (email, password, orgName) => {
          const signUpResult = validateSignUpInputs({ email, password, orgName })
          const utilResult = isValidPassword(password)

          if (utilResult !== null) {
            // isValidPassword returned an error → sign-up should also fail
            expect(signUpResult.valid).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('every sign-up generates a valid invite code', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const code = generateInviteCode()
        expect(isValidInviteCode(code)).toBe(true)
        expect(code).toHaveLength(8)
        expect(code).toMatch(/^[A-Z0-9]{8}$/)
      }),
      { numRuns: 300 }
    )
  })

  it('each sign-up generates a unique invite code (probabilistic)', () => {
    // Generate 100 codes and verify no collisions
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()))
    // With 36^8 possible codes, collision probability in 100 draws is negligible
    expect(codes.size).toBe(100)
  })
})
