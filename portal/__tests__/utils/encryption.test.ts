import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/utils/encryption'

// A valid 32-byte (64 hex char) test key
const TEST_KEY = 'a'.repeat(64)

describe('encrypt / decrypt', () => {
  beforeEach(() => {
    process.env.CONNECTOR_ENCRYPTION_KEY = TEST_KEY
  })

  afterEach(() => {
    delete process.env.CONNECTOR_ENCRYPTION_KEY
  })

  it('round-trips a simple string', () => {
    const plaintext = 'hello world'
    const payload = encrypt(plaintext)
    expect(decrypt(payload)).toBe(plaintext)
  })

  it('round-trips an empty string', () => {
    const payload = encrypt('')
    expect(decrypt(payload)).toBe('')
  })

  it('round-trips a JSON credential object', () => {
    const plaintext = JSON.stringify({ apiKey: 'sk-test-123', secret: 'abc' })
    const payload = encrypt(plaintext)
    expect(decrypt(payload)).toBe(plaintext)
  })

  it('round-trips a string with unicode characters', () => {
    const plaintext = 'こんにちは 🔐 café'
    const payload = encrypt(plaintext)
    expect(decrypt(payload)).toBe(plaintext)
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same input'
    const p1 = encrypt(plaintext)
    const p2 = encrypt(plaintext)
    expect(p1.iv).not.toBe(p2.iv)
    expect(p1.ciphertext).not.toBe(p2.ciphertext)
  })

  it('returns a payload with iv, ciphertext, and tag fields', () => {
    const payload = encrypt('test')
    expect(payload).toHaveProperty('iv')
    expect(payload).toHaveProperty('ciphertext')
    expect(payload).toHaveProperty('tag')
  })

  it('iv is a 24-char hex string (12 bytes)', () => {
    const payload = encrypt('test')
    expect(payload.iv).toMatch(/^[0-9a-f]{24}$/)
  })

  it('tag is a 32-char hex string (16 bytes)', () => {
    const payload = encrypt('test')
    expect(payload.tag).toMatch(/^[0-9a-f]{32}$/)
  })

  it('throws when CONNECTOR_ENCRYPTION_KEY is not set', () => {
    delete process.env.CONNECTOR_ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('CONNECTOR_ENCRYPTION_KEY is not set')
  })

  it('throws when CONNECTOR_ENCRYPTION_KEY is wrong length', () => {
    process.env.CONNECTOR_ENCRYPTION_KEY = 'tooshort'
    expect(() => encrypt('test')).toThrow('CONNECTOR_ENCRYPTION_KEY must be 32 bytes')
  })

  it('throws on decryption when auth tag is tampered', () => {
    const payload = encrypt('sensitive data')
    // Flip the last byte of the tag
    const badTag = payload.tag.slice(0, -2) + (payload.tag.slice(-2) === 'ff' ? '00' : 'ff')
    expect(() => decrypt({ ...payload, tag: badTag })).toThrow()
  })

  it('throws on decryption when ciphertext is tampered', () => {
    const payload = encrypt('sensitive data')
    const badCiphertext = payload.ciphertext.slice(0, -2) + (payload.ciphertext.slice(-2) === 'ff' ? '00' : 'ff')
    expect(() => decrypt({ ...payload, ciphertext: badCiphertext })).toThrow()
  })
})
