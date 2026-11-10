-- Optimize call_logs table for sync operations and prevent overlaps

-- Create unique index on device_call_id + caller_id to prevent duplicates
-- This is the primary mechanism for preventing data overlap
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_device_caller_unique 
ON call_logs (device_call_id, caller_id);

-- Optimize for time-range queries (most common sync operation)
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_time 
ON call_logs (caller_id, called_at DESC);

-- Optimize for org-scoped queries with time filtering
CREATE INDEX IF NOT EXISTS idx_call_logs_org_time 
ON call_logs (org_id, called_at DESC);

-- Optimize for sync operations that filter by caller and time range
CREATE INDEX IF NOT EXISTS idx_call_logs_sync_window 
ON call_logs (caller_id, called_at DESC, created_at);

-- Add partial index for recent data (last 30 days) for faster sync queries
CREATE INDEX IF NOT EXISTS idx_call_logs_recent 
ON call_logs (caller_id, called_at DESC) 
WHERE called_at >= (now() - interval '30 days');

-- Ensure proper constraints exist
ALTER TABLE call_logs 
ADD CONSTRAINT IF NOT EXISTS chk_call_logs_device_id_not_empty 
CHECK (device_call_id IS NOT NULL AND device_call_id != '');

ALTER TABLE call_logs 
ADD CONSTRAINT IF NOT EXISTS chk_call_logs_called_at_reasonable 
CHECK (called_at >= '2020-01-01'::timestamptz AND called_at <= now() + interval '1 day');

-- Add comment for documentation
COMMENT ON INDEX idx_call_logs_device_caller_unique IS 
'Prevents duplicate call logs by enforcing uniqueness on device_call_id + caller_id combination';

COMMENT ON INDEX idx_call_logs_recent IS 
'Optimizes sync queries for recent data (last 30 days) to improve performance';