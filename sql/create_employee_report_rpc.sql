-- Main Employee Report RPC Function
-- This is the core function that provides comprehensive employee call statistics

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
    -- Calculate working hours based on call activity (8 hours default, can be enhanced)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_employee_report(uuid, timestamptz, timestamptz) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_employee_report(uuid, timestamptz, timestamptz) IS 
'Returns comprehensive employee call statistics including call counts by type, durations, and unique client counts for an organization within a date range';