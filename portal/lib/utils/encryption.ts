import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM; auth tag length is 16 bytes (GCM default)

function getKey(): Buffer {
  const keyHex = process.env.CONNECTOR_ENCRYPTION_KEY
  if (!keyHex) throw new Error('CONNECTOR_ENCRYPTION_KEY is not set')
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) throw new Error('CONNECTOR_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

export interface EncryptedPayload {
  iv: string
  ciphertext: string
  tag: string
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns an object with iv, ciphertext, and auth tag (all hex-encoded).
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  }
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Throws if the auth tag is invalid (tampered data).
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getKey()
  const iv = Buffer.from(payload.iv, 'hex')
  const ciphertext = Buffer.from(payload.ciphertext, 'hex')
  const tag = Buffer.from(payload.tag, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
