import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/client';
import { useTheme } from '../src/lib/useTheme';
import { withTimeout } from '../src/lib/async';
import { configureNotifications, topUpReminders, useNotificationDeepLink } from '../src/notifications';
import { useFeed } from '../src/store/feed';
import { Button, useUi } from '../src/components/ui';
import { ToastHost } from '../src/components/Toast';
import { Owiwi } from '../src/components/Owiwi';

void SplashScreen.preventAutoHideAsync();

// Boot steps that gate first paint get a deadline, so a hung native call shows the
// retry screen instead of an endless splash. Generation is never awaited at boot.
const DB_TIMEOUT_MS = 8000;
const REFRESH_TIMEOUT_MS = 8000;
/** Last-resort: the splash is hidden after this no matter what boot is doing. */
const SPLASH_MAX_MS = 10000;

function hideSplash(): void {
  try {
    SplashScreen.hide();
  } catch {
    // Native splash already gone.
  }
}

/**
 * Paints the native root view (visible behind screens during transitions and keyboard animations).
 * Loaded lazily: the module's native side may be missing from an older dev build, and
 * requireNativeModule throws at import time. Any failure is silent.
 */
async function setRootBackground(color: string): Promise<void> {
  try {
    const SystemUI = await import('expo-system-ui');
    await SystemUI.setBackgroundColorAsync(color);
  } catch {
    // Native module not in this build; the themed screens still cover the root view.
  }
}

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // A user-started retry has no native splash in front of it, so its loading view shows the owl.
  const [retrying, setRetrying] = useState(false);
  const refresh = useFeed((s) => s.refresh);
  const theme = useTheme();
  const ui = useUi();
  const { colors } = theme;

  // Only once the Stack is mounted: navigating earlier remounts this layout in a loop.
  useNotificationDeepLink(state === 'ready');
  const bootRun = useRef(0);

  useEffect(() => {
    void setRootBackground(colors.bg);
  }, [colors.bg]);

  const boot = async () => {
    const run = ++bootRun.current;
    setState('loading');
    try {
      await withTimeout(getDb(), DB_TIMEOUT_MS, 'open database');
      await withTimeout(refresh(), REFRESH_TIMEOUT_MS, 'load feed'); // wipe + load; generation is not awaited
      if (run !== bootRun.current) return;
      setState('ready');
    } catch {
      if (run === bootRun.current) setState('error');
    } finally {
      hideSplash();
    }
  };

  useEffect(() => {
    void boot();
    // Not needed for first paint. The Android channel must exist before scheduling.
    void configureNotifications()
      .catch(() => undefined)
      .then(() => topUpReminders());
    const safety = setTimeout(() => {
      hideSplash();
      // Only the first boot: a user-started retry has its own step deadlines.
      if (bootRun.current === 1) setState((s) => (s === 'loading' ? 'error' : s));
    }, SPLASH_MAX_MS);
    // Wipe stale data, handle midnight rollover and top up reminders on every foreground.
    // refresh() and the reminder sync coalesce overlapping calls, so rapid AppState flips are cheap.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void refresh().catch(() => undefined);
      void topUpReminders();
    });
    return () => {
      clearTimeout(safety);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'error') {
    return (
      <View style={[ui.screen, { justifyContent: 'center', padding: 24, gap: 16 }]}>
        <Owiwi emotion="sad" />
        <Text style={[ui.h2, { textAlign: 'center' }]}>Owiwi couldn't start</Text>
        <Text style={[ui.muted, { textAlign: 'center' }]}>
          Something got stuck while opening your news. Your keywords, bookmarks and streak are safe. Try again, or restart
          the app.
        </Text>
        <Button
          title="Try again"
          onPress={() => {
            setRetrying(true);
            void boot();
          }}
        />
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </View>
    );
  }
  if (state === 'loading') {
    // First boot sits behind the native splash: keep a plain view in its background colour to avoid a flash.
    if (!retrying) return <View style={ui.screen} />;
    return (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Owiwi emotion="thinking" />
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.indigo,
          headerTitleStyle: { color: colors.navy, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/keywords" options={{ title: 'Keywords' }} />
        <Stack.Screen name="settings/providers" options={{ title: 'LLM providers' }} />
        <Stack.Screen name="settings/provider" options={{ title: 'Provider' }} />
        <Stack.Screen name="settings/schedule" options={{ title: 'Schedule & reminders' }} />
        <Stack.Screen name="settings/sources" options={{ title: 'News source' }} />
        <Stack.Screen name="bookmarks" options={{ title: 'Bookmarks' }} />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
