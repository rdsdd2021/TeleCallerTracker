import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RefreshCw, SlidersHorizontal, BarChart3, Target,
  Users, ArrowRight, Check, Flame,
} from 'lucide-react-native';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../lib/haptics';

const { width } = Dimensions.get('window');

interface Step {
  key:    string;
  icon:   React.ReactNode;
  color:  string;
  title:  string;
  body:   string;
  tip:    string;
}

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const [current, setCurrent] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const STEPS: Step[] = [
    {
      key:   'sync',
      icon:  <RefreshCw size={52} stroke="#fff" strokeWidth={1.8} />,
      color: theme.primary,
      title: 'Auto-sync in background',
      body:  'Call logs sync every 5 minutes — even when the app is closed. Your manager sees your data in real time without you doing anything.',
      tip:   '💡 Pull down on any screen to force a manual sync right now.',
    },
    {
      key:   'target',
      icon:  <Target size={52} stroke="#fff" strokeWidth={1.8} />,
      color: theme.success,
      title: 'Hit your daily target',
      body:  'The dashboard shows a live progress ring for your daily call target. Build a streak by hitting it every day — your streak is shown with a 🔥 badge.',
      tip:   '💡 Your manager sets the target. It updates automatically.',
    },
    {
      key:   'contacts',
      icon:  <Users size={52} stroke="#fff" strokeWidth={1.8} />,
      color: theme.accent,
      title: 'Deep-dive on any contact',
      body:  'Tap any contact to see their full call history, total talk time, average duration, and a 14-day activity chart — all in one place.',
      tip:   '💡 Use the search bar in Contacts to find anyone instantly.',
    },
    {
      key:   'reports',
      icon:  <BarChart3 size={52} stroke="#fff" strokeWidth={1.8} />,
      color: theme.warning,
      title: 'Understand your patterns',
      body:  'Reports shows your connection rate, rejection rate, peak calling hours, and top contacts. Filter by any date range or call type.',
      tip:   '💡 Your manager can see all agents side-by-side on the web portal.',
    },
    {
      key:   'filter',
      icon:  <SlidersHorizontal size={52} stroke="#fff" strokeWidth={1.8} />,
      color: '#8B5CF6',
      title: 'Filter everything',
      body:  'Every screen has a Filter button. Pick a date range, time window, call type, and SIM card — so you only see what matters right now.',
      tip:   '💡 Try "Yesterday, 9:00–18:00, Outgoing" to review your workday.',
    },
  ];

  const animateTo = (idx: number) => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 100, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,   duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: -20, duration: 100, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    setCurrent(idx);
  };

  const handleNext = () => {
    haptics.light();
    if (current < STEPS.length - 1) {
      animateTo(current + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    haptics.success();
    await Storage.set(STORAGE_KEYS.ONBOARDING_DONE, 'true');
    onDone();
  };

  const step = STEPS[current];
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
        <Text style={styles.skipTxt}>Skip</Text>
      </TouchableOpacity>

      {/* Illustration */}
      <Animated.View style={[styles.illustrationWrap, { opacity: fadeAnim }]}>
        <View style={[styles.iconBg, { backgroundColor: step.color }]}>
          {/* Outer glow ring */}
          <View style={[styles.glowRing, { borderColor: step.color + '30' }]} />
          {/* Inner ring */}
          <View style={[styles.iconRing, { borderColor: step.color + '50' }]}>
            {step.icon}
          </View>
        </View>
        {/* Step counter badge */}
        <View style={[styles.stepBadge, { backgroundColor: step.color }]}>
          <Text style={styles.stepBadgeTxt}>{current + 1} / {STEPS.length}</Text>
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => { haptics.light(); animateTo(i); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={[
              styles.dot,
              {
                backgroundColor: i === current ? step.color : theme.border,
                width: i === current ? 28 : 8,
                opacity: i < current ? 0.5 : 1,
              },
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Text content */}
      <Animated.View style={[
        styles.textWrap,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={[styles.tipCard, { backgroundColor: step.color + '12', borderColor: step.color + '25' }]}>
          <Text style={[styles.tipTxt, { color: step.color }]}>{step.tip}</Text>
        </View>
      </Animated.View>

      {/* CTA */}
      <View style={styles.footer}>
        {/* Previous button (shown from step 2 onwards) */}
        {current > 0 && (
          <TouchableOpacity
            style={[styles.prevBtn, { borderColor: theme.border }]}
            onPress={() => { haptics.light(); animateTo(current - 1); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.prevTxt, { color: theme.textSecondary }]}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: step.color }, current === 0 && styles.nextBtnFull]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          {current === STEPS.length - 1 ? (
            <>
              <Check size={20} stroke="#fff" />
              <Text style={styles.nextTxt}>Get Started</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextTxt}>Next</Text>
              <ArrowRight size={20} stroke="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },

  skipBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  skipTxt: { fontSize: 14, fontWeight: '600', color: theme.textTertiary },

  illustrationWrap: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  iconBg: {
    width: 168, height: 168, borderRadius: 52,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 64,
    borderWidth: 2,
  },
  iconRing: {
    width: 144, height: 144, borderRadius: 44,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  stepBadge: {
    position: 'absolute', bottom: -10,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999,
  },
  stepBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot:  { height: 8, borderRadius: 4 },

  textWrap:  { paddingHorizontal: 28, flex: 1 },
  title: {
    fontSize: 24, fontWeight: '800', color: theme.textPrimary,
    marginBottom: 12, lineHeight: 30,
  },
  body: {
    fontSize: 15, color: theme.textSecondary,
    lineHeight: 24, marginBottom: 16,
  },
  tipCard: {
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  tipTxt: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

  footer: {
    flexDirection: 'row', gap: 10,
    padding: 24, paddingBottom: 32,
  },
  prevBtn: {
    height: 56, borderRadius: 18, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  prevTxt: { fontSize: 15, fontWeight: '600' },
  nextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  nextBtnFull: { flex: 1 },
  nextTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
