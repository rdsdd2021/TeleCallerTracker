import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, NativeModules } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Storage, STORAGE_KEYS } from './lib/storage';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { configureBackgroundSync } from './services/backgroundTask';
import RegistrationScreen from './screens/RegistrationScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainTabs from './MainTabs';

// ─── App-level context ────────────────────────────────────────────────────────
type AppContextType = { onUnregister: () => void };
export const AppContext = createContext<AppContextType>({ onUnregister: () => {} });
export const useAppContext = () => useContext(AppContext);

type AppState = 'loading' | 'register' | 'onboarding' | 'home';

function AppInner() {
  const { theme, isDark } = useTheme();
  const [state, setState] = useState<AppState>('loading');

  useEffect(() => {
    (async () => {
      const id = await Storage.get(STORAGE_KEYS.CALLER_ID);
      if (!id) { setState('register'); return; }

      // Start background sync as soon as the device is registered.
      // configureBackgroundSync must be called once at app launch so the OS
      // schedules periodic wake-ups even when the app is in the background.
      configureBackgroundSync();

      // Start the native foreground service (5-minute sync loop).
      // This keeps syncing even when the app is backgrounded or the screen is off.
      NativeModules.SyncModule?.startSyncService?.();

      const onboardingDone = await Storage.get(STORAGE_KEYS.ONBOARDING_DONE);
      setState(onboardingDone === 'true' ? 'home' : 'onboarding');
    })();
  }, []);

  const handleUnregister = async () => {
    await Storage.clear();
    setState('register');
  };

  const handleRegistered = async () => {
    // After registration, configure background sync and start the foreground service
    configureBackgroundSync();
    NativeModules.SyncModule?.startSyncService?.();

    // After registration, check if onboarding was already done
    const done = await Storage.get(STORAGE_KEYS.ONBOARDING_DONE);
    setState(done === 'true' ? 'home' : 'onboarding');
  };

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <AppContext.Provider value={{ onUnregister: handleUnregister }}>
      <NavigationContainer>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />
        {state === 'register' && (
          <RegistrationScreen onRegistered={handleRegistered} />
        )}
        {state === 'onboarding' && (
          <OnboardingScreen onDone={() => setState('home')} />
        )}
        {state === 'home' && (
          <MainTabs />
        )}
      </NavigationContainer>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
