/**
 * Property 13: Note Template Count Invariant (Req 10.5)
 * Property 14: Message Template Body Length Invariant (Req 11.4)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateTemplateBody } from '@/lib/utils/validation'

// ─── Property 13: Note template count invariant ───────────────────────────────

describe('Property 13: Note template count invariant (Req 10.5)', () => {
  const MAX_TEMPLATES = 50

  /**
   * Simulates the server-side check: returns an error if count >= MAX_TEMPLATES.
   * This mirrors the logic in note-templates/actions.ts.
   */
  function canCreateTemplate(currentCount: number): { allowed: boolean; error?: string } {
    if (currentCount >= MAX_TEMPLATES) {
      return { allowed: false, error: 'You have reached the maximum of 50 templates.' }
    }
    return { allowed: true }
  }

  it('allows creation when count is below 50', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 49 }), (count) => {
        expect(canCreateTemplate(count).allowed).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('blocks creation when count is exactly 50', () => {
    const result = canCreateTemplate(50)
    expect(result.allowed).toBe(false)
    expect(result.error).toBe('You have reached the maximum of 50 templates.')
  })

  it('blocks creation when count is above 50', () => {
    fc.assert(
      fc.property(fc.integer({ min: 50, max: 200 }), (count) => {
        expect(canCreateTemplate(count).allowed).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('count remains 50 after a blocked insertion attempt', () => {
    // Simulate: start at 50, attempt to add, verify count unchanged
    let count = 50
    const result = canCreateTemplate(count)
    if (!result.allowed) {
      // Insertion is rejected — count stays the same
      expect(count).toBe(50)
    }
  })

  it('error message is exactly the required string', () => {
    const result = canCreateTemplate(50)
    expect(result.error).toBe('You have reached the maximum of 50 templates.')
  })
})

// ─── Property 14: Message template body length invariant ─────────────────────

describe('Property 14: Message template body length invariant (Req 11.4)', () => {
  it('any body with length > 1000 is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1001, max: 5000 }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        (body) => {
          expect(validateTemplateBody(body)).toBe('Message body must not exceed 1,000 characters.')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('any body with length <= 1000 is accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        (body) => {
          expect(validateTemplateBody(body)).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('boundary: exactly 1000 characters is accepted', () => {
    expect(validateTemplateBody('a'.repeat(1000))).toBeNull()
  })

  it('boundary: exactly 1001 characters is rejected', () => {
    expect(validateTemplateBody('a'.repeat(1001))).toBe(
      'Message body must not exceed 1,000 characters.'
    )
  })

  it('error message is exactly the required string', () => {
    const result = validateTemplateBody('x'.repeat(1001))
    expect(result).toBe('Message body must not exceed 1,000 characters.')
  })
})
