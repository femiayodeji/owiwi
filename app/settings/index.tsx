import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Dropdown, type DropdownOption } from '../../src/components/Dropdown';
import { Row, Section, useUi } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { getActiveProvider, listKeywords } from '../../src/db/queries';
import { saveSettings } from '../../src/db/settings';
import { radius, space, THEME_MODE_OPTIONS, type ThemeMode } from '../../src/lib/theme';
import { makeStyles, useTheme } from '../../src/lib/useTheme';
import { NEWS_SOURCES } from '../../src/news';
import { useFeed } from '../../src/store/feed';

const AUTHOR = 'oluwainstincts';
const AUTHOR_URL = 'https://femiayodeji.github.io/';
const APP_VERSION = Constants.expoConfig?.version;

const THEME_OPTIONS: readonly DropdownOption<ThemeMode>[] = THEME_MODE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  description: o.description,
}));

export default function SettingsHome() {
  const settings = useFeed((s) => s.settings);
  const reloadSettings = useFeed((s) => s.reloadSettings);
  const ui = useUi();
  const styles = useStyles();
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

  const setThemeMode = async (theme_mode: ThemeMode) => {
    if (theme_mode === settings.theme_mode) return;
    await saveSettings(await getDb(), { theme_mode });
    await reloadSettings();
  };

  const source = NEWS_SOURCES.find((s) => s.id === settings.rss_provider)?.label ?? settings.rss_provider;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Section title="Appearance">
        <View style={styles.appearance}>
          <Dropdown label="Theme" value={settings.theme_mode} options={THEME_OPTIONS} onChange={(m) => void setThemeMode(m)} />
          <ThemePreview />
        </View>
      </Section>
      <Section title="Your feed">
        <Row title="Keywords" subtitle={summary.keywords} onPress={() => router.push('/settings/keywords')} />
        <Row title="News source" subtitle={`${source} · ${settings.locale}`} onPress={() => router.push('/settings/sources')} />
        <Row title="Bookmarks" subtitle="Stories you saved" onPress={() => router.push('/bookmarks')} />
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
      {/* The whole line is the tap target, so the link is 44pt tall rather than one text line. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Made by ${AUTHOR}`}
        accessibilityHint="Opens the author's website"
        onPress={() => void WebBrowser.openBrowserAsync(AUTHOR_URL)}
        style={styles.creditRow}
      >
        {({ pressed }) => (
          <Text style={[ui.muted, styles.credit, pressed && styles.creditPressed]}>
            Made by <Text style={styles.creditLink}>{AUTHOR}</Text>
            {APP_VERSION ? ` · v${APP_VERSION}` : ''}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/** Live strip of the active theme: background, surface and accent swatches plus a type sample. */
function ThemePreview() {
  const theme = useTheme();
  const styles = useStyles();
  const { colors, type } = theme;
  return (
    <View style={styles.preview} accessibilityLabel={`Preview of the ${theme.name} theme`}>
      <View style={[styles.swatch, { backgroundColor: colors.bg }]} />
      <View style={[styles.swatch, { backgroundColor: colors.surface }]} />
      <View style={[styles.swatch, { backgroundColor: colors.indigo, borderColor: colors.indigo }]} />
      <Text style={[styles.sample, { fontFamily: type.readingFont }]}>Aa</Text>
      <Text style={styles.sampleName} numberOfLines={1}>
        {theme.name === 'reading' ? 'Serif, roomier text' : theme.dark ? 'Dark' : 'Light'}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  appearance: { padding: space.md, gap: space.sm },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatch: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  sample: { fontSize: 20, fontWeight: '700', color: colors.navy, marginLeft: space.xs },
  sampleName: { flex: 1, fontSize: 13, color: colors.textMuted },
  // 44pt row; the small top margin keeps the visual gap to the privacy line at about space.md.
  creditRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: space.sm, marginTop: space.xs },
  credit: { textAlign: 'center', fontSize: 13 },
  creditPressed: { opacity: 0.6 },
  creditLink: { color: colors.indigo, fontWeight: '600' },
}));
