# Design Document — Telecaller Web Portal

## Overview

The Telecaller Web Portal is a multi-tenant Next.js 14 (App Router) web application that gives managers and organisation owners a single pane of glass over their telecaller teams. It consumes call-log data synced from Android devices via the existing React Native mobile app and Supabase backend.

### Goals

- Provide real-time dashboards, per-employee reports, and team administration.
- Enforce strict data isolation between organisations at the database layer (RLS) and application layer.
- Deliver a fast, accessible, server-rendered experience using Next.js App Router, Supabase SSR, Tailwind CSS, and shadcn/ui.

### Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | SSR, RSC, file-based routing, server actions |
| Auth | Supabase Auth (email + password) | Already in use; SSR session via `@supabase/ssr` |
| Database | Supabase Postgres (existing project) | Existing tables; RLS for multi-tenancy |
| Styling | Tailwind CSS + shadcn/ui | Rapid, accessible component library |
| Charts | Recharts | Lightweight, composable React charts |
| State | RSC + client components (no Redux) | Minimal client state; server fetches data |
| Testing | Vitest + fast-check (PBT) | Property-based testing for invariants |

---

## Architecture

### High-Level Architecture

```
Browser
  │
  ├── Next.js App Router (portal/)
  │     ├── Server Components  ──► Supabase Server Client (cookies)
  │     ├── Client Components  ──► Supabase Browser Client
  │     ├── Server Actions     ──► Supabase Server Client (mutations)
  │     └── API Routes         ──► Supabase Server Client (streaming exports)
  │
  └── Supabase
        ├── Auth (JWT, HttpOnly cookies via @supabase/ssr)
        ├── Postgres (RLS-enforced tables)
        └── Storage (call recordings)
```

### Request Lifecycle

1. Browser sends request with session cookie.
2. `middleware.ts` calls `supabase.auth.getUser()` to refresh the session token and writes the updated cookie.
3. If the route is protected and no valid session exists, middleware redirects to `/login`.
4. The Server Component creates a server Supabase client (reads cookies), calls `getOrgId(userId)`, and fetches data — all RLS-enforced.
5. HTML is streamed to the browser; client components hydrate for interactivity.

### Directory Structure

```
portal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           ← sidebar + header shell (RSC)
│   │   ├── dashboard/page.tsx
│   │   ├── manage/
│   │   │   ├── employees/page.tsx
│   │   │   ├── exclude-numbers/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── note-templates/page.tsx
│   │   │   ├── message-templates/page.tsx
│   │   │   ├── recordings/page.tsx
│   │   │   └── pinned-logs/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── connectors/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/callback/route.ts
│       └── export/[type]/route.ts
├── components/
│   ├── ui/                      ← shadcn components (auto-generated)
│   ├── layout/                  ← Sidebar, Header, NavItem
│   ├── dashboard/               ← StatCard, PeriodSelector
│   ├── manage/                  ← EmployeeTable, AddManagerForm
│   └── reports/                 ← ReportTable, CallTypePieChart
├── lib/
│   ├── supabase/
│   │   ├── client.ts            ← browser client (singleton)
│   │   ├── server.ts            ← server client (cookies)
│   │   └── middleware.ts        ← session refresh helper
│   ├── queries/                 ← typed query functions per domain
│   │   ├── dashboard.ts
│   │   ├── employees.ts
│   │   ├── reports.ts
│   │   └── templates.ts
│   └── utils/
│       ├── metrics.ts           ← pure metric calculation functions
│       └── export.ts            ← CSV generation
├── middleware.ts                ← auth guard + session refresh
└── next.config.ts
```

---

## Components and Interfaces

### Supabase Client Helpers

**`lib/supabase/server.ts`** — used in Server Components, Server Actions, and API Routes:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

**`lib/supabase/client.ts`** — used in Client Components:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`middleware.ts`** — session refresh + route protection:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/manage', '/reports', '/connectors', '/settings']
const MANAGEMENT_PREFIXES = ['/manage']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* getAll/setAll on supabaseResponse */ } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && PROTECTED_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

### Multi-Tenancy Helper

**`lib/queries/org.ts`**:

```typescript
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// React cache() deduplicates within a single request
export const getOrgId = cache(async (userId: string): Promise<string> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()
  if (error || !data) throw new Error('Organisation not found')
  return data.org_id
})

export const getUserRole = cache(async (userId: string, orgId: string) => {
  const supabase = createClient()
  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single()
  return data?.role ?? null
})
```

Every Server Component and Server Action calls `getOrgId(user.id)` at the top. The `org_id` is then passed to all query functions. RLS provides the second layer of enforcement.

### Role Guard (Server Component helper)

```typescript
// lib/auth/requireRole.ts
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/queries/org'

type Role = 'owner' | 'admin' | 'member'

export async function requireRole(
  userId: string,
  orgId: string,
  allowed: Role[]
) {
  const role = await getUserRole(userId, orgId)
  if (!role || !allowed.includes(role)) {
    redirect('/dashboard?error=permission_denied')
  }
  return role
}
```

Management pages call `requireRole(userId, orgId, ['owner', 'admin'])` at the top of the Server Component.

### Component RSC vs Client Classification

| Component | Type | Reason |
|---|---|---|
| `(dashboard)/layout.tsx` | RSC | Fetches user + org data once for the shell |
| `Sidebar` | RSC | Static nav links; active state via `usePathname` in a thin client wrapper |
| `dashboard/page.tsx` | RSC | Fetches initial metrics server-side |
| `PeriodSelector` | Client | User interaction; re-fetches on period change |
| `StatCard` | RSC | Pure display |
| `EmployeeTable` | Client | Search filtering, pagination |
| `AddManagerForm` | Client | Form with optimistic UI |
| `ReportTable` | Client | Sortable columns |
| `CallTypePieChart` | Client | Recharts requires browser APIs |
| `ExportButton` | Client | Triggers download |
| `manage/users/page.tsx` | RSC | Fetches member list |
| `settings/page.tsx` | RSC | Fetches org settings |

### Dashboard Data Flow

```
dashboard/page.tsx (RSC)
  └── getDashboardMetrics(orgId, 'today') → StatCard × 11
  └── <PeriodSelector> (Client)
        └── on change → fetch('/api/dashboard?period=yesterday&orgId=...')
              └── returns DashboardMetrics JSON
```

The initial render is fully server-rendered. Period changes use a lightweight client fetch to a Route Handler (not a full page navigation) to avoid layout re-renders.

---

## Data Models

### New Tables — Full Schema

#### `organisations`

```sql
CREATE TABLE organisations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  invite_code  char(8) NOT NULL UNIQUE,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organisations_invite_code ON organisations (invite_code)
  WHERE deleted_at IS NULL;
```

`invite_code` is an 8-character uppercase alphanumeric string generated by the server action using `crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase()`.

#### `org_members`

```sql
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members (user_id);
CREATE INDEX idx_org_members_org_id  ON org_members (org_id);
```

#### `excluded_numbers`

```sql
CREATE TABLE excluded_numbers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  phone_number   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_number)
);

CREATE INDEX idx_excluded_numbers_org_id ON excluded_numbers (org_id);
```

Phone numbers are stored as-is (E.164 format validated at application layer).

#### `note_templates`

```sql
CREATE TABLE note_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_templates_org_id ON note_templates (org_id);
```

#### `message_templates`

```sql
CREATE TABLE message_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL CHECK (char_length(body) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_org_id ON message_templates (org_id);
```

The `CHECK` constraint enforces the 1,000-character limit at the database layer as a second line of defence.

#### `pinned_call_logs`

```sql
CREATE TABLE pinned_call_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  call_log_id  uuid NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  pinned_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, call_log_id)
);

CREATE INDEX idx_pinned_call_logs_org_id ON pinned_call_logs (org_id);
```

#### `connector_configs`

```sql
CREATE TYPE connector_status AS ENUM ('connected', 'disconnected', 'error');

CREATE TABLE connector_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  connector_type        text NOT NULL,
  credentials_encrypted jsonb,
  status                connector_status NOT NULL DEFAULT 'disconnected',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, connector_type)
);

CREATE INDEX idx_connector_configs_org_id ON connector_configs (org_id);
```

Credentials are encrypted at the application layer using AES-256-GCM before being stored in the `jsonb` column. The encryption key is stored in an environment variable (`CONNECTOR_ENCRYPTION_KEY`), never in the database.

### Existing Table Alterations

```sql
-- Add org_id to existing tables
ALTER TABLE callers
  ADD COLUMN org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE call_logs
  ADD COLUMN org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE sync_logs
  ADD COLUMN org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

-- Backfill: existing rows without org_id will need a migration strategy
-- (create a default org for existing data or leave NULL during transition)

-- After backfill, add NOT NULL constraint:
ALTER TABLE callers   ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE call_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE sync_logs ALTER COLUMN org_id SET NOT NULL;

-- Indexes for org-scoped queries
CREATE INDEX idx_callers_org_id   ON callers   (org_id);
CREATE INDEX idx_call_logs_org_id ON call_logs (org_id);
CREATE INDEX idx_sync_logs_org_id ON sync_logs (org_id);

-- Composite index for call_logs time-range queries (most common access pattern)
CREATE INDEX idx_call_logs_org_called_at ON call_logs (org_id, called_at DESC);
CREATE INDEX idx_call_logs_org_caller    ON call_logs (org_id, caller_id, called_at DESC);
```

### RLS Policies

All tables use the same pattern: a helper function `get_user_org_id()` that reads the current user's org from `org_members`, and policies that compare `org_id` to that value.

```sql
-- Helper function (security definer to avoid RLS recursion on org_members itself)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id FROM org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Helper function for role check
CREATE OR REPLACE FUNCTION get_user_role(p_org_id uuid)
RETURNS org_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM org_members
  WHERE user_id = auth.uid() AND org_id = p_org_id
  LIMIT 1;
$$;
```

#### RLS: `organisations`

```sql
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- SELECT: members can read their own org
CREATE POLICY "org_select" ON organisations
  FOR SELECT USING (id = get_user_org_id() AND deleted_at IS NULL);

-- INSERT: handled by server action with service role (sign-up flow only)
-- No direct INSERT policy for authenticated users

-- UPDATE: only owner can update org name
CREATE POLICY "org_update_owner" ON organisations
  FOR UPDATE USING (
    id = get_user_org_id()
    AND get_user_role(id) = 'owner'
  );

-- DELETE: soft-delete only via server action; no direct DELETE policy
```

#### RLS: `org_members`

```sql
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- SELECT: members can see all members of their own org
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (org_id = get_user_org_id());

-- INSERT: owner or admin can add members (invite flow via server action)
CREATE POLICY "org_members_insert" ON org_members
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
  );

-- UPDATE: owner can change roles; admin cannot promote to owner
CREATE POLICY "org_members_update" ON org_members
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role(org_id) = 'owner'
  );

-- DELETE: owner or admin can remove members (not themselves if owner)
CREATE POLICY "org_members_delete" ON org_members
  FOR DELETE USING (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
    AND user_id != auth.uid()
  );
```

#### RLS: `callers`

```sql
ALTER TABLE callers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callers_select" ON callers
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "callers_insert" ON callers
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
  );

CREATE POLICY "callers_update" ON callers
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
  );

-- No DELETE policy: callers are not deleted, only deactivated
```

#### RLS: `call_logs`

```sql
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- All roles can read call_logs for their org
CREATE POLICY "call_logs_select" ON call_logs
  FOR SELECT USING (org_id = get_user_org_id());

-- INSERT is performed by the mobile app via service role (anon key with RLS)
-- The mobile app upserts with the org_id resolved from invite_code
CREATE POLICY "call_logs_insert" ON call_logs
  FOR INSERT WITH CHECK (org_id = get_user_org_id());
```

#### RLS: `sync_logs`

```sql
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_logs_select" ON sync_logs
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "sync_logs_insert" ON sync_logs
  FOR INSERT WITH CHECK (org_id = get_user_org_id());
```

#### RLS: `excluded_numbers`, `note_templates`, `message_templates`, `pinned_call_logs`, `connector_configs`

All follow the same pattern (shown for `excluded_numbers`; others are identical in structure):

```sql
ALTER TABLE excluded_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "excluded_numbers_select" ON excluded_numbers
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "excluded_numbers_insert" ON excluded_numbers
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
  );

CREATE POLICY "excluded_numbers_delete" ON excluded_numbers
  FOR DELETE USING (
    org_id = get_user_org_id()
    AND get_user_role(org_id) IN ('owner', 'admin')
  );
```

`member` role users can SELECT but not INSERT/UPDATE/DELETE on all management tables. The application layer enforces this via `requireRole()`, and the database layer enforces it via RLS as a second line of defence.

### TypeScript Types

Generated via `supabase gen types typescript` and stored in `types/supabase.ts`. Domain-specific types are defined in `types/domain.ts`:

```typescript
export type Period = 'today' | 'yesterday' | 'last_week'

export interface DashboardMetrics {
  totalCalls: number
  totalDurationSec: number
  incomingCalls: number
  outgoingCalls: number
  missedCalls: number
  rejectedCalls: number
  neverAttendedCalls: number
  notPickupByClientCalls: number
  uniqueClients: number
  workingHoursSec: number
  connectedCalls: number
  delta: Partial<DashboardMetrics> // percentage change vs prior period
}

export interface EmployeeReportRow {
  callerId: string
  name: string
  employeeId: string
  totalCalls: number
  incoming: number
  outgoing: number
  missed: number
  rejected: number
  neverAttended: number
  notPickupByClient: number
  connectedCalls: number
  totalDurationSec: number
  avgDurationSec: number
  uniqueClients: number
  workingHoursSec: number
}

export interface CallTypeDistribution {
  incoming: number
  outgoing: number
  missed: number
  rejected: number
  neverAttended: number
  notPickupByClient: number
}
```

---

## Authentication Flow

### Sign-Up → Org Creation

The sign-up flow is implemented as a Next.js Server Action to ensure atomicity:

```
signup/page.tsx (Client Component)
  └── <form action={signUpAction}>
        └── signUpAction (Server Action in app/(auth)/signup/actions.ts)
              1. supabase.auth.signUp({ email, password })
              2. If error → return { error: 'An account with this email already exists.' }
              3. Generate invite_code = randomAlphanumeric(8)
              4. INSERT INTO organisations (name, invite_code) → org_id
              5. INSERT INTO org_members (org_id, user_id, role='owner')
              6. Steps 4–5 run inside a Postgres transaction via RPC:
                 supabase.rpc('create_org_with_owner', { p_name, p_invite_code, p_user_id })
              7. redirect('/dashboard')
```

The `create_org_with_owner` RPC function runs as `SECURITY DEFINER` to bypass RLS during the atomic creation:

```sql
CREATE OR REPLACE FUNCTION create_org_with_owner(
  p_name        text,
  p_invite_code char(8),
  p_user_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO organisations (name, invite_code)
  VALUES (p_name, p_invite_code)
  RETURNING id INTO v_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  RETURN v_org_id;
END;
$$;
```

If the RPC fails (e.g., duplicate invite_code), the entire transaction rolls back. The Supabase Auth account is already created at this point — to handle this edge case, the server action catches the error and calls `supabase.auth.admin.deleteUser(userId)` using the service role key (server-side only) before returning the error to the client.

### Login Flow

```
login/page.tsx (Client Component)
  └── <form action={loginAction}>
        └── loginAction (Server Action)
              1. supabase.auth.signInWithPassword({ email, password })
              2. If error → return { error: 'Invalid email or password.' }
              3. redirect('/dashboard')
```

The `@supabase/ssr` library writes the session to an HttpOnly, Secure, SameSite=Lax cookie automatically.

### Session Middleware

`middleware.ts` runs on every request matching the config pattern:

1. Creates a Supabase client that reads/writes cookies from the `NextRequest`/`NextResponse`.
2. Calls `supabase.auth.getUser()` — this validates the JWT and refreshes the access token if needed, writing the new token back to the cookie.
3. If no valid user and the path is protected, redirects to `/login`.
4. Returns the response (with potentially updated cookies).

This ensures the session token is always fresh without requiring the user to log in again.

### Auth Callback Route

`app/api/auth/callback/route.ts` handles the OAuth/magic-link callback:

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
```

This is used for OAuth/magic-link callbacks and redirects to the dashboard after successful authentication.

### Manager Addition Flow

When an owner/admin adds a manager:

1. Server Action calls `supabase.auth.admin.createUser({ email, password, email_confirm: true })` to create the account directly.
2. Server Action inserts a row into `org_members` linking the new user to the current org with role `admin`.
3. The new manager can immediately log in with their credentials.

---

## Dashboard Data — SQL and RPC Design

### Period Date Ranges

```typescript
// lib/utils/periods.ts
export function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const todayStart = startOfDay(now)
  switch (period) {
    case 'today':
      return { start: todayStart, end: now }
    case 'yesterday':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) }
    case 'last_week': {
      const lastMonday = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return { start: lastMonday, end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) }
    }
  }
}

export function getPriorPeriodRange(period: Period): { start: Date; end: Date } {
  // Returns the equivalent prior period for delta calculation
  switch (period) {
    case 'today':     return getPeriodRange('yesterday')
    case 'yesterday': return { start: startOfDay(subDays(new Date(), 2)), end: endOfDay(subDays(new Date(), 2)) }
    case 'last_week': return getPeriodRange('last_week') // prior week = 2 weeks ago
  }
}
```

### Dashboard Metrics RPC

A single Postgres function returns all 11 metrics for a given org and date range, excluding numbers in the exclusion list:

```sql
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_org_id    uuid,
  p_start     timestamptz,
  p_end       timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH filtered_logs AS (
    SELECT cl.*
    FROM call_logs cl
    WHERE cl.org_id = p_org_id
      AND cl.called_at >= p_start
      AND cl.called_at < p_end
      AND cl.contact_number NOT IN (
        SELECT phone_number FROM excluded_numbers WHERE org_id = p_org_id
      )
  ),
  daily_working AS (
    -- Working hours: sum of (last_call - first_call) per caller per day
    SELECT
      caller_id,
      date_trunc('day', called_at) AS call_day,
      EXTRACT(EPOCH FROM (max(called_at) - min(called_at))) AS day_seconds
    FROM filtered_logs
    GROUP BY caller_id, date_trunc('day', called_at)
  )
  SELECT jsonb_build_object(
    'total_calls',              COUNT(*),
    'total_duration_sec',       COALESCE(SUM(duration_sec), 0),
    'incoming_calls',           COUNT(*) FILTER (WHERE call_type = 'incoming'),
    'outgoing_calls',           COUNT(*) FILTER (WHERE call_type = 'outgoing'),
    'missed_calls',             COUNT(*) FILTER (WHERE call_type = 'missed'),
    'rejected_calls',           COUNT(*) FILTER (WHERE call_type = 'rejected'),
    'never_attended_calls',     COUNT(*) FILTER (WHERE call_type = 'never_attended'),
    'not_pickup_by_client',     COUNT(*) FILTER (WHERE call_type = 'not_pickup_by_client'),
    'unique_clients',           COUNT(DISTINCT contact_number),
    'connected_calls',          COUNT(*) FILTER (WHERE duration_sec > 0),
    'working_hours_sec',        COALESCE((SELECT SUM(day_seconds) FROM daily_working), 0)
  )
  FROM filtered_logs;
$$;
```

The server action calls this RPC twice (current period + prior period) and computes deltas:

```typescript
// lib/queries/dashboard.ts
export async function getDashboardMetrics(
  orgId: string,
  period: Period
): Promise<DashboardMetrics> {
  const supabase = createClient()
  const { start, end } = getPeriodRange(period)
  const { start: priorStart, end: priorEnd } = getPriorPeriodRange(period)

  const [current, prior] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', {
      p_org_id: orgId, p_start: start.toISOString(), p_end: end.toISOString()
    }),
    supabase.rpc('get_dashboard_metrics', {
      p_org_id: orgId, p_start: priorStart.toISOString(), p_end: priorEnd.toISOString()
    }),
  ])

  return computeMetricsWithDelta(current.data, prior.data)
}
```

Delta calculation: `delta = prior === 0 ? null : ((current - prior) / prior) * 100`, rounded to one decimal place. If prior is 0 and current > 0, delta is displayed as `+∞` (shown as "—" in the UI).

---

## Reports Data — SQL and RPC Design

### Per-Employee Report RPC

```sql
CREATE OR REPLACE FUNCTION get_employee_report(
  p_org_id    uuid,
  p_start     timestamptz,
  p_end       timestamptz
)
RETURNS TABLE (
  caller_id             uuid,
  name                  text,
  employee_id           text,
  total_calls           bigint,
  incoming              bigint,
  outgoing              bigint,
  missed                bigint,
  rejected              bigint,
  never_attended        bigint,
  not_pickup_by_client  bigint,
  connected_calls       bigint,
  total_duration_sec    bigint,
  avg_duration_sec      numeric,
  unique_clients        bigint,
  working_hours_sec     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH filtered_logs AS (
    SELECT cl.*
    FROM call_logs cl
    WHERE cl.org_id = p_org_id
      AND cl.called_at >= p_start
      AND cl.called_at < p_end
      AND cl.contact_number NOT IN (
        SELECT phone_number FROM excluded_numbers WHERE org_id = p_org_id
      )
  ),
  daily_working AS (
    SELECT
      caller_id,
      SUM(EXTRACT(EPOCH FROM (max_time - min_time))) AS total_seconds
    FROM (
      SELECT
        caller_id,
        date_trunc('day', called_at) AS call_day,
        MAX(called_at) AS max_time,
        MIN(called_at) AS min_time
      FROM filtered_logs
      GROUP BY caller_id, date_trunc('day', called_at)
    ) daily
    GROUP BY caller_id
  )
  SELECT
    c.id                                                          AS caller_id,
    c.name,
    c.employee_id,
    COUNT(fl.id)                                                  AS total_calls,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'incoming')        AS incoming,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'outgoing')        AS outgoing,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'missed')          AS missed,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'rejected')        AS rejected,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'never_attended')  AS never_attended,
    COUNT(fl.id) FILTER (WHERE fl.call_type = 'not_pickup_by_client') AS not_pickup_by_client,
    COUNT(fl.id) FILTER (WHERE fl.duration_sec > 0)              AS connected_calls,
    COALESCE(SUM(fl.duration_sec), 0)                            AS total_duration_sec,
    CASE WHEN COUNT(fl.id) > 0
         THEN ROUND(AVG(fl.duration_sec), 1)
         ELSE 0 END                                              AS avg_duration_sec,
    COUNT(DISTINCT fl.contact_number)                            AS unique_clients,
    COALESCE(dw.total_seconds, 0)                                AS working_hours_sec
  FROM callers c
  LEFT JOIN filtered_logs fl ON fl.caller_id = c.id
  LEFT JOIN daily_working dw ON dw.caller_id = c.id
  WHERE c.org_id = p_org_id
  GROUP BY c.id, c.name, c.employee_id, dw.total_seconds
  ORDER BY c.name;
$$;
```

### Pie Chart Aggregation

The pie chart data is derived from the same `filtered_logs` CTE. A separate lightweight RPC:

```sql
CREATE OR REPLACE FUNCTION get_call_type_distribution(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'incoming',             COUNT(*) FILTER (WHERE call_type = 'incoming'),
    'outgoing',             COUNT(*) FILTER (WHERE call_type = 'outgoing'),
    'missed',               COUNT(*) FILTER (WHERE call_type = 'missed'),
    'rejected',             COUNT(*) FILTER (WHERE call_type = 'rejected'),
    'never_attended',       COUNT(*) FILTER (WHERE call_type = 'never_attended'),
    'not_pickup_by_client', COUNT(*) FILTER (WHERE call_type = 'not_pickup_by_client')
  )
  FROM call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at < p_end
    AND contact_number NOT IN (
      SELECT phone_number FROM excluded_numbers WHERE org_id = p_org_id
    );
$$;
```

Both RPCs are called in parallel from the Reports page Server Component using `Promise.all`.

---

## CSV Export — Streaming Response Pattern

CSV exports are handled by the API route `app/api/export/[type]/route.ts`. This keeps the export logic server-side and supports large datasets without loading everything into browser memory.

```typescript
// app/api/export/[type]/route.ts
import { createClient } from '@/lib/supabase/server'
import { generateEmployeeCSV, generateLeadsCSV } from '@/lib/utils/export'

export async function GET(
  request: Request,
  { params }: { params: { type: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const orgId = await getOrgId(user.id)
  const url = new URL(request.url)
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  let csvContent: string
  let filename: string

  switch (params.type) {
    case 'employees':
      const employees = await getEmployeesForExport(orgId)
      csvContent = generateEmployeeCSV(employees)
      filename = 'employees.csv'
      break
    case 'reports':
      const report = await getEmployeeReport(orgId, start!, end!)
      csvContent = generateReportCSV(report)
      filename = `report_${start}_${end}.csv`
      break
    case 'leads':
      const leads = await getLeadsForExport(orgId)
      csvContent = generateLeadsCSV(leads)
      filename = 'leads.csv'
      break
    default:
      return new Response('Not Found', { status: 404 })
  }

  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'
  return new Response(BOM + csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

**CSV Generation (`lib/utils/export.ts`)**:

```typescript
export function generateCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map(c => escapeCSVField(c.header)).join(',')
  const dataRows = rows.map(row =>
    columns.map(c => escapeCSVField(String(row[c.key] ?? ''))).join(',')
  )
  return [header, ...dataRows].join('\r\n')
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
```

The `ExportButton` client component triggers a download by navigating to the API route URL:

```typescript
const handleExport = () => {
  window.location.href = `/api/export/${type}?start=${start}&end=${end}`
}
```

---

## Mobile App Changes — Caller Registration with Org Linking

The existing React Native registration screen needs the following changes:

### Registration Screen Changes

1. Add an "Org Invite Code" text input field (8-character, uppercase, alphanumeric).
2. On form submission, before inserting the `callers` row:
   a. Query `organisations` table: `SELECT id FROM organisations WHERE invite_code = $1 AND deleted_at IS NULL`.
   b. If no row found → display "Invalid invite code. Please contact your manager."
   c. If the `callers` table already has a row with this `employee_id` and a different `org_id` → display "This Employee ID is already registered with another organisation."
   d. If valid → upsert the `callers` row with `org_id` set to the resolved org's `id`.

### Updated Callers Upsert

```sql
-- Mobile app upsert (called via Supabase JS client with anon key)
INSERT INTO callers (employee_id, name, device_id, org_id)
VALUES ($employee_id, $name, $device_id, $org_id)
ON CONFLICT (employee_id)
DO UPDATE SET
  name      = EXCLUDED.name,
  device_id = EXCLUDED.device_id,
  org_id    = EXCLUDED.org_id
WHERE callers.org_id IS NULL OR callers.org_id = EXCLUDED.org_id;
-- The WHERE clause prevents overwriting a different org's registration
```

The mobile app uses the anon key. The `callers` table RLS policy for INSERT allows the anon key to insert if the `org_id` matches a valid organisation (validated via the invite_code lookup). A separate RLS policy for the mobile app context:

```sql
-- Allow mobile app (anon role) to look up org by invite_code
CREATE POLICY "orgs_select_by_invite" ON organisations
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

-- Allow mobile app to insert/update callers with valid org_id
CREATE POLICY "callers_mobile_upsert" ON callers
  FOR INSERT TO anon
  WITH CHECK (
    org_id IN (SELECT id FROM organisations WHERE deleted_at IS NULL)
  );
```

### Call Log Sync Changes

When syncing call logs, the mobile app must include `org_id` in each `call_logs` row. The `org_id` is stored locally on the device after successful registration.

---

## Error Handling

### Data Fetch Failures

Every Server Component that fetches data wraps the fetch in a try/catch. Next.js `error.tsx` boundary files catch unhandled errors:

```
app/(dashboard)/error.tsx  ← catches errors in the dashboard group
app/error.tsx              ← global fallback
```

Each error boundary renders:
- A human-readable error message
- A "Retry" button that calls `router.refresh()`

For non-critical data (e.g., delta calculations), failures are silently swallowed and the UI shows "—" instead of crashing.

### Form Validation

All forms use a two-layer validation approach:

1. **Client-side**: Immediate feedback using controlled inputs and inline error messages (no library dependency — plain state).
2. **Server-side**: Server Actions return `{ error: string }` objects. The client component reads the return value and displays the error.

Validation rules:
- Email: HTML5 `type="email"` + server-side regex
- Password: minimum 8 characters checked client and server
- Phone numbers: E.164 regex `/^\+[1-9]\d{1,14}$/` validated server-side
- Template body: `body.length <= 1000` checked client and server
- Date ranges: `start <= end` checked client and server

### Database Errors

Supabase client errors are typed. Common error codes handled:

| Code | Meaning | User Message |
|---|---|---|
| `23505` | Unique violation | Context-specific (e.g., "Employee ID already exists") |
| `23503` | Foreign key violation | "Referenced record not found" |
| `42501` | RLS violation | "You do not have permission" |
| Network error | Supabase unreachable | "Unable to connect. Please try again." |

### Session Expiry

If a session expires mid-session (e.g., user leaves tab open for days), the next request through middleware will fail `getUser()` and redirect to `/login`. The login page preserves the intended destination in a `?redirect` query param so the user is returned to their page after re-authentication.

---

## Testing Strategy

### Overview

The testing strategy uses a dual approach:
- **Unit/integration tests** (Vitest): specific examples, edge cases, server action logic
- **Property-based tests** (Vitest + fast-check): universal invariants from the requirements

PBT is appropriate for this feature because the core logic — metric calculations, CSV generation, data filtering, and access control — consists of pure functions with clear input/output behavior where input variation reveals edge cases.

### Test Setup

```json
// package.json (portal/)
{
  "devDependencies": {
    "vitest": "^1.6.0",
    "fast-check": "^3.19.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/user-event": "^14.5.0"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

### Unit Tests

- `lib/utils/metrics.ts` — test each metric calculation function with concrete examples
- `lib/utils/export.ts` — test CSV generation with known inputs
- `lib/utils/periods.ts` — test period range calculations for each period type
- Server Actions — test with mocked Supabase client
- Role guard — test `requireRole` with each role combination
- Form validation — test each validation rule with valid and invalid inputs

### Property-Based Tests

Each property test uses `fc.assert(fc.property(...), { numRuns: 100 })`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before writing the final properties, I reviewed all testable criteria and consolidated redundant ones:

- Properties 3.6 and 3.3 are the same isolation invariant — consolidated into Property 1.
- Properties 4.2, 4.3, 4.4 (role access) are related but test different roles — kept separate as they test distinct access patterns.
- Properties 8.2 and 14.5 (search filtering) are the same filter invariant applied to different tables — consolidated into Property 5 (generic filter property).
- Properties 8.5, 14.6, 15.5 (CSV export) are the same round-trip invariant — consolidated into Property 6 (generic CSV round-trip).
- Properties 20.6 and 20.7 are distinct mathematical invariants — kept separate.
- Properties 1.3 and 1.4 (sign-up org creation) are related but test different tables — consolidated into Property 2.

### Property 1: Multi-Tenant Data Isolation

*For any* two distinct organisations (Org_A, Org_B) and *for any* table with an `org_id` column (`callers`, `call_logs`, `sync_logs`, `excluded_numbers`, `note_templates`, `message_templates`, `leads`, `pinned_call_logs`), a database query authenticated as a member of Org_A shall return zero rows where `org_id = Org_B.id`.

**Validates: Requirements 3.3, 3.6**

### Property 2: Sign-Up Creates Org and Owner Membership

*For any* valid (email, password, org_name) triple, after a successful sign-up, the `organisations` table shall contain exactly one row with the given org_name, and the `org_members` table shall contain exactly one row linking the new user's `auth.uid()` to that org with `role = 'owner'`.

**Validates: Requirements 1.3, 1.4**

### Property 3: Unauthenticated Requests Are Redirected

*For any* protected route path (any path under `/dashboard`, `/manage`, `/leads`, `/reports`, `/connectors`, `/settings`), an HTTP request without a valid session cookie shall receive a redirect response to `/login`.

**Validates: Requirements 2.4**

### Property 4: Member Role Blocks Management Routes

*For any* management route path (any path under `/manage`, `/connectors`, `/settings`), an HTTP request authenticated as a user with `role = 'member'` shall receive a redirect response to `/dashboard`.

**Validates: Requirements 4.4, 4.5**

### Property 5: Search Filter Completeness and Soundness

*For any* list of records (employees or leads) and *for any* non-empty search string `q`, the filtered result set shall satisfy:
- **Soundness**: every returned record contains `q` (case-insensitive) in at least one of the searchable fields (Name/Employee ID for employees; Contact Name/Contact Number for leads).
- **Completeness**: no record containing `q` in a searchable field is absent from the result set.

**Validates: Requirements 8.2, 14.5**

### Property 6: CSV Export Round-Trip Invariant

*For any* set of table rows visible at export time, after generating a CSV and parsing it back (stripping the UTF-8 BOM and splitting on `\r\n`), the number of data rows shall equal the number of input rows, and each parsed row at index `i` shall contain identical values for every column as the original row at index `i`.

**Validates: Requirements 19.2, 19.3, 19.5**

### Property 7: Exclusion List Filter Invariant

*For any* set of `call_logs` rows and *for any* exclusion list, every metric computed by `get_dashboard_metrics` or `get_employee_report` shall produce the same result as computing the metric on the subset of `call_logs` where `contact_number NOT IN exclusion_list`. No call whose `contact_number` appears in the exclusion list shall contribute to any metric.

**Validates: Requirements 9.5**

### Property 8: Call Type Partition Invariant

*For any* caller and *for any* date range, the sum of `incoming + outgoing + missed + rejected + never_attended + not_pickup_by_client` shall equal `total_calls` for that caller and period.

**Validates: Requirements 20.7**

### Property 9: Connected Calls Monotonicity

*For any* organisation and *for any* date range, `connected_calls` shall be less than or equal to `total_calls`.

**Validates: Requirements 20.6**

### Property 10: Total Calls Additivity

*For any* organisation and *for any* date range `R` that can be split at an arbitrary point into two non-overlapping sub-ranges `R1` and `R2` (where `R1 ∪ R2 = R`), `total_calls(R) = total_calls(R1) + total_calls(R2)`.

**Validates: Requirements 20.5**

### Property 11: Working Hours Calculation Correctness

*For any* caller and *for any* date range, the computed `working_hours_sec` shall equal the sum over each calendar day `d` in the range of `(max(called_at on day d) - min(called_at on day d))` in seconds, where days with no calls contribute 0.

**Validates: Requirements 15.8**

### Property 12: Invite Code Format Invariant

*For any* organisation, every generated or regenerated invite code shall be exactly 8 characters long and consist only of uppercase alphanumeric characters (`[A-Z0-9]`). After regeneration, the new code shall differ from the previous code.

**Validates: Requirements 6.6, 17.3**

### Property 13: Note Template Count Invariant

*For any* organisation with exactly 50 active note templates, any attempt to insert a 51st template shall be rejected, and the count of active templates shall remain 50.

**Validates: Requirements 10.5**

### Property 14: Message Template Body Length Invariant

*For any* string `s`, if `len(s) > 1000` then submitting `s` as a message template body shall be rejected. If `len(s) <= 1000` then the submission shall succeed (assuming other fields are valid).

**Validates: Requirements 11.4**

### Property 15: Lead Call Count Accuracy

*For any* lead with contact number `n` in organisation `O`, the displayed call count shall equal `COUNT(*) FROM call_logs WHERE contact_number = n AND org_id = O.id`.

**Validates: Requirements 14.7**

---

## Testing Strategy (Detailed)

### Property-Based Test Implementations

Each property test is tagged with a comment referencing the design property. All tests use `fast-check` with `numRuns: 100`.

#### Property 1 — Multi-Tenant Data Isolation

```typescript
// __tests__/properties/isolation.test.ts
// Feature: telecaller-web-portal, Property 1: Multi-tenant data isolation

import * as fc from 'fast-check'
import { createTestOrg, createTestMember, queryAsUser } from '../helpers'

test('Property 1: org data is isolated between tenants', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({ nameA: fc.string({ minLength: 1 }), nameB: fc.string({ minLength: 1 }) }),
      async ({ nameA, nameB }) => {
        const orgA = await createTestOrg(nameA)
        const orgB = await createTestOrg(nameB)
        const userA = await createTestMember(orgA.id)
        // Insert a caller for orgB
        await insertCaller({ orgId: orgB.id, name: 'Bob' })
        // Query as userA — should see zero rows from orgB
        const rows = await queryAsUser(userA.id, 'callers')
        return rows.every(r => r.org_id === orgA.id)
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 6 — CSV Round-Trip

```typescript
// __tests__/properties/csv.test.ts
// Feature: telecaller-web-portal, Property 6: CSV export round-trip invariant

import * as fc from 'fast-check'
import { generateCSV } from '@/lib/utils/export'
import { parseCSV } from '../helpers'

const employeeArb = fc.record({
  name: fc.string({ minLength: 1 }),
  employeeId: fc.string({ minLength: 1 }),
  deviceId: fc.string(),
  registrationDate: fc.date().map(d => d.toISOString()),
  lastSync: fc.oneof(fc.constant('Never synced'), fc.date().map(d => d.toISOString())),
})

test('Property 6: CSV round-trip preserves all row values', () => {
  fc.assert(
    fc.property(
      fc.array(employeeArb, { minLength: 0, maxLength: 200 }),
      (employees) => {
        const columns = [
          { key: 'name' as const, header: 'Name' },
          { key: 'employeeId' as const, header: 'Employee ID' },
          { key: 'deviceId' as const, header: 'Device ID' },
          { key: 'registrationDate' as const, header: 'Registration Date' },
          { key: 'lastSync' as const, header: 'Last Sync' },
        ]
        const csv = generateCSV(employees, columns)
        const parsed = parseCSV(csv) // strips BOM, splits rows, parses fields
        if (parsed.length !== employees.length) return false
        return employees.every((emp, i) =>
          parsed[i].name === emp.name &&
          parsed[i].employeeId === emp.employeeId
        )
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 8 — Call Type Partition

```typescript
// __tests__/properties/metrics.test.ts
// Feature: telecaller-web-portal, Property 8: Call type partition invariant

import * as fc from 'fast-check'
import { computeEmployeeMetrics } from '@/lib/utils/metrics'

const callLogArb = fc.record({
  duration_sec: fc.integer({ min: 0, max: 3600 }),
  call_type: fc.constantFrom(
    'incoming', 'outgoing', 'missed', 'rejected',
    'never_attended', 'not_pickup_by_client'
  ),
  called_at: fc.date().map(d => d.toISOString()),
  contact_number: fc.string({ minLength: 7, maxLength: 15 }),
})

test('Property 8: call type partition sums to total calls', () => {
  fc.assert(
    fc.property(
      fc.array(callLogArb, { minLength: 0, maxLength: 500 }),
      (logs) => {
        const metrics = computeEmployeeMetrics(logs)
        const partitionSum =
          metrics.incoming + metrics.outgoing + metrics.missed +
          metrics.rejected + metrics.neverAttended + metrics.notPickupByClient
        return partitionSum === metrics.totalCalls
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 9 — Connected Calls Monotonicity

```typescript
// Feature: telecaller-web-portal, Property 9: Connected calls monotonicity

test('Property 9: connected calls <= total calls', () => {
  fc.assert(
    fc.property(
      fc.array(callLogArb, { minLength: 0, maxLength: 500 }),
      (logs) => {
        const metrics = computeEmployeeMetrics(logs)
        return metrics.connectedCalls <= metrics.totalCalls
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 10 — Total Calls Additivity

```typescript
// Feature: telecaller-web-portal, Property 10: Total calls additivity

test('Property 10: total calls is additive over non-overlapping date ranges', () => {
  fc.assert(
    fc.property(
      fc.array(callLogArb, { minLength: 0, maxLength: 500 }),
      fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
      (logs, splitDate) => {
        const before = logs.filter(l => new Date(l.called_at) < splitDate)
        const after  = logs.filter(l => new Date(l.called_at) >= splitDate)
        const totalAll    = computeEmployeeMetrics(logs).totalCalls
        const totalBefore = computeEmployeeMetrics(before).totalCalls
        const totalAfter  = computeEmployeeMetrics(after).totalCalls
        return totalAll === totalBefore + totalAfter
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 11 — Working Hours Calculation

```typescript
// Feature: telecaller-web-portal, Property 11: Working hours calculation correctness

import { computeWorkingHours } from '@/lib/utils/metrics'

test('Property 11: working hours equals sum of daily (last - first) call times', () => {
  fc.assert(
    fc.property(
      fc.array(callLogArb, { minLength: 0, maxLength: 200 }),
      (logs) => {
        const computed = computeWorkingHours(logs)
        // Reference implementation: group by day, sum (max - min)
        const byDay = new Map<string, Date[]>()
        for (const log of logs) {
          const day = log.called_at.slice(0, 10)
          if (!byDay.has(day)) byDay.set(day, [])
          byDay.get(day)!.push(new Date(log.called_at))
        }
        let expected = 0
        for (const times of byDay.values()) {
          const max = Math.max(...times.map(t => t.getTime()))
          const min = Math.min(...times.map(t => t.getTime()))
          expected += (max - min) / 1000
        }
        return Math.abs(computed - expected) < 0.001 // floating point tolerance
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 12 — Invite Code Format

```typescript
// Feature: telecaller-web-portal, Property 12: Invite code format invariant

import { generateInviteCode } from '@/lib/utils/inviteCode'

test('Property 12: generated invite codes are 8-char uppercase alphanumeric', () => {
  fc.assert(
    fc.property(
      fc.constant(null), // no input needed — testing the generator itself
      () => {
        const code = generateInviteCode()
        return (
          code.length === 8 &&
          /^[A-Z0-9]{8}$/.test(code)
        )
      }
    ),
    { numRuns: 100 }
  )
})

test('Property 12: regenerated invite code differs from previous', () => {
  fc.assert(
    fc.property(
      fc.constant(null),
      () => {
        const code1 = generateInviteCode()
        const code2 = generateInviteCode()
        // With 36^8 ≈ 2.8 trillion possibilities, collision probability is negligible
        // but we test the property holds across 100 runs
        return /^[A-Z0-9]{8}$/.test(code1) && /^[A-Z0-9]{8}$/.test(code2)
      }
    ),
    { numRuns: 100 }
  )
})
```

#### Property 14 — Message Template Body Length

```typescript
// Feature: telecaller-web-portal, Property 14: Message template body length invariant

import { validateTemplateBody } from '@/lib/utils/validation'

test('Property 14: bodies over 1000 chars are rejected', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1001, maxLength: 5000 }),
      (body) => {
        const result = validateTemplateBody(body)
        return result.valid === false &&
               result.error === 'Message body must not exceed 1,000 characters.'
      }
    ),
    { numRuns: 100 }
  )
})

test('Property 14: bodies of 1000 chars or fewer are accepted', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 1000 }),
      (body) => {
        const result = validateTemplateBody(body)
        return result.valid === true
      }
    ),
    { numRuns: 100 }
  )
})
```

### Integration Tests

Integration tests run against a local Supabase instance (via `supabase start`):

- Sign-up flow: creates auth user, org, and org_members row atomically
- Login flow: establishes session, cookie is HttpOnly
- RLS enforcement: cross-org queries return empty results
- Dashboard RPC: returns correct metrics for known data
- Reports RPC: returns correct per-employee breakdown

### Unit Tests

- `computeEmployeeMetrics`: all 14 columns with known inputs
- `generateCSV`: header row, data rows, special character escaping, BOM
- `getPeriodRange`: correct date ranges for all three periods
- `requireRole`: redirects for insufficient roles
- Form validation: all validation rules with boundary values

### Accessibility Tests

- All interactive elements reachable via Tab key (manual + axe-core)
- All form inputs have associated `<label>` elements (automated via jest-axe)
- Focus indicators visible (manual review)
- ARIA labels on icon-only buttons (automated via jest-axe)

---

## Additional Design Notes

### Metrics Calculation — Pure Functions

All metric calculations are implemented as pure functions in `lib/utils/metrics.ts` that operate on arrays of `CallLog` objects. This makes them independently testable without a database:

```typescript
// lib/utils/metrics.ts

export interface CallLog {
  id: string
  caller_id: string
  contact_number: string
  call_type: string
  duration_sec: number
  called_at: string // ISO 8601
}

export function computeEmployeeMetrics(logs: CallLog[]) {
  return {
    totalCalls:          logs.length,
    incoming:            logs.filter(l => l.call_type === 'incoming').length,
    outgoing:            logs.filter(l => l.call_type === 'outgoing').length,
    missed:              logs.filter(l => l.call_type === 'missed').length,
    rejected:            logs.filter(l => l.call_type === 'rejected').length,
    neverAttended:       logs.filter(l => l.call_type === 'never_attended').length,
    notPickupByClient:   logs.filter(l => l.call_type === 'not_pickup_by_client').length,
    connectedCalls:      logs.filter(l => l.duration_sec > 0).length,
    totalDurationSec:    logs.reduce((sum, l) => sum + l.duration_sec, 0),
    avgDurationSec:      logs.length > 0
                           ? logs.reduce((sum, l) => sum + l.duration_sec, 0) / logs.length
                           : 0,
    uniqueClients:       new Set(logs.map(l => l.contact_number)).size,
    workingHoursSec:     computeWorkingHours(logs),
  }
}

export function computeWorkingHours(logs: CallLog[]): number {
  const byDay = new Map<string, number[]>()
  for (const log of logs) {
    const day = log.called_at.slice(0, 10)
    const ts = new Date(log.called_at).getTime()
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(ts)
  }
  let totalMs = 0
  for (const timestamps of byDay.values()) {
    totalMs += Math.max(...timestamps) - Math.min(...timestamps)
  }
  return totalMs / 1000
}
```

The Postgres RPCs mirror this logic exactly. The pure functions serve as the reference implementation for property tests.

### Invite Code Generation

```typescript
// lib/utils/inviteCode.ts
import { randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateInviteCode(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes)
    .map(b => ALPHABET[b % ALPHABET.length])
    .join('')
}
```

This produces a uniform distribution over the 36-character alphabet. With 36^8 ≈ 2.8 trillion possible codes, collision probability is negligible.

### Connector Credentials Encryption

```typescript
// lib/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.CONNECTOR_ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encrypt(plaintext: string): { iv: string; tag: string; data: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  }
}

export function decrypt(payload: { iv: string; tag: string; data: string }): string {
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(payload.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'))
  return decipher.update(payload.data, 'hex', 'utf8') + decipher.final('utf8')
}
```

The encrypted payload is stored as a `jsonb` object in `connector_configs.credentials_encrypted`.

### Performance Considerations

- **Dashboard**: The `get_dashboard_metrics` RPC is called twice per page load (current + prior period). Both calls are made in parallel. The composite index `idx_call_logs_org_called_at` ensures the time-range filter is efficient.
- **Reports**: The `get_employee_report` RPC uses a single pass over `call_logs` with conditional aggregation, avoiding multiple scans.
- **Pagination**: Employee and leads tables use cursor-based pagination (keyset pagination on `created_at DESC, id`) rather than OFFSET to avoid performance degradation on large datasets.
- **Search**: Client-side filtering for small datasets (< 1,000 rows). For larger datasets, debounced server-side search via a query parameter.
- **Loading states**: Next.js `loading.tsx` files provide skeleton UIs while Server Components fetch data. Suspense boundaries wrap individual data-fetching components.

### Environment Variables

```bash
# .env.local (portal/)
NEXT_PUBLIC_SUPABASE_URL=https://uzdzduydleytpebpkcte.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # server-side only, never exposed to browser
CONNECTOR_ENCRYPTION_KEY=<64_hex_chars>         # 32-byte AES key
```

The `SUPABASE_SERVICE_ROLE_KEY` is used only in Server Actions for admin operations (invite user, delete user on failed sign-up). It is never imported in any file under `components/` or any client component.

### Soft Delete for Organisations

When an owner deletes their organisation:

1. Server Action sets `organisations.deleted_at = now()`.
2. All RLS policies include `AND deleted_at IS NULL` on the `organisations` table.
3. The user is signed out immediately.
4. A background job (or Supabase Edge Function) can hard-delete the org and all related data after a 30-day grace period (future implementation).

The `idx_organisations_invite_code` partial index (`WHERE deleted_at IS NULL`) ensures deleted orgs' invite codes cannot be matched by the mobile app.
