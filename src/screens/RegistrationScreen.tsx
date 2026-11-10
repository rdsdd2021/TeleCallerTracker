import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { requestMultiple, PERMISSIONS } from 'react-native-permissions';
import { supabase } from '../lib/supabase';
import { Storage, STORAGE_KEYS } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { UserPlus, Briefcase, User, Hash } from 'lucide-react-native';

export default function RegistrationScreen({ onRegistered }: { onRegistered: () => void }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const requestPermissions = async () => {
    const permissions = [
      PERMISSIONS.ANDROID.READ_CALL_LOG,
      PERMISSIONS.ANDROID.READ_CONTACTS,
      PERMISSIONS.ANDROID.READ_PHONE_STATE,
    ];
    await requestMultiple(permissions);
  };

  const handleSubmit = async () => {
    setErrorMsg('');

    if (!fullName.trim() || !employeeId.trim() || !inviteCode.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
      setErrorMsg('Invite code must be 8 uppercase alphanumeric characters.');
      return;
    }

    setLoading(true);
    try {
      const deviceId = await DeviceInfo.getUniqueId();

      // 1. Resolve org from invite code (exclude soft-deleted orgs)
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('id')
        .eq('invite_code', normalizedCode)
        .is('deleted_at', null)
        .maybeSingle();

      if (orgError) throw orgError;

      if (!org) {
        setErrorMsg('Invalid invite code. Please contact your manager.');
        setLoading(false);
        return;
      }

      const orgId = org.id;

      // 2. Check if this employee ID already exists
      const { data: existing, error: selectError } = await supabase
        .from('callers')
        .select('id, device_id, org_id')
        .eq('employee_id', employeeId.trim())
        .maybeSingle();

      if (selectError) throw selectError;

      let callerId: string;

      if (existing) {
        // Employee ID exists — check org conflict
        if (existing.org_id && existing.org_id !== orgId) {
          setErrorMsg('This Employee ID is already registered with another organisation.');
          setLoading(false);
          return;
        }

        if (!existing.device_id) {
          // Claim the unregistered row
          const { error: updateError } = await supabase
            .from('callers')
            .update({ device_id: deviceId, name: fullName.trim(), org_id: orgId })
            .eq('id', existing.id);
          if (updateError) throw updateError;
          callerId = existing.id;
        } else if (existing.device_id === deviceId) {
          // Same device re-registering — update name and org
          const { error: updateError } = await supabase
            .from('callers')
            .update({ name: fullName.trim(), org_id: orgId })
            .eq('id', existing.id);
          if (updateError) throw updateError;
          callerId = existing.id;
        } else {
          setErrorMsg('This Employee ID is already registered on another device. Contact your manager.');
          setLoading(false);
          return;
        }
      } else {
        // New employee — insert with org_id
        const { data: inserted, error: insertError } = await supabase
          .from('callers')
          .insert({
            employee_id: employeeId.trim(),
            name: fullName.trim(),
            device_id: deviceId,
            org_id: orgId,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        callerId = inserted.id;
      }

      // 3. Persist to local storage
      await Storage.set(STORAGE_KEYS.CALLER_ID, callerId);
      await Storage.set(STORAGE_KEYS.CALLER_NAME, fullName.trim());
      await Storage.set(STORAGE_KEYS.EMPLOYEE_ID, employeeId.trim());
      await Storage.set(STORAGE_KEYS.ORG_ID, orgId);

      await requestPermissions();
      onRegistered();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Decorative blobs */}
      <View style={[styles.decorBlob, styles.blob1]} />
      <View style={[styles.decorBlob, styles.blob2]} />

      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoCircle}>
          <UserPlus size={36} stroke={theme.primary} />
        </View>

        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.subtext}>Register your device to start tracking calls</Text>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <User size={18} stroke={theme.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={theme.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrap}>
            <Briefcase size={18} stroke={theme.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor={theme.textTertiary}
              value={employeeId}
              onChangeText={setEmployeeId}
              editable={!loading}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <Hash size={18} stroke={theme.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Org Invite Code (8 characters)"
              placeholderTextColor={theme.textTertiary}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              editable={!loading}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </TouchableOpacity>

          {!!errorMsg && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Your call logs will be synced automatically{'\n'}in the background once registered.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  decorBlob: { position: 'absolute', borderRadius: 999 },
  blob1: {
    width: 240, height: 240, backgroundColor: theme.primaryContainer,
    opacity: 0.5, top: -60, right: -60,
  },
  blob2: {
    width: 180, height: 180, backgroundColor: theme.accentContainer,
    opacity: 0.4, top: 120, left: -80,
  },
  content: {
    flex: 1, paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: theme.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 24,
    ...theme.shadow,
  },
  heading: {
    fontSize: 32, fontWeight: '800', color: theme.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtext: {
    fontSize: 15, color: theme.textSecondary,
    textAlign: 'center', marginBottom: 36, lineHeight: 22,
  },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 16, height: 54, gap: 12,
    ...theme.shadow,
  },
  input: { flex: 1, fontSize: 16, color: theme.textPrimary },
  button: {
    height: 54, backgroundColor: theme.primary,
    borderRadius: theme.radius.md, justifyContent: 'center',
    alignItems: 'center', marginTop: 8,
    ...theme.shadowStrong,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  errorWrap: {
    backgroundColor: theme.errorContainer,
    borderRadius: theme.radius.sm, padding: 12,
  },
  errorText: { color: theme.error, textAlign: 'center', fontSize: 14 },
  footer: {
    color: theme.textTertiary, textAlign: 'center',
    fontSize: 12, marginTop: 32, lineHeight: 18,
  },
});
