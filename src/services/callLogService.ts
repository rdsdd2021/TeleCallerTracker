import CallLog from 'react-native-call-log';

export type CallLogEntry = {
  device_call_id: string;    // Android's own unique _id for this call entry
  contact_number: string;    // raw phone number
  contact_name:   string | null; // "Rahul Sharma" if saved, null if not
  call_type:      'incoming' | 'outgoing' | 'missed' | 'rejected' | 'spam';
  duration_sec:   number;    // 0 for missed/rejected
  called_at:      string;    // ISO 8601 UTC string
  sim_id:         string | null; // Identifier for the SIM card used
};

// Android call type integer → our string enum
const CALL_TYPE_MAP: Record<string, CallLogEntry['call_type']> = {
  '1': 'incoming',
  '2': 'outgoing',
  '3': 'missed',
  '4': 'spam',      // VOICEMAIL — treat as spam
  '5': 'rejected',
  '6': 'spam',      // BLOCKED
  '7': 'spam',      // ANSWERED_EXTERNALLY
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
  MISSED:   'missed',
  REJECTED: 'rejected',
  BLOCKED:  'spam',
  SPAM:     'spam',
};

export async function getCallLogsSince(sinceEpochMs: number): Promise<CallLogEntry[]> {
  try {
    // Fetch up to 1000 recent entries from Android call log
    // react-native-call-log returns newest first on most devices
    const rawLogs = await CallLog.load(1000);

    const results: CallLogEntry[] = [];
    const seenDeviceIds = new Set<string>(); // Track device IDs to prevent duplicates

    for (const log of rawLogs) {
      const logTime = parseInt(log.timestamp ?? '0', 10);

      // Skip logs with no timestamp
      if (!logTime) continue;

      // Stop once we reach logs older than our sync window
      // (they're sorted newest first, so we can break early)
      if (logTime <= sinceEpochMs) break;

      const logAny = log as any;
      const deviceId = logAny._id
        || logAny.callId
        || `${log.rawType ?? ''}_${log.timestamp ?? ''}_${(log.phoneNumber ?? '').replace(/\s+/g, '')}`;

      // Skip if we've already processed this device ID (prevents duplicates within the batch)
      if (seenDeviceIds.has(String(deviceId))) {
        console.log(`[CallLogService] Skipping duplicate device_call_id: ${deviceId}`);
        continue;
      }
      seenDeviceIds.add(String(deviceId));

      const entry: CallLogEntry = {
        device_call_id: String(deviceId),
        contact_number: (log.phoneNumber ?? 'unknown').replace(/\s+/g, ''),
        contact_name:   log.name && log.name.trim() !== '' ? log.name.trim() : null,
        call_type:      CALL_TYPE_MAP[String(log.type ?? '')] ?? CALL_TYPE_MAP[String(log.rawType ?? '')] ?? 'incoming',
        duration_sec:   parseInt(String(log.duration ?? '0'), 10),
        called_at:      new Date(logTime).toISOString(),
        sim_id:         logAny.phoneAccountId ?? null,
      };

      results.push(entry);
    }

    console.log(`[CallLogService] Found ${results.length} new logs since ${new Date(sinceEpochMs).toLocaleString()}`);
    console.log(`[CallLogService] Date range: ${results.length > 0 ? `${new Date(Math.min(...results.map(r => new Date(r.called_at).getTime()))).toLocaleString()} to ${new Date(Math.max(...results.map(r => new Date(r.called_at).getTime()))).toLocaleString()}` : 'N/A'}`);
    
    return results;
  } catch (error) {
    console.error('[CallLogService] Failed to read logs:', error);
    return [];
  }
}
