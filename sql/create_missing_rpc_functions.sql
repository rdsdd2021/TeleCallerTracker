-- Missing RPC Functions for TeleCallerTracker
-- Run these in your Supabase SQL Editor to sync all RPC functions

-- 1. get_call_type_distribution
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

-- 2. get_daily_metrics
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

-- 3. get_hourly_metrics
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

-- 4. get_dashboard_metrics
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

-- 5. get_call_trends (for mobile app)
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

-- 6. get_contact_interactions (for mobile app)
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

-- 7. create_org_with_owner (for signup)
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_call_type_distribution(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_call_trends(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_interactions(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION create_org_with_owner(text, text) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_call_type_distribution(uuid, timestamptz, timestamptz) IS 'Returns call type distribution for an organization within a date range';
COMMENT ON FUNCTION get_daily_metrics(uuid, timestamptz, timestamptz) IS 'Returns daily call metrics for an organization within a date range';
COMMENT ON FUNCTION get_hourly_metrics(uuid, timestamptz, timestamptz) IS 'Returns hourly call metrics for an organization within a date range';
COMMENT ON FUNCTION get_dashboard_metrics(uuid, timestamptz, timestamptz) IS 'Returns comprehensive dashboard metrics for an organization within a date range';
COMMENT ON FUNCTION get_call_trends(text, integer) IS 'Returns call trends for a specific caller over the last N days';
COMMENT ON FUNCTION get_contact_interactions(text, integer) IS 'Returns recent contact interactions for a specific caller';
COMMENT ON FUNCTION create_org_with_owner(text, text) IS 'Creates a new organization with the current user as owner';