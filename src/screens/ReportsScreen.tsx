import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Dimensions, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import {
  Calendar, TrendingUp, Clock, Award, SlidersHorizontal,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Zap, Users, BarChart2, Activity,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { statsService } from '../services/statsService';
import { useTheme } from '../context/ThemeContext';
import DateTimeFilterSheet, {
  DateTimeFilter, callMatchesFilter, filterSummaryLabel, buildPresetDates,
} from '../components/DateTimeFilterSheet';
import { ReportsSkeleton } from '../components/SkeletonLoader';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80; // card padding (20) * 2 + inner padding (20) * 2

function reportsDefaultFilter(): DateTimeFilter {
  const { from, to } = buildPresetDates('30d');
  return {
    preset: '30d', fromDate: from, toDate: to,
    fromTime: { h: 0, m: 0 }, toTime: { h: 23, m: 59 },
    callType: 'all', simId: null,
  };
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtHour(h: number): string {
  if (h === 0)  return '12am';
  if (h < 12)  return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { theme } = useTheme();
  const [allCalls, setAllCalls]         = useState<any[]>([]);
  const [topContacts, setTopContacts]   = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filter, setFilter]             = useState<DateTimeFilter>(reportsDefaultFilter());
  const [showFilter, setShowFilter]     = useState(false);

  const loadData = useCallback(async () => {
    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (!id) { setLoading(false); return; }
    try {
      const since = new Date(); since.setDate(since.getDate() - 90);
      const [callsRes, contactsRes] = await Promise.all([
        supabase
          .from('call_logs')
          .select('called_at, call_type, duration_sec, sim_id, contact_number, contact_name')
          .eq('caller_id', id)
          .gte('called_at', since.toISOString())
          .order('called_at', { ascending: true }),
        statsService.getContactInteractions(id, 5),
      ]);
      if (!callsRes.error && callsRes.data) setAllCalls(callsRes.data);
      if (contactsRes) setTopContacts(contactsRes);
    } catch (e) {
      console.error('[Reports] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filtered = useMemo(() =>
    allCalls.filter(c => callMatchesFilter(c, filter)),
  [allCalls, filter]);

  // ── Per-type counts ──────────────────────────────────────────────────────
  const typeCounts = useMemo(() => {
    const counts = { incoming: 0, outgoing: 0, missed: 0, rejected: 0, spam: 0 };
    filtered.forEach(c => {
      const t = c.call_type as keyof typeof counts;
      if (t in counts) counts[t]++;
    });
    return counts;
  }, [filtered]);

  const totalConnected = typeCounts.incoming + typeCounts.outgoing;
  const totalNotAnswered = typeCounts.missed + typeCounts.rejected + typeCounts.spam;
  const totalCalls = filtered.length;

  // ── Duration stats ───────────────────────────────────────────────────────
  const durationStats = useMemo(() => {
    const connected = filtered.filter(c => c.duration_sec > 0);
    const total = filtered.reduce((a, c) => a + (c.duration_sec ?? 0), 0);
    const avg = connected.length > 0 ? Math.round(total / connected.length) : 0;
    const max = connected.length > 0 ? Math.max(...connected.map((c: any) => c.duration_sec)) : 0;
    return { total, avg, max, connectedCount: connected.length };
  }, [filtered]);

  // ── Daily trend for line chart ───────────────────────────────────────────
  const trends = useMemo(() => {
    const map: Record<string, { incoming: number; outgoing: number; missed: number; rejected: number }> = {};
    filtered.forEach(c => {
      const day = new Date(c.called_at).toISOString().slice(0, 10);
      if (!map[day]) map[day] = { incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
      const t = c.call_type as keyof typeof map[string];
      if (t in map[day]) map[day][t]++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));
  }, [filtered]);

  // ── Hourly distribution ──────────────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    filtered.forEach(c => {
      const h = new Date(c.called_at).getHours();
      hours[h].count++;
    });
    return hours;
  }, [filtered]);

  const peakHour = useMemo(() => {
    if (!filtered.length) return null;
    return hourlyData.reduce((a, b) => a.count > b.count ? a : b);
  }, [hourlyData, filtered.length]);

  // ── Bar chart data for call type breakdown ───────────────────────────────
  const typeBarData = useMemo(() => [
    { value: typeCounts.incoming, label: 'In',       frontColor: theme.success,  gradientColor: theme.successContainer },
    { value: typeCounts.outgoing, label: 'Out',      frontColor: theme.primary,  gradientColor: theme.primaryContainer },
    { value: typeCounts.missed,   label: 'Missed',   frontColor: theme.warning,  gradientColor: theme.warningContainer },
    { value: typeCounts.rejected, label: 'Rejected', frontColor: theme.error,    gradientColor: theme.errorContainer },
    { value: typeCounts.spam,     label: 'Spam',     frontColor: theme.textTertiary, gradientColor: theme.surfaceVariant ?? theme.surface },
  ], [typeCounts, theme]);

  // ── Hourly bar chart data (group into 2-hour slots for readability) ──────
  const hourlyBarData = useMemo(() => {
    const slots: { label: string; value: number }[] = [];
    for (let i = 0; i < 24; i += 2) {
      // Label shows the start hour only — e.g. "9am" means 9–11am
      slots.push({
        label: fmtHour(i),
        value: hourlyData[i].count + (hourlyData[i + 1]?.count ?? 0),
      });
    }
    return slots.map(s => ({
      ...s,
      frontColor: theme.accent,
      gradientColor: theme.accentContainer,
    }));
  }, [hourlyData, theme]);

  // ── Line chart data ──────────────────────────────────────────────────────
  const lineDataIn  = useMemo(() => trends.map(t => ({ value: t.incoming })), [trends]);
  const lineDataOut = useMemo(() => trends.map(t => ({ value: t.outgoing })), [trends]);

  const chartSpacing = useMemo(() => {
    if (trends.length <= 1) return 40;
    return Math.max(Math.floor(CHART_WIDTH / trends.length), 14);
  }, [trends.length]);

  // ── Insights ─────────────────────────────────────────────────────────────
  const bestDay = useMemo(() => {
    if (!trends.length) return '—';
    const best = trends.reduce((a, b) =>
      (a.incoming + a.outgoing) > (b.incoming + b.outgoing) ? a : b);
    return new Date(best.day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }, [trends]);

  const avgPerDay = useMemo(() => {
    const days = trends.length || 1;
    return Math.round(totalConnected / days);
  }, [totalConnected, trends.length]);

  const connectionRate = useMemo(() => {
    if (!totalCalls) return '—';
    return `${Math.round((totalConnected / totalCalls) * 100)}%`;
  }, [totalConnected, totalCalls]);

  const rejectionRate = useMemo(() => {
    if (!totalCalls) return '—';
    return `${Math.round((typeCounts.rejected / totalCalls) * 100)}%`;
  }, [typeCounts.rejected, totalCalls]);

  // ── Top contacts — from RPC (server-side, handles large datasets) ────────
  // topContacts state is loaded in loadData via statsService.getContactInteractions

  const isFilterActive = filter.preset !== '30d' || filter.callType !== 'all';
  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[theme.primary]} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Reports</Text>
          <TouchableOpacity
            style={[s.filterBtn, isFilterActive && s.filterBtnActive]}
            onPress={() => setShowFilter(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={15} stroke={isFilterActive ? '#fff' : theme.primary} />
            <Text style={[s.filterBtnTxt, isFilterActive && { color: '#fff' }]}>
              {filterSummaryLabel(filter)}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ReportsSkeleton />
        ) : (
          <>
            {/* ── Call type breakdown grid ── */}
            <Text style={s.sectionLabel}>CALL BREAKDOWN</Text>
            <View style={s.typeGrid}>
              <TypeCard label="Incoming"  value={typeCounts.incoming}  color={theme.success}      bg={theme.successContainer}  icon={<PhoneIncoming  size={16} stroke={theme.success} />}      theme={theme} />
              <TypeCard label="Outgoing"  value={typeCounts.outgoing}  color={theme.primary}      bg={theme.primaryContainer}  icon={<PhoneOutgoing  size={16} stroke={theme.primary} />}      theme={theme} />
              <TypeCard label="Missed"    value={typeCounts.missed}    color={theme.warning}      bg={theme.warningContainer}  icon={<PhoneMissed    size={16} stroke={theme.warning} />}      theme={theme} />
              <TypeCard label="Rejected"  value={typeCounts.rejected}  color={theme.error}        bg={theme.errorContainer}    icon={<PhoneOff       size={16} stroke={theme.error} />}        theme={theme} />
              <TypeCard label="Connected" value={totalConnected}       color={theme.accent}       bg={theme.accentContainer}   icon={<Zap            size={16} stroke={theme.accent} />}       theme={theme} wide />
              <TypeCard label="Spam/Blocked" value={typeCounts.spam}  color={theme.textSecondary} bg={theme.surfaceVariant ?? theme.surface} icon={<PhoneOff size={16} stroke={theme.textSecondary} />} theme={theme} wide />
            </View>

            {/* ── Duration stats ── */}
            <Text style={s.sectionLabel}>TALK TIME</Text>
            <View style={s.durationRow}>
              <DurationTile label="Total"   value={fmtDuration(durationStats.total)} color={theme.accent}   theme={theme} />
              <DurationTile label="Avg/Call" value={fmtDuration(durationStats.avg)}  color={theme.primary}  theme={theme} />
              <DurationTile label="Longest"  value={fmtDuration(durationStats.max)}  color={theme.success}  theme={theme} />
            </View>

            {/* ── Call type bar chart ── */}
            <Text style={s.sectionLabel}>VOLUME BY TYPE</Text>
            <View style={s.card}>
              {totalCalls > 0 ? (
                <View style={s.chartWrap}>
                  <BarChart
                    data={typeBarData}
                    barWidth={36}
                    spacing={16}
                    noOfSections={4}
                    barBorderRadius={8}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor={theme.border}
                    hideRules
                    yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    width={CHART_WIDTH}
                    isAnimated
                    showGradient
                    gradientColor={theme.primaryContainer}
                  />
                </View>
              ) : (
                <EmptyChart theme={theme} />
              )}
            </View>

            {/* ── Daily trend line chart ── */}
            <Text style={s.sectionLabel}>DAILY TREND</Text>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.legendRow}>
                  <LegendDot color={theme.success} label="Incoming" theme={theme} />
                  <LegendDot color={theme.primary} label="Outgoing" theme={theme} />
                </View>
              </View>
              {lineDataIn.length > 0 ? (
                <View style={s.chartWrap}>
                  <LineChart
                    data={lineDataIn}
                    data2={lineDataOut}
                    height={160}
                    width={CHART_WIDTH}
                    initialSpacing={6}
                    spacing={chartSpacing}
                    color1={theme.success}
                    color2={theme.primary}
                    thickness={2.5}
                    dataPointsColor1={theme.success}
                    dataPointsColor2={theme.primary}
                    dataPointsRadius={3}
                    noOfSections={4}
                    yAxisColor={theme.border}
                    xAxisColor={theme.border}
                    yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9 }}
                    hideRules
                    curved
                    areaChart
                    startFillColor1={theme.success}  endFillColor1={theme.surface}  startOpacity1={0.2}  endOpacity1={0}
                    startFillColor2={theme.primary}  endFillColor2={theme.surface}  startOpacity2={0.15} endOpacity2={0}
                    isAnimated
                  />
                </View>
              ) : (
                <EmptyChart theme={theme} />
              )}
            </View>

            {/* ── Hourly distribution ── */}
            <Text style={s.sectionLabel}>HOURLY ACTIVITY</Text>
            <View style={s.card}>
              {totalCalls > 0 ? (
                <View style={s.chartWrap}>
                  <BarChart
                    data={hourlyBarData}
                    barWidth={18}
                    spacing={8}
                    noOfSections={3}
                    barBorderRadius={4}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor={theme.border}
                    hideRules
                    yAxisTextStyle={{ color: theme.textTertiary, fontSize: 9 }}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 9 }}
                    width={CHART_WIDTH}
                    isAnimated
                    showGradient
                    gradientColor={theme.accentContainer}
                  />
                </View>
              ) : (
                <EmptyChart theme={theme} />
              )}
            </View>

            {/* ── Insights ── */}
            <Text style={s.sectionLabel}>INSIGHTS</Text>
            <View style={s.card}>
              <InsightRow icon={<Calendar size={18} stroke={theme.primary} />}   label="Best day to call"    value={bestDay}          theme={theme} />
              <InsightRow icon={<Activity size={18} stroke={theme.accent} />}    label="Peak hour"           value={peakHour ? `${fmtHour(peakHour.hour)} (${peakHour.count} calls)` : '—'} theme={theme} />
              <InsightRow icon={<TrendingUp size={18} stroke={theme.success} />} label="Avg calls / day"     value={`${avgPerDay}`}   theme={theme} />
              <InsightRow icon={<Zap size={18} stroke={theme.warning} />}        label="Connection rate"     value={connectionRate}   theme={theme} />
              <InsightRow icon={<PhoneOff size={18} stroke={theme.error} />}     label="Rejection rate"      value={rejectionRate}    theme={theme} />
              <InsightRow icon={<Users size={18} stroke={theme.accent} />}       label="Total calls tracked" value={`${totalCalls}`}  theme={theme} last />
            </View>

            {/* ── Top contacts ── */}
            {topContacts.length > 0 && (
              <>
                <Text style={s.sectionLabel}>TOP CONTACTS</Text>
                <View style={s.card}>
                  {topContacts.map((c, i) => {
                    // RPC shape: contact_name, contact_number, total_calls, total_duration
                    const displayName = c.contact_name ?? c.contact_number;
                    const initial = displayName[0].toUpperCase();
                    return (
                      <View key={c.contact_number} style={[s.contactRow, i < topContacts.length - 1 && s.rowBorder]}>
                        <View style={[s.contactAvatar, { backgroundColor: theme.primaryContainer }]}>
                          <Text style={[s.contactAvatarTxt, { color: theme.primary }]}>{initial}</Text>
                        </View>
                        <View style={s.contactInfo}>
                          <Text style={s.contactName} numberOfLines={1}>{displayName}</Text>
                          {c.contact_name && (
                            <Text style={s.contactNumber} numberOfLines={1}>{c.contact_number}</Text>
                          )}
                        </View>
                        <View style={s.contactStats}>
                          <Text style={[s.contactCallCount, { color: theme.primary }]}>
                            {c.total_calls} calls
                          </Text>
                          <Text style={s.contactDuration}>{fmtDuration(c.total_duration)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <DateTimeFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={setFilter}
        currentFilter={filter}
        showTypeFilter
        showSimFilter
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TypeCard = React.memo(function TypeCard({
  label, value, color, bg, icon, theme, wide,
}: {
  label: string; value: number; color: string; bg: string;
  icon: React.ReactNode; theme: any; wide?: boolean;
}) {
  const s = makeStyles(theme);
  return (
    <View style={[s.typeCard, wide && s.typeCardWide, theme.shadow]}>
      <View style={[s.typeIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[s.typeVal, { color }]}>{value}</Text>
      <Text style={s.typeLabel}>{label}</Text>
    </View>
  );
});

const DurationTile = React.memo(function DurationTile({
  label, value, color, theme,
}: { label: string; value: string; color: string; theme: any }) {
  const s = makeStyles(theme);
  return (
    <View style={[s.durationTile, theme.shadow]}>
      <Text style={[s.durationVal, { color }]}>{value}</Text>
      <Text style={s.durationLabel}>{label}</Text>
    </View>
  );
});

const InsightRow = React.memo(function InsightRow({
  icon, label, value, theme, last,
}: { icon: React.ReactNode; label: string; value: string; theme: any; last?: boolean }) {
  const s = makeStyles(theme);
  return (
    <View style={[s.insightRow, last && { borderBottomWidth: 0 }]}>
      {icon}
      <View style={s.insightText}>
        <Text style={s.insightLabel}>{label}</Text>
        <Text style={s.insightValue}>{value}</Text>
      </View>
    </View>
  );
});

const LegendDot = React.memo(function LegendDot({
  color, label, theme,
}: { color: string; label: string; theme: any }) {
  const s = makeStyles(theme);
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.legendTxt}>{label}</Text>
    </View>
  );
});

const EmptyChart = React.memo(function EmptyChart({ theme }: { theme: any }) {
  const s = makeStyles(theme);
  return (
    <View style={s.emptyChart}>
      <BarChart2 size={28} stroke={theme.textTertiary} />
      <Text style={s.emptyTxt}>No data for this period</Text>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (theme: any) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.bg },
  scroll:      { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title:       { fontSize: 26, fontWeight: '800', color: theme.textPrimary },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.primaryContainer,
    borderWidth: 1.5, borderColor: theme.primary,
    maxWidth: 180,
  },
  filterBtnActive: { backgroundColor: theme.primary },
  filterBtnTxt:    { fontSize: 12, fontWeight: '700', color: theme.primary },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: theme.textTertiary,
    letterSpacing: 1, marginBottom: 10, marginLeft: 2,
  },

  loadingWrap: { paddingTop: 80, alignItems: 'center', gap: 12 },
  loadingTxt:  { fontSize: 15, color: theme.textSecondary },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: {
    width: (width - 50) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 14, alignItems: 'flex-start',
  },
  typeCardWide: { width: (width - 50) / 2 },
  typeIcon:  { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  typeVal:   { fontSize: 22, fontWeight: '800' },
  typeLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 2, fontWeight: '600' },

  // Duration row
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  durationTile: {
    flex: 1, backgroundColor: theme.surface,
    borderRadius: theme.radius.lg, padding: 14, alignItems: 'center',
  },
  durationVal:   { fontSize: 16, fontWeight: '800' },
  durationLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 3, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.lg,
    padding: 16, marginBottom: 20, ...theme.shadow,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },

  // Chart wrapper — clips overflow so chart never bleeds outside card
  chartWrap: { overflow: 'hidden' },

  legendRow:  { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 12, color: theme.textSecondary },

  emptyChart: { height: 100, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTxt:   { color: theme.textTertiary, textAlign: 'center', fontSize: 13 },

  // Insights
  insightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  insightText:  { flex: 1 },
  insightLabel: { fontSize: 12, color: theme.textSecondary },
  insightValue: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginTop: 1 },

  // Top contacts
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
  },
  rowBorder:       { borderBottomWidth: 1, borderBottomColor: theme.divider },
  contactAvatar:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  contactAvatarTxt:{ fontSize: 16, fontWeight: '700' },
  contactInfo:     { flex: 1 },
  contactName:     { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  contactNumber:   { fontSize: 11, color: theme.textTertiary, marginTop: 1 },
  contactStats:    { alignItems: 'flex-end' },
  contactCallCount:{ fontSize: 13, fontWeight: '700' },
  contactDuration: { fontSize: 11, color: theme.textTertiary, marginTop: 1 },
});
