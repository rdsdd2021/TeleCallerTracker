import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Dimensions, TouchableOpacity, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import Svg, { Circle } from 'react-native-svg';
import {
  Phone, Clock, UserCheck, TrendingUp,
  ArrowUp, ArrowDown, RefreshCw, SlidersHorizontal, Flame,
} from 'lucide-react-native';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { statsService, DashboardStats, CallTrend } from '../services/statsService';
import { runSync } from '../services/syncService';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../lib/haptics';
import DateTimeFilterSheet, {
  DateTimeFilter, defaultFilter, filterSummaryLabel,
} from '../components/DateTimeFilterSheet';

const { width } = Dimensions.get('window');

// ─── Animated ring progress ───────────────────────────────────────────────────
function TargetRing({
  current, target, color, size = 110,
}: {
  current: number; target: number; color: string; size?: number;
}) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / Math.max(target, 1), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const pct = Math.round(progress * 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={8}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 }}>
        {current}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>
        {pct}%
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { theme } = useTheme();
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [trends, setTrends]         = useState<CallTrend[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callerName, setCallerName] = useState('');
  const [syncError, setSyncError]   = useState(false);
  const [filter, setFilter]         = useState<DateTimeFilter>(defaultFilter());
  const [showFilter, setShowFilter] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const loadData = useCallback(async () => {
    const name = await Storage.get(STORAGE_KEYS.CALLER_NAME);
    if (name) setCallerName(name);

    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (!id) { setLoading(false); return; }

    try {
      const diffMs   = filter.toDate.getTime() - filter.fromDate.getTime();
      const diffDays = Math.max(1, Math.min(90, Math.ceil(diffMs / 86400000) + 1));

      const [statsRes, trendsRes] = await Promise.all([
        statsService.getDashboardStats(id),
        statsService.getCallTrends(id, diffDays),
      ]);
      if (statsRes)  setStats(statsRes);
      if (trendsRes) setTrends(trendsRes);
      setSyncError(false);
    } catch (e) {
      console.error('[Dashboard] loadData error:', e);
      setSyncError(true);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncError(false);
    haptics.medium();
    try {
      await runSync();
      await loadData();
    } catch {
      setSyncError(true);
      haptics.error();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    loadData().then(() => {
      runSync().then(loadData).catch(() => setSyncError(true));
    });
  }, [loadData]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { value: stats.today.incoming, color: theme.success },
      { value: stats.today.outgoing, color: theme.primary },
      { value: stats.today.missed,   color: theme.error },
    ].filter(d => d.value > 0);
  }, [stats, theme]);

  const barData = useMemo(() =>
    trends.map(t => ({
      value: t.incoming + t.outgoing + (t.missed ?? 0),
      label: t.day.slice(5).replace('-', '/'),
      frontColor: theme.primary,
      gradientColor: theme.primaryLight,
      topLabelComponent: () => (
        <Text style={{ color: theme.textTertiary, fontSize: 9, marginBottom: 2 }}>
          {t.incoming + t.outgoing + (t.missed ?? 0)}
        </Text>
      ),
    })),
  [trends, theme]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayTotal     = stats?.today.total_calls ?? 0;
  const yesterdayTotal = stats?.yesterday_total   ?? 0;
  const diff           = todayTotal - yesterdayTotal;
  const isUp           = diff >= 0;
  const target         = stats?.daily_target ?? 50;
  const streak         = stats?.streak ?? 0;

  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            colors={[theme.primary]} tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.name}>{callerName || 'Telecaller'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.filterBtn, filter.preset !== 'today' && styles.filterBtnActive]}
              onPress={() => { haptics.light(); setShowFilter(true); }}
              activeOpacity={0.7}
            >
              <SlidersHorizontal size={14} stroke={filter.preset !== 'today' ? '#fff' : theme.primary} />
              <Text style={[styles.filterBtnTxt, filter.preset !== 'today' && { color: '#fff' }]}>
                {filterSummaryLabel(filter)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
              <Animated.View style={[styles.syncDot, { transform: [{ scale: pulseAnim }] }]}>
                <RefreshCw size={16} stroke={theme.primary} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {syncError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTxt}>⚠️ Sync failed — pull down to retry</Text>
          </View>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : !stats ? (
          <FirstLaunchEmpty onSync={onRefresh} refreshing={refreshing} theme={styles} themeObj={theme} />
        ) : (
          <>
            {/* ── Hero card: target ring + streak ── */}
            <View style={styles.heroCard}>
              {/* Decorative blobs */}
              <View style={[styles.blob, styles.blob1]} />
              <View style={[styles.blob, styles.blob2]} />

              {/* Left: target ring */}
              <View style={styles.heroLeft}>
                <TargetRing current={todayTotal} target={target} color={theme.primary} />
                <Text style={styles.heroTargetLabel}>of {target} target</Text>
              </View>

              {/* Right: stats */}
              <View style={styles.heroRight}>
                <Text style={styles.heroLabel}>Today's Calls</Text>
                <Text style={styles.heroValue}>{todayTotal}</Text>
                <View style={styles.heroChange}>
                  {isUp
                    ? <ArrowUp size={13} stroke="rgba(255,255,255,0.9)" />
                    : <ArrowDown size={13} stroke="rgba(255,255,255,0.9)" />}
                  <Text style={[styles.heroChangeTxt, { color: isUp ? '#86efac' : '#fca5a5' }]}>
                    {Math.abs(diff)} vs yesterday
                  </Text>
                </View>

                {/* Streak badge */}
                {streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Flame size={13} stroke="#f97316" fill="#f97316" />
                    <Text style={styles.streakTxt}>{streak} day streak</Text>
                  </View>
                )}

                {/* Mini pie */}
                {pieData.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <PieChart
                      data={pieData}
                      donut
                      radius={32}
                      innerRadius={22}
                      showText={false}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* ── Stat cards grid ── */}
            <View style={styles.grid}>
              <StatCard
                label="Duration"
                value={formatDuration(stats?.today.total_duration || 0)}
                icon={<Clock size={18} stroke={theme.accent} />}
                color={theme.accentContainer}
                theme={theme}
              />
              <StatCard
                label="Incoming"
                value={stats?.today.incoming ?? 0}
                icon={<TrendingUp size={18} stroke={theme.success} />}
                color={theme.successContainer}
                theme={theme}
              />
              <StatCard
                label="Outgoing"
                value={stats?.today.outgoing ?? 0}
                icon={<Phone size={18} stroke={theme.primary} />}
                color={theme.primaryContainer}
                theme={theme}
              />
              <StatCard
                label="Unique"
                value={stats?.today.unique_contacts ?? 0}
                icon={<UserCheck size={18} stroke={theme.warning} />}
                color={theme.warningContainer}
                theme={theme}
              />
            </View>

            {/* ── Bar chart ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {filter.preset === 'today' ? '7-Day Activity' : `${trends.length}-Day Activity`}
              </Text>
              {barData.length > 0 ? (
                <View style={{ overflow: 'hidden' }}>
                  <BarChart
                    data={barData}
                    barWidth={Math.min(28, Math.floor((width - 120) / Math.max(barData.length, 1)) - 8)}
                    spacing={Math.min(20, Math.floor((width - 120) / Math.max(barData.length, 1)) - 4)}
                    noOfSections={4}
                    barBorderRadius={6}
                    frontColor={theme.primary}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor={theme.border}
                    hideRules
                    yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: 10 }}
                    width={width - 96}
                    isAnimated
                  />
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={styles.emptyTxt}>No data yet — pull down to sync</Text>
                </View>
              )}
            </View>

            {/* ── Today's breakdown ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's Breakdown</Text>
              <View style={styles.legendRow}>
                {[
                  { label: 'Incoming', color: theme.success, val: stats?.today.incoming ?? 0 },
                  { label: 'Outgoing', color: theme.accent,  val: stats?.today.outgoing ?? 0 },
                  { label: 'Missed',   color: theme.warning, val: stats?.today.missed   ?? 0 },
                  { label: 'Rejected', color: theme.error,   val: stats?.today.rejected ?? 0 },
                ].map((item, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendVal}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <DateTimeFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={(f) => { haptics.medium(); setFilter(f); setLoading(true); }}
        currentFilter={filter}
        showTypeFilter={false}
      />
    </SafeAreaView>
  );
}

// ─── First-launch empty state ─────────────────────────────────────────────────
function FirstLaunchEmpty({
  onSync, refreshing, themeObj,
}: {
  onSync: () => void; refreshing: boolean; theme: any; themeObj: any;
}) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  return (
    <View style={fe.wrap}>
      <Animated.View style={[fe.iconRing, { opacity: pulseAnim, backgroundColor: themeObj.primaryContainer }]}>
        <Phone size={36} stroke={themeObj.primary} />
      </Animated.View>
      <Text style={[fe.title, { color: themeObj.textPrimary }]}>No data yet</Text>
      <Text style={[fe.body, { color: themeObj.textSecondary }]}>
        Your first sync is running in the background.{'\n'}
        Pull down or tap below to sync now.
      </Text>
      <TouchableOpacity
        style={[fe.btn, { backgroundColor: themeObj.primary }]}
        onPress={onSync}
        disabled={refreshing}
        activeOpacity={0.8}
      >
        {refreshing
          ? <ActivityIndicator color="#fff" size="small" />
          : <RefreshCw size={18} stroke="#fff" />}
        <Text style={fe.btnTxt}>{refreshing ? 'Syncing…' : 'Sync Now'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const fe = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 16 },
  iconRing:{ width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  title:   { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body:    { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16, marginTop: 8,
  },
  btnTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const StatCard = React.memo(function StatCard({
  label, value, icon, color, theme,
}: {
  label: string; value: string | number; icon: React.ReactNode; color: string; theme: any;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={[styles.statCard, theme.shadow]}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const makeStyles = (theme: any) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: theme.bg },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 20,
  },
  greeting: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  name:     { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.primaryContainer,
    borderWidth: 1.5, borderColor: theme.primary,
    maxWidth: 140,
  },
  filterBtnActive: { backgroundColor: theme.primary },
  filterBtnTxt:    { fontSize: 11, fontWeight: '700', color: theme.primary },
  syncDot: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: theme.errorContainer,
    borderRadius: theme.radius.md,
    padding: 12, marginBottom: 12, alignItems: 'center',
  },
  errorBannerTxt: { color: theme.error, fontWeight: '600', fontSize: 13 },
  loadingWrap: { paddingTop: 80, alignItems: 'center', gap: 12 },
  loadingTxt:  { fontSize: 15, color: theme.textSecondary },

  // Hero card
  heroCard: {
    backgroundColor: theme.primary,
    borderRadius: theme.radius.xl,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    ...theme.shadowStrong,
  },
  blob:  { position: 'absolute', borderRadius: 999 },
  blob1: { width: 160, height: 160, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30 },
  blob2: { width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -20, left: -10 },

  heroLeft: { alignItems: 'center', marginRight: 20 },
  heroTargetLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', marginTop: 4 },

  heroRight: { flex: 1 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  heroValue: { color: '#fff', fontSize: 44, fontWeight: '800', lineHeight: 50 },
  heroChange: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  heroChangeTxt: { fontSize: 12, fontWeight: '600' },

  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginTop: 8,
  },
  streakTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Stat grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
  },
  statIcon:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 20, marginBottom: 16,
    ...theme.shadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  emptyChart: { height: 80, justifyContent: 'center', alignItems: 'center' },
  emptyTxt:   { color: theme.textTertiary, fontSize: 13 },

  legendRow:  { gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendLabel:{ flex: 1, color: theme.textSecondary, fontSize: 14 },
  legendVal:  { fontWeight: '700', color: theme.textPrimary, fontSize: 14 },
});
