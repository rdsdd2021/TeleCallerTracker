-- Function to upsert call logs with deduplication
-- This function prevents data overlap by using device_call_id as the unique key

CREATE OR REPLACE FUNCTION upsert_call_logs(
  logs jsonb,
  p_caller_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_record jsonb;
  inserted_count integer := 0;
  updated_count integer := 0;
  total_count integer := 0;
  caller_org_id uuid;
BEGIN
  -- Get the caller's org_id for data isolation
  SELECT org_id INTO caller_org_id 
  FROM callers 
  WHERE id = p_caller_id;
  
  IF caller_org_id IS NULL THEN
    RAISE EXCEPTION 'Caller not found or not associated with an organization';
  END IF;

  -- Count total logs being processed
  SELECT jsonb_array_length(logs) INTO total_count;

  -- Process each log entry
  FOR log_record IN SELECT * FROM jsonb_array_elements(logs)
  LOOP
    -- Insert or update call log with conflict resolution on device_call_id
    INSERT INTO call_logs (
      device_call_id,
      caller_id,
      org_id,
      contact_number,
      contact_name,
      call_type,
      duration_sec,
      called_at,
      sim_id,
      created_at,
      updated_at
    )
    VALUES (
      (log_record->>'device_call_id')::text,
      p_caller_id,
      caller_org_id,
      (log_record->>'contact_number')::text,
      NULLIF((log_record->>'contact_name')::text, ''),
      (log_record->>'call_type')::call_type,
      (log_record->>'duration_sec')::integer,
      (log_record->>'called_at')::timestamptz,
      NULLIF((log_record->>'sim_id')::text, ''),
      now(),
      now()
    )
    ON CONFLICT (device_call_id, caller_id) 
    DO UPDATE SET
      contact_number = EXCLUDED.contact_number,
      contact_name = EXCLUDED.contact_name,
      call_type = EXCLUDED.call_type,
      duration_sec = EXCLUDED.duration_sec,
      called_at = EXCLUDED.called_at,
      sim_id = EXCLUDED.sim_id,
      updated_at = now()
    WHERE 
      -- Only update if the new data is different (prevents unnecessary updates)
      (call_logs.contact_number, call_logs.contact_name, call_logs.call_type, 
       call_logs.duration_sec, call_logs.called_at, call_logs.sim_id) 
      IS DISTINCT FROM 
      (EXCLUDED.contact_number, EXCLUDED.contact_name, EXCLUDED.call_type,
       EXCLUDED.duration_sec, EXCLUDED.called_at, EXCLUDED.sim_id);

    -- Track if this was an insert or update
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    IF inserted_count > 0 THEN
      -- Check if it was actually an insert (new row) or update (existing row)
      IF EXISTS (
        SELECT 1 FROM call_logs 
        WHERE device_call_id = (log_record->>'device_call_id')::text 
        AND caller_id = p_caller_id
        AND created_at = updated_at
      ) THEN
        inserted_count := inserted_count + 1;
      ELSE
        updated_count := updated_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Return summary statistics
  RETURN jsonb_build_object(
    'total_processed', total_count,
    'inserted', inserted_count,
    'updated', updated_count,
    'org_id', caller_org_id,
    'caller_id', p_caller_id,
    'processed_at', now()
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_call_logs(jsonb, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION upsert_call_logs(jsonb, text) IS 
'Upserts call logs with deduplication based on device_call_id and caller_id. 
Prevents data overlap by using ON CONFLICT to handle duplicate entries.
Returns statistics about inserted/updated records.';