-- COMPLETE RPC FUNCTION SYNC FOR SUPABASE
-- Run this entire script in your Supabase SQL Editor to sync all RPC functions

-- ============================================================================
-- 1. MAIN EMPLOYEE REPORT FUNCTION (Most Important)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_employee_report(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  caller_id text,
  name text,
  employee_id text,
  total_calls bigint,
  incoming bigint,
  outgoing bigint,
  missed bigint,
  rejected bigint,
  never_attended bigint,
  not_pickup_by_client bigint,
  connected_calls bigint,
  total_duration_sec bigint,
  avg_duration_sec numeric,
  unique_clients bigint,
  working_hours_sec bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as caller_id,
    c.name,
    c.employee_id,
    COALESCE(stats.total_calls, 0) as total_calls,
    COALESCE(stats.incoming, 0) as incoming,
    COALESCE(stats.outgoing, 0) as outgoing,
    COALESCE(stats.missed, 0) as missed,
    COALESCE(stats.rejected, 0) as rejected,
    COALESCE(stats.never_attended, 0) as never_attended,
    COALESCE(stats.not_pickup_by_client, 0) as not_pickup_by_client,
    COALESCE(stats.connected_calls, 0) as connected_calls,
    COALESCE(stats.total_duration_sec, 0) as total_duration_sec,
    COALESCE(stats.avg_duration_sec, 0) as avg_duration_sec,
    COALESCE(stats.unique_clients, 0) as unique_clients,
    CASE 
      WHEN stats.total_calls > 0 THEN 28800 -- 8 hours in seconds
      ELSE 0 
    END as working_hours_sec
  FROM callers c
  LEFT JOIN (
    SELECT 
      cl.caller_id,
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE cl.call_type = 'incoming') as incoming,
      COUNT(*) FILTER (WHERE cl.call_type = 'outgoing') as outgoing,
      COUNT(*) FILTER (WHERE cl.call_type = 'missed') as missed,
      COUNT(*) FILTER (WHERE cl.call_type = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE cl.call_type = 'never_attended') as never_attended,
      COUNT(*) FILTER (WHERE cl.call_type = 'not_pickup_by_client') as not_pickup_by_client,
      COUNT(*) FILTER (WHERE cl.duration_sec > 0) as connected_calls,
      COALESCE(SUM(cl.duration_sec), 0) as total_duration_sec,
      COALESCE(AVG(cl.duration_sec) FILTER (WHERE cl.duration_sec > 0), 0) as avg_duration_sec,
      COUNT(DISTINCT cl.contact_number) as unique_clients
    FROM call_logs cl
    WHERE cl.org_id = p_org_id
      AND cl.called_at >= p_start
      AND cl.called_at <= p_end
    GROUP BY cl.caller_id
  ) stats ON c.id = stats.caller_id
  WHERE c.org_id = p_org_id
  ORDER BY c.name;
END;
$$;

-- ============================================================================
-- 2. CALL TYPE DISTRIBUTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_call_type_distribution(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'incoming', COALESCE(SUM(CASE WHEN call_type = 'incoming' THEN 1 ELSE 0 END), 0),
    'outgoing', COALESCE(SUM(CASE WHEN call_type = 'outgoing' THEN 1 ELSE 0 END), 0),
    'missed', COALESCE(SUM(CASE WHEN call_type = 'missed' THEN 1 ELSE 0 END), 0),
    'rejected', COALESCE(SUM(CASE WHEN call_type = 'rejected' THEN 1 ELSE 0 END), 0),
    'never_attended', COALESCE(SUM(CASE WHEN call_type = 'never_attended' THEN 1 ELSE 0 END), 0),
    'not_pickup_by_client', COALESCE(SUM(CASE WHEN call_type = 'not_pickup_by_client' THEN 1 ELSE 0 END), 0)
  ) INTO result
  FROM call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- 3. DAILY METRICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_metrics(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  call_date date,
  total_calls bigint,
  incoming_calls bigint,
  outgoing_calls bigint,
  missed_calls bigint,
  connected_calls bigint,
  total_duration bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    called_at::date as call_date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE call_type = 'incoming') as incoming_calls,
    COUNT(*) FILTER (WHERE call_type = 'outgoing') as outgoing_calls,
    COUNT(*) FILTER (WHERE call_type = 'missed') as missed_calls,
    COUNT(*) FILTER (WHERE duration_sec > 0) as connected_calls,
    COALESCE(SUM(duration_sec), 0) as total_duration
  FROM call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end
  GROUP BY called_at::date
  ORDER BY call_date;
END;
$$;

-- ============================================================================
-- 4. HOURLY METRICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_hourly_metrics(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  hour text,
  calls bigint,
  avg_duration numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    LPAD(EXTRACT(hour FROM called_at)::text, 2, '0') || ':00' as hour,
    COUNT(*) as calls,
    COALESCE(AVG(duration_sec) FILTER (WHERE duration_sec > 0), 0) as avg_duration
  FROM call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end
  GROUP BY EXTRACT(hour FROM called_at)
  ORDER BY EXTRACT(hour FROM called_at);
END;
$$;

-- ============================================================================
-- 5. DASHBOARD METRICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalCalls', COUNT(*),
    'connectedCalls', COUNT(*) FILTER (WHERE duration_sec > 0),
    'totalDuration', COALESCE(SUM(duration_sec), 0),
    'avgDuration', COALESCE(AVG(duration_sec) FILTER (WHERE duration_sec > 0), 0),
    'uniqueClients', COUNT(DISTINCT contact_number),
    'activeEmployees', COUNT(DISTINCT caller_id),
    'connectionRate', CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE duration_sec > 0)::numeric / COUNT(*)::numeric * 100)
      ELSE 0 
    END,
    'callTypes', jsonb_build_object(
      'incoming', COUNT(*) FILTER (WHERE call_type = 'incoming'),
      'outgoing', COUNT(*) FILTER (WHERE call_type = 'outgoing'),
      'missed', COUNT(*) FILTER (WHERE call_type = 'missed'),
      'rejected', COUNT(*) FILTER (WHERE call_type = 'rejected')
    )
  ) INTO result
  FROM call_logs
  WHERE org_id = p_org_id
    AND called_at >= p_start
    AND called_at <= p_end;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- 6. MOBILE APP FUNCTIONS
-- ============================================================================

-- Dashboard stats for individual caller
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_caller_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalCalls', COUNT(*),
    'connectedCalls', COUNT(*) FILTER (WHERE duration_sec > 0),
    'totalDuration', COALESCE(SUM(duration_sec), 0),
    'avgDuration', COALESCE(AVG(duration_sec) FILTER (WHERE duration_sec > 0), 0),
    'uniqueClients', COUNT(DISTINCT contact_number),
    'todayCalls', COUNT(*) FILTER (WHERE called_at::date = CURRENT_DATE),
    'connectionRate', CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE duration_sec > 0)::numeric / COUNT(*)::numeric * 100)
      ELSE 0 
    END
  ) INTO result
  FROM call_logs
  WHERE caller_id = p_caller_id
    AND called_at >= CURRENT_DATE - INTERVAL '30 days';
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Call trends for individual caller
CREATE OR REPLACE FUNCTION get_call_trends(
  p_caller_id text,
  p_days integer DEFAULT 7
)
RETURNS TABLE(
  date date,
  total_calls bigint,
  connected_calls bigint,
  total_duration bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    called_at::date as date,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE duration_sec > 0) as connected_calls,
    COALESCE(SUM(duration_sec), 0) as total_duration
  FROM call_logs
  WHERE caller_id = p_caller_id
    AND called_at >= (CURRENT_DATE - INTERVAL '1 day' * p_days)
  GROUP BY called_at::date
  ORDER BY date DESC;
END;
$$;

-- Contact interactions for individual caller
CREATE OR REPLACE FUNCTION get_contact_interactions(
  p_caller_id text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'contactNumber', contact_number,
      'contactName', COALESCE(contact_name, contact_number),
      'lastCallDate', called_at,
      'totalCalls', total_calls,
      'totalDuration', total_duration,
      'callType', call_type
    )
  ) INTO result
  FROM (
    SELECT 
      contact_number,
      contact_name,
      MAX(called_at) as called_at,
      COUNT(*) as total_calls,
      SUM(duration_sec) as total_duration,
      (array_agg(call_type ORDER BY called_at DESC))[1] as call_type
    FROM call_logs
    WHERE caller_id = p_caller_id
    GROUP BY contact_number, contact_name
    ORDER BY MAX(called_at) DESC
    LIMIT p_limit
  ) interactions;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 7. ORGANIZATION MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION create_org_with_owner(
  p_name text,
  p_invite_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  user_id uuid;
  result jsonb;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO user_id;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Create organization
  INSERT INTO orgs (name, invite_code, created_by)
  VALUES (p_name, p_invite_code, user_id)
  RETURNING id INTO new_org_id;
  
  -- Create owner membership
  INSERT INTO org_memberships (org_id, user_id, role)
  VALUES (new_org_id, user_id, 'owner');
  
  -- Return result
  SELECT jsonb_build_object(
    'orgId', new_org_id,
    'name', p_name,
    'role', 'owner'
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================================================
-- 8. GRANT PERMISSIONS TO ALL FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_employee_report(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_call_type_distribution(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_call_trends(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_interactions(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_with_owner(text, text) TO authenticated;

-- ============================================================================
-- 9. ADD DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_employee_report(uuid, timestamptz, timestamptz) IS 'Returns comprehensive employee call statistics including call counts by type, durations, and unique client counts';
COMMENT ON FUNCTION get_call_type_distribution(uuid, timestamptz, timestamptz) IS 'Returns call type distribution for an organization within a date range';
COMMENT ON FUNCTION get_daily_metrics(uuid, timestamptz, timestamptz) IS 'Returns daily call metrics for an organization within a date range';
COMMENT ON FUNCTION get_hourly_metrics(uuid, timestamptz, timestamptz) IS 'Returns hourly call metrics for an organization within a date range';
COMMENT ON FUNCTION get_dashboard_metrics(uuid, timestamptz, timestamptz) IS 'Returns comprehensive dashboard metrics for an organization within a date range';
COMMENT ON FUNCTION get_dashboard_stats(text) IS 'Returns dashboard statistics for a specific caller';
COMMENT ON FUNCTION get_call_trends(text, integer) IS 'Returns call trends for a specific caller over the last N days';
COMMENT ON FUNCTION get_contact_interactions(text, integer) IS 'Returns recent contact interactions for a specific caller';
COMMENT ON FUNCTION create_org_with_owner(text, text) IS 'Creates a new organization with the current user as owner';

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

-- After running this script, regenerate your Supabase types by running:
-- npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts