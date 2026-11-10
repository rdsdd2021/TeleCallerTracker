/**
 * Property 3: Unauthenticated Requests Are Redirected (Req 2.4)
 * Property 4: Member Role Blocks Management Routes (Req 4.4, 4.5)
 *
 * These properties test the middleware redirect decision logic as pure functions,
 * extracted from the actual middleware implementation in portal/middleware.ts.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Extracted middleware logic (mirrors portal/middleware.ts) ────────────────

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/manage',
  '/reports',
  '/connectors',
  '/settings',
]

const MANAGEMENT_PREFIXES = ['/manage', '/connectors', '/settings']

/**
 * Returns the redirect destination for an unauthenticated request,
 * or null if no redirect is needed.
 */
function getUnauthenticatedRedirect(path: string): string | null {
  if (PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return '/login'
  }
  return null
}

/**
 * Returns the redirect destination for a member-role request to a management route,
 * or null if access is allowed.
 */
function getMemberRoleRedirect(path: string, role: 'owner' | 'admin' | 'member'): string | null {
  if (role === 'member' && MANAGEMENT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return '/dashboard?error=permission_denied'
  }
  return null
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Protected route paths
const protectedPathArb = fc.constantFrom(
  '/dashboard',
  '/dashboard/page',
  '/manage',
  '/manage/employees',
  '/manage/users',
  '/manage/exclude-numbers',
  '/manage/note-templates',
  '/manage/message-templates',
  '/manage/recordings',
  '/manage/pinned-logs',
  '/reports',
  '/reports?start=2024-01-01&end=2024-01-31',
  '/connectors',
  '/settings',
)

// Management route paths (subset of protected)
const managementPathArb = fc.constantFrom(
  '/manage',
  '/manage/employees',
  '/manage/users',
  '/manage/exclude-numbers',
  '/manage/note-templates',
  '/manage/message-templates',
  '/manage/recordings',
  '/manage/pinned-logs',
  '/connectors',
  '/settings',
)

// Public route paths (should NOT be redirected)
const publicPathArb = fc.constantFrom(
  '/login',
  '/signup',
  '/api/auth/callback',
  '/',
  '/about',
)

// ─── Property 3: Unauthenticated redirect ─────────────────────────────────────

describe('Property 3: Unauthenticated requests are redirected to /login (Req 2.4)', () => {
  it('every protected path redirects unauthenticated users to /login', () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        expect(getUnauthenticatedRedirect(path)).toBe('/login')
      }),
      { numRuns: 100 }
    )
  })

  it('public paths do NOT redirect unauthenticated users', () => {
    fc.assert(
      fc.property(publicPathArb, (path) => {
        expect(getUnauthenticatedRedirect(path)).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('all PROTECTED_PREFIXES trigger a redirect', () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(getUnauthenticatedRedirect(prefix)).toBe('/login')
      expect(getUnauthenticatedRedirect(`${prefix}/sub-page`)).toBe('/login')
    }
  })

  it('redirect destination is always exactly /login', () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        const dest = getUnauthenticatedRedirect(path)
        if (dest !== null) {
          expect(dest).toBe('/login')
        }
      }),
      { numRuns: 100 }
    )
  })

  it('paths with query strings on protected routes still redirect', () => {
    const pathsWithQuery = [
      '/dashboard?error=permission_denied',
      '/reports?start=2024-01-01',
      '/settings?tab=danger',
    ]
    for (const path of pathsWithQuery) {
      expect(getUnauthenticatedRedirect(path)).toBe('/login')
    }
  })
})

// ─── Property 4: Member role blocks management routes ─────────────────────────

describe('Property 4: Member role blocks management routes (Req 4.4, 4.5)', () => {
  it('member role is redirected from every management path', () => {
    fc.assert(
      fc.property(managementPathArb, (path) => {
        expect(getMemberRoleRedirect(path, 'member')).toBe('/dashboard?error=permission_denied')
      }),
      { numRuns: 100 }
    )
  })

  it('owner role is NOT redirected from management paths', () => {
    fc.assert(
      fc.property(managementPathArb, (path) => {
        expect(getMemberRoleRedirect(path, 'owner')).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('admin role is NOT redirected from management paths', () => {
    fc.assert(
      fc.property(managementPathArb, (path) => {
        expect(getMemberRoleRedirect(path, 'admin')).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('member role can access non-management protected routes (dashboard, reports)', () => {
    const memberAllowedPaths = ['/dashboard', '/reports']
    for (const path of memberAllowedPaths) {
      expect(getMemberRoleRedirect(path, 'member')).toBeNull()
    }
  })

  it('redirect destination for member is always /dashboard?error=permission_denied', () => {
    fc.assert(
      fc.property(managementPathArb, (path) => {
        const dest = getMemberRoleRedirect(path, 'member')
        if (dest !== null) {
          expect(dest).toBe('/dashboard?error=permission_denied')
        }
      }),
      { numRuns: 100 }
    )
  })

  it('all MANAGEMENT_PREFIXES block member access', () => {
    for (const prefix of MANAGEMENT_PREFIXES) {
      expect(getMemberRoleRedirect(prefix, 'member')).toBe('/dashboard?error=permission_denied')
      expect(getMemberRoleRedirect(`${prefix}/sub-page`, 'member')).toBe('/dashboard?error=permission_denied')
    }
  })
})
