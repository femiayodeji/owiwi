import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { NumberStepper, Section, TimeStepper, ToggleRow, useUi } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { saveSettings, type Settings } from '../../src/db/settings';
import { timeToMinutes } from '../../src/lib/dates';
import { requestPermission, syncReminders } from '../../src/notifications';
import { useFeed } from '../../src/store/feed';

export default function ScheduleScreen() {
  const settings = useFeed((s) => s.settings);
  const ui = useUi();
  const refresh = useFeed((s) => s.refresh);
  const [error, setError] = useState<string | null>(null);

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
      <Text style={ui.muted}>
        Reminders are local and best-effort. Owiwi builds your digest when you open the app, not in the background.
      </Text>
    </ScrollView>
  );
}
