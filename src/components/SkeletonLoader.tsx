import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Single shimmer block ─────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const base = theme.dark ? theme.surfaceVariant : theme.border;

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: base, opacity },
        style,
      ]}
    />
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={sk.container}>
      {/* Hero card */}
      <SkeletonBox height={160} borderRadius={24} style={sk.mb20} />
      {/* 2×2 stat grid */}
      <View style={sk.grid}>
        <SkeletonBox width="48%" height={90} borderRadius={16} />
        <SkeletonBox width="48%" height={90} borderRadius={16} />
        <SkeletonBox width="48%" height={90} borderRadius={16} />
        <SkeletonBox width="48%" height={90} borderRadius={16} />
      </View>
      {/* Bar chart card */}
      <SkeletonBox height={180} borderRadius={20} style={sk.mb16} />
      {/* Breakdown card */}
      <SkeletonBox height={120} borderRadius={20} />
    </View>
  );
}

// ─── Calls skeleton ───────────────────────────────────────────────────────────

export function CallsSkeleton() {
  return (
    <View style={sk.container}>
      <SkeletonBox width={120} height={14} borderRadius={7} style={sk.mb16} />
      <View style={sk.card}>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={[sk.callRow, i < 5 && sk.rowBorder]}>
            <SkeletonBox width={42} height={42} borderRadius={12} />
            <View style={sk.callInfo}>
              <SkeletonBox width="55%" height={14} borderRadius={7} style={sk.mb8} />
              <SkeletonBox width="35%" height={11} borderRadius={6} />
            </View>
            <View style={sk.callMeta}>
              <SkeletonBox width={40} height={11} borderRadius={6} style={sk.mb8} />
              <SkeletonBox width={30} height={10} borderRadius={5} />
            </View>
          </View>
        ))}
      </View>
      <SkeletonBox width={120} height={14} borderRadius={7} style={sk.mb16} />
      <View style={sk.card}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[sk.callRow, i < 3 && sk.rowBorder]}>
            <SkeletonBox width={42} height={42} borderRadius={12} />
            <View style={sk.callInfo}>
              <SkeletonBox width="60%" height={14} borderRadius={7} style={sk.mb8} />
              <SkeletonBox width="40%" height={11} borderRadius={6} />
            </View>
            <View style={sk.callMeta}>
              <SkeletonBox width={40} height={11} borderRadius={6} style={sk.mb8} />
              <SkeletonBox width={30} height={10} borderRadius={5} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Contacts skeleton ────────────────────────────────────────────────────────

export function ContactsSkeleton() {
  return (
    <View style={sk.container}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={[sk.card, sk.contactRow, sk.mb10]}>
          <SkeletonBox width={50} height={50} borderRadius={14} />
          <View style={sk.contactInfo}>
            <SkeletonBox width="50%" height={14} borderRadius={7} style={sk.mb8} />
            <SkeletonBox width="35%" height={11} borderRadius={6} style={sk.mb8} />
            <SkeletonBox width="80%" height={4} borderRadius={2} />
          </View>
          <View style={sk.contactStats}>
            <SkeletonBox width={24} height={11} borderRadius={5} style={sk.mb8} />
            <SkeletonBox width={24} height={11} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Reports skeleton ─────────────────────────────────────────────────────────

export function ReportsSkeleton() {
  return (
    <View style={sk.container}>
      {/* Type grid */}
      <SkeletonBox width={80} height={11} borderRadius={6} style={sk.mb10} />
      <View style={sk.grid}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <SkeletonBox key={i} width="48%" height={80} borderRadius={16} />
        ))}
      </View>
      {/* Duration row */}
      <SkeletonBox width={80} height={11} borderRadius={6} style={sk.mb10} />
      <View style={sk.durationRow}>
        <SkeletonBox width="31%" height={70} borderRadius={16} />
        <SkeletonBox width="31%" height={70} borderRadius={16} />
        <SkeletonBox width="31%" height={70} borderRadius={16} />
      </View>
      {/* Charts */}
      <SkeletonBox width={80} height={11} borderRadius={6} style={sk.mb10} />
      <SkeletonBox height={160} borderRadius={20} style={sk.mb16} />
      <SkeletonBox width={80} height={11} borderRadius={6} style={sk.mb10} />
      <SkeletonBox height={160} borderRadius={20} style={sk.mb16} />
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  mb8:  { marginBottom: 8 },
  mb10: { marginBottom: 10 },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { backgroundColor: 'transparent' },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  callInfo: { flex: 1 },
  callMeta: { alignItems: 'flex-end' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  contactInfo: { flex: 1 },
  contactStats: { alignItems: 'flex-end', gap: 4 },
});
