import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, NumberStepper, Section, TimeStepper, ToggleRow, ui } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { saveSettings, type Settings } from '../../src/db/settings';
import { timeToMinutes } from '../../src/lib/dates';
import { requestPermission, sendTestNotification, syncReminders, type ReminderKind } from '../../src/notifications';
import { space } from '../../src/lib/theme';
import { useFeed } from '../../src/store/feed';

export default function ScheduleScreen() {
  const settings = useFeed((s) => s.settings);
  const refresh = useFeed((s) => s.refresh);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const test = async (kind: ReminderKind) => {
    const ok = await sendTestNotification(kind);
    setTestStatus(ok ? 'Arriving in 3 seconds. Lock the phone or leave the app to see it in the shade.' : 'Notifications are off for Owiwi. Allow them in system settings.');
  };

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    if ((timeToMinutes(next.morning_time) ?? 0) >= (timeToMinutes(next.evening_time) ?? 0)) {
      setError('Morning has to come before evening.');
      return;
    }
    setError(null);
    await saveSettings(await getDb(), patch);
    await refresh();
    await syncReminders(); // cancel and reschedule with the new times
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Section title="Digest times">
        <TimeStepper label="Morning" value={settings.morning_time} onChange={(v) => void update({ morning_time: v })} />
        <TimeStepper label="Evening" value={settings.evening_time} onChange={(v) => void update({ evening_time: v })} />
      </Section>
      {error ? <Text style={[ui.error, { marginTop: -12, marginBottom: 16 }]}>{error}</Text> : null}
      <Section title="Digest size">
        <NumberStepper
          label="Cards per digest"
          value={settings.cards_per_digest}
          min={5}
          max={10}
          onChange={(v) => void update({ cards_per_digest: v })}
        />
      </Section>
      <Section title="Streak saver">
        <ToggleRow
          title="Evening nudge"
          subtitle="One reminder if you haven't read yet today"
          value={settings.nudge_enabled === '1'}
          onChange={async (on) => {
            if (on) await requestPermission();
            await update({ nudge_enabled: on ? '1' : '0' });
          }}
        />
        {settings.nudge_enabled === '1' ? (
          <TimeStepper label="Nudge at" value={settings.nudge_time} onChange={(v) => void update({ nudge_time: v })} />
        ) : null}
      </Section>
      <Section title="Test">
        <View style={{ padding: space.md, gap: space.sm }}>
          <Button title="Send test notification (morning)" variant="secondary" onPress={() => void test('morning')} />
          <Button title="Send test notification (evening)" variant="secondary" onPress={() => void test('evening')} />
          <Button title="Send test notification (nudge)" variant="secondary" onPress={() => void test('nudge')} />
          {testStatus ? <Text style={ui.muted}>{testStatus}</Text> : null}
        </View>
      </Section>
      <Text style={ui.muted}>
        Reminders are local and best-effort. Owiwi builds your digest when you open the app, not in the background.
      </Text>
    </ScrollView>
  );
}
