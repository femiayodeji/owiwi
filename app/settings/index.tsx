import { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Row, Section, ui } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { getActiveProvider, listKeywords } from '../../src/db/queries';
import { NEWS_SOURCES } from '../../src/news';
import { useFeed } from '../../src/store/feed';

export default function SettingsHome() {
  const settings = useFeed((s) => s.settings);
  const [summary, setSummary] = useState({ keywords: '', provider: '' });

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const db = await getDb();
        const kws = (await listKeywords(db)).filter((k) => k.enabled);
        const provider = await getActiveProvider(db);
        setSummary({
          keywords: kws.length ? kws.map((k) => k.label).join(', ') : 'None on',
          provider: provider ? `${provider.label} · ${provider.model}` : 'Not set up',
        });
      })();
    }, []),
  );

  const source = NEWS_SOURCES.find((s) => s.id === settings.rss_provider)?.label ?? settings.rss_provider;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Section title="Your feed">
        <Row title="Keywords" subtitle={summary.keywords} onPress={() => router.push('/settings/keywords')} />
        <Row title="News source" subtitle={`${source} · ${settings.locale}`} onPress={() => router.push('/settings/sources')} />
      </Section>
      <Section title="AI">
        <Row title="LLM providers" subtitle={summary.provider} onPress={() => router.push('/settings/providers')} />
      </Section>
      <Section title="Habit">
        <Row
          title="Schedule & reminders"
          subtitle={`Morning ${settings.morning_time} · Evening ${settings.evening_time} · ${settings.cards_per_digest} cards`}
          onPress={() => router.push('/settings/schedule')}
        />
      </Section>
      <Text style={[ui.muted, { textAlign: 'center' }]}>
        Owiwi runs entirely on this device. No accounts, no servers, no analytics.
      </Text>
    </ScrollView>
  );
}
