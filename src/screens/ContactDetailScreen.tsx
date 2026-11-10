import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import {
  ArrowLeft, Phone, Clock, TrendingUp, Calendar,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Tag, Check, X,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../lib/haptics';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;

type Disposition = 'interested' | 'callback' | 'not_interested' | 'wrong_number' | 'no_answer' | 'converted' | null;

interface CallRecord {
  id: string;
  call_type: string;
  duration_sec: number;
  called_at: string;
  sim_id: string | null;
  disposition: Disposition;
  notes: string | null;
}

interface ContactDetailProps {
  contactNumber: string;
  contactName: string | null;
  onBack: () => void;
}

export default function ContactDetailScreen({
  contactNumber, contactName, onBack,
}: ContactDetailProps) {
  const { theme } = useTheme();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (!id) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('call_logs')
      .select('id, call_type, duration_sec, called_at, sim_id, disposition, notes')
      .eq('caller_id', id)
      .eq('contact_number', contactNumber)
      .order('called_at', { ascending: false })
      .limit(200);

    if (!error && data) setCalls(data);
    setLoading(false);
  }, [contactNumber]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const [editingCall, setEditingCall] = useState<CallRecord | null>(null);

  const saveDisposition = useCallback(async (callId: string, disposition: Disposition, notes: string) => {
    haptics.medium();
    // Optimistic update
    setCalls(prev => prev.map(c =>
      c.id === callId ? { ...c, disposition, notes: notes || null } : c
    ));
    await supabase
      .from('call_logs')
      .update({ disposition, notes: notes || null })
      .eq('id', callId);
  }, []);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const incoming = calls.filter(c => c.call_type === 'incoming').length;
    const outgoing = calls.filter(c => c.call_type === 'outgoing').length;
    const missed = calls.filter(c => c.call_type === 'missed').length;
    const rejected = calls.filter(c => c.call_type === 'rejected').length;
    const totalDuration = calls.reduce((a, c) => a + (c.duration_sec ?? 0), 0);
    const avgDuration = calls.length > 0 ? Math.round(totalDuration / calls.length) : 0;
    const lastCall = calls.length > 0 ? calls[0].called_at : null;
    const firstCall = calls.length > 0 ? calls[calls.length - 1].called_at : null;

    return {
      total: calls.length,
      incoming, outgoing, missed, rejected,
      totalDuration, avgDuration,
      lastCall, firstCall,
    };
  }, [calls]);

  // ── Daily trend for line chart ───────────────────────────────────────────
  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach(c => {
      const day = new Date(c.called_at).toISOString().slice(0, 10);
      map[day] = (map[day] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14) // last 14 days
      .map(([day, count]) => ({ day, count }));
  }, [calls]);

  const chartData = useMemo(() =>
    dailyTrend.map(d => ({ value: d.count })),
  [dailyTrend]);

  const chartSpacing = useMemo(() => {
    if (dailyTrend.length <= 1) return 40;
    return Math.max(Math.floor(CHART_WIDTH / dailyTrend.length), 14);
  }, [dailyTrend.length]);

  // ── Format helpers ───────────────────────────────────────────────────────
  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const initial = (contactName ?? contactNumber)[0].toUpperCase();

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { haptics.light(); onBack(); }} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} stroke={theme.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {contactName ?? contactNumber}
          </Text>
          {contactName && (
            <Text style={s.headerSubtitle}>{contactNumber}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={s.loadingTxt}>Loading history…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Avatar + summary */}
          <View style={s.heroCard}>
            <View style={[s.avatar, { backgroundColor: theme.primaryContainer }]}>
              <Text style={[s.avatarTxt, { color: theme.primary }]}>{initial}</Text>
            </View>
            <Text style={s.heroTotal}>{stats.total}</Text>
            <Text style={s.heroLabel}>Total Calls</Text>
            <View style={s.heroRow}>
              <View style={s.heroStat}>
                <PhoneIncoming size={14} stroke={theme.success} />
                <Text style={[s.heroStatTxt, { color: theme.success }]}>{stats.incoming}</Text>
              </View>
              <View style={s.heroStat}>
                <PhoneOutgoing size={14} stroke={theme.primary} />
                <Text style={[s.heroStatTxt, { color: theme.primary }]}>{stats.outgoing}</Text>
              </View>
              <View style={s.heroStat}>
                <PhoneMissed size={14} stroke={theme.warning} />
                <Text style={[s.heroStatTxt, { color: theme.warning }]}>{stats.missed}</Text>
              </View>
              {stats.rejected > 0 && (
                <View style={s.heroStat}>
                  <PhoneOff size={14} stroke={theme.error} />
                  <Text style={[s.heroStatTxt, { color: theme.error }]}>{stats.rejected}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats grid */}
          <View style={s.statsGrid}>
            <StatTile
              icon={<Clock size={18} stroke={theme.accent} />}
              label="Total Talk Time"
              value={fmtDuration(stats.totalDuration)}
              color={theme.accentContainer}
              theme={theme}
            />
            <StatTile
              icon={<TrendingUp size={18} stroke={theme.success} />}
              label="Avg Duration"
              value={fmtDuration(stats.avgDuration)}
              color={theme.successContainer}
              theme={theme}
            />
            <StatTile
              icon={<Calendar size={18} stroke={theme.primary} />}
              label="Last Call"
              value={stats.lastCall ? fmtDate(stats.lastCall) : '—'}
              color={theme.primaryContainer}
              theme={theme}
            />
            <StatTile
              icon={<Calendar size={18} stroke={theme.warning} />}
              label="First Call"
              value={stats.firstCall ? fmtDate(stats.firstCall) : '—'}
              color={theme.warningContainer}
              theme={theme}
            />
          </View>

          {/* 14-day trend */}
          {chartData.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>14-Day Activity</Text>
              <View style={s.chartWrap}>
                <LineChart
                  data={chartData}
                  height={140}
                  width={CHART_WIDTH}
                  initialSpacing={6}
                  spacing={chartSpacing}
                  color1={theme.primary}
                  thickness={2.5}
                  dataPointsColor1={theme.primary}
                  dataPointsRadius={3}
                  noOfSections={3}
                  yAxisColor={theme.border}
                  xAxisColor={theme.border}
                  yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                  hideRules
                  curved
                  areaChart
                  startFillColor1={theme.primary}
                  endFillColor1={theme.surface}
                  startOpacity1={0.2}
                  endOpacity1={0}
                  isAnimated
                />
              </View>
            </View>
          )}

          {/* Call history */}
          <Text style={s.sectionLabel}>CALL HISTORY</Text>
          <View style={s.card}>
            {calls.length === 0 ? (
              <View style={s.emptyHistory}>
                <Phone size={28} stroke={theme.textTertiary} />
                <Text style={s.emptyTxt}>No calls found</Text>
              </View>
            ) : (
              calls.map((call, i) => (
                <CallHistoryRow
                  key={call.id}
                  call={call}
                  theme={theme}
                  fmtDate={fmtDate}
                  fmtTime={fmtTime}
                  fmtDuration={fmtDuration}
                  isLast={i === calls.length - 1}
                  onEdit={() => { haptics.light(); setEditingCall(call); }}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Disposition editor modal */}
      {editingCall && (
        <DispositionModal
          call={editingCall}
          theme={theme}
          onSave={(disp, notes) => {
            saveDisposition(editingCall.id, disp, notes);
            setEditingCall(null);
          }}
          onClose={() => { haptics.light(); setEditingCall(null); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatTile = React.memo(function StatTile({
  icon, label, value, color, theme,
}: {
  icon: React.ReactNode; label: string; value: string; color: string; theme: any;
}) {
  const s = makeStyles(theme);
  return (
    <View style={[s.statTile, theme.shadow]}>
      <View style={[s.statIcon, { backgroundColor: color }]}>{icon}</View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
});

const CallHistoryRow = React.memo(function CallHistoryRow({
  call, theme, fmtDate, fmtTime, fmtDuration, isLast, onEdit,
}: {
  call: CallRecord;
  theme: any;
  fmtDate: (iso: string) => string;
  fmtTime: (iso: string) => string;
  fmtDuration: (sec: number) => string;
  isLast: boolean;
  onEdit: () => void;
}) {
  const s = makeStyles(theme);
  const type = call.call_type;
  const isIn = type === 'incoming';
  const isOut = type === 'outgoing';
  const isRej = type === 'rejected';

  const icon = isIn
    ? { Icon: PhoneIncoming, color: theme.success, bg: theme.successContainer }
    : isOut
    ? { Icon: PhoneOutgoing, color: theme.primary, bg: theme.primaryContainer }
    : isRej
    ? { Icon: PhoneOff, color: theme.error, bg: theme.errorContainer }
    : { Icon: PhoneMissed, color: theme.warning, bg: theme.warningContainer };

  const typeLabel = isIn ? 'Incoming' : isOut ? 'Outgoing' : isRej ? 'Rejected' : 'Missed';
  const duration = call.duration_sec > 0 ? fmtDuration(call.duration_sec) : '—';

  const dispMeta = call.disposition ? DISPOSITION_META[call.disposition] : null;

  return (
    <View style={[s.historyRow, !isLast && s.historyRowBorder]}>
      <View style={[s.historyIcon, { backgroundColor: icon.bg }]}>
        <icon.Icon size={16} stroke={icon.color} />
      </View>
      <View style={s.historyInfo}>
        <View style={s.historyTopRow}>
          <Text style={[s.historyType, { color: icon.color }]}>{typeLabel}</Text>
          {dispMeta && (
            <View style={[s.dispTag, { backgroundColor: dispMeta.color + '20' }]}>
              <Text style={[s.dispTagTxt, { color: dispMeta.color }]}>{dispMeta.label}</Text>
            </View>
          )}
        </View>
        <Text style={s.historyDate}>{fmtDate(call.called_at)}</Text>
        {call.notes ? (
          <Text style={s.historyNotes} numberOfLines={1}>{call.notes}</Text>
        ) : null}
      </View>
      <View style={s.historyRight}>
        <Text style={s.historyTime}>{fmtTime(call.called_at)}</Text>
        <Text style={s.historyDuration}>{duration}</Text>
        <TouchableOpacity onPress={onEdit} style={s.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Tag size={13} stroke={theme.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Disposition metadata ─────────────────────────────────────────────────────

const DISPOSITION_META: Record<NonNullable<Disposition>, { label: string; color: string }> = {
  interested:     { label: '⭐ Interested',      color: '#10B981' },
  callback:       { label: '🔁 Callback',        color: '#F59E0B' },
  not_interested: { label: '👎 Not Interested',  color: '#EF4444' },
  wrong_number:   { label: '❌ Wrong Number',    color: '#6B7280' },
  no_answer:      { label: '📵 No Answer',       color: '#9CA3AF' },
  converted:      { label: '🏆 Converted',       color: '#4F46E5' },
};

const DISPOSITION_OPTIONS: NonNullable<Disposition>[] = [
  'interested', 'callback', 'not_interested', 'wrong_number', 'no_answer', 'converted',
];

// ─── Disposition modal ────────────────────────────────────────────────────────

function DispositionModal({ call, theme, onSave, onClose }: {
  call: CallRecord;
  theme: any;
  onSave: (disp: Disposition, notes: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Disposition>(call.disposition);
  const [notes, setNotes] = useState(call.notes ?? '');
  const s = makeStyles(theme);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={[s.modalSheet, { backgroundColor: theme.surface }]}>
        <View style={s.modalHandle} />
        <View style={s.modalHeader}>
          <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Tag this call</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} stroke={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Disposition chips */}
        <View style={s.dispChips}>
          {DISPOSITION_OPTIONS.map(d => {
            const meta = DISPOSITION_META[d];
            const active = selected === d;
            return (
              <TouchableOpacity
                key={d}
                style={[
                  s.dispChip,
                  { borderColor: active ? meta.color : theme.border },
                  active && { backgroundColor: meta.color + '18' },
                ]}
                onPress={() => { haptics.light(); setSelected(active ? null : d); }}
                activeOpacity={0.7}
              >
                {active && <Check size={12} stroke={meta.color} />}
                <Text style={[s.dispChipTxt, { color: active ? meta.color : theme.textSecondary }]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes input */}
        <Text style={[s.notesLabel, { color: theme.textTertiary }]}>NOTES (optional)</Text>
        <TextInput
          style={[s.notesInput, {
            color: theme.textPrimary,
            borderColor: theme.border,
            backgroundColor: theme.surfaceVariant,
          }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a note about this call…"
          placeholderTextColor={theme.textTertiary}
          multiline
          maxLength={200}
        />

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: theme.primary }]}
          onPress={() => onSave(selected, notes)}
          activeOpacity={0.85}
        >
          <Check size={18} stroke="#fff" />
          <Text style={s.saveBtnTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.surface,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
    ...theme.shadow,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 15, color: theme.textSecondary },

  scroll: { padding: 20, paddingBottom: 40 },

  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.xl,
    padding: 24, alignItems: 'center',
    marginBottom: 20,
    ...theme.shadowStrong,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarTxt: { fontSize: 28, fontWeight: '800' },
  heroTotal: { fontSize: 40, fontWeight: '800', color: theme.textPrimary },
  heroLabel: { fontSize: 13, color: theme.textSecondary, marginBottom: 12 },
  heroRow: { flexDirection: 'row', gap: 16 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatTxt: { fontSize: 14, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statTile: {
    width: (width - 50) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 14, alignItems: 'center',
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 2, textAlign: 'center' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: theme.textTertiary,
    letterSpacing: 1, marginBottom: 10, marginLeft: 2,
  },

  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 16, marginBottom: 20,
    ...theme.shadow,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  chartWrap: { overflow: 'hidden' },

  emptyHistory: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt: { fontSize: 14, color: theme.textTertiary },

  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
  },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.divider },
  historyIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  historyInfo:  { flex: 1, marginLeft: 12 },
  historyTopRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  historyType:  { fontSize: 14, fontWeight: '600' },
  historyDate:  { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  historyNotes: { fontSize: 11, color: theme.textTertiary, marginTop: 2, fontStyle: 'italic' },
  historyRight: { alignItems: 'flex-end', gap: 2 },
  historyTime:  { fontSize: 12, color: theme.textSecondary },
  historyDuration: { fontSize: 11, color: theme.textTertiary },
  editBtn:      { marginTop: 4, padding: 2 },

  // Disposition tag (inline in history row)
  dispTag:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dispTagTxt: { fontSize: 10, fontWeight: '700' },

  // Disposition modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
    ...theme.shadowStrong,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle:  { fontSize: 17, fontWeight: '800' },
  dispChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  dispChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    backgroundColor: theme.surfaceVariant,
  },
  dispChipTxt: { fontSize: 13, fontWeight: '600' },
  notesLabel:  { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  notesInput: {
    borderWidth: 1, borderRadius: theme.radius.md,
    padding: 12, fontSize: 14, minHeight: 72,
    textAlignVertical: 'top', marginBottom: 16,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: theme.radius.lg,
    ...theme.shadow,
  },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
