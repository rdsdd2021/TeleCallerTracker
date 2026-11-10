import { randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a cryptographically random 8-character uppercase alphanumeric invite code.
 * Uses rejection sampling on random bytes to ensure uniform distribution over [A-Z0-9].
 */
export function generateInviteCode(): string {
  const length = 8
  let result = ''
  // Each byte gives a value 0-255. We use rejection sampling to avoid modulo bias.
  // 36 chars → accept bytes 0-215 (6 * 36 = 216), reject 216-255.
  while (result.length < length) {
    const bytes = randomBytes(length * 2) // generate extra to account for rejections
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const byte = bytes[i]
      if (byte < 216) {
        result += ALPHABET[byte % 36]
      }
    }
  }
  return result
}
