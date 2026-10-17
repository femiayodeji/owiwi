import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Dropdown, type DropdownOption } from '../../src/components/Dropdown';
import { Button, Section, useUi } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { saveSettings } from '../../src/db/settings';
import { space } from '../../src/lib/theme';
import { NEWS_SOURCES, PUBLISHER_PRESETS, type NewsSourceId } from '../../src/news';
import { useFeed } from '../../src/store/feed';

const REGIONS = ['en-NG', 'en-US', 'en-GB', 'en-GH', 'en-KE', 'en-ZA', 'en-IN', 'fr-FR'];

const REGION_NAMES: Record<string, string> = {
  'en-NG': 'Nigeria (English)',
  'en-US': 'United States (English)',
  'en-GB': 'United Kingdom (English)',
  'en-GH': 'Ghana (English)',
  'en-KE': 'Kenya (English)',
  'en-ZA': 'South Africa (English)',
  'en-IN': 'India (English)',
  'fr-FR': 'France (French)',
};

const REGION_OPTIONS: readonly DropdownOption<string>[] = REGIONS.map((r) => ({ value: r, label: REGION_NAMES[r] ?? r, description: r }));

const SOURCE_OPTIONS: readonly DropdownOption<NewsSourceId>[] = NEWS_SOURCES.map((s) => ({
  value: s.id,
  label: s.label,
  description: s.description,
  badge: s.id === 'google' ? 'Default' : undefined,
}));

export default function SourcesScreen() {
  const settings = useFeed((s) => s.settings);
  const ui = useUi();
  const refresh = useFeed((s) => s.refresh);
  const [locale, setLocale] = useState(settings.locale);
  const localeValid = /^[a-z]{2}-[A-Z]{2}$/.test(locale);

  const save = async (patch: Parameters<typeof saveSettings>[1]) => {
    await saveSettings(await getDb(), patch);
    await refresh();
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Dropdown
        label="News source"
        value={settings.rss_provider}
        options={SOURCE_OPTIONS}
        onChange={(id) => void save({ rss_provider: id })}
        hint={
          settings.rss_provider === 'publishers'
            ? `Uses ${PUBLISHER_PRESETS.map((p) => p.label).join(', ')} and keeps stories matching your keywords.`
            : undefined
        }
      />

      <Section title="Region and language">
        <View style={{ padding: space.md }}>
          <Dropdown
            label="Region"
            title="Region and language"
            value={locale}
            options={REGION_OPTIONS}
            onChange={setLocale}
            allowCustom
            onChangeCustom={setLocale}
            customPlaceholder="language-COUNTRY, e.g. en-NG"
            hint={localeValid ? undefined : 'Use the form en-NG (language-COUNTRY).'}
          />
          <Button title="Save region" onPress={() => void save({ locale })} disabled={!localeValid || locale === settings.locale} />
        </View>
      </Section>
      <Text style={ui.muted}>All sources are free public RSS feeds. No news API keys needed.</Text>
    </ScrollView>
  );
}
