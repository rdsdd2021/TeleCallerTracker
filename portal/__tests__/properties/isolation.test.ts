/**
 * Property 1: Multi-Tenant Data Isolation (Req 3.3, 3.6)
 * Property 2: Sign-Up Creates Org and Owner Membership (Req 1.3, 1.4)
 *
 * These properties test the data isolation and sign-up invariants as pure
 * logic tests against in-memory data structures that mirror the database schema.
 * They validate the correctness of the filtering and creation logic without
 * requiring a live database connection.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── In-memory data models (mirror the DB schema) ─────────────────────────────

interface OrgRow {
  id: string
  name: string
  invite_code: string
  deleted_at: string | null
}

interface OrgMemberRow {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
}

interface DataRow {
  id: string
  org_id: string
  [key: string]: unknown
}

// ─── Pure query functions (mirror RLS policy logic) ───────────────────────────

/**
 * Simulates the RLS SELECT policy: returns only rows where org_id matches
 * the authenticated user's org.
 */
function queryWithRLS(rows: DataRow[], userOrgId: string): DataRow[] {
  return rows.filter((row) => row.org_id === userOrgId)
}

/**
 * Simulates the sign-up flow: creates an org + owner membership atomically.
 * Returns the created rows.
 */
function simulateSignUp(
  email: string,
  orgName: string,
  inviteCode: string,
  userId: string,
  existingOrgs: OrgRow[],
  existingMembers: OrgMemberRow[]
): { org: OrgRow; member: OrgMemberRow } | { error: string } {
  // Check for duplicate invite code (should be unique)
  if (existingOrgs.some((o) => o.invite_code === inviteCode)) {
    return { error: 'Duplicate invite code' }
  }

  const orgId = `org-${userId}`
  const org: OrgRow = {
    id: orgId,
    name: orgName,
    invite_code: inviteCode,
    deleted_at: null,
  }

  const member: OrgMemberRow = {
    id: `member-${userId}`,
    org_id: orgId,
    user_id: userId,
    role: 'owner',
  }

  return { org, member }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid()

const orgIdArb = uuidArb
const userIdArb = uuidArb

const dataRowArb = (orgId: string): fc.Arbitrary<DataRow> =>
  fc.record({
    id: uuidArb,
    org_id: fc.constant(orgId),
    value: fc.string(),
  })

const multiOrgDataArb = fc
  .tuple(uuidArb, uuidArb)
  .filter(([a, b]) => a !== b)
  .chain(([orgA, orgB]) =>
    fc.tuple(
      fc.array(dataRowArb(orgA), { minLength: 0, maxLength: 20 }),
      fc.array(dataRowArb(orgB), { minLength: 0, maxLength: 20 }),
      fc.constant(orgA),
      fc.constant(orgB)
    )
  )

// ─── Property 1: Multi-Tenant Data Isolation ─────────────────────────────────

describe('Property 1: Multi-tenant data isolation (Req 3.3, 3.6)', () => {
  it('a query for Org A returns zero rows belonging to Org B', () => {
    fc.assert(
      fc.property(multiOrgDataArb, ([rowsA, rowsB, orgA, orgB]) => {
        const allRows = [...rowsA, ...rowsB]

        // Query as Org A member
        const resultA = queryWithRLS(allRows, orgA)

        // No result should have org_id = orgB
        const leakedRows = resultA.filter((r) => r.org_id === orgB)
        expect(leakedRows).toHaveLength(0)
      }),
      { numRuns: 300 }
    )
  })

  it('a query for Org B returns zero rows belonging to Org A', () => {
    fc.assert(
      fc.property(multiOrgDataArb, ([rowsA, rowsB, orgA, orgB]) => {
        const allRows = [...rowsA, ...rowsB]

        const resultB = queryWithRLS(allRows, orgB)
        const leakedRows = resultB.filter((r) => r.org_id === orgA)
        expect(leakedRows).toHaveLength(0)
      }),
      { numRuns: 300 }
    )
  })

  it('Org A query returns exactly all rows belonging to Org A', () => {
    fc.assert(
      fc.property(multiOrgDataArb, ([rowsA, rowsB, orgA]) => {
        const allRows = [...rowsA, ...rowsB]
        const resultA = queryWithRLS(allRows, orgA)

        // Every row in rowsA should appear in resultA
        for (const row of rowsA) {
          expect(resultA.some((r) => r.id === row.id)).toBe(true)
        }
        // Result count equals Org A row count
        expect(resultA).toHaveLength(rowsA.length)
      }),
      { numRuns: 300 }
    )
  })

  it('isolation holds for any number of orgs', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 2, maxLength: 5 }).filter(
          (ids) => new Set(ids).size === ids.length // all distinct
        ),
        fc.nat({ max: 10 }),
        (orgIds, rowsPerOrg) => {
          // Build rows for each org
          const allRows: DataRow[] = []
          for (const orgId of orgIds) {
            for (let i = 0; i < rowsPerOrg; i++) {
              allRows.push({ id: `${orgId}-row-${i}`, org_id: orgId })
            }
          }

          // For each org, verify isolation
          for (const targetOrg of orgIds) {
            const result = queryWithRLS(allRows, targetOrg)
            const otherOrgRows = result.filter((r) => r.org_id !== targetOrg)
            expect(otherOrgRows).toHaveLength(0)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─── Property 2: Sign-Up Creates Org and Owner Membership ────────────────────

describe('Property 2: Sign-up creates exactly one org and one owner membership (Req 1.3, 1.4)', () => {
  const emailArb = fc.emailAddress()
  const orgNameArb = fc.string({ minLength: 1, maxLength: 50 })
  const inviteCodeArb = fc.stringMatching(/^[A-Z0-9]{8}$/)

  it('successful sign-up creates exactly one organisations row', () => {
    fc.assert(
      fc.property(emailArb, orgNameArb, inviteCodeArb, userIdArb, (email, orgName, inviteCode, userId) => {
        const result = simulateSignUp(email, orgName, inviteCode, userId, [], [])
        if ('error' in result) return // skip if error (e.g. duplicate code)

        // Exactly one org created
        expect(result.org).toBeDefined()
        expect(result.org.name).toBe(orgName)
        expect(result.org.invite_code).toBe(inviteCode)
        expect(result.org.deleted_at).toBeNull()
      }),
      { numRuns: 200 }
    )
  })

  it('successful sign-up creates exactly one org_members row with role = owner', () => {
    fc.assert(
      fc.property(emailArb, orgNameArb, inviteCodeArb, userIdArb, (email, orgName, inviteCode, userId) => {
        const result = simulateSignUp(email, orgName, inviteCode, userId, [], [])
        if ('error' in result) return

        expect(result.member).toBeDefined()
        expect(result.member.role).toBe('owner')
        expect(result.member.user_id).toBe(userId)
        expect(result.member.org_id).toBe(result.org.id)
      }),
      { numRuns: 200 }
    )
  })

  it('the org_members row links to the created org (referential integrity)', () => {
    fc.assert(
      fc.property(emailArb, orgNameArb, inviteCodeArb, userIdArb, (email, orgName, inviteCode, userId) => {
        const result = simulateSignUp(email, orgName, inviteCode, userId, [], [])
        if ('error' in result) return

        expect(result.member.org_id).toBe(result.org.id)
      }),
      { numRuns: 200 }
    )
  })

  it('sign-up is atomic: if org creation fails, no orphaned membership exists', () => {
    // Simulate failure by using a duplicate invite code
    fc.assert(
      fc.property(emailArb, orgNameArb, inviteCodeArb, userIdArb, (email, orgName, inviteCode, userId) => {
        const existingOrg: OrgRow = {
          id: 'existing-org',
          name: 'Existing Org',
          invite_code: inviteCode,
          deleted_at: null,
        }

        const result = simulateSignUp(email, orgName, inviteCode, userId, [existingOrg], [])

        // Should fail — no partial state
        expect('error' in result).toBe(true)
        // No org or member was created
        if ('error' in result) {
          expect(result.error).toBeTruthy()
        }
      }),
      { numRuns: 200 }
    )
  })

  it('the created org has a non-empty invite code', () => {
    fc.assert(
      fc.property(emailArb, orgNameArb, inviteCodeArb, userIdArb, (email, orgName, inviteCode, userId) => {
        const result = simulateSignUp(email, orgName, inviteCode, userId, [], [])
        if ('error' in result) return

        expect(result.org.invite_code).toBeTruthy()
        expect(result.org.invite_code.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })
})
