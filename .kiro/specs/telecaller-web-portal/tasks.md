# Implementation Plan: Telecaller Web Portal

## Overview

This plan builds the Telecaller Web Portal incrementally: database foundations first, then the Next.js scaffold, authentication, layout shell, and each page in dependency order. Every task is scoped to one focused coding session and references the exact requirements and design sections the implementer needs.

The portal lives in `portal/` at the workspace root — a completely separate Next.js 14 project with its own `package.json`. It shares the existing Supabase project (`uzdzduydleytpebpkcte.supabase.co`).

### Key Workflow Changes

**User Management:**
- Portal signup: Manager signs up with org name → creates org + owner account
- Manager addition: Owners/admins can add managers directly (no email invite flow)
- Employee registration: Handled exclusively via mobile app using org invite codes

**No Invitation Flow:**
- Removed email invitation system for team members
- Managers are created directly with portal accounts
- Employees register only through the mobile app

---

## Tasks

- [x] 1. Database migrations — new tables, helper functions, and RPCs
  - [x] 1.1 Create `organisations`, `org_members`, and enum types
    - Apply migration: `CREATE TYPE org_role AS ENUM ('owner','admin','member')`, then create `organisations` and `org_members` tables with all columns, constraints, and indexes exactly as specified in the design's "New Tables" section.
    - Create the `create_org_with_owner` SECURITY DEFINER RPC that atomically inserts an org and its owner membership row inside a single transaction.
    - _Requirements: 1.3, 1.4, 1.9 — Design: Data Models › organisations, org_members; Authentication Flow › Sign-Up_

  - [x] 1.2 Create `excluded_numbers`, `note_templates`, `message_templates` tables
    - Apply migration for all three tables with columns, CHECK constraints (message body ≤ 1 000 chars), indexes, and foreign keys as specified in the design.
    - _Requirements: 9.1, 10.1, 11.1 — Design: Data Models › excluded_numbers, note_templates, message_templates_

  - [x] 1.3 Create `pinned_call_logs`, `connector_configs` tables and enums
    - Apply migration: `CREATE TYPE connector_status AS ENUM (...)`, then create the two tables with all columns, constraints, and indexes.
    - _Requirements: 13.2, 16.3 — Design: Data Models › pinned_call_logs, connector_configs_  - [x] 1.4 Alter existing `callers`, `call_logs`, `sync_logs` tables — add `org_id`
    - Apply migration: add nullable `org_id uuid REFERENCES organisations(id)` to each table, create all composite indexes (`idx_call_logs_org_called_at`, `idx_call_logs_org_caller`, etc.), then add NOT NULL constraint after backfill placeholder comment.
    - _Requirements: 3.4 — Design: Data Models › Existing Table Alterations_

  - [x] 1.5 Create RLS helper functions and enable RLS on all tables
    - Create `get_user_org_id()` and `get_user_role(p_org_id)` SECURITY DEFINER functions.
    - Enable RLS and apply all policies for `organisations`, `org_members`, `callers`, `call_logs`, `sync_logs`, `excluded_numbers`, `note_templates`, `message_templates`, `leads`, `pinned_call_logs`, `connector_configs` exactly as specified in the design's "RLS Policies" section.
    - Add the two anon-role policies for mobile app access (`orgs_select_by_invite`, `callers_mobile_upsert`).
    - _Requirements: 3.1, 3.3, 3.5 — Design: Data Models › RLS Policies_

  - [x] 1.6 Create `get_dashboard_metrics` RPC
    - Apply migration for the `get_dashboard_metrics(p_org_id, p_start, p_end)` SECURITY DEFINER function that returns a `jsonb` object with all 11 metrics, using the `filtered_logs` and `daily_working` CTEs as specified in the design.
    - _Requirements: 7.1, 7.6, 9.5, 20.1–20.4 — Design: Dashboard Data › Dashboard Metrics RPC_

  - [x] 1.7 Create `get_employee_report` and `get_call_type_distribution` RPCs
    - Apply migration for both SECURITY DEFINER functions as specified in the design's "Reports Data" section.
    - _Requirements: 15.2, 15.3, 15.8 — Design: Reports Data › Per-Employee Report RPC, Pie Chart Aggregation_

- [x] 2. Next.js 14 project scaffold (`portal/`)
  - Create `portal/` directory with `package.json` specifying Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, `@supabase/ssr`, `@supabase/supabase-js`, `date-fns`, `vitest`, and `fast-check` at pinned versions.
  - Initialise `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, and `.env.local.example` with the four required environment variable keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CONNECTOR_ENCRYPTION_KEY`).
  - Create `vitest.config.ts` with `environment: 'node'` and `globals: true`.
  - Run `shadcn init` to generate `components/ui/` baseline.
  - Create the full directory skeleton from the design (`app/`, `components/`, `lib/`, `types/`) with empty index files so TypeScript path aliases resolve.
  - Generate Supabase TypeScript types into `types/supabase.ts` via `supabase gen types typescript`.
  - Create `types/domain.ts` with `Period`, `DashboardMetrics`, `EmployeeReportRow`, `CallTypeDistribution`, and `CallLog` interfaces exactly as specified in the design.
  - _Requirements: 21.1 — Design: Architecture › Directory Structure, TypeScript Types_

- [x] 3. Supabase client helpers, middleware, and org utilities
  - [x] 3.1 Create `lib/supabase/server.ts`, `lib/supabase/client.ts`, and `lib/supabase/middleware.ts`
    - Implement the three Supabase client factory functions exactly as shown in the design's "Supabase Client Helpers" section.
    - _Requirements: 2.7, 3.2 — Design: Components › Supabase Client Helpers_

  - [x] 3.2 Create `middleware.ts` (route protection + session refresh)
    - Implement the Next.js middleware that calls `supabase.auth.getUser()` on every request, refreshes the session cookie, and redirects unauthenticated users away from protected routes.
    - Protected prefixes: `/dashboard`, `/manage`, `/leads`, `/reports`, `/connectors`, `/settings`.
    - _Requirements: 2.4, 2.6, 2.7 — Design: Components › middleware.ts_

  - [x] 3.3 Create `lib/queries/org.ts` and `lib/auth/requireRole.ts`
    - Implement `getOrgId(userId)` and `getUserRole(userId, orgId)` using React `cache()` as shown in the design.
    - Implement `requireRole(userId, orgId, allowed[])` that calls `redirect('/dashboard?error=permission_denied')` for insufficient roles.
    - _Requirements: 4.5, 4.6 — Design: Components › Multi-Tenancy Helper, Role Guard_

  - [x] 3.4 Create utility modules: `lib/utils/metrics.ts`, `lib/utils/periods.ts`, `lib/utils/export.ts`, `lib/utils/inviteCode.ts`, `lib/utils/encryption.ts`, `lib/utils/validation.ts`
    - Implement `computeEmployeeMetrics`, `computeWorkingHours` in `metrics.ts` as pure functions matching the design's reference implementation exactly.
    - Implement `getPeriodRange` and `getPriorPeriodRange` in `periods.ts`.
    - Implement `generateCSV` and `escapeCSVField` in `export.ts` with UTF-8 BOM support.
    - Implement `generateInviteCode` in `inviteCode.ts` using `crypto.randomBytes`.
    - Implement `encrypt`/`decrypt` (AES-256-GCM) in `encryption.ts`.
    - Implement `validateTemplateBody` and phone number (E.164) validation in `validation.ts`.
    - _Requirements: 6.6, 9.3, 11.4, 15.8, 19.4, 20.1–20.4 — Design: Additional Design Notes_

- [x] 4. Authentication pages and server actions
  - [x] 4.1 Sign-up page and `signUpAction` server action
    - Create `app/(auth)/signup/page.tsx` (Client Component) with a form accepting email, password, and organisation name.
    - Create `app/(auth)/signup/actions.ts` with `signUpAction` that: validates inputs, calls `supabase.auth.signUp`, generates an invite code, calls the `create_org_with_owner` RPC, and redirects to `/dashboard`. On failure, calls `supabase.auth.admin.deleteUser` (service role) and returns the appropriate error string.
    - Display inline validation errors: "Password must be at least 8 characters.", "Organisation name is required.", "An account with this email already exists."
    - _Requirements: 1.1–1.9 — Design: Authentication Flow › Sign-Up_

  - [x] 4.2 Login page and `loginAction` server action
    - Create `app/(auth)/login/page.tsx` (Client Component) with email + password form.
    - Create `app/(auth)/login/actions.ts` with `loginAction` that calls `supabase.auth.signInWithPassword` and redirects to `/dashboard` on success, or returns "Invalid email or password." on failure.
    - _Requirements: 2.1–2.3, 2.5 — Design: Authentication Flow › Login Flow_

  - [x] 4.3 Auth callback route
    - Create `app/api/auth/callback/route.ts` that exchanges the auth code for a session and redirects to `/dashboard`.
    - _Requirements: 2.1–2.3 — Design: Authentication Flow › Auth Callback Route_

- [x] 5. Layout shell — sidebar, header, and navigation
  - Create `app/(dashboard)/layout.tsx` (RSC) that fetches the authenticated user and org name, then renders the `<Sidebar>` and `<Header>` components wrapping `{children}`.
  - Create `components/layout/Sidebar.tsx` with navigation links to Dashboard, Manage (expandable with sub-links), Leads, Reports, Connectors, and Settings. Use a thin `'use client'` wrapper with `usePathname()` to highlight the active link.
  - Create `components/layout/Header.tsx` displaying the organisation name.
  - Add the sidebar footer showing the authenticated user's name and role.
  - Implement responsive collapse: sidebar becomes a hamburger menu on viewports < 768 px using Tailwind's `md:` breakpoint.
  - Create `app/(dashboard)/error.tsx` and `app/error.tsx` error boundaries that render a human-readable message and a "Retry" button calling `router.refresh()`.
  - Create `app/(dashboard)/loading.tsx` with a skeleton placeholder.
  - _Requirements: 18.1–18.5, 21.3, 21.4 — Design: Architecture › Request Lifecycle, Components › Sidebar_

- [x] 6. Dashboard page
  - [x] 6.1 Dashboard page — server-rendered stat cards
    - Create `app/(dashboard)/dashboard/page.tsx` (RSC) that calls `getDashboardMetrics(orgId, 'today')` server-side and renders 11 `<StatCard>` components.
    - Create `components/dashboard/StatCard.tsx` displaying metric name, numeric value, and delta badge (percentage change or "—").
    - Create `lib/queries/dashboard.ts` with `getDashboardMetrics` that calls the `get_dashboard_metrics` RPC twice in parallel and runs `computeMetricsWithDelta`.
    - Show "0" for all metrics and "—" for all deltas when no data exists.
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7 — Design: Dashboard Data Flow, Dashboard Metrics RPC_

  - [x] 6.2 Dashboard page — period selector and client-side refresh
    - Create `components/dashboard/PeriodSelector.tsx` (Client Component) with "Today", "Yesterday", "Last Week" buttons.
    - On period change, fetch `/api/dashboard?period=...&orgId=...` and update the stat cards without a full page navigation.
    - Create `app/api/dashboard/route.ts` Route Handler that calls `getDashboardMetrics` and returns JSON.
    - Ensure the update completes within 2 seconds (use `loading` state on the stat card grid during fetch).
    - _Requirements: 7.2, 7.3 — Design: Dashboard Data Flow_

- [x] 7. Manage — Employees sub-page
  - Create `app/(dashboard)/manage/employees/page.tsx` (RSC) that calls `requireRole(['owner','admin'])` and fetches all callers for the org.
  - Create `components/manage/EmployeeTable.tsx` (Client Component) with: paginated table (Name, Employee ID, Device ID, Registration Date, Last Sync), debounced search filtering (≤ 300 ms) on Name and Employee ID (case-insensitive), and "Never synced" label for callers with no sync_logs.
  - Note: Employee registration is handled exclusively through the mobile app using org invite codes. No portal-based employee registration.
  - Create `lib/queries/employees.ts` with typed query functions for listing callers.
  - _Requirements: 8.1–8.6 — Design: Components › EmployeeTable_

- [x] 8. Manage — Users sub-page (org members and manager addition)
  - Create `app/(dashboard)/manage/users/page.tsx` (RSC) that fetches all `org_members` rows for the org and renders a table with email, role, and join date.
  - Create a server action `addManagerAction` that calls `supabase.auth.admin.createUser` to create a portal account directly with admin role and inserts the `org_members` row.
  - Create a server action `removeMemberAction` that deletes the `org_members` row.
  - Display "An account with this email already exists." when applicable.
  - _Requirements: 5.1–5.5 — Design: Authentication Flow › Manager Addition Flow_

- [x] 9. Manage — Exclude Numbers sub-page
  - Create `app/(dashboard)/manage/exclude-numbers/page.tsx` (RSC) that fetches and renders the exclusion list for the org.
  - Create server actions to add (with E.164 validation) and delete excluded numbers.
  - Display "Please enter a valid phone number." for invalid formats.
  - _Requirements: 9.1–9.5 — Design: Data Models › excluded_numbers_

- [x] 10. Manage — Note Templates sub-page
  - Create `app/(dashboard)/manage/note-templates/page.tsx` (RSC) that fetches and renders all note templates for the org.
  - Create server actions to insert, update, and delete note templates.
  - Enforce the 50-template limit: display "You have reached the maximum of 50 templates." when the count is already 50.
  - Reflect updates and deletions in the UI within 500 ms (optimistic update or `router.refresh()`).
  - _Requirements: 10.1–10.6 — Design: Data Models › note_templates_

- [x] 11. Manage — Message Templates sub-page
  - Create `app/(dashboard)/manage/message-templates/page.tsx` (RSC) that fetches and renders all message templates for the org.
  - Create server actions to insert and delete message templates.
  - Validate body length ≤ 1 000 characters client-side and server-side; display "Message body must not exceed 1,000 characters."
  - _Requirements: 11.1–11.5 — Design: Data Models › message_templates_

- [x] 12. Manage — Call Recordings sub-page
  - Create `app/(dashboard)/manage/recordings/page.tsx` (RSC) with a date range filter and paginated list of recordings (Caller Name, Contact Number, Call Date, Duration, playback control).
  - Create `components/manage/AudioPlayer.tsx` (Client Component) that streams audio from Supabase Storage and displays elapsed/total time.
  - Show "Recording unavailable" when the storage file is not found.
  - _Requirements: 12.1–12.5 — Design: Architecture (Supabase Storage)_

- [x] 13. Manage — Pinned Call Logs sub-page
  - Create `app/(dashboard)/manage/pinned-logs/page.tsx` (RSC) that fetches all `pinned_call_logs` rows joined with `call_logs` and `callers` for the org.
  - Create server actions to pin and unpin call log entries (INSERT/DELETE on `pinned_call_logs`).
  - Display: Caller Name, Contact Number, Call Type, Duration, Call Date, pinned-by member name.
  - _Requirements: 13.1–13.4 — Design: Data Models › pinned_call_logs_

- [x] 14. Checkpoint — ensure all Manage pages compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Reports page
  - [x] 15.1 Reports page — date picker and per-employee table
    - Create `app/(dashboard)/reports/page.tsx` (RSC) with a date range picker (start + end date inputs).
    - Create `components/reports/ReportTable.tsx` (Client Component) with sortable columns (click header to toggle asc/desc) for all 14 per-employee metrics.
    - Call `get_employee_report` RPC via `lib/queries/reports.ts`.
    - Display "No data for the selected period." when the result set is empty.
    - Display "Start date must be on or before end date." for invalid ranges.
    - _Requirements: 15.1, 15.2, 15.4, 15.6, 15.7, 15.8 — Design: Reports Data › Per-Employee Report RPC_

  - [x] 15.2 Reports page — call-type pie chart
    - Create `components/reports/CallTypePieChart.tsx` (Client Component) using Recharts `PieChart` to display the distribution of the six call types for the selected date range.
    - Call `get_call_type_distribution` RPC in parallel with `get_employee_report` using `Promise.all`.
    - _Requirements: 15.3 — Design: Reports Data › Pie Chart Aggregation_

- [x] 16. CSV export API route and export buttons
  - Create `app/api/export/[type]/route.ts` that authenticates the request, resolves `orgId`, and streams a UTF-8 BOM CSV response for types `employees` and `reports`.
  - Implement `generateEmployeeCSV` and `generateReportCSV` in `lib/utils/export.ts` using the generic `generateCSV` helper.
  - Create `components/ExportButton.tsx` (Client Component) that navigates to the API route URL with the appropriate query params.
  - Wire the Export button into the Employees and Reports pages.
  - _Requirements: 8.5, 15.5, 19.1–19.4 — Design: CSV Export › Streaming Response Pattern_

- [x] 17. Connectors page
  - Create `app/(dashboard)/connectors/page.tsx` (RSC) that calls `requireRole(['owner','admin'])` and fetches `connector_configs` for the org.
  - Render a list of available integrations with Connected / Not Connected / Reconnection required status badges.
  - Create server actions for Connect (store encrypted credentials via `encrypt()`) and Disconnect (delete credentials, set status to `disconnected`).
  - Display "Reconnection required" when `status = 'error'`.
  - _Requirements: 16.1–16.5 — Design: Data Models › connector_configs, Additional Design Notes › Connector Credentials Encryption_

- [x] 18. Settings page
  - Create `app/(dashboard)/settings/page.tsx` (RSC) that calls `requireRole(['owner','admin'])` and fetches the org row.
  - Display org name, creation date, current invite code, and plan tier ("Free").
  - Create server action `updateOrgNameAction` (owner only) that updates `organisations.name` and triggers `router.refresh()`.
  - Create server action `regenerateInviteCodeAction` (owner or admin) that calls `generateInviteCode()` and updates `organisations.invite_code`.
  - Create server action `deleteOrgAction` (owner only) that: shows a confirmation dialog requiring the user to type the org name, then sets `organisations.deleted_at = now()` and signs the user out.
  - _Requirements: 17.1–17.6, 6.5, 6.6 — Design: Additional Design Notes › Soft Delete for Organisations_

- [x] 19. Mobile app — Org Invite Code in registration screen
  - In the React Native registration screen (`src/`), add an "Org Invite Code" text input field (8-character, uppercase, alphanumeric).
  - Before inserting the `callers` row, query `organisations` for a matching `invite_code` (excluding soft-deleted orgs).
  - Display "Invalid invite code. Please contact your manager." if no org is found.
  - Display "This Employee ID is already registered with another organisation." if the existing `callers` row has a different `org_id`.
  - On success, upsert the `callers` row with the resolved `org_id` using the conditional `ON CONFLICT ... WHERE` clause from the design.
  - Update the call-log sync code to include `org_id` (stored locally after registration) in every `call_logs` row.
  - _Requirements: 6.1–6.4, 6.7 — Design: Mobile App Changes_

- [x] 20. Checkpoint — ensure all pages compile, middleware redirects work, and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Property-based tests
  - [x] 21.1 Write property test for multi-tenant data isolation (Property 1)
    - File: `portal/__tests__/properties/isolation.test.ts`
    - **Property 1: Multi-Tenant Data Isolation** — for any two distinct orgs, a query authenticated as a member of Org A returns zero rows where `org_id = Org_B.id` across all tables with `org_id`.
    - **Validates: Requirements 3.3, 3.6**

  - [x] 21.2 Write property test for sign-up org creation (Property 2)
    - File: `portal/__tests__/properties/signup.test.ts`
    - **Property 2: Sign-Up Creates Org and Owner Membership** — for any valid (email, password, org_name) triple, after successful sign-up, exactly one `organisations` row and one `org_members` row with `role = 'owner'` exist.
    - **Validates: Requirements 1.3, 1.4**

  - [x] 21.3 Write property test for unauthenticated redirect (Property 3)
    - File: `portal/__tests__/properties/auth.test.ts`
    - **Property 3: Unauthenticated Requests Are Redirected** — for any protected route path, a request without a valid session cookie receives a redirect to `/login`.
    - **Validates: Requirements 2.4**

  - [x] 21.4 Write property test for member role blocking management routes (Property 4)
    - File: `portal/__tests__/properties/auth.test.ts`
    - **Property 4: Member Role Blocks Management Routes** — for any management route path, a request authenticated as `role = 'member'` receives a redirect to `/dashboard`.
    - **Validates: Requirements 4.4, 4.5**

  - [x] 21.5 Write property test for search filter completeness and soundness (Property 5)
    - File: `portal/__tests__/properties/search.test.ts`
    - **Property 5: Search Filter Completeness and Soundness** — for any list of records and any non-empty search string, every returned record contains the string in a searchable field (soundness), and no matching record is absent (completeness).
    - **Validates: Requirements 8.2**

  - [x] 21.6 Write property test for CSV export round-trip invariant (Property 6)
    - File: `portal/__tests__/properties/csv.test.ts`
    - **Property 6: CSV Export Round-Trip Invariant** — for any set of rows, after generating a CSV and parsing it back, the row count and all field values are identical to the input.
    - **Validates: Requirements 19.2, 19.3, 19.5**

  - [x] 21.7 Write property test for exclusion list filter invariant (Property 7)
    - File: `portal/__tests__/properties/metrics.test.ts`
    - **Property 7: Exclusion List Filter Invariant** — for any set of call_logs and any exclusion list, every metric equals the metric computed on the subset where `contact_number NOT IN exclusion_list`.
    - **Validates: Requirements 9.5**

  - [x] 21.8 Write property test for call type partition invariant (Property 8)
    - File: `portal/__tests__/properties/metrics.test.ts`
    - **Property 8: Call Type Partition Invariant** — for any array of call logs, `incoming + outgoing + missed + rejected + never_attended + not_pickup_by_client = total_calls`.
    - **Validates: Requirements 20.7**

  - [x] 21.9 Write property test for connected calls monotonicity (Property 9)
    - File: `portal/__tests__/properties/metrics.test.ts`
    - **Property 9: Connected Calls Monotonicity** — for any array of call logs, `connected_calls <= total_calls`.
    - **Validates: Requirements 20.6**

  - [x] 21.10 Write property test for total calls additivity (Property 10)
    - File: `portal/__tests__/properties/metrics.test.ts`
    - **Property 10: Total Calls Additivity** — for any array of call logs and any split date, `total_calls(all) = total_calls(before) + total_calls(after)`.
    - **Validates: Requirements 20.5**

  - [x] 21.11 Write property test for working hours calculation correctness (Property 11)
    - File: `portal/__tests__/properties/metrics.test.ts`
    - **Property 11: Working Hours Calculation Correctness** — for any array of call logs, `computeWorkingHours` equals the sum of `(max(called_at) - min(called_at))` per calendar day.
    - **Validates: Requirements 15.8**

  - [x] 21.12 Write property test for invite code format invariant (Property 12)
    - File: `portal/__tests__/properties/inviteCode.test.ts`
    - **Property 12: Invite Code Format Invariant** — every generated invite code is exactly 8 characters and matches `[A-Z0-9]{8}`.
    - **Validates: Requirements 6.6, 17.3**

  - [x] 21.13 Write property test for note template count invariant (Property 13)
    - File: `portal/__tests__/properties/templates.test.ts`
    - **Property 13: Note Template Count Invariant** — with exactly 50 active templates, any attempt to insert a 51st is rejected and the count remains 50.
    - **Validates: Requirements 10.5**

  - [x] 21.14 Write property test for message template body length invariant (Property 14)
    - File: `portal/__tests__/properties/templates.test.ts`
    - **Property 14: Message Template Body Length Invariant** — any body with `len > 1000` is rejected; any body with `len <= 1000` is accepted.
    - **Validates: Requirements 11.4**

- [x] 22. Final checkpoint — ensure all tests pass
  - Run `vitest --run` in `portal/` and confirm all property-based and unit tests pass.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements and design sections for full traceability.
- Property tests in task 22 target the pure utility functions in `lib/utils/` — no database required for most of them.
- Tasks 1.1–1.7 must be applied to the existing Supabase project (`uzdzduydleytpebpkcte.supabase.co`) before any portal code runs.
- The mobile app changes in task 20 are in the existing React Native project root, not in `portal/`.
