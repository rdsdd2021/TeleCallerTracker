import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, Phone, Users, BarChart3, Settings } from 'lucide-react-native';
import DashboardScreen from './screens/DashboardScreen';
import CallsScreen from './screens/CallsScreen';
import ContactsScreen from './screens/ContactsScreen';
import ReportsScreen from './screens/ReportsScreen';
import StatusScreen from './screens/StatusScreen';
import { useTheme } from './context/ThemeContext';
import { Storage, STORAGE_KEYS } from './lib/storage';

const Tab = createBottomTabNavigator();

// ─── Red dot badge ────────────────────────────────────────────────────────────
function SyncErrorDot() {
  const { theme } = useTheme();
  return <View style={[dot.badge, { backgroundColor: theme.error }]} />;
}

const dot = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2, right: -4,
    width: 8, height: 8,
    borderRadius: 4,
  },
});

// ─── Main tabs ────────────────────────────────────────────────────────────────
export default function MainTabs() {
  const { theme } = useTheme();
  const [hasSyncError, setHasSyncError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSyncStatus = async () => {
    const status = await Storage.get(STORAGE_KEYS.SYNC_STATUS);
    setHasSyncError(status === 'error');
  };

  useEffect(() => {
    // Check immediately on mount
    checkSyncStatus();

    // Poll every 30 seconds so the badge appears even while the app is
    // foregrounded and a background sync writes an error to storage.
    pollRef.current = setInterval(checkSyncStatus, 30_000);

    // Also re-check whenever the app returns to the foreground
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') checkSyncStatus();
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard stroke={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Phone stroke={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Users stroke={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BarChart3 stroke={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={StatusScreen}
        listeners={{
          // Clear the badge when the user opens Settings — they'll see the
          // error banner inside the screen and can act on it there.
          tabPress: () => setHasSyncError(false),
        }}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View>
              <Settings stroke={color} size={size} />
              {hasSyncError && <SyncErrorDot />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
