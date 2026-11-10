-- Complete Database Setup for TeleCallerTracker
-- Run this script in your Supabase SQL Editor to set up all required functions and types

-- 1. Create call_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_type') THEN
        CREATE TYPE call_type AS ENUM (
            'incoming',
            'outgoing', 
            'missed',
            'rejected',
            'never_attended',
            'not_pickup_by_client'
        );
    END IF;
END $$;

-- 2. Ensure tables exist with proper structure
-- Note: Adjust these CREATE TABLE statements based on your actual schema

-- Organizations table
CREATE TABLE IF NOT EXISTS orgs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    invite_code text UNIQUE,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Organization memberships
CREATE TABLE IF NOT EXISTS org_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz DEFAULT now(),
    UNIQUE(org_id, user_id)
);

-- Callers (employees)
CREATE TABLE IF NOT EXISTS callers (
    id text PRIMARY KEY,
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    name text NOT NULL,
    employee_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(org_id, employee_id)
);

-- Call logs
CREATE TABLE IF NOT EXISTS call_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_call_id text NOT NULL,
    caller_id text REFERENCES callers(id) ON DELETE CASCADE,
    org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
    contact_number text NOT NULL,
    contact_name text,
    call_type call_type NOT NULL,
    duration_sec integer DEFAULT 0,
    called_at timestamptz NOT NULL,
    sim_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(device_call_id, caller_id)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_org_id_called_at ON call_logs(org_id, called_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id_called_at ON call_logs(caller_id, called_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_type ON call_logs(call_type);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact_number ON call_logs(contact_number);
CREATE INDEX IF NOT EXISTS idx_callers_org_id ON callers(org_id);

-- 4. Enable Row Level Security
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Organizations: Users can only see orgs they're members of
DROP POLICY IF EXISTS "Users can view their organizations" ON orgs;
CREATE POLICY "Users can view their organizations" ON orgs
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM org_memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Callers: Users can only see callers in their organizations
DROP POLICY IF EXISTS "Users can view callers in their organizations" ON callers;
CREATE POLICY "Users can view callers in their organizations" ON callers
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_memberships 
            WHERE user_id = auth.uid()
        )
    );

-- Call logs: Users can only see call logs in their organizations
DROP POLICY IF EXISTS "Users can view call logs in their organizations" ON call_logs;
CREATE POLICY "Users can view call logs in their organizations" ON call_logs
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_memberships 
            WHERE user_id = auth.uid()
        )
    );

-- 6. Create helper function to get user's org ID
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT om.org_id INTO org_id
    FROM org_memberships om
    WHERE om.user_id = auth.uid()
    LIMIT 1;
    
    RETURN org_id;
END;
$$;

-- 7. Create function to get user role in organization
CREATE OR REPLACE FUNCTION get_user_role(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    SELECT om.role INTO user_role
    FROM org_memberships om
    WHERE om.user_id = auth.uid()
      AND om.org_id = p_org_id;
    
    RETURN COALESCE(user_role, 'none');
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_user_org_id() IS 'Returns the organization ID for the current authenticated user';
COMMENT ON FUNCTION get_user_role(uuid) IS 'Returns the role of the current user in the specified organization';