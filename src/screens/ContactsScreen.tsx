import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users, ChevronRight, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  SlidersHorizontal, Search,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import DateTimeFilterSheet, {
  DateTimeFilter, callMatchesFilter, filterSummaryLabel, buildPresetDates,
} from '../components/DateTimeFilterSheet';
import ContactDetailScreen from './ContactDetailScreen';
import { ContactsSkeleton } from '../components/SkeletonLoader';
import { haptics } from '../lib/haptics';

function contactsDefaultFilter(): DateTimeFilter {
  const { from, to } = buildPresetDates('30d');
  return {
    preset: '30d', fromDate: from, toDate: to,
    fromTime: { h: 0, m: 0 }, toTime: { h: 23, m: 59 },
    callType: 'all', simId: null,
  };
}

interface AggContact {
  contact_number: string;
  contact_name:   string | null;
  total_calls:    number;
  incoming_calls: number;
  outgoing_calls: number;
  missed_calls:   number;
  total_duration: number;
  last_call:      string;
}

export default function ContactsScreen() {
  const { theme } = useTheme();
  const AVATAR_COLORS = [theme.primary, theme.accent, theme.success, theme.warning, '#8B5CF6', '#EC4899'];

  const [allCalls, setAllCalls]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<DateTimeFilter>(contactsDefaultFilter());
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ number: string; name: string | null } | null>(null);

  const loadData = useCallback(async () => {
    const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
    if (!id) { setLoading(false); return; }
    try {
      const since = new Date(); since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from('call_logs')
        .select('contact_number, contact_name, call_type, duration_sec, called_at, sim_id')
        .eq('caller_id', id)
        .gte('called_at', since.toISOString())
        .order('called_at', { ascending: false });
      if (!error && data) setAllCalls(data);
    } catch (e) {
      console.error('[Contacts] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate filtered calls into per-contact stats
  const contacts = useMemo((): AggContact[] => {
    const filtered = allCalls.filter(c => callMatchesFilter(c, filter));
    const map: Record<string, AggContact> = {};
    filtered.forEach(c => {
      const key = c.contact_number;
      if (!map[key]) {
        map[key] = {
          contact_number: c.contact_number,
          contact_name:   c.contact_name,
          total_calls: 0, incoming_calls: 0, outgoing_calls: 0,
          missed_calls: 0, total_duration: 0, last_call: c.called_at,
        };
      }
      const r = map[key];
      r.total_calls++;
      r.total_duration += c.duration_sec ?? 0;
      if (c.call_type === 'incoming')                                    r.incoming_calls++;
      else if (c.call_type === 'outgoing')                               r.outgoing_calls++;
      else if (c.call_type === 'missed' || c.call_type === 'rejected')   r.missed_calls++;
      if (new Date(c.called_at) > new Date(r.last_call))                 r.last_call = c.called_at;
      if (!r.contact_name && c.contact_name)                             r.contact_name = c.contact_name;
    });
    return Object.values(map).sort((a, b) => b.total_calls - a.total_calls);
  }, [allCalls, filter]);

  // Apply search on top of aggregated contacts
  const visibleContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(c =>
      (c.contact_name ?? '').toLowerCase().includes(q) ||
      c.contact_number.includes(q)
    );
  }, [contacts, searchQuery]);

  const maxCalls = useMemo(() =>
    Math.max(...visibleContacts.map(c => c.total_calls), 1),
  [visibleContacts]);

  const isFilterActive = filter.preset !== '30d' || filter.callType !== 'all';
  const cs = makeStyles(theme);

  // ── Contact detail overlay ───────────────────────────────────────────────
  if (selectedContact) {
    return (
      <ContactDetailScreen
        contactNumber={selectedContact.number}
        contactName={selectedContact.name}
        onBack={() => setSelectedContact(null)}
      />
    );
  }

  const renderItem = ({ item, index }: { item: AggContact; index: number }) => {
    const initial     = (item.contact_name || item.contact_number || '?')[0].toUpperCase();
    const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const strength    = Math.round((item.total_calls / maxCalls) * 100);
    const lastCallDate = new Date(item.last_call).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
    });

    return (
      <TouchableOpacity
        style={cs.card}
        activeOpacity={0.7}
        onPress={() => {
          haptics.light();
          setSelectedContact({ number: item.contact_number, name: item.contact_name });
        }}
      >
        <View style={[cs.avatar, { backgroundColor: avatarColor + '22' }]}>
          <Text style={[cs.avatarText, { color: avatarColor }]}>{initial}</Text>
        </View>
        <View style={cs.info}>
          <Text style={cs.name} numberOfLines={1}>
            {item.contact_name || item.contact_number}
          </Text>
          {item.contact_name ? (
            <Text style={cs.number}>{item.contact_number}</Text>
          ) : null}
          <View style={cs.barRow}>
            <View style={cs.barBg}>
              <View style={[cs.bar, { width: `${strength}%` as any, backgroundColor: avatarColor }]} />
            </View>
            <Text style={[cs.barLabel, { color: avatarColor }]}>{item.total_calls} calls</Text>
          </View>
          <Text style={cs.lastCall}>Last: {lastCallDate}</Text>
        </View>
        <View style={cs.statsCol}>
          <View style={cs.miniStat}>
            <PhoneIncoming size={11} stroke={theme.success} />
            <Text style={cs.miniStatTxt}>{item.incoming_calls}</Text>
          </View>
          <View style={cs.miniStat}>
            <PhoneOutgoing size={11} stroke={theme.primary} />
            <Text style={cs.miniStatTxt}>{item.outgoing_calls}</Text>
          </View>
          {item.missed_calls > 0 && (
            <View style={cs.miniStat}>
              <PhoneMissed size={11} stroke={theme.error} />
              <Text style={[cs.miniStatTxt, { color: theme.error }]}>{item.missed_calls}</Text>
            </View>
          )}
        </View>
        <ChevronRight size={16} stroke={theme.textTertiary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={cs.container}>
        <View style={cs.header}>
          <Text style={cs.title}>Contacts</Text>
        </View>
        <ContactsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={cs.container}>
      {/* Header */}
      <View style={cs.header}>
        <View>
          <Text style={cs.title}>Contacts</Text>
          <Text style={cs.subtitle}>{contacts.length} people reached</Text>
        </View>
        <TouchableOpacity
          style={[cs.filterBtn, isFilterActive && cs.filterBtnActive]}
          onPress={() => { haptics.light(); setShowFilter(true); }}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={15} stroke={isFilterActive ? '#fff' : theme.primary} />
          <Text style={[cs.filterBtnTxt, isFilterActive && { color: '#fff' }]}>
            {filterSummaryLabel(filter)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={cs.searchWrap}>
        <View style={cs.searchBar}>
          <Search size={17} stroke={theme.textTertiary} />
          <TextInput
            style={cs.searchInput}
            placeholder="Search name or number…"
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={cs.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={visibleContacts}
        renderItem={renderItem}
        keyExtractor={item => item.contact_number}
        contentContainerStyle={cs.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
            colors={[theme.primary]} tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={cs.empty}>
            <Users size={40} stroke={theme.textTertiary} />
            <Text style={cs.emptyTxt}>
              {allCalls.length === 0
                ? 'No contacts yet'
                : searchQuery
                ? `No results for "${searchQuery}"`
                : 'No contacts in this period'}
            </Text>
            <Text style={cs.emptyHint}>
              {allCalls.length === 0
                ? 'Call logs will appear here after syncing'
                : searchQuery
                ? 'Try a different name or number'
                : 'Try a wider date range'}
            </Text>
            {(allCalls.length > 0 && !searchQuery) && (
              <TouchableOpacity
                onPress={() => setFilter(contactsDefaultFilter())}
                style={cs.clearFilterBtn}
              >
                <Text style={cs.clearFilterTxt}>Reset filter</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

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
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title:    { fontSize: 26, fontWeight: '800', color: theme.textPrimary },
  subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
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
  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, paddingHorizontal: 14,
    borderRadius: theme.radius.md, height: 46,
    borderWidth: 1, borderColor: theme.border, gap: 10,
  },
  searchInput: { flex: 1, color: theme.textPrimary, fontSize: 15 },
  clearBtn:    { fontSize: 14, color: theme.textTertiary, paddingHorizontal: 4 },
  list:     { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: theme.radius.lg,
    padding: 14, ...theme.shadow,
  },
  avatar:     { width: 50, height: 50, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700' },
  info:       { flex: 1, marginLeft: 12 },
  name:       { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  number:     { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  barBg:      { flex: 1, height: 4, backgroundColor: theme.border, borderRadius: 2 },
  bar:        { height: '100%', borderRadius: 2 },
  barLabel:   { fontSize: 11, fontWeight: '600' },
  lastCall:   { fontSize: 11, color: theme.textTertiary, marginTop: 3 },
  statsCol:   { alignItems: 'flex-end', gap: 4, marginRight: 8 },
  miniStat:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatTxt:{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
  loadingWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { fontSize: 15, color: theme.textSecondary },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 8 },
  emptyTxt:   { fontSize: 17, fontWeight: '600', color: theme.textSecondary },
  emptyHint:  { fontSize: 13, color: theme.textTertiary, textAlign: 'center' },
  clearFilterBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: theme.primaryContainer, borderRadius: theme.radius.full,
  },
  clearFilterTxt: { fontSize: 13, fontWeight: '700', color: theme.primary },
});
