import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';

export interface SyncValidationResult {
  isValid: boolean;
  issues: string[];
  stats: {
    totalCallLogs: number;
    duplicateDeviceIds: number;
    logsLast7Days: number;
    oldestLog: string | null;
    newestLog: string | null;
    gapsDetected: string[];
  };
}

/**
 * Validates sync integrity by checking for duplicates, gaps, and data consistency
 */
export async function validateSyncIntegrity(): Promise<SyncValidationResult> {
  const callerId = await Storage.get(STORAGE_KEYS.CALLER_ID);
  if (!callerId) {
    return {
      isValid: false,
      issues: ['Device not registered'],
      stats: {
        totalCallLogs: 0,
        duplicateDeviceIds: 0,
        logsLast7Days: 0,
        oldestLog: null,
        newestLog: null,
        gapsDetected: [],
      },
    };
  }

  const issues: string[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Check for duplicate device_call_ids (should not exist with proper constraints)
    const { data: duplicates } = await supabase
      .from('call_logs')
      .select('device_call_id, count(*)')
      .eq('caller_id', callerId)
      .group('device_call_id')
      .having('count(*) > 1');

    const duplicateCount = duplicates?.length ?? 0;
    if (duplicateCount > 0) {
      issues.push(`Found ${duplicateCount} duplicate device_call_ids`);
    }

    // Get overall statistics
    const { data: stats } = await supabase
      .from('call_logs')
      .select('called_at')
      .eq('caller_id', callerId)
      .order('called_at', { ascending: true });

    const totalCallLogs = stats?.length ?? 0;
    const oldestLog = stats?.[0]?.called_at ?? null;
    const newestLog = stats?.[stats.length - 1]?.called_at ?? null;

    // Count logs in last 7 days
    const { count: recentCount } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('caller_id', callerId)
      .gte('called_at', sevenDaysAgo);

    const logsLast7Days = recentCount ?? 0;

    // Check for significant time gaps (more than 24 hours between consecutive logs)
    const gapsDetected: string[] = [];
    if (stats && stats.length > 1) {
      for (let i = 1; i < stats.length; i++) {
        const prevTime = new Date(stats[i - 1].called_at).getTime();
        const currTime = new Date(stats[i].called_at).getTime();
        const gapHours = (currTime - prevTime) / (1000 * 60 * 60);
        
        if (gapHours > 24) {
          gapsDetected.push(
            `${Math.round(gapHours)}h gap between ${new Date(prevTime).toLocaleString()} and ${new Date(currTime).toLocaleString()}`
          );
        }
      }
    }

    if (gapsDetected.length > 0) {
      issues.push(`Detected ${gapsDetected.length} time gaps > 24 hours`);
    }

    // Validate last sync timestamp
    const lastSyncStr = await Storage.get(STORAGE_KEYS.LAST_SYNCED_AT);
    if (lastSyncStr) {
      const lastSyncMs = parseInt(lastSyncStr, 10);
      const timeSinceLastSync = Date.now() - lastSyncMs;
      const hoursSinceSync = timeSinceLastSync / (1000 * 60 * 60);
      
      if (hoursSinceSync > 24) {
        issues.push(`Last sync was ${Math.round(hoursSinceSync)} hours ago`);
      }
    } else {
      issues.push('No sync timestamp found');
    }

    return {
      isValid: issues.length === 0,
      issues,
      stats: {
        totalCallLogs,
        duplicateDeviceIds: duplicateCount,
        logsLast7Days,
        oldestLog,
        newestLog,
        gapsDetected,
      },
    };

  } catch (error) {
    console.error('[SyncValidation] Error validating sync integrity:', error);
    return {
      isValid: false,
      issues: [`Validation failed: ${error}`],
      stats: {
        totalCallLogs: 0,
        duplicateDeviceIds: 0,
        logsLast7Days: 0,
        oldestLog: null,
        newestLog: null,
        gapsDetected: [],
      },
    };
  }
}

/**
 * Performs a sync integrity check and logs results
 */
export async function performSyncIntegrityCheck(): Promise<void> {
  console.log('[SyncValidation] Starting integrity check...');
  
  const result = await validateSyncIntegrity();
  
  console.log('[SyncValidation] Integrity check results:');
  console.log(`  - Valid: ${result.isValid}`);
  console.log(`  - Total call logs: ${result.stats.totalCallLogs}`);
  console.log(`  - Logs last 7 days: ${result.stats.logsLast7Days}`);
  console.log(`  - Date range: ${result.stats.oldestLog} to ${result.stats.newestLog}`);
  
  if (result.issues.length > 0) {
    console.warn('[SyncValidation] Issues found:');
    result.issues.forEach(issue => console.warn(`  - ${issue}`));
  }
  
  if (result.stats.gapsDetected.length > 0) {
    console.warn('[SyncValidation] Time gaps detected:');
    result.stats.gapsDetected.forEach(gap => console.warn(`  - ${gap}`));
  }
  
  if (result.isValid) {
    console.log('[SyncValidation] ✅ Sync integrity check passed');
  } else {
    console.warn('[SyncValidation] ⚠️ Sync integrity issues detected');
  }
}