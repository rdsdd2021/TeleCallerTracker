/**
 * Validates a phone number in E.164 format.
 * E.164: starts with +, followed by 7-15 digits.
 */
export function isValidE164PhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}

/**
 * Validates a message template body.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateTemplateBody(body: string): string | null {
  if (body.length > 1000) {
    return 'Message body must not exceed 1,000 characters.'
  }
  return null
}

/**
 * Validates an invite code format.
 * Must be exactly 8 uppercase alphanumeric characters.
 */
export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code)
}

/**
 * Validates a password meets minimum requirements.
 */
export function isValidPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  return null
}
