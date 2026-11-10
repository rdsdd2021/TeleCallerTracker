import { describe, it, expect } from 'vitest'
import {
  isValidE164PhoneNumber,
  validateTemplateBody,
  isValidInviteCode,
  isValidPassword,
} from '@/lib/utils/validation'

// ─── isValidE164PhoneNumber ───────────────────────────────────────────────────

describe('isValidE164PhoneNumber', () => {
  it('accepts a standard US number', () => {
    expect(isValidE164PhoneNumber('+12025551234')).toBe(true)
  })

  it('accepts a UK number', () => {
    expect(isValidE164PhoneNumber('+447911123456')).toBe(true)
  })

  it('accepts a minimum-length number (7 digits after country code)', () => {
    expect(isValidE164PhoneNumber('+1234567')).toBe(true)
  })

  it('accepts a maximum-length number (15 digits total)', () => {
    expect(isValidE164PhoneNumber('+123456789012345')).toBe(true)
  })

  it('rejects a number without leading +', () => {
    expect(isValidE164PhoneNumber('12025551234')).toBe(false)
  })

  it('rejects a number with only +', () => {
    expect(isValidE164PhoneNumber('+')).toBe(false)
  })

  it('rejects a number that is too short (fewer than 7 digits after +)', () => {
    expect(isValidE164PhoneNumber('+12345')).toBe(false)
  })

  it('rejects a number that is too long (more than 15 digits total)', () => {
    expect(isValidE164PhoneNumber('+1234567890123456')).toBe(false)
  })

  it('rejects a number with letters', () => {
    expect(isValidE164PhoneNumber('+1202ABC1234')).toBe(false)
  })

  it('rejects a number with spaces', () => {
    expect(isValidE164PhoneNumber('+1 202 555 1234')).toBe(false)
  })

  it('rejects a number starting with +0 (country code cannot start with 0)', () => {
    expect(isValidE164PhoneNumber('+01234567890')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidE164PhoneNumber('')).toBe(false)
  })
})

// ─── validateTemplateBody ─────────────────────────────────────────────────────

describe('validateTemplateBody', () => {
  it('returns null for an empty body', () => {
    expect(validateTemplateBody('')).toBeNull()
  })

  it('returns null for a body of exactly 1000 characters', () => {
    expect(validateTemplateBody('a'.repeat(1000))).toBeNull()
  })

  it('returns null for a body under 1000 characters', () => {
    expect(validateTemplateBody('Hello world')).toBeNull()
  })

  it('returns an error message for a body of 1001 characters', () => {
    const result = validateTemplateBody('a'.repeat(1001))
    expect(result).toBe('Message body must not exceed 1,000 characters.')
  })

  it('returns an error message for a body well over 1000 characters', () => {
    const result = validateTemplateBody('x'.repeat(5000))
    expect(result).toBe('Message body must not exceed 1,000 characters.')
  })
})

// ─── isValidInviteCode ────────────────────────────────────────────────────────

describe('isValidInviteCode', () => {
  it('accepts a valid 8-char uppercase alphanumeric code', () => {
    expect(isValidInviteCode('ABC12345')).toBe(true)
  })

  it('accepts a code with only digits', () => {
    expect(isValidInviteCode('12345678')).toBe(true)
  })

  it('accepts a code with only uppercase letters', () => {
    expect(isValidInviteCode('ABCDEFGH')).toBe(true)
  })

  it('rejects a code shorter than 8 characters', () => {
    expect(isValidInviteCode('ABC123')).toBe(false)
  })

  it('rejects a code longer than 8 characters', () => {
    expect(isValidInviteCode('ABC123456')).toBe(false)
  })

  it('rejects a code with lowercase letters', () => {
    expect(isValidInviteCode('abc12345')).toBe(false)
  })

  it('rejects a code with special characters', () => {
    expect(isValidInviteCode('ABC!2345')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidInviteCode('')).toBe(false)
  })
})

// ─── isValidPassword ──────────────────────────────────────────────────────────

describe('isValidPassword', () => {
  it('returns null for a password of exactly 8 characters', () => {
    expect(isValidPassword('12345678')).toBeNull()
  })

  it('returns null for a password longer than 8 characters', () => {
    expect(isValidPassword('supersecretpassword')).toBeNull()
  })

  it('returns an error for a password of 7 characters', () => {
    expect(isValidPassword('1234567')).toBe('Password must be at least 8 characters.')
  })

  it('returns an error for an empty password', () => {
    expect(isValidPassword('')).toBe('Password must be at least 8 characters.')
  })
})
