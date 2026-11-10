import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus,
  Linking, ScrollView, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RefreshCcw, ShieldCheck, ShieldAlert, Battery, Info, CheckCircle2,
  LogOut, ChevronRight, Cloud, Moon, Sun, Smartphone, Pencil, Check,
} from 'lucide-react-native';
import { check, PERMISSIONS, RESULTS, PermissionStatus } from 'react-native-permissions';
import DeviceInfo from 'react-native-device-info';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { runSync } from '../services/syncService';
import { useAppContext } from '../App';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { haptics } from '../lib/haptics';

function formatRelativeTime(ms: number | null): string {
  if (!ms) return 'Never synced';
  const diff = Math.floor((Date.now() - ms) / 60000);
  if (diff < 1)  return 'Just now';
  if (diff === 1) return '1 minute ago';
  if (diff < 60) return `${diff} minutes ago`;
  const h = Math.floor(diff / 60);
  return h === 1 ? '1 hour ago' : `${h} hours ago`;
}

// ─── SIM label editor modal ───────────────────────────────────────────────────

function SimLabelModal({ simId, current, onSave, onClose }: {
  simId: string; current: string;
  onSave: (label: string) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const [val, setVal] = useState(current);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ml.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[ml.card, { backgroundColor: theme.surface }]}>
        <Text style={[ml.title, { color: theme.textPrimary }]}>Label SIM</Text>
        <Text style={[ml.sub, { color: theme.textSecondary }]}>SIM ID: {simId}</Text>
        <TextInput
          style={[ml.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
          value={val}
          onChangeText={setVal}
          placeholder="e.g. Work, Personal, Sales"
          placeholderTextColor={theme.textTertiary}
          autoFocus
          maxLength={20}
        />
        <View style={ml.row}>
          <TouchableOpacity style={[ml.btn, { backgroundColor: theme.surfaceVariant }]} onPress={onClose}>
            <Text style={[ml.btnTxt, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ml.btn, { backgroundColor: theme.primary }]}
            onPress={() => { onSave(val.trim() || simId); onClose(); }}
          >
            <Check size={16} stroke="#fff" />
            <Text style={[ml.btnTxt, { color: '#fff' }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ml = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub:   { fontSize: 12, marginBottom: 16 },
  input: {
    height: 50, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 16, marginBottom: 20,
  },
  row:   { flexDirection: 'row', gap: 12 },
  btn:   { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnTxt:{ fontSize: 15, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StatusScreen() {
  const { onUnregister } = useAppContext();
  const { theme, mode, setMode, isDark } = useTheme();

  const [callerName, setCallerName]         = useState('');
  const [callerId, setCallerId]             = useState('');
  const [syncStatus, setSyncStatus]         = useState<'ok'|'error'|'syncing'|null>(null);
  const [lastSyncMs, setLastSyncMs]         = useState<number | null>(null);
  const [isSyncing, setIsSyncing]           = useState(false);
  const [simLabels, setSimLabels]           = useState<Record<string, string>>({});
  const [simIds, setSimIds]                 = useState<string[]>([]);
  const [editingSim, setEditingSim]         = useState<string | null>(null);
  const [appVersion, setAppVersion]         = useState('');

  // Real permission states
  const [callLogPerm, setCallLogPerm]       = useState<PermissionStatus | null>(null);
  const [batteryOptOff, setBatteryOptOff]   = useState<boolean | null>(null); // true = unrestricted

  const checkPermissions = useCallback(async () => {
    // Call log permission — real check
    try {
      const result = await check(PERMISSIONS.ANDROID.READ_CALL_LOG);
      setCallLogPerm(result);
    } catch {
      setCallLogPerm(null);
    }

    // Battery optimisation — check via DeviceInfo if available, else fall back to storage flag
    try {
      // react-native-device-info doesn't expose battery opt directly;
      // we use the stored flag set when the user taps "Unrestricted"
      const batteryDone = await Storage.get(STORAGE_KEYS.BATTERY_PROMPT);
      setBatteryOptOff(batteryDone === 'true');
    } catch {
      setBatteryOptOff(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    const name = await Storage.get(STORAGE_KEYS.CALLER_NAME);
    if (name) setCallerName(name);
    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (id) setCallerId(id);
    const status = await Storage.get(STORAGE_KEYS.SYNC_STATUS) as any;
    if (status) setSyncStatus(status);
    const timeStr = await Storage.get(STORAGE_KEYS.LAST_SYNCED_AT);
    if (timeStr) setLastSyncMs(parseInt(timeStr, 10));

    setAppVersion(DeviceInfo.getVersion());

    // Load SIM labels from storage
    const labelsJson = await Storage.get(STORAGE_KEYS.SIM_LABELS);
    if (labelsJson) {
      try { setSimLabels(JSON.parse(labelsJson)); } catch {}
    }

    // Load SIM IDs: query Supabase, fall back to cached storage
    const cid = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (cid) {
      try {
        const { data } = await supabase
          .from('call_logs')
          .select('sim_id')
          .eq('caller_id', cid)
          .not('sim_id', 'is', null)
          .limit(200);

        if (data && data.length > 0) {
          const ids = [...new Set(data.map((r: any) => r.sim_id).filter(Boolean))] as string[];
          if (ids.length > 0) {
            setSimIds(ids);
            await Storage.set('known_sim_ids', JSON.stringify(ids));
            return;
          }
        }
      } catch (e) {
        console.warn('[StatusScreen] Could not fetch SIM IDs from DB:', e);
      }
    }

    const simIdsJson = await Storage.get('known_sim_ids');
    if (simIdsJson) {
      try {
        const ids = JSON.parse(simIdsJson);
        if (Array.isArray(ids) && ids.length > 0) { setSimIds(ids); return; }
      } catch {}
    }

    setSimIds(['default']);
  }, []);

  const handleSyncNow = async () => {
    if (isSyncing) return;
    haptics.medium();
    setIsSyncing(true);
    setSyncStatus('syncing');
    await runSync();
    await loadData();
    setIsSyncing(false);
    haptics.success();
  };

  const saveSimLabel = async (simId: string, label: string) => {
    const updated = { ...simLabels, [simId]: label };
    setSimLabels(updated);
    await Storage.set(STORAGE_KEYS.SIM_LABELS, JSON.stringify(updated));
  };

  useEffect(() => {
    loadData();
    checkPermissions();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        loadData();
        checkPermissions(); // re-check when user returns from Settings
      }
    });
    return () => sub.remove();
  }, [loadData, checkPermissions]);

  const isConnected = syncStatus === 'ok';
  const hasSyncError = syncStatus === 'error';
  const initial = (callerName || 'U')[0].toUpperCase();

  // Derive permission display values
  const callLogGranted = callLogPerm === RESULTS.GRANTED;
  const callLogLabel   = callLogPerm === null ? 'Checking…'
    : callLogGranted ? 'Granted'
    : callLogPerm === RESULTS.DENIED ? 'Denied'
    : callLogPerm === RESULTS.BLOCKED ? 'Blocked — tap to fix'
    : 'Unknown';
  const callLogColor = callLogGranted ? theme.success : theme.error;

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Profile & Sync</Text>

        {/* Sync error banner */}
        {hasSyncError && (
          <TouchableOpacity style={s.errorBanner} onPress={handleSyncNow} activeOpacity={0.8}>
            <ShieldAlert size={16} stroke={theme.error} />
            <Text style={s.errorBannerTxt}>Sync failed — tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Profile hero */}
        <View style={s.profileHero}>
          <View style={[s.blob, s.blob1]} />
          <View style={[s.blob, s.blob2]} />
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initial}</Text>
            </View>
          </View>
          <Text style={s.heroName}>{callerName || 'Telecaller'}</Text>
          <Text style={s.heroId}>ID: {callerId || '—'}</Text>
          <View style={[s.badge, { backgroundColor: isConnected ? theme.successContainer : hasSyncError ? theme.errorContainer : theme.surfaceVariant }]}>
            {isConnected
              ? <CheckCircle2 size={13} stroke={theme.success} />
              : <Cloud size={13} stroke={hasSyncError ? theme.error : theme.textTertiary} />}
            <Text style={[s.badgeTxt, { color: isConnected ? theme.success : hasSyncError ? theme.error : theme.textTertiary }]}>
              {isConnected ? 'Synced' : hasSyncError ? 'Sync error' : 'Not synced'}
            </Text>
          </View>
          <Text style={s.lastSync}>{formatRelativeTime(lastSyncMs)}</Text>
        </View>

        {/* Sync button */}
        <TouchableOpacity
          style={[s.syncBtn, isSyncing && s.syncBtnDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing}
          activeOpacity={0.8}
        >
          {isSyncing
            ? <ActivityIndicator color="#fff" size="small" />
            : <RefreshCcw size={20} stroke="#fff" />}
          <Text style={s.syncBtnTxt}>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</Text>
        </TouchableOpacity>

        {/* Appearance */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.settingsCard}>
          <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
            <View style={[s.rowIcon, { backgroundColor: isDark ? theme.primaryContainer : theme.warningContainer }]}>
              {isDark
                ? <Moon size={20} stroke={theme.primary} />
                : <Sun size={20} stroke={theme.warning} />}
            </View>
            <Text style={[s.rowLabel, { flex: 0, marginRight: 4 }]}>Theme</Text>
            {(['light', 'dark', 'system'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[s.modeChip, mode === m && s.modeChipActive]}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[s.modeChipTxt, mode === m && s.modeChipTxtActive]}>
                  {m === 'light' ? '☀️ Light' : m === 'dark' ? '🌙 Dark' : '⚙️ System'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SIM Labels */}
        <Text style={s.sectionLabel}>SIM LABELS</Text>
        <View style={s.settingsCard}>
          {simIds.length === 0 ? (
            <View style={[s.row, { justifyContent: 'center' }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.rowLabel, { flex: 0, marginLeft: 8, color: theme.textTertiary }]}>
                Loading SIM info…
              </Text>
            </View>
          ) : simIds[0] === 'default' ? (
            <TouchableOpacity style={s.row} onPress={() => setEditingSim('default')} activeOpacity={0.7}>
              <View style={[s.rowIcon, { backgroundColor: theme.primaryContainer }]}>
                <Smartphone size={20} stroke={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{simLabels['default'] || 'Primary SIM'}</Text>
                <Text style={[s.rowSub, { color: theme.textTertiary }]}>Tap to add a label</Text>
              </View>
              <Pencil size={15} stroke={theme.textTertiary} />
            </TouchableOpacity>
          ) : (
            simIds.map((simId, i) => (
              <TouchableOpacity
                key={simId}
                style={[s.row, i < simIds.length - 1 && s.rowBorder]}
                onPress={() => setEditingSim(simId)}
                activeOpacity={0.7}
              >
                <View style={[s.rowIcon, { backgroundColor: i === 0 ? theme.primaryContainer : theme.accentContainer }]}>
                  <Smartphone size={20} stroke={i === 0 ? theme.primary : theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{simLabels[simId] || `SIM ${i + 1}`}</Text>
                  <Text style={[s.rowSub, { color: theme.textTertiary }]} numberOfLines={1}>{simId}</Text>
                </View>
                <View style={s.simBadge}>
                  <Text style={[s.simBadgeTxt, { color: i === 0 ? theme.primary : theme.accent }]}>
                    {simLabels[simId] ? 'Labelled' : 'Tap to label'}
                  </Text>
                </View>
                <Pencil size={15} stroke={theme.textTertiary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Permissions */}
        <Text style={s.sectionLabel}>SETTINGS & PERMISSIONS</Text>
        <View style={s.settingsCard}>
          <SettingRow
            icon={
              callLogGranted
                ? <ShieldCheck size={20} stroke={theme.primary} />
                : <ShieldAlert size={20} stroke={theme.error} />
            }
            bg={callLogGranted ? theme.primaryContainer : theme.errorContainer}
            label="Call Log Permission"
            value={callLogLabel}
            valueColor={callLogColor}
            onPress={() => Linking.openSettings()}
            theme={theme}
          />
          <SettingRow
            icon={<Battery size={20} stroke={batteryOptOff ? theme.success : theme.warning} />}
            bg={batteryOptOff ? theme.successContainer : theme.warningContainer}
            label="Battery Optimization"
            value={batteryOptOff === null ? 'Checking…' : batteryOptOff ? 'Unrestricted ✓' : 'Restricted ⚠️'}
            valueColor={batteryOptOff ? theme.success : theme.error}
            onPress={async () => {
              await Storage.set(STORAGE_KEYS.BATTERY_PROMPT, 'true');
              setBatteryOptOff(true);
              Linking.openSettings();
            }}
            theme={theme}
          />
          <SettingRow
            icon={<Info size={20} stroke={theme.accent} />}
            bg={theme.accentContainer}
            label="App Version"
            value={appVersion ? `v${appVersion}` : 'v—'}
            last
            theme={theme}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() => Alert.alert(
            'Unregister Device',
            'This will remove your device registration. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unregister', style: 'destructive', onPress: onUnregister },
            ]
          )}
        >
          <LogOut size={18} stroke={theme.error} />
          <Text style={s.logoutTxt}>Unregister Device</Text>
        </TouchableOpacity>
      </ScrollView>

      {editingSim && (
        <SimLabelModal
          simId={editingSim}
          current={simLabels[editingSim] || ''}
          onSave={(label) => saveSimLabel(editingSim, label)}
          onClose={() => setEditingSim(null)}
        />
      )}
    </SafeAreaView>
  );
}

function SettingRow({ icon, bg, label, value, valueColor, onPress, last, theme }: {
  icon: any; bg: string; label: string; value: string;
  valueColor?: string; onPress?: () => void; last?: boolean; theme: any;
}) {
  const s = makeStyles(theme);
  const Inner = (
    <View style={[s.row, !last && s.rowBorder]}>
      <View style={[s.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      {onPress && <ChevronRight size={16} stroke={theme.textTertiary} />}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress}>{Inner}</TouchableOpacity> : Inner;
}

const makeStyles = (theme: any) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.bg },
  scroll:      { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 26, fontWeight: '800', color: theme.textPrimary, marginBottom: 16 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.errorContainer,
    borderRadius: theme.radius.md,
    padding: 14, marginBottom: 16,
  },
  errorBannerTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.error },

  profileHero: {
    backgroundColor: theme.primary, borderRadius: theme.radius.xl,
    padding: 28, alignItems: 'center', marginBottom: 16,
    overflow: 'hidden', ...theme.shadowStrong,
  },
  blob:        { position: 'absolute', borderRadius: 999 },
  blob1:       { width: 160, height: 160, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30 },
  blob2:       { width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -20, left: -10 },
  avatarRing:  { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatar:      { width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 28, fontWeight: '800', color: theme.primary },
  heroName:    { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroId:      { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 12 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.radius.full, marginBottom: 6 },
  badgeTxt:    { fontSize: 13, fontWeight: '700' },
  lastSync:    { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  syncBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, borderRadius: theme.radius.lg, height: 52, marginBottom: 24, ...theme.shadow },
  syncBtnDisabled: { opacity: 0.7 },
  syncBtnTxt:      { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  settingsCard: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 24, ...theme.shadow },

  row:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowBorder:{ borderBottomWidth: 1, borderBottomColor: theme.divider },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: theme.textPrimary, fontWeight: '500' },
  rowSub:   { fontSize: 11, marginTop: 1 },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  modeChip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.radius.full, backgroundColor: theme.surfaceVariant, borderWidth: 1, borderColor: 'transparent' },
  modeChipActive:   { backgroundColor: theme.primaryContainer, borderColor: theme.primary },
  modeChipTxt:      { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  modeChipTxtActive:{ color: theme.primary },

  simBadge:   { marginRight: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, backgroundColor: theme.surfaceVariant },
  simBadgeTxt:{ fontSize: 11, fontWeight: '600' },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  logoutTxt:  { color: theme.error, fontSize: 15, fontWeight: '600' },
});
