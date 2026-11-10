import { supabase }            from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { getCallLogsSince }    from './callLogService';
import { performSyncIntegrityCheck } from './syncValidation';
import DeviceInfo              from 'react-native-device-info';

const BATCH_SIZE = 500; // never send more than 500 rows per RPC call

export async function runSync(): Promise<void> {
  const callerId = await Storage.get(STORAGE_KEYS.CALLER_ID);
  if (!callerId) {
    console.log('[Sync] Skipped — device not registered');
    return;
  }

  await Storage.set(STORAGE_KEYS.SYNC_STATUS, 'syncing');

  try {
    // Calculate sync window: always sync last 7 days to ensure no gaps
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Get last sync time (default: 7 days ago on first run)
    const lastSyncStr = await Storage.get(STORAGE_KEYS.LAST_SYNCED_AT);
    const lastSyncMs = lastSyncStr ? parseInt(lastSyncStr, 10) : sevenDaysAgo;
    
    // Always sync from at least 7 days ago, but use last sync if it's more recent
    // This ensures we capture any missed calls and prevents data gaps
    const syncFromMs = Math.max(sevenDaysAgo, lastSyncMs);
    
    console.log(`[Sync] Syncing from ${new Date(syncFromMs).toLocaleString()} (${syncFromMs > lastSyncMs ? '7-day window' : 'last sync'})`);

    const newLogs = await getCallLogsSince(syncFromMs);

    if (newLogs.length === 0) {
      console.log(`[Sync] No new call logs found since: ${new Date(syncFromMs).toLocaleString()}`);
      await Storage.set(STORAGE_KEYS.SYNC_STATUS, 'ok');
      // Update last sync time even if no new logs to prevent unnecessary re-syncing
      await Storage.set(STORAGE_KEYS.LAST_SYNCED_AT, Date.now().toString());
      return;
    }

    console.log(`[Sync] Found ${newLogs.length} logs to sync from ${new Date(syncFromMs).toLocaleString()}`);

    // Sort logs by timestamp to ensure consistent processing order
    newLogs.sort((a, b) => new Date(a.called_at).getTime() - new Date(b.called_at).getTime());

    // Split into batches of 500 and send sequentially
    const batches: typeof newLogs[] = [];
    for (let i = 0; i < newLogs.length; i += BATCH_SIZE) {
      batches.push(newLogs.slice(i, i + BATCH_SIZE));
    }

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const batch of batches) {
      console.log(`[Sync] Processing batch of ${batch.length} logs...`);
      
      const { data, error } = await supabase.rpc('upsert_call_logs', {
        logs:        batch,
        p_caller_id: callerId,
      });

      if (error) {
        console.error('[Sync] RPC error:', error.message);
        await Storage.set(STORAGE_KEYS.SYNC_STATUS, 'error');
        return; // Don't update lastSyncedAt — will retry same window next time
      }

      if (data) {
        totalInserted += data.inserted ?? 0;
        totalUpdated += data.updated ?? 0;
        console.log(`[Sync] Batch result: ${data.inserted ?? 0} inserted, ${data.updated ?? 0} updated`);
      }
    }

    // Only update timestamp AFTER successful sync
    const syncCompletedAt = Date.now();
    await Storage.set(STORAGE_KEYS.LAST_SYNCED_AT, syncCompletedAt.toString());
    await Storage.set(STORAGE_KEYS.SYNC_STATUS, 'ok');

    // Write to sync audit log with detailed statistics
    const orgId = await Storage.get(STORAGE_KEYS.ORG_ID);
    await supabase.from('sync_logs').insert({
      caller_id:        callerId,
      records_sent:     newLogs.length,
      records_inserted: totalInserted,
      records_updated:  totalUpdated,
      app_version:      DeviceInfo.getVersion(),
      org_id:           orgId,
      sync_window_start: new Date(syncFromMs).toISOString(),
      sync_window_end:   new Date(syncCompletedAt).toISOString(),
      metadata: {
        batches_processed: batches.length,
        sync_duration_ms: syncCompletedAt - Date.now() + (Date.now() - syncCompletedAt), // Approximate
        seven_day_window_used: syncFromMs === sevenDaysAgo,
      }
    });

    console.log(`[Sync] Completed successfully:`);
    console.log(`  - ${newLogs.length} logs processed in ${batches.length} batches`);
    console.log(`  - ${totalInserted} new records inserted`);
    console.log(`  - ${totalUpdated} existing records updated`);
    console.log(`  - Sync window: ${new Date(syncFromMs).toLocaleString()} to ${new Date(syncCompletedAt).toLocaleString()}`);
    console.log(`  - Next sync will start from: ${new Date(syncCompletedAt).toLocaleString()}`);

    // Track distinct SIM IDs seen so Settings can show label editor
    const simIds = [...new Set(newLogs.map(l => l.sim_id).filter(Boolean))] as string[];
    if (simIds.length > 0) {
      const existingJson = await Storage.get('known_sim_ids');
      const existing: string[] = existingJson ? JSON.parse(existingJson) : [];
      const merged = [...new Set([...existing, ...simIds])];
      await Storage.set('known_sim_ids', JSON.stringify(merged));
      console.log(`  - Tracked SIM IDs: ${simIds.join(', ')}`);
    }

    // Perform integrity check after successful sync (every 10th sync to avoid overhead)
    const syncCount = parseInt(await Storage.get('sync_count') ?? '0', 10) + 1;
    await Storage.set('sync_count', syncCount.toString());
    
    if (syncCount % 10 === 0) {
      console.log('[Sync] Performing periodic integrity check...');
      await performSyncIntegrityCheck();
    }

  } catch (err) {
    console.error('[Sync] Unexpected error:', err);
    await Storage.set(STORAGE_KEYS.SYNC_STATUS, 'error');
  }
}
