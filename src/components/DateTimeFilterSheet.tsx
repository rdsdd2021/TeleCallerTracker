import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import { X, Check, Smartphone } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { Storage, STORAGE_KEYS } from '../lib/storage';

const { height: SCREEN_H } = Dimensions.get('window');
const ITEM_H = 44;

// ─── Public types ─────────────────────────────────────────────────────────────

export type CallTypeFilter = 'all' | 'incoming' | 'outgoing' | 'missed' | 'spam';
export type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export interface DateTimeFilter {
  preset:   PresetKey;
  fromDate: Date;
  toDate:   Date;
  fromTime: { h: number; m: number };
  toTime:   { h: number; m: number };
  callType: CallTypeFilter;
  simId:    string | null;   // null = all SIMs
}

// ─── Helpers (exported so screens can use them) ───────────────────────────────

export function buildPresetDates(preset: PresetKey): { from: Date; to: Date } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today':
      return { from: today, to: now };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const ye = new Date(y);    ye.setHours(23, 59, 59, 999);
      return { from: y, to: ye };
    }
    case '7d': {
      const f = new Date(today); f.setDate(f.getDate() - 6);
      return { from: f, to: now };
    }
    case '30d': {
      const f = new Date(today); f.setDate(f.getDate() - 29);
      return { from: f, to: now };
    }
    case 'month': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: f, to: now };
    }
    default:
      return { from: today, to: now };
  }
}

export function defaultFilter(): DateTimeFilter {
  const { from, to } = buildPresetDates('today');
  return {
    preset: 'today', fromDate: from, toDate: to,
    fromTime: { h: 0, m: 0 }, toTime: { h: 23, m: 59 },
    callType: 'all',
    simId: null,
  };
}

export function callMatchesFilter(call: any, filter: DateTimeFilter): boolean {
  const d    = new Date(call.called_at);
  const from = new Date(filter.fromDate);
  from.setHours(filter.fromTime.h, filter.fromTime.m, 0, 0);
  const to   = new Date(filter.toDate);
  to.setHours(filter.toTime.h, filter.toTime.m, 59, 999);
  if (d < from || d > to) return false;
  if (filter.callType !== 'all' && call.call_type !== filter.callType) return false;
  // SIM filter — null means all SIMs; 'default' is the placeholder for single-SIM devices
  if (filter.simId !== null && filter.simId !== 'default') {
    if (call.sim_id !== filter.simId) return false;
  }
  return true;
}

export function filterSummaryLabel(f: DateTimeFilter): string {
  const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const fmtT = (t: { h: number; m: number }) =>
    `${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')}`;
  const hasTimeRange = !(f.fromTime.h === 0 && f.fromTime.m === 0 && f.toTime.h === 23 && f.toTime.m === 59);
  const timePart = hasTimeRange ? ` · ${fmtT(f.fromTime)}–${fmtT(f.toTime)}` : '';
  const labels: Record<PresetKey, string> = {
    today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7d',
    '30d': 'Last 30d', month: 'This Month', custom: 'Custom',
  };
  const datePart = f.preset !== 'custom'
    ? labels[f.preset]
    : `${fmtD(f.fromDate)} – ${fmtD(f.toDate)}`;
  return datePart + timePart;
}

// ─── Scroll-wheel picker ──────────────────────────────────────────────────────

function WheelPicker({ items, selectedIndex, onChange, width: w = 72, theme }: {
  items: string[]; selectedIndex: number;
  onChange: (i: number) => void; width?: number; theme: any;
}) {
  const ref   = useRef<ScrollView>(null);
  const ready = useRef(false);
  const ws    = makeWheelStyles(theme);

  useEffect(() => {
    if (ready.current) {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
    }
  }, [selectedIndex]);

  return (
    <View style={[ws.wrap, { width: w }]}>
      <View style={ws.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={() => {
          ready.current = true;
          ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
        }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const c   = Math.max(0, Math.min(idx, items.length - 1));
          if (c !== selectedIndex) onChange(c);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {items.map((lbl, i) => (
          <TouchableOpacity
            key={i} style={ws.item}
            onPress={() => { onChange(i); ref.current?.scrollTo({ y: i * ITEM_H, animated: true }); }}
            activeOpacity={0.7}
          >
            <Text style={[ws.txt, i === selectedIndex && ws.txtActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeWheelStyles = (theme: any) => StyleSheet.create({
  wrap:      { height: ITEM_H * 5, overflow: 'hidden', position: 'relative' },
  highlight: {
    position: 'absolute', top: ITEM_H * 2, left: 0, right: 0,
    height: ITEM_H, backgroundColor: theme.primaryContainer, borderRadius: 10, zIndex: 0,
  },
  item:      { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  txt:       { fontSize: 16, color: theme.textTertiary, fontWeight: '500' },
  txtActive: { fontSize: 18, color: theme.primary, fontWeight: '700' },
});

// ─── Date picker (month / day / year wheels) ──────────────────────────────────

function DatePicker({ value, onChange, theme }: { value: Date; onChange: (d: Date) => void; theme: any }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now    = new Date();
  const years  = useMemo(() => {
    const arr: string[] = [];
    for (let y = now.getFullYear() - 3; y <= now.getFullYear(); y++) arr.push(String(y));
    return arr;
  }, []);
  const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const days = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')),
  [daysInMonth]);

  const upd = (field: 'y'|'m'|'d', idx: number) => {
    const d = new Date(value);
    if (field === 'y') d.setFullYear(parseInt(years[idx], 10));
    if (field === 'm') d.setMonth(idx);
    if (field === 'd') d.setDate(idx + 1);
    const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() > max) d.setDate(max);
    onChange(d);
  };

  const yIdx = Math.max(0, years.indexOf(String(value.getFullYear())));

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      <WheelPicker items={MONTHS} selectedIndex={value.getMonth()}  onChange={i => upd('m', i)} width={76} theme={theme} />
      <WheelPicker items={days}   selectedIndex={value.getDate()-1} onChange={i => upd('d', i)} width={56} theme={theme} />
      <WheelPicker items={years}  selectedIndex={yIdx}              onChange={i => upd('y', i)} width={72} theme={theme} />
    </View>
  );
}

// ─── Time picker (hour / minute wheels) ──────────────────────────────────────

function TimePicker({ value, onChange, theme }: {
  value: { h: number; m: number };
  onChange: (v: { h: number; m: number }) => void;
  theme: any;
}) {
  const hours   = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0')), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2,'0')), []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <WheelPicker items={hours}   selectedIndex={value.h} onChange={h => onChange({ ...value, h })} width={64} theme={theme} />
      <Text style={{ fontSize: 26, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 }}>:</Text>
      <WheelPicker items={minutes} selectedIndex={value.m} onChange={m => onChange({ ...value, m })} width={64} theme={theme} />
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d',        label: 'Last 7 Days' },
  { key: '30d',       label: 'Last 30 Days' },
  { key: 'month',     label: 'This Month' },
  { key: 'custom',    label: 'Custom Range' },
];

interface Props {
  visible:          boolean;
  onClose:          () => void;
  onApply:          (f: DateTimeFilter) => void;
  currentFilter:    DateTimeFilter;
  showTypeFilter?:  boolean;
  showSimFilter?:   boolean;   // show SIM chip section
}

export default function DateTimeFilterSheet({ visible, onClose, onApply, currentFilter, showTypeFilter = true, showSimFilter = false }: Props) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const [preset,    setPreset]    = useState<PresetKey>(currentFilter.preset);
  const [fromDate,  setFromDate]  = useState(currentFilter.fromDate);
  const [toDate,    setToDate]    = useState(currentFilter.toDate);
  const [fromTime,  setFromTime]  = useState(currentFilter.fromTime);
  const [toTime,    setToTime]    = useState(currentFilter.toTime);
  const [callType,  setCallType]  = useState<CallTypeFilter>(currentFilter.callType);
  const [simId,     setSimId]     = useState<string | null>(currentFilter.simId);
  const [dateTab,   setDateTab]   = useState<'from'|'to'>('from');
  const [timeTab,   setTimeTab]   = useState<'from'|'to'>('from');

  // SIM data loaded from storage
  const [knownSimIds,  setKnownSimIds]  = useState<string[]>([]);
  const [simLabels,    setSimLabels]    = useState<Record<string, string>>({});

  // Load SIM IDs + labels from storage whenever sheet opens
  useEffect(() => {
    if (!visible || !showSimFilter) return;
    (async () => {
      const idsJson = await Storage.get('known_sim_ids');
      if (idsJson) {
        try { setKnownSimIds(JSON.parse(idsJson)); } catch {}
      }
      const labelsJson = await Storage.get(STORAGE_KEYS.SIM_LABELS);
      if (labelsJson) {
        try { setSimLabels(JSON.parse(labelsJson)); } catch {}
      }
    })();
  }, [visible, showSimFilter]);

  const CALL_TYPES: { key: CallTypeFilter; label: string; color: string }[] = [
    { key: 'all',      label: 'All',      color: theme.primary },
    { key: 'incoming', label: 'Incoming', color: theme.success },
    { key: 'outgoing', label: 'Outgoing', color: theme.accent },
    { key: 'missed',   label: 'Missed',   color: theme.error },
    { key: 'spam',     label: 'Spam',     color: theme.warning },
  ];

  useEffect(() => {
    if (visible) {
      setPreset(currentFilter.preset);
      setFromDate(currentFilter.fromDate);
      setToDate(currentFilter.toDate);
      setFromTime(currentFilter.fromTime);
      setToTime(currentFilter.toTime);
      setCallType(currentFilter.callType);
      setSimId(currentFilter.simId);
      setDateTab('from');
      setTimeTab('from');
    }
  }, [visible]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      bounciness: 3,
    }).start();
  }, [visible]);

  const handlePreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== 'custom') {
      const { from, to } = buildPresetDates(key);
      setFromDate(from); setToDate(to);
      setFromTime({ h: 0, m: 0 }); setToTime({ h: 23, m: 59 });
    }
  };

  const handleApply = () => {
    onApply({ preset, fromDate, toDate, fromTime, toTime, callType, simId });
    onClose();
  };

  const handleReset = () => {
    const f = defaultFilter();
    setPreset(f.preset); setFromDate(f.fromDate); setToDate(f.toDate);
    setFromTime(f.fromTime); setToTime(f.toTime);
    setCallType(f.callType); setSimId(null);
  };

  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (t: { h: number; m: number }) =>
    `${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')}`;

  const s = makeStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Filter</Text>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={handleReset} style={s.resetBtn}>
              <Text style={s.resetTxt}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <X size={20} stroke={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

          {/* Call type */}
          {showTypeFilter && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>CALL TYPE</Text>
              <View style={s.chipRow}>
                {CALL_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.key}
                    style={[s.chip, callType === ct.key && { backgroundColor: ct.color, borderColor: ct.color }]}
                    onPress={() => setCallType(ct.key)}
                    activeOpacity={0.7}
                  >
                    {callType === ct.key && <Check size={11} stroke="#fff" />}
                    <Text style={[s.chipTxt, callType === ct.key && s.chipTxtActive]}>{ct.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* SIM filter */}
          {showSimFilter && knownSimIds.length > 0 && !(knownSimIds.length === 1 && knownSimIds[0] === 'default') && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>SIM CARD</Text>
              <View style={s.chipRow}>
                {/* "All SIMs" chip */}
                <TouchableOpacity
                  style={[s.chip, simId === null && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setSimId(null)}
                  activeOpacity={0.7}
                >
                  {simId === null && <Check size={11} stroke="#fff" />}
                  <Smartphone size={13} stroke={simId === null ? '#fff' : theme.textSecondary} />
                  <Text style={[s.chipTxt, simId === null && s.chipTxtActive]}>All SIMs</Text>
                </TouchableOpacity>

                {/* One chip per known SIM */}
                {knownSimIds.map((id, i) => {
                  const label = simLabels[id] || `SIM ${i + 1}`;
                  const color = i === 0 ? theme.primary : theme.accent;
                  const active = simId === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[s.chip, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setSimId(active ? null : id)}
                      activeOpacity={0.7}
                    >
                      {active && <Check size={11} stroke="#fff" />}
                      <Smartphone size={13} stroke={active ? '#fff' : color} />
                      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Presets */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>QUICK SELECT</Text>
            <View style={s.presetGrid}>
              {PRESETS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[s.presetBtn, preset === p.key && s.presetBtnActive]}
                  onPress={() => handlePreset(p.key)}
                  activeOpacity={0.7}
                >
                  {preset === p.key && <Check size={12} stroke={theme.primary} />}
                  <Text style={[s.presetTxt, preset === p.key && s.presetTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom date range */}
          {preset === 'custom' && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>DATE RANGE</Text>
              <View style={s.tabRow}>
                <TouchableOpacity
                  style={[s.tab, dateTab === 'from' && s.tabActive]}
                  onPress={() => setDateTab('from')}
                >
                  <Text style={[s.tabTxt, dateTab === 'from' && s.tabTxtActive]}>From</Text>
                  <Text style={[s.tabSub, dateTab === 'from' && { color: theme.primary }]}>
                    {fmtDate(fromDate)}
                  </Text>
                </TouchableOpacity>
                <View style={s.tabDivider} />
                <TouchableOpacity
                  style={[s.tab, dateTab === 'to' && s.tabActive]}
                  onPress={() => setDateTab('to')}
                >
                  <Text style={[s.tabTxt, dateTab === 'to' && s.tabTxtActive]}>To</Text>
                  <Text style={[s.tabSub, dateTab === 'to' && { color: theme.primary }]}>
                    {fmtDate(toDate)}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={s.pickerCard}>
                {dateTab === 'from'
                  ? <DatePicker value={fromDate} onChange={setFromDate} theme={theme} />
                  : <DatePicker value={toDate}   onChange={setToDate}   theme={theme} />
                }
              </View>
            </View>
          )}

          {/* Time range — always shown */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>TIME RANGE</Text>
            <View style={s.tabRow}>
              <TouchableOpacity
                style={[s.tab, timeTab === 'from' && s.tabActive]}
                onPress={() => setTimeTab('from')}
              >
                <Text style={[s.tabTxt, timeTab === 'from' && s.tabTxtActive]}>From</Text>
                <Text style={[s.tabSub, timeTab === 'from' && { color: theme.primary }]}>
                  {fmtTime(fromTime)}
                </Text>
              </TouchableOpacity>
              <View style={s.tabDivider} />
              <TouchableOpacity
                style={[s.tab, timeTab === 'to' && s.tabActive]}
                onPress={() => setTimeTab('to')}
              >
                <Text style={[s.tabTxt, timeTab === 'to' && s.tabTxtActive]}>To</Text>
                <Text style={[s.tabSub, timeTab === 'to' && { color: theme.primary }]}>
                  {fmtTime(toTime)}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={s.pickerCard}>
              {timeTab === 'from'
                ? <TimePicker value={fromTime} onChange={setFromTime} theme={theme} />
                : <TimePicker value={toTime}   onChange={setToTime}   theme={theme} />
              }
            </View>
          </View>

          {/* Summary */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTxt}>
              {fmtDate(fromDate)} {fmtTime(fromTime)}
              {'  →  '}
              {fmtDate(toDate)} {fmtTime(toTime)}
            </Text>
            {simId !== null && (
              <Text style={[s.summaryTxt, { marginTop: 4, opacity: 0.8 }]}>
                SIM: {simLabels[simId] || simId}
              </Text>
            )}
          </View>

        </ScrollView>

        {/* Apply button */}
        <View style={s.footer}>
          <TouchableOpacity style={s.applyBtn} onPress={handleApply} activeOpacity={0.85}>
            <Check size={18} stroke="#fff" />
            <Text style={s.applyTxt}>Apply Filter</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (theme: any) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.92,
    ...theme.shadowStrong,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  title:      { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.surfaceVariant },
  resetTxt:   { fontSize: 13, fontWeight: '600', color: theme.primary },
  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  body:       { paddingHorizontal: 20, paddingBottom: 16 },
  section:    { marginTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textTertiary, letterSpacing: 1, marginBottom: 10 },

  // Call type chips
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.surface,
    borderWidth: 1.5, borderColor: theme.border,
  },
  chipTxt:       { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  chipTxtActive: { color: '#fff' },

  // Presets
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: theme.radius.full,
    backgroundColor: theme.surfaceVariant,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  presetBtnActive: { borderColor: theme.primary, backgroundColor: theme.primaryContainer },
  presetTxt:       { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  presetTxtActive: { color: theme.primary },

  // From/To tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  tabActive: { backgroundColor: theme.surface, ...theme.shadow },
  tabTxt:    { fontSize: 12, fontWeight: '600', color: theme.textTertiary },
  tabTxtActive: { color: theme.primary },
  tabSub:    { fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginTop: 2 },
  tabDivider:{ width: 1, backgroundColor: theme.border, marginVertical: 8 },

  // Picker card
  pickerCard: {
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.radius.lg,
    padding: 16,
    alignItems: 'center',
  },

  // Summary
  summaryCard: {
    marginTop: 16,
    backgroundColor: theme.primaryContainer,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
  },
  summaryTxt: { fontSize: 13, fontWeight: '600', color: theme.primary, textAlign: 'center' },

  // Footer
  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: theme.divider,
  },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: theme.primary,
    borderRadius: theme.radius.lg, height: 54,
    ...theme.shadowStrong,
  },
  applyTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
