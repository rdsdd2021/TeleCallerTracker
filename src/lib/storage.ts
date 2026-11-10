import EncryptedStorage from 'react-native-encrypted-storage';

export const STORAGE_KEYS = {
  CALLER_ID:       'caller_id',
  CALLER_NAME:     'caller_name',
  EMPLOYEE_ID:     'employee_id',
  ORG_ID:          'org_id',             // resolved from invite code at registration
  LAST_SYNCED_AT:  'last_synced_at',    // epoch ms as string
  SYNC_STATUS:     'sync_status',        // 'ok' | 'error' | 'syncing'
  TODAY_COUNT:     'today_count',        // cached count to avoid extra queries
  BATTERY_PROMPT:  'battery_prompt_shown',
  THEME_MODE:      'theme_mode',         // 'light' | 'dark' | 'system'
  SIM_LABELS:      'sim_labels',         // JSON: { [sim_id]: label }
  ONBOARDING_DONE: 'onboarding_done',    // 'true' once walkthrough completed
} as const;

export const Storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      await EncryptedStorage.setItem(key, value);
    } catch (e) {
      console.error('[Storage] set error:', e);
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (e) {
      console.error('[Storage] remove error:', e);
    }
  },
  /** Wipe all known app keys — used on unregister */
  async clear(): Promise<void> {
    try {
      await Promise.all(
        Object.values(STORAGE_KEYS).map(k => EncryptedStorage.removeItem(k))
      );
    } catch (e) {
      console.error('[Storage] clear error:', e);
    }
  },
};
