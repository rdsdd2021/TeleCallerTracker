# TeleCallerTracker Sync Improvements

## Overview

This document outlines the improvements made to the data synchronization system to ensure proper 7-day sync windows and prevent data overlap.

## Key Improvements

### 1. 7-Day Sync Window Enforcement

**Problem**: The previous implementation only used a 7-day lookback on first sync, but subsequent syncs could miss data if there were gaps.

**Solution**: 
- Always sync from at least 7 days ago, regardless of last sync time
- Use `Math.max(sevenDaysAgo, lastSyncMs)` to ensure comprehensive coverage
- Log whether 7-day window or incremental sync is being used

**Code Changes**:
```typescript
// Calculate sync window: always sync last 7 days to ensure no gaps
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const syncFromMs = Math.max(sevenDaysAgo, lastSyncMs);
```

### 2. Enhanced Overlap Prevention

**Problem**: Potential for duplicate data if sync processes overlap or device IDs collide.

**Solution**:
- Client-side deduplication in `getCallLogsSince()` using `Set<string>`
- Server-side upsert function with `ON CONFLICT` handling
- Unique constraint on `(device_call_id, caller_id)` combination
- Proper timestamp-based filtering with sorted processing

**Code Changes**:
```typescript
const seenDeviceIds = new Set<string>();
// ... check for duplicates before processing
if (seenDeviceIds.has(String(deviceId))) {
  console.log(`Skipping duplicate device_call_id: ${deviceId}`);
  continue;
}
```

### 3. Robust Database Function

**New File**: `sql/upsert_call_logs.sql`

**Features**:
- Proper conflict resolution using `ON CONFLICT (device_call_id, caller_id)`
- Only updates when data actually changes (prevents unnecessary writes)
- Returns detailed statistics (inserted vs updated counts)
- Proper error handling and org_id validation
- Security with `SECURITY DEFINER` and proper permissions

### 4. Database Optimizations

**New File**: `sql/optimize_call_logs_indexes.sql`

**Features**:
- Unique index on `(device_call_id, caller_id)` prevents duplicates
- Optimized indexes for time-range queries
- Partial index for recent data (last 30 days)
- Proper constraints for data validation

### 5. Sync Validation System

**New File**: `src/services/syncValidation.ts`

**Features**:
- Detects duplicate device_call_ids
- Identifies time gaps > 24 hours
- Validates sync timestamps
- Provides comprehensive statistics
- Runs periodic integrity checks (every 10th sync)

### 6. Enhanced Logging and Monitoring

**Improvements**:
- Detailed batch processing logs
- Sync window information
- Insert vs update statistics
- Date range validation
- Performance metrics in sync_logs table

## Database Schema Updates

### Required Migrations

1. **Run the upsert function**:
```sql
-- Execute sql/upsert_call_logs.sql
```

2. **Apply index optimizations**:
```sql
-- Execute sql/optimize_call_logs_indexes.sql
```

3. **Update sync_logs table** (if needed):
```sql
ALTER TABLE sync_logs 
ADD COLUMN IF NOT EXISTS records_updated integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_window_start timestamptz,
ADD COLUMN IF NOT EXISTS sync_window_end timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb;
```

## Configuration

### Storage Keys

New storage keys added:
- `sync_count`: Tracks number of syncs for periodic validation
- `known_sim_ids`: Tracks SIM IDs for multi-SIM support

### Background Sync

No changes to background sync configuration - continues to run every 15 minutes minimum.

## Testing Recommendations

### 1. Sync Window Testing

```typescript
// Test 7-day window enforcement
await Storage.remove(STORAGE_KEYS.LAST_SYNCED_AT); // First sync
await runSync(); // Should sync 7 days

// Test incremental sync
await runSync(); // Should sync from last sync time

// Test gap handling
await Storage.set(STORAGE_KEYS.LAST_SYNCED_AT, (Date.now() - 10 * 24 * 60 * 60 * 1000).toString());
await runSync(); // Should still sync 7 days
```

### 2. Overlap Prevention Testing

```typescript
// Test duplicate handling
const duplicateLogs = [
  { device_call_id: 'test123', /* ... */ },
  { device_call_id: 'test123', /* ... */ }, // Same ID
];
// Should only insert once
```

### 3. Validation Testing

```typescript
import { performSyncIntegrityCheck } from './src/services/syncValidation';
await performSyncIntegrityCheck();
// Check console for validation results
```

## Performance Considerations

### Optimizations Made

1. **Batch Processing**: Continues to use 500-record batches
2. **Indexed Queries**: New indexes optimize common query patterns
3. **Partial Indexes**: Recent data index improves sync performance
4. **Efficient Deduplication**: Client-side Set operations are O(1)
5. **Conditional Updates**: Server only updates when data changes

### Memory Usage

- Client-side deduplication uses minimal memory (Set of strings)
- Batch processing prevents large memory allocations
- Sorted processing ensures consistent order

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Sync Success Rate**: Check `sync_status` in storage
2. **Duplicate Detection**: Monitor validation check results
3. **Time Gaps**: Watch for gaps > 24 hours in validation
4. **Batch Processing**: Monitor `batches_processed` in sync_logs
5. **Insert/Update Ratio**: Track efficiency via sync_logs

### Recommended Alerts

- Sync failures > 3 consecutive attempts
- Duplicate device_call_ids detected
- Time gaps > 48 hours detected
- Sync duration > 5 minutes

## Rollback Plan

If issues occur, rollback steps:

1. **Revert sync service changes**:
```bash
git checkout HEAD~1 -- src/services/syncService.ts
git checkout HEAD~1 -- src/services/callLogService.ts
```

2. **Remove new files**:
```bash
rm src/services/syncValidation.ts
rm sql/upsert_call_logs.sql
rm sql/optimize_call_logs_indexes.sql
```

3. **Database rollback** (if needed):
```sql
DROP FUNCTION IF EXISTS upsert_call_logs(jsonb, text);
-- Remove indexes if they cause issues
```

## Future Enhancements

### Potential Improvements

1. **Incremental Sync Optimization**: Only sync truly new data after initial 7-day window
2. **Conflict Resolution**: Handle cases where same call appears with different data
3. **Sync Scheduling**: Smart scheduling based on usage patterns
4. **Data Compression**: Compress sync payloads for large batches
5. **Real-time Sync**: WebSocket-based real-time updates for critical data

### Monitoring Dashboard

Consider adding sync health dashboard showing:
- Last sync times per device
- Sync success rates
- Data volume trends
- Duplicate detection rates
- Performance metrics