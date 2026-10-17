// Keyword CRUD: add (free text or suggestion), rename, edit query, toggle, reorder, delete.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
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
import { haptic } from '../lib/haptics';
import { colors, radius, space } from '../lib/theme';
import { PressScale } from './PressScale';
import { ConfirmDialog } from './Sheet';
import { showToast } from './Toast';
import { Button, Chip, Field, ui } from './ui';

export const KEYWORD_SUGGESTIONS = ['AI', 'Geopolitics', 'Football', 'Tech', 'Business', 'Nigeria', 'Science', 'Startups', 'Climate', 'Health'];

export function KeywordEditor({ onChange }: { onChange?: (keywords: Keyword[]) => void }) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Keyword | null>(null);

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
    if (!kw.enabled) showToast(`Added, but off. Up to ${MAX_ENABLED_KEYWORDS} keywords can be on at once.`, 'info');
    setDraft('');
    await reload();
  };

  const toggle = async (k: Keyword, on: boolean) => {
    const ok = await setKeywordEnabled(await getDb(), k.id, on);
    if (!ok) showToast(`Limit reached. Turn one off first: up to ${MAX_ENABLED_KEYWORDS} can be on at once.`, 'warning');
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

  const confirmDelete = async () => {
    const k = toDelete;
    setToDelete(null);
    if (!k) return;
    await deleteKeyword(await getDb(), k.id);
    await reload();
  };

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
          {suggestions.map((s, i) => (
            <Animated.View key={s} entering={ZoomIn.delay(i * 45).springify().damping(11)}>
              <Chip label={`+ ${s}`} onPress={() => void add(s)} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      <Text style={[ui.muted, { marginTop: space.md, marginBottom: space.sm }]}>
        {enabledCount} of {MAX_ENABLED_KEYWORDS} on
      </Text>

      {keywords.map((k, i) => (
        <Animated.View key={k.id} entering={FadeInDown.springify().damping(16)} style={[styles.item, !k.enabled && styles.itemOff]}>
          <View style={styles.itemRow}>
            <PressScale style={{ flex: 1 }} scaleTo={0.98} dimTo={0.7} onPress={() => setEditing(editing === k.id ? null : k.id)}>
              <Text style={styles.label}>{k.label}</Text>
              {k.query !== k.label ? <Text style={ui.muted}>Searches: {k.query}</Text> : null}
            </PressScale>
            <Switch
              value={k.enabled}
              onValueChange={(v) => {
                haptic.select();
                void toggle(k, v);
              }}
              trackColor={{ true: colors.indigo }}
            />
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
              onDelete={() => setToDelete(k)}
            />
          ) : null}
        </Animated.View>
      ))}
      {keywords.length === 0 ? <Text style={ui.muted}>No keywords yet. Add one or tap a suggestion.</Text> : null}
      <ConfirmDialog
        visible={toDelete !== null}
        title="Delete keyword?"
        message={toDelete ? `"${toDelete.label}" will be removed.` : undefined}
        confirmLabel="Delete"
        destructive
        emotion="sad"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
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
        <PressScale onPress={onDelete} hitSlop={8} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={`Delete ${keyword.label}`}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
        </PressScale>
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
