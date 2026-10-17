import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Field, Section, Row, ui } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { saveSettings } from '../../src/db/settings';
import { colors, space } from '../../src/lib/theme';
import { NEWS_SOURCES, PUBLISHER_PRESETS } from '../../src/news';
import { useFeed } from '../../src/store/feed';

const REGIONS = ['en-NG', 'en-US', 'en-GB', 'en-GH', 'en-KE', 'en-ZA', 'en-IN', 'fr-FR'];

export default function SourcesScreen() {
  const settings = useFeed((s) => s.settings);
  const refresh = useFeed((s) => s.refresh);
  const [locale, setLocale] = useState(settings.locale);
  const localeValid = /^[a-z]{2}-[A-Z]{2}$/.test(locale);

  const save = async (patch: Parameters<typeof saveSettings>[1]) => {
    await saveSettings(await getDb(), patch);
    await refresh();
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Section title="Source">
        {NEWS_SOURCES.map((s) => (
          <Row
            key={s.id}
            title={s.label}
            subtitle={s.description}
            onPress={() => void save({ rss_provider: s.id })}
            right={settings.rss_provider === s.id ? <Text style={styles.check}>✓</Text> : <View />}
          />
        ))}
      </Section>
      {settings.rss_provider === 'publishers' ? (
        <Text style={[ui.muted, { marginTop: -12, marginBottom: space.lg }]}>
          Uses {PUBLISHER_PRESETS.map((p) => p.label).join(', ')} and keeps stories matching your keywords.
        </Text>
      ) : null}

      <Section title="Region and language">
        <View style={{ padding: space.md }}>
          <View style={styles.chips}>
            {REGIONS.map((r) => (
              <Chip key={r} label={r} selected={locale === r} onPress={() => setLocale(r)} />
            ))}
          </View>
          <Field
            label="Locale (language-COUNTRY)"
            value={locale}
            onChangeText={setLocale}
            autoCapitalize="none"
            autoCorrect={false}
            hint={localeValid ? undefined : 'Use the form en-NG.'}
          />
          <Button title="Save region" onPress={() => void save({ locale })} disabled={!localeValid || locale === settings.locale} />
        </View>
      </Section>
      <Text style={ui.muted}>All sources are free public RSS feeds. No news API keys needed.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  check: { color: colors.indigo, fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
});
