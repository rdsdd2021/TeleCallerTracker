-- =============================================================================
-- TeleCallerTracker — Master Supabase Schema
-- Run this entire file on a fresh Supabase project to get it deployment-ready.
-- Order: extensions → enums → tables → indexes → RLS → functions/RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.call_type AS ENUM ('incoming', 'outgoing', 'missed', 'rejected', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.connector_status AS ENUM ('connected', 'disconnected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------------

-- organisations
CREATE TABLE IF NOT EXISTS public.organisations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  invite_code       char(8)     NOT NULL UNIQUE,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  daily_call_target integer     NOT NULL DEFAULT 50
);

-- callers (mobile app users / telecallers)
CREATE TABLE IF NOT EXISTS public.callers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  device_id   text        UNIQUE,
  created_at  timestamptz DEFAULT now(),
  org_id      uuid        REFERENCES public.organisations(id)
);

-- call_logs
CREATE TABLE IF NOT EXISTS public.call_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id      uuid        NOT NULL REFERENCES public.callers(id),
  device_call_id text        NOT NULL,
  contact_number text        NOT NULL,
  contact_name   text,
  call_type      text        NOT NULL,
  duration_sec   integer     NOT NULL,
  called_at      timestamptz NOT NULL,
  sim_id         text,
  created_at     timestamptz DEFAULT now(),
  org_id         uuid        REFERENCES public.organisations(id),
  disposition    text        CHECK (
                               disposition IS NULL OR disposition IN (
                                 'interested','callback','not_interested',
                                 'wrong_number','no_answer','converted'
                               )
                             ),
  notes          text,
  UNIQUE (caller_id, device_call_id)
);

-- sync_logs
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id        uuid        NOT NULL REFERENCES public.callers(id),
  records_sent     integer     NOT NULL,
  records_inserted integer     NOT NULL,
  app_version      text,
  created_at       timestamptz DEFAULT now(),
  org_id           uuid        REFERENCES public.organisations(id),
  records_updated  integer     DEFAULT 0,
  sync_window_start timestamptz,
  sync_window_end   timestamptz,
  metadata         jsonb
);

-- org_members  (links auth.users → organisations with a role)
CREATE TABLE IF NOT EXISTS public.org_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organisations(id),
  user_id    uuid        NOT NULL REFERENCES auth.users(id),
  role       public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- excluded_numbers
CREATE TABLE IF NOT EXISTS public.excluded_numbers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organisations(id),
  phone_number text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_number)
);

-- note_templates
CREATE TABLE IF NOT EXISTS public.note_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organisations(id),
  title      text        NOT NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.organisations(id),
  title      text        NOT NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- connector_configs
CREATE TABLE IF NOT EXISTS public.connector_configs (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid                    NOT NULL REFERENCES public.organisations(id),
  connector_type        text                    NOT NULL,
  credentials_encrypted jsonb,
  status                public.connector_status NOT NULL DEFAULT 'disconnected',
  created_at            timestamptz             NOT NULL DEFAULT now(),
  updated_at            timestamptz             NOT NULL DEFAULT now(),
  UNIQUE (org_id, connector_type)
);

-- pinned_call_logs
CREATE TABLE IF NOT EXISTS public.pinned_call_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organisations(id),
  call_log_id uuid        NOT NULL REFERENCES public.call_logs(id),
  pinned_by   uuid        NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, call_log_id)
);

-- -----------------------------------------------------------------------------
-- 3. INDEXES
-- -----------------------------------------------------------------------------

-- call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_time
  ON public.call_logs (caller_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_sync_window
  ON public.call_logs (caller_id, called_at DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_call_logs_org_id
  ON public.call_logs (org_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_org_called_at
  ON public.call_logs (org_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_org_time
  ON public.call_logs (org_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_org_caller
  ON public.call_logs (org_id, caller_id, called_at DESC);

-- Partial index — covers the most recent ~30 days; update the date on re-deploy
CREATE INDEX IF NOT EXISTS idx_call_logs_recent
  ON public.call_logs (caller_id, called_at DESC)
  WHERE called_at >= (now() - interval '30 days');

-- Duplicate-prevention index (device_call_id + caller_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_device_caller_unique
  ON public.call_logs (device_call_id, caller_id);

-- callers
CREATE INDEX IF NOT EXISTS idx_callers_org_id
  ON public.callers (org_id);

-- org_members
CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON public.org_members (org_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON public.org_members (user_id);

-- organisations
CREATE INDEX IF NOT EXISTS idx_organisations_invite_code
  ON public.organisations (invite_code)
  WHERE deleted_at IS NULL;

-- sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_org_id
  ON public.sync_logs (org_id);

-- excluded_numbers
CREATE INDEX IF NOT EXISTS idx_excluded_numbers_org_id
  ON public.excluded_numbers (org_id);

-- note_templates
CREATE INDEX IF NOT EXISTS idx_note_templates_org_id
  ON public.note_templates (org_id);

-- message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_org_id
  ON public.message_templates (org_id);

-- connector_configs
CREATE INDEX IF NOT EXISTS idx_connector_configs_org_id
  ON public.connector_configs (org_id);

-- pinned_call_logs
CREATE INDEX IF NOT EXISTS idx_pinned_call_logs_org_id
  ON public.pinned_call_logs (org_id);

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE public.organisations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excluded_numbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_call_logs   ENABLE ROW LEVEL SECURITY;

-- ── organisations ─────────────────────────────────────────────────────────────
-- anon: mobile app reads org by invite code during registration
CREATE POLICY orgs_select_by_invite ON public.organisations
  FOR SELECT TO anon USING (deleted_at IS NULL);

-- anon: mobile app inserts org (handled via RPC in practice, kept for flexibility)
CREATE POLICY orgs_mobile_insert ON public.organisations
  FOR INSERT TO anon WITH CHECK (true);

-- authenticated: can only see their own org
CREATE POLICY org_select ON public.organisations
  FOR SELECT TO public
  USING (id = get_user_org_id() AND deleted_at IS NULL);

-- authenticated: only owner can update
CREATE POLICY org_update_owner ON public.organisations
  FOR UPDATE TO public
  USING (id = get_user_org_id() AND get_user_role(id) = 'owner');

-- ── callers ───────────────────────────────────────────────────────────────────
-- anon: mobile app reads callers (to check existing employee_id)
CREATE POLICY callers_mobile_select ON public.callers
  FOR SELECT TO anon USING (true);

-- anon: mobile app registers a new caller
CREATE POLICY callers_mobile_upsert ON public.callers
  FOR INSERT TO anon WITH CHECK (true);

-- anon: mobile app updates caller (re-registration, name change)
CREATE POLICY callers_mobile_update ON public.callers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- authenticated: see callers in own org
CREATE POLICY callers_select ON public.callers
  FOR SELECT TO public USING (org_id = get_user_org_id());

-- authenticated: owner/admin can insert callers
CREATE POLICY callers_insert ON public.callers
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- authenticated: owner/admin can update callers
CREATE POLICY callers_update ON public.callers
  FOR UPDATE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- ── call_logs ─────────────────────────────────────────────────────────────────
-- anon: mobile app reads its own call logs
CREATE POLICY call_logs_mobile_select ON public.call_logs
  FOR SELECT TO anon USING (true);

-- anon: mobile app inserts call logs (org must be active)
CREATE POLICY call_logs_mobile_insert ON public.call_logs
  FOR INSERT TO anon
  WITH CHECK (org_id IN (
    SELECT id FROM public.organisations WHERE deleted_at IS NULL
  ));

-- authenticated: see call logs in own org
CREATE POLICY call_logs_select ON public.call_logs
  FOR SELECT TO public USING (org_id = get_user_org_id());

-- authenticated: insert call logs in own org
CREATE POLICY call_logs_insert ON public.call_logs
  FOR INSERT TO public WITH CHECK (org_id = get_user_org_id());

-- ── sync_logs ─────────────────────────────────────────────────────────────────
CREATE POLICY sync_logs_select ON public.sync_logs
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY sync_logs_insert ON public.sync_logs
  FOR INSERT TO public WITH CHECK (org_id = get_user_org_id());

-- ── org_members ───────────────────────────────────────────────────────────────
CREATE POLICY org_members_mobile_select ON public.org_members
  FOR SELECT TO anon USING (true);

CREATE POLICY org_members_mobile_insert ON public.org_members
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY org_members_select ON public.org_members
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY org_members_update ON public.org_members
  FOR UPDATE TO public
  USING (org_id = get_user_org_id() AND get_user_role(org_id) = 'owner');

CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role])
    AND user_id <> auth.uid());

-- ── excluded_numbers ──────────────────────────────────────────────────────────
CREATE POLICY excluded_numbers_select ON public.excluded_numbers
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY excluded_numbers_insert ON public.excluded_numbers
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY excluded_numbers_delete ON public.excluded_numbers
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- ── note_templates ────────────────────────────────────────────────────────────
CREATE POLICY note_templates_select ON public.note_templates
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY note_templates_insert ON public.note_templates
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY note_templates_update ON public.note_templates
  FOR UPDATE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY note_templates_delete ON public.note_templates
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- ── message_templates ─────────────────────────────────────────────────────────
CREATE POLICY message_templates_select ON public.message_templates
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY message_templates_insert ON public.message_templates
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY message_templates_delete ON public.message_templates
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- ── connector_configs ─────────────────────────────────────────────────────────
CREATE POLICY connector_configs_select ON public.connector_configs
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY connector_configs_insert ON public.connector_configs
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY connector_configs_update ON public.connector_configs
  FOR UPDATE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY connector_configs_delete ON public.connector_configs
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- ── pinned_call_logs ──────────────────────────────────────────────────────────
CREATE POLICY pinned_call_logs_select ON public.pinned_call_logs
  FOR SELECT TO public USING (org_id = get_user_org_id());

CREATE POLICY pinned_call_logs_insert ON public.pinned_call_logs
  FOR INSERT TO public
  WITH CHECK (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE POLICY pinned_call_logs_delete ON public.pinned_call_logs
  FOR DELETE TO public
  USING (org_id = get_user_org_id()
    AND get_user_role(org_id) = ANY (ARRAY['owner'::org_role, 'admin'::org_role]));

-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS (used by RLS policies — must come before RPCs)
-- -----------------------------------------------------------------------------

-- Returns the org_id of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns the role of the currently authenticated user within a given org
CREATE OR REPLACE FUNCTION public.get_user_role(p_org_id uuid)
RETURNS public.org_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.org_members
  WHERE user_id = auth.uid() AND org_id = p_org_id
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPCs
-- -----------------------------------------------------------------------------

-- ── create_org_with_owner ─────────────────────────────────────────────────────
-- Creates an organisation and assigns the calling user as owner.
-- Used by the web portal during onboarding.
CREATE OR REPLACE FUNCTION public.create_org_with_owner(
  p_name        text,
  p_invite_code character,
  p_user_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organisations (name, invite_code)
  VALUES (p_name, p_invite_code)
  RETURNING id INTO v_org_id;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  RETURN v_org_id;
END;
$$;

-- ── upsert_call_logs ──────────────────────────────────────────────────────────
-- Called by the mobile app to sync a batch of call logs.
-- Uses ON CONFLICT to avoid duplicates (idempotent).
CREATE OR REPLACE FUNCTION public.upsert_call_logs(
  logs        jsonb,
  p_caller_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
  updated_count  integer := 0;
  log            jsonb;
  v_org_id       uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM public.callers WHERE id = p_caller_id;

  FOR log IN SELECT * FROM jsonb_array_elements(logs)
  LOOP
    INSERT INTO public.call_logs (
      caller_id, org_id, device_call_id, contact_number, contact_name,
      call_type, duration_sec, called_at, sim_id
    )
    VALUES (
      p_caller_id,
      v_org_id,
      log->>'device_call_id',
      log->>'contact_number',
      NULLIF(log->>'contact_name', ''),
      lower(log->>'call_type'),
      (log->>'duration_sec')::integer,
      (log->>'called_at')::timestamptz,
      NULLIF(log->>'sim_id', '')
    )
    ON CONFLICT (caller_id, device_call_id)
    DO UPDATE SET
      org_id         = COALESCE(EXCLUDED.org_id,         call_logs.org_id),
      contact_number = EXCLUDED.contact_number,
      contact_name   = COALESCE(EXCLUDED.contact_name,   call_logs.contact_name),
      call_type      = lower(EXCLUDED.call_type),
      duration_sec   = EXCLUDED.duration_sec,
      called_at      = EXCLUDED.called_at,
      sim_id         = COALESCE(EXCLUDED.sim_id,         call_logs.sim_id);

    IF NOT FOUND THEN
      updated_count := updated_count + 1;
    ELSE
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted',  inserted_count,
    'updated',   updated_count,
    'processed', jsonb_array_length(logs)
  );
END;
$$;

-- ── get_dashboard_stats ───────────────────────────────────────────────────────
-- Legacy v1 — kept for backwards compatibility with older app builds.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_caller_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start     timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_yesterday_start timestamptz := v_today_start - interval '1 day';
  v_stats           jsonb;
BEGIN
  WITH today_stats AS (
    SELECT
      count(*)                                                    AS total_calls,
      coalesce(sum(duration_sec), 0)                             AS total_duration,
      count(DISTINCT contact_number)                             AS unique_contacts,
      count(*) FILTER (WHERE call_type = 'incoming')             AS incoming,
      count(*) FILTER (WHERE call_type = 'outgoing')             AS outgoing,
      count(*) FILTER (WHERE call_type IN ('missed','rejected')) AS missed
    FROM public.call_logs
    WHERE caller_id = p_caller_id
      AND called_at >= v_today_start
  ),
  yesterday_stats AS (
    SELECT count(*) AS total_calls
    FROM public.call_logs
    WHERE caller_id = p_caller_id
      AND called_at >= v_yesterday_start
      AND called_at <  v_today_start
  )
  SELECT jsonb_build_object(
    'today',           (SELECT row_to_json(today_stats) FROM today_stats),
    'yesterday_total', (SELECT total_calls FROM yesterday_stats)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- ── get_dashboard_stats_v2 ────────────────────────────────────────────────────
-- Current version used by the mobile app.
-- Adds: daily_target (from org), streak (consecutive days hitting target),
--       rejected and spam breakdowns.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(p_caller_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start     timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_yesterday_start timestamptz := v_today_start - interval '1 day';
  v_target          integer;
  v_streak          integer := 0;
  v_check_day       date;
  v_day_count       integer;
  v_stats           jsonb;
BEGIN
  SELECT COALESCE(o.daily_call_target, 50)
    INTO v_target
    FROM public.callers c
    JOIN public.organisations o ON o.id = c.org_id
   WHERE c.id = p_caller_id;

  IF v_target IS NULL THEN v_target := 50; END IF;

  -- Walk backwards from yesterday counting consecutive days >= target
  v_check_day := (v_today_start AT TIME ZONE 'UTC')::date - 1;
  LOOP
    SELECT COUNT(*) INTO v_day_count
      FROM public.call_logs
     WHERE caller_id = p_caller_id
       AND called_at >= (v_check_day::timestamptz AT TIME ZONE 'UTC')
       AND called_at <  ((v_check_day + 1)::timestamptz AT TIME ZONE 'UTC');

    EXIT WHEN v_day_count < v_target;
    v_streak    := v_streak + 1;
    v_check_day := v_check_day - 1;
    EXIT WHEN v_streak >= 365;
  END LOOP;

  WITH today_stats AS (
    SELECT
      count(*)                                                    AS total_calls,
      coalesce(sum(duration_sec), 0)                             AS total_duration,
      count(DISTINCT contact_number)                             AS unique_contacts,
      count(*) FILTER (WHERE call_type = 'incoming')             AS incoming,
      count(*) FILTER (WHERE call_type = 'outgoing')             AS outgoing,
      count(*) FILTER (WHERE call_type IN ('missed','rejected')) AS missed,
      count(*) FILTER (WHERE call_type = 'rejected')             AS rejected,
      count(*) FILTER (WHERE call_type = 'spam')                 AS spam
    FROM public.call_logs
    WHERE caller_id = p_caller_id
      AND called_at >= v_today_start
  ),
  yesterday_stats AS (
    SELECT count(*) AS total_calls
    FROM public.call_logs
    WHERE caller_id = p_caller_id
      AND called_at >= v_yesterday_start
      AND called_at <  v_today_start
  )
  SELECT jsonb_build_object(
    'today',           (SELECT row_to_json(today_stats) FROM today_stats),
    'yesterday_total', (SELECT total_calls FROM yesterday_stats),
    'daily_target',    v_target,
    'streak',          v_streak
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- ── get_call_trends ───────────────────────────────────────────────────────────
-- Returns daily incoming/outgoing/missed counts for the last N days.
-- Used by Dashboard (bar chart) and Reports (line chart).
CREATE OR REPLACE FUNCTION public.get_call_trends(
  p_caller_id uuid,
  p_days      integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(d)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        to_char(date_trunc('day', called_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        count(*) FILTER (WHERE call_type = 'incoming')             AS incoming,
        count(*) FILTER (WHERE call_type = 'outgoing')             AS outgoing,
        count(*) FILTER (WHERE call_type IN ('missed','rejected')) AS missed
      FROM public.call_logs
      WHERE caller_id = p_caller_id
        AND called_at >= (
          date_trunc('day', now() AT TIME ZONE 'UTC')
          - ((p_days - 1) || ' days')::interval
        )
      GROUP BY 1
      ORDER BY 1 ASC
    ) d
  );
END;
$$;

-- ── get_contact_interactions ──────────────────────────────────────────────────
-- Returns top N contacts by call count for a given caller.
-- Used by Reports (top contacts section).
CREATE OR REPLACE FUNCTION public.get_contact_interactions(
  p_caller_id uuid,
  p_limit     integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(c), '[]'::jsonb)
    FROM (
      SELECT
        contact_number,
        contact_name,
        count(*)                                                   AS total_calls,
        coalesce(sum(duration_sec), 0)                            AS total_duration,
        max(called_at)                                            AS last_call,
        count(*) FILTER (WHERE call_type = 'incoming')            AS incoming_calls,
        count(*) FILTER (WHERE call_type = 'outgoing')            AS outgoing_calls,
        count(*) FILTER (WHERE call_type IN ('missed','rejected')) AS missed_calls
      FROM public.call_logs
      WHERE caller_id = p_caller_id
      GROUP BY 1, 2
      ORDER BY 3 DESC
      LIMIT p_limit
    ) c
  );
END;
$$;

-- ── get_agent_daily_trend ─────────────────────────────────────────────────────
-- Returns a simple daily call count for a single agent.
-- Used by the web portal agent detail page.
CREATE OR REPLACE FUNCTION public.get_agent_daily_trend(
  p_caller_id uuid,
  p_days      integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(row_to_json(d)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        to_char(date_trunc('day', called_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        count(*) AS calls
      FROM public.call_logs
      WHERE caller_id = p_caller_id
        AND called_at >= (
          date_trunc('day', now() AT TIME ZONE 'UTC')
          - ((p_days - 1) || ' days')::interval
        )
      GROUP BY 1
      ORDER BY 1 ASC
    ) d
  );
END;
$$;

-- ── get_all_agents_summary ────────────────────────────────────────────────────
-- Returns a summary row per agent for the org dashboard in the web portal.
CREATE OR REPLACE FUNCTION public.get_all_agents_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT coalesce(
      jsonb_agg(row_to_json(a)::jsonb ORDER BY (row_to_json(a)->>'total_calls')::int DESC),
      '[]'::jsonb
    )
    FROM (
      SELECT
        c.id                                                               AS caller_id,
        c.name,
        c.employee_id,
        count(cl.id)                                                       AS total_calls,
        count(cl.id) FILTER (WHERE cl.call_type = 'incoming')             AS incoming,
        count(cl.id) FILTER (WHERE cl.call_type = 'outgoing')             AS outgoing,
        count(cl.id) FILTER (WHERE cl.call_type IN ('missed','rejected'))  AS missed,
        coalesce(sum(cl.duration_sec), 0)                                  AS total_duration_sec,
        count(DISTINCT cl.contact_number)                                  AS unique_contacts,
        max(cl.called_at)                                                  AS last_call_at,
        count(cl.id) FILTER (
          WHERE cl.called_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
        )                                                                  AS today_calls
      FROM public.callers c
      LEFT JOIN public.call_logs cl
        ON cl.caller_id = c.id
        AND cl.called_at >= (
          date_trunc('day', now() AT TIME ZONE 'UTC')
          - ((p_days - 1) || ' days')::interval
        )
      GROUP BY c.id, c.name, c.employee_id
    ) a
  );
END;
$$;

-- ── get_dashboard_metrics ─────────────────────────────────────────────────────
-- Org-level aggregate metrics for the web portal dashboard.
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalCalls',       count(*),
    'connectedCalls',   count(*) FILTER (WHERE duration_sec > 0),
    'totalDuration',    coalesce(sum(duration_sec), 0),
    'avgDuration',      coalesce(avg(duration_sec) FILTER (WHERE duration_sec > 0), 0),
    'uniqueClients',    count(DISTINCT contact_number),
    'activeEmployees',  count(DISTINCT caller_id),
    'connectionRate',   CASE
                          WHEN count(*) > 0 THEN
                            (count(*) FILTER (WHERE duration_sec > 0))::numeric
                            / count(*)::numeric * 100
                          ELSE 0
                        END,
    'callTypes', jsonb_build_object(
      'incoming', count(*) FILTER (WHERE call_type = 'incoming'),
      'outgoing', count(*) FILTER (WHERE call_type = 'outgoing'),
      'missed',   count(*) FILTER (WHERE call_type = 'missed'),
      'rejected', count(*) FILTER (WHERE call_type = 'rejected')
    )
  ) INTO result
  FROM public.call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end;

  RETURN coalesce(result, '{}'::jsonb);
END;
$$;

-- ── get_call_type_distribution ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_call_type_distribution(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'incoming',  coalesce(sum(CASE WHEN call_type = 'incoming'  THEN 1 ELSE 0 END), 0),
    'outgoing',  coalesce(sum(CASE WHEN call_type = 'outgoing'  THEN 1 ELSE 0 END), 0),
    'missed',    coalesce(sum(CASE WHEN call_type = 'missed'    THEN 1 ELSE 0 END), 0),
    'rejected',  coalesce(sum(CASE WHEN call_type = 'rejected'  THEN 1 ELSE 0 END), 0),
    'spam',      coalesce(sum(CASE WHEN call_type = 'spam'      THEN 1 ELSE 0 END), 0)
  ) INTO result
  FROM public.call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end;

  RETURN coalesce(result, '{}'::jsonb);
END;
$$;

-- ── get_daily_metrics ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_metrics(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS TABLE (
  call_date       date,
  total_calls     bigint,
  incoming_calls  bigint,
  outgoing_calls  bigint,
  missed_calls    bigint,
  connected_calls bigint,
  total_duration  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    called_at::date                                          AS call_date,
    count(*)                                                 AS total_calls,
    count(*) FILTER (WHERE call_type = 'incoming')           AS incoming_calls,
    count(*) FILTER (WHERE call_type = 'outgoing')           AS outgoing_calls,
    count(*) FILTER (WHERE call_type = 'missed')             AS missed_calls,
    count(*) FILTER (WHERE duration_sec > 0)                 AS connected_calls,
    coalesce(sum(duration_sec), 0)                           AS total_duration
  FROM public.call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end
  GROUP BY called_at::date
  ORDER BY call_date;
END;
$$;

-- ── get_hourly_metrics ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hourly_metrics(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS TABLE (
  hour         text,
  calls        bigint,
  avg_duration numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lpad(extract(hour FROM called_at)::text, 2, '0') || ':00' AS hour,
    count(*)                                                    AS calls,
    coalesce(avg(duration_sec) FILTER (WHERE duration_sec > 0), 0) AS avg_duration
  FROM public.call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end
  GROUP BY extract(hour FROM called_at)
  ORDER BY extract(hour FROM called_at);
END;
$$;

-- ── get_employee_report ───────────────────────────────────────────────────────
-- Full per-agent breakdown for the web portal reports page.
CREATE OR REPLACE FUNCTION public.get_employee_report(
  p_org_id uuid,
  p_start  timestamptz,
  p_end    timestamptz
)
RETURNS TABLE (
  caller_id             text,
  name                  text,
  employee_id           text,
  total_calls           bigint,
  incoming              bigint,
  outgoing              bigint,
  missed                bigint,
  rejected              bigint,
  connected_calls       bigint,
  total_duration_sec    bigint,
  avg_duration_sec      numeric,
  unique_clients        bigint,
  working_hours_sec     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id::text,
    c.name,
    c.employee_id,
    coalesce(s.total_calls,        0),
    coalesce(s.incoming,           0),
    coalesce(s.outgoing,           0),
    coalesce(s.missed,             0),
    coalesce(s.rejected,           0),
    coalesce(s.connected_calls,    0),
    coalesce(s.total_duration_sec, 0),
    coalesce(s.avg_duration_sec,   0),
    coalesce(s.unique_clients,     0),
    CASE WHEN coalesce(s.total_calls, 0) > 0 THEN 28800::bigint ELSE 0::bigint END
  FROM public.callers c
  LEFT JOIN (
    SELECT
      cl.caller_id,
      count(*)                                                    AS total_calls,
      count(*) FILTER (WHERE cl.call_type = 'incoming')           AS incoming,
      count(*) FILTER (WHERE cl.call_type = 'outgoing')           AS outgoing,
      count(*) FILTER (WHERE cl.call_type = 'missed')             AS missed,
      count(*) FILTER (WHERE cl.call_type = 'rejected')           AS rejected,
      count(*) FILTER (WHERE cl.duration_sec > 0)                 AS connected_calls,
      coalesce(sum(cl.duration_sec), 0)                           AS total_duration_sec,
      coalesce(avg(cl.duration_sec) FILTER (WHERE cl.duration_sec > 0), 0) AS avg_duration_sec,
      count(DISTINCT cl.contact_number)                           AS unique_clients
    FROM public.call_logs cl
    WHERE cl.org_id = p_org_id
      AND cl.called_at >= p_start
      AND cl.called_at <= p_end
    GROUP BY cl.caller_id
  ) s ON c.id = s.caller_id
  WHERE c.org_id = p_org_id
  ORDER BY c.name;
END;
$$;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- Notes for deployment:
--   1. Run this file in the Supabase SQL editor on a fresh project.
--   2. The partial index idx_call_logs_recent uses a hardcoded date offset
--      (now() - 30 days at creation time). It will still work correctly but
--      you can DROP and re-CREATE it periodically to keep it tight.
--   3. Enable "Confirm email" in Auth settings if required for the web portal.
--   4. Set SUPABASE_URL and SUPABASE_ANON_KEY in the mobile app .env.
-- =============================================================================
