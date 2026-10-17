// Keyword CRUD: add (free text or suggestion), rename, edit query, toggle, reorder, delete.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { getDb } from '../db/client';
import {
  addKeyword,
  deleteKeyword,
  listKeywords,
  MAX_ENABLED_KEYWORDS,
  reorderKeywords,
  setKeywordEnabled,
  updateKeyword,
  type Keyword,
} from '../db/queries';
import { colors, radius, space } from '../lib/theme';
import { Button, Chip, Field, ui } from './ui';

export const KEYWORD_SUGGESTIONS = ['AI', 'Geopolitics', 'Football', 'Tech', 'Business', 'Nigeria', 'Science', 'Startups', 'Climate', 'Health'];

export function KeywordEditor({ onChange }: { onChange?: (keywords: Keyword[]) => void }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await listKeywords(await getDb());
    setKeywords(list);
    onChange?.(list);
  }, [onChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enabledCount = keywords.filter((k) => k.enabled).length;
  const has = (label: string) => keywords.some((k) => k.label.toLowerCase() === label.toLowerCase());

  const add = async (label: string) => {
    const clean = label.trim();
    if (!clean || has(clean)) return;
    const kw = await addKeyword(await getDb(), clean);
    if (!kw.enabled) Alert.alert('Keyword added but off', `You can have up to ${MAX_ENABLED_KEYWORDS} keywords on at once.`);
    setDraft('');
    await reload();
  };

  const toggle = async (k: Keyword, on: boolean) => {
    const ok = await setKeywordEnabled(await getDb(), k.id, on);
    if (!ok) Alert.alert('Limit reached', `Turn one off first. Up to ${MAX_ENABLED_KEYWORDS} keywords can be on at once.`);
    await reload();
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= keywords.length) return;
    const ids = keywords.map((k) => k.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderKeywords(await getDb(), ids);
    await reload();
  };

  const remove = (k: Keyword) =>
    Alert.alert('Delete keyword?', `"${k.label}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteKeyword(await getDb(), k.id);
          await reload();
        },
      },
    ]);

  const suggestions = KEYWORD_SUGGESTIONS.filter((s) => !has(s));

  return (
    <View>
      <Field
        label="Add a keyword"
        placeholder='e.g. "Premier League transfers"'
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => void add(draft)}
        returnKeyType="done"
        autoCapitalize="words"
      />
      {draft.trim() ? <Button title={`Add "${draft.trim()}"`} onPress={() => void add(draft)} variant="secondary" /> : null}

      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip key={s} label={`+ ${s}`} onPress={() => void add(s)} />
          ))}
        </View>
      ) : null}

      <Text style={[ui.muted, { marginTop: space.md, marginBottom: space.sm }]}>
        {enabledCount} of {MAX_ENABLED_KEYWORDS} on
      </Text>

      {keywords.map((k, i) => (
        <View key={k.id} style={[styles.item, !k.enabled && styles.itemOff]}>
          <View style={styles.itemRow}>
            <Pressable style={{ flex: 1 }} onPress={() => setEditing(editing === k.id ? null : k.id)}>
              <Text style={styles.label}>{k.label}</Text>
              {k.query !== k.label ? <Text style={ui.muted}>Searches: {k.query}</Text> : null}
            </Pressable>
            <Switch value={k.enabled} onValueChange={(v) => void toggle(k, v)} trackColor={{ true: colors.indigo }} />
          </View>
          {editing === k.id ? (
            <KeywordDetails
              keyword={k}
              canUp={i > 0}
              canDown={i < keywords.length - 1}
              onSave={async (patch) => {
                await updateKeyword(await getDb(), k.id, patch);
                setEditing(null);
                await reload();
              }}
              onMove={(d) => void move(i, d)}
              onDelete={() => remove(k)}
            />
          ) : null}
        </View>
      ))}
      {keywords.length === 0 ? <Text style={ui.muted}>No keywords yet. Add one or tap a suggestion.</Text> : null}
    </View>
  );
}

function KeywordDetails({
  keyword,
  canUp,
  canDown,
  onSave,
  onMove,
  onDelete,
}: {
  keyword: Keyword;
  canUp: boolean;
  canDown: boolean;
  onSave: (patch: { label: string; query: string }) => Promise<void>;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(keyword.label);
  const [query, setQuery] = useState(keyword.query);
  const valid = label.trim().length > 0 && query.trim().length > 0;
  return (
    <View style={styles.details}>
      <Field label="Label (what you see)" value={label} onChangeText={setLabel} />
      <Field label="Search query (sent to the news feed)" value={query} onChangeText={setQuery} autoCapitalize="none" />
      <View style={styles.actions}>
        <Chip label="↑ Up" onPress={canUp ? () => onMove(-1) : undefined} muted={!canUp} />
        <Chip label="↓ Down" onPress={canDown ? () => onMove(1) : undefined} muted={!canDown} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
        </Pressable>
      </View>
      <Button title="Save" onPress={() => void onSave({ label, query })} disabled={!valid} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8, padding: space.md },
  itemOff: { opacity: 0.6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontSize: 16, fontWeight: '600', color: colors.navy },
  details: { marginTop: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
});
