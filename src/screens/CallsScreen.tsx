import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  ShieldAlert, SlidersHorizontal,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { runSync } from '../services/syncService';
import DateTimeFilterSheet, {
  DateTimeFilter, defaultFilter, callMatchesFilter, filterSummaryLabel,
} from '../components/DateTimeFilterSheet';
import { useTheme } from '../context/ThemeContext';
import { CallsSkeleton } from '../components/SkeletonLoader';
import { haptics } from '../lib/haptics';

const PAGE_SIZE = 100;

export default function CallsScreen() {
  const { theme } = useTheme();
  const [calls, setCalls]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter]           = useState<DateTimeFilter>(defaultFilter());
  const [showFilter, setShowFilter]   = useState(false);
  const pageRef = useRef(0);

  const loadCalls = useCallback(async (reset = true) => {
    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (!id) { setLoading(false); return; }

    const page = reset ? 0 : pageRef.current;
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('call_logs')
      .select('id, caller_id, contact_number, contact_name, call_type, duration_sec, called_at, sim_id')
      .eq('caller_id', id)
      .order('called_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      if (reset) {
        setCalls(data);
        pageRef.current = 1;
      } else {
        setCalls(prev => [...prev, ...data]);
        pageRef.current = page + 1;
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadCalls(false);
  }, [loadCalls, loadingMore, hasMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.medium();
    await runSync();
    await loadCalls(true);
    setRefreshing(false);
  }, [loadCalls]);

  useEffect(() => { loadCalls(true); }, [loadCalls]);

  const filteredCalls = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return calls.filter(c => {
      if (!callMatchesFilter(c, filter)) return false;
      if (q &&
        !(c.contact_name || '').toLowerCase().includes(q) &&
        !(c.contact_number || '').includes(q)) return false;
      return true;
    });
  }, [calls, filter, searchQuery]);

  const sections = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const today     = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    filteredCalls.forEach(c => {
      const d = new Date(c.called_at);
      let key: string;
      if (d.toDateString() === today.toDateString())          key = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday';
      else key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return Object.entries(grouped);
  }, [filteredCalls]);

  const isFilterActive = useMemo(() =>
    filter.preset !== 'today' || filter.callType !== 'all' ||
    filter.fromTime.h !== 0 || filter.fromTime.m !== 0 ||
    filter.toTime.h !== 23 || filter.toTime.m !== 59,
  [filter]);

  const s = makeStyles(theme);

  const renderCallItem = useCallback((item: any) => {
    const time = new Date(item.called_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const type: string = item.call_type ?? '';
    const isIn   = type === 'incoming';
    const isOut  = type === 'outgoing';
    const isMis  = type === 'missed';
    const isSpam = type === 'spam' || type === 'rejected';

    const icon = isIn
      ? { Icon: PhoneIncoming, color: theme.success, bg: theme.successContainer }
      : isOut
      ? { Icon: PhoneOutgoing, color: theme.primary, bg: theme.primaryContainer }
      : isSpam
      ? { Icon: ShieldAlert,   color: theme.warning, bg: theme.warningContainer }
      : { Icon: PhoneMissed,   color: theme.error,   bg: theme.errorContainer };

    const dur = item.duration_sec > 0
      ? `${Math.floor(item.duration_sec / 60)}m ${item.duration_sec % 60}s`
      : isMis ? 'Missed' : isSpam ? 'Spam/Blocked' : 'No answer';

    const typeLabel = isIn ? 'Incoming' : isOut ? 'Outgoing' : isSpam ? 'Spam' : 'Missed';

    return (
      <TouchableOpacity key={item.id} style={s.callItem} activeOpacity={0.7}>
        <View style={[s.iconCircle, { backgroundColor: icon.bg }]}>
          <icon.Icon stroke={icon.color} size={19} />
        </View>
        <View style={s.callDetails}>
          <Text style={s.contactName} numberOfLines={1}>
            {item.contact_name || item.contact_number}
          </Text>
          {item.contact_name ? (
            <Text style={s.contactNumber}>{item.contact_number}</Text>
          ) : null}
          <Text style={[s.typeTag, { color: icon.color }]}>{typeLabel}</Text>
        </View>
        <View style={s.callMeta}>
          <Text style={s.callTime}>{time}</Text>
          <Text style={[s.callDuration, (isMis || isSpam) && { color: icon.color }]}>{dur}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [theme, s]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Call Log</Text>
        </View>
        <CallsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Call Log</Text>
        <View style={s.headerRight}>
          <Text style={s.countBadge}>{filteredCalls.length}</Text>
          <TouchableOpacity
            style={[s.filterBtn, isFilterActive && s.filterBtnActive]}
            onPress={() => { haptics.light(); setShowFilter(true); }}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={16} stroke={isFilterActive ? '#fff' : theme.primary} />
            <Text style={[s.filterBtnTxt, isFilterActive && { color: '#fff' }]}>
              {isFilterActive ? filterSummaryLabel(filter) : 'Filter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search stroke={theme.textTertiary} size={18} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name or number…"
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active filter pill */}
      {isFilterActive && (
        <View style={s.activePillRow}>
          <View style={s.activePill}>
            <Text style={s.activePillTxt}>{filterSummaryLabel(filter)}</Text>
            <TouchableOpacity
              onPress={() => setFilter(defaultFilter())}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.activePillX}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* List */}
      {sections.length === 0 ? (
        <View style={s.empty}>
          <PhoneMissed size={40} stroke={theme.textTertiary} />
          <Text style={s.emptyTxt}>
            {calls.length === 0 ? 'No calls synced yet' : 'No calls match your filter'}
          </Text>
          {calls.length === 0
            ? <Text style={s.emptyHint}>Pull down to sync your call logs</Text>
            : (
              <TouchableOpacity onPress={() => setFilter(defaultFilter())} style={s.clearFilterBtn}>
                <Text style={s.clearFilterTxt}>Clear filter</Text>
              </TouchableOpacity>
            )
          }
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([key]) => key}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing} onRefresh={onRefresh}
              colors={[theme.primary]} tintColor={theme.primary}
            />
          }
          renderItem={({ item: [dateLabel, items] }) => (
            <View>
              <Text style={s.dateLabel}>{dateLabel}</Text>
              <View style={s.group}>{items.map(renderCallItem)}</View>
            </View>
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={s.loadMoreWrap}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={s.loadMoreTxt}>Loading more…</Text>
              </View>
            ) : !hasMore && calls.length > 0 ? (
              <Text style={s.endTxt}>All {calls.length} calls loaded</Text>
            ) : null
          }
        />
      )}

      <DateTimeFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={(f) => { haptics.medium(); setFilter(f); }}
        currentFilter={filter}
        showTypeFilter
        showSimFilter
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title:       { fontSize: 26, fontWeight: '800', color: theme.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: theme.primaryContainer, color: theme.primary,
    fontWeight: '700', fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.primaryContainer,
    borderWidth: 1.5, borderColor: theme.primary,
    maxWidth: 160,
  },
  filterBtnActive: { backgroundColor: theme.primary },
  filterBtnTxt:    { fontSize: 12, fontWeight: '700', color: theme.primary },
  searchWrap:  { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, paddingHorizontal: 14,
    borderRadius: theme.radius.md, height: 46,
    borderWidth: 1, borderColor: theme.border, gap: 10,
  },
  searchInput: { flex: 1, color: theme.textPrimary, fontSize: 15 },
  clearBtn:    { fontSize: 14, color: theme.textTertiary, paddingHorizontal: 4 },
  activePillRow: { paddingHorizontal: 20, marginBottom: 8 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primaryContainer,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  activePillTxt: { fontSize: 12, fontWeight: '600', color: theme.primary },
  activePillX:   { fontSize: 12, color: theme.primary, fontWeight: '700' },
  listContent:   { paddingHorizontal: 20, paddingBottom: 30 },
  dateLabel: {
    fontSize: 13, fontWeight: '700', color: theme.textTertiary,
    marginBottom: 8, marginTop: 4, letterSpacing: 0.5,
  },
  group: {
    backgroundColor: theme.surface, borderRadius: theme.radius.lg,
    overflow: 'hidden', marginBottom: 16, ...theme.shadow,
  },
  callItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.divider,
  },
  iconCircle:    { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  callDetails:   { flex: 1, marginLeft: 12 },
  contactName:   { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  contactNumber: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  typeTag:       { fontSize: 11, fontWeight: '600', marginTop: 3 },
  callMeta:      { alignItems: 'flex-end' },
  callTime:      { fontSize: 12, color: theme.textSecondary },
  callDuration:  { fontSize: 11, color: theme.textTertiary, marginTop: 3 },
  loadingWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:    { fontSize: 15, color: theme.textSecondary },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt:      { fontSize: 16, color: theme.textTertiary, fontWeight: '600' },
  emptyHint:     { fontSize: 13, color: theme.textTertiary },
  clearFilterBtn:{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.primaryContainer, borderRadius: theme.radius.full },
  clearFilterTxt:{ fontSize: 13, fontWeight: '700', color: theme.primary },
  loadMoreWrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loadMoreTxt:   { fontSize: 13, color: theme.textSecondary },
  endTxt:        { textAlign: 'center', fontSize: 12, color: theme.textTertiary, paddingVertical: 16 },
});
