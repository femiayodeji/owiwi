import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/client';
import { colors } from '../src/lib/theme';
import { configureNotifications, syncReminders, useNotificationDeepLink } from '../src/notifications';
import { useFeed } from '../src/store/feed';
import { Button, ui } from '../src/components/ui';
import { ToastHost } from '../src/components/Toast';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const refresh = useFeed((s) => s.refresh);

  useNotificationDeepLink();

  const boot = async () => {
    setState('loading');
    try {
      await getDb();
      await configureNotifications();
      await refresh(); // wipe + load + maybe auto-generate
      setState('ready');
      void syncReminders();
    } catch {
      setState('error');
    } finally {
      SplashScreen.hide();
    }
  };

  useEffect(() => {
    void boot();
    // Wipe stale data, handle midnight rollover and top up reminders on every foreground.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void refresh().catch(() => undefined);
      void syncReminders();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'error') {
    return (
      <View style={[ui.screen, { justifyContent: 'center', padding: 24, gap: 16 }]}>
        <Text style={ui.h2}>Owiwi couldn't start</Text>
        <Text style={ui.muted}>Local storage failed to open. Try again, or restart the app.</Text>
        <Button title="Try again" onPress={() => void boot()} />
      </View>
    );
  }
  if (state === 'loading') return <View style={ui.screen} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
