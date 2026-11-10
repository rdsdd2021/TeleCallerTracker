# Web Management Portal Developer Guide

This document describes the design, implementation, and deployment procedures for the **TeleCallerTracker** web management portal located in [`portal/`](../portal/).

---

## 1. Web Technology Stack

* **Framework:** Next.js 14 (App Router, React Server Components)
* **Styling:** Tailwind CSS, PostCSS, `tailwindcss-animate`
* **Components:** Radix UI primitives, Lucide React
* **Charts & Analytics:** Recharts 2.x
* **Data Layer:** `@supabase/ssr` with Cookie-based Session Handshake
* **Testing:** Vitest & `fast-check` (Property-based testing)

---

## 2. Directory Structure & App Router

```
portal/
├── app/
│   ├── (auth)/                      # Unauthenticated route group
│   │   ├── login/                   # Manager authentication
│   │   └── signup/                  # New organization registration
│   ├── (dashboard)/                 # Authenticated protected group
│   │   ├── dashboard/               # Executive KPI dashboard
│   │   ├── leads/                   # Lead management & pipeline table
│   │   ├── reports/                 # Deep analytics, hourly charts, exports
│   │   ├── connectors/              # Third-party integrations
│   │   ├── settings/                # Organisation details & invite codes
│   │   └── manage/                  # Admin sub-pages
│   │       ├── employees/           # Telecaller list & deactivation
│   │       ├── exclude-numbers/     # Phone number exclusion list
│   │       ├── message-templates/   # WhatsApp/SMS pre-sets
│   │       ├── note-templates/      # Call disposition templates
│   │       ├── pinned-logs/         # Flagged conversations
│   │       ├── recordings/          # Call audio archives
│   │       └── users/               # Portal managers & role permissions
│   ├── api/                         # Edge/Serverless API routes
│   │   ├── auth/callback/           # Supabase OAuth/magic link callback
│   │   ├── export/[type]/           # CSV download streams
│   │   └── reports/                 # Real-time report endpoints
│   ├── globals.css                  # Tailwind styles & theme variables
│   └── layout.tsx                   # Root HTML shell
├── components/                      # Shared UI components & charts
├── lib/                             # Supabase clients & utility helpers
│   ├── auth/                        # Role requirement helpers
│   ├── queries/                     # Reusable database queries
│   ├── supabase/                    # Server, Client & Middleware clients
│   └── utils/                       # Metrics math, periods, CSV formatters
└── types/                           # Generated TypeScript definitions
```

---

## 3. Authentication & Middleware Guard

### Cookie-based SSR Handshake
Authentication is managed via `@supabase/ssr`. Server Components and Server Actions read session tokens stored in secure, `httpOnly` cookies via [`lib/supabase/server.ts`](../portal/lib/supabase/server.ts).

### Route Protection Middleware ([`middleware.ts`](../portal/middleware.ts))
Before any request enters `(dashboard)`, the middleware:
1. Refreshes the Supabase session token to prevent mid-session expirations.
2. Inspects `supabase.auth.getUser()`. If missing, rewrites the request to `/login`.
3. If an authenticated user visits `/login` or `/signup`, redirects them directly to `/dashboard`.

---

## 4. Analytics & Metrics Calculations

The analytics engine processes raw call logs into standard business KPIs:

1. **Total Calls:** Count of all logs within the selected period.
2. **Connected Calls:** Calls where `duration > 0` (excluding missed and immediate drops).
3. **Connection Rate:** `(connected_calls / total_calls) * 100`.
4. **Talk Time:** Sum of `duration` across all connected calls.
5. **Working Hours:** Calculated daily by taking `(max(called_at) - min(called_at))` across non-overlapping shifts.

---

## 5. Deployment on Vercel

### Deploying via CLI
```bash
cd portal
npx vercel
npx vercel --prod
```

### Required Environment Variables
Configure these in the Vercel Project Dashboard:
| Variable | Description | Exposure |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Public / Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | Public / Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Service Role Key | Server-only |
| `CONNECTOR_ENCRYPTION_KEY` | 32-byte hex key for encrypting credentials | Server-only |
