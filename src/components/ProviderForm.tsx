// Add / edit an LLM provider. The key goes straight to SecureStore and is never shown again.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getDb } from '../db/client';
import { getProvider, saveProvider } from '../db/queries';
import { newId } from '../lib/ids';
import { getApiKey, hasApiKey, setApiKey } from '../lib/secureStore';
import { colors, space } from '../lib/theme';
import { createProvider, PRESETS, testConnection, type ProviderPreset } from '../llm';
import type { ProviderConfig } from '../llm/types';
import { Button, Chip, Field, ui } from './ui';

function presetFor(p: ProviderConfig): ProviderPreset {
  return (
    PRESETS.find((x) => x.kind === p.kind && (x.kind !== 'openai_compatible' || x.baseUrl === p.baseUrl)) ??
    PRESETS.find((x) => x.id === 'custom')!
  );
}

export function ProviderForm({ providerId, onSaved }: { providerId?: string; onSaved: () => void }) {
  const [id] = useState(() => providerId ?? newId());
  const [preset, setPreset] = useState<ProviderPreset>(PRESETS[0]);
  const [label, setLabel] = useState(PRESETS[0].label);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [model, setModel] = useState(PRESETS[0].defaultModel);
  const [key, setKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!providerId) return;
    void (async () => {
      const p = await getProvider(await getDb(), providerId);
      if (!p) return;
      setPreset(presetFor(p));
      setLabel(p.label);
      setBaseUrl(p.baseUrl ?? '');
      setModel(p.model);
      setHasSavedKey(await hasApiKey(providerId));
    })();
  }, [providerId]);

  const pickPreset = (p: ProviderPreset) => {
    setPreset(p);
    setLabel(p.label);
    setBaseUrl(p.baseUrl);
    setModel(p.defaultModel);
    setResult(null);
  };

  const config = (): ProviderConfig => ({
    id,
    kind: preset.kind,
    label: label.trim() || preset.label,
    baseUrl: preset.kind === 'openai_compatible' ? baseUrl.trim().replace(/\/+$/, '') : null,
    model: model.trim(),
    isActive: false,
  });

  const needsBaseUrl = preset.kind === 'openai_compatible' && !/^https:\/\/\S+$/.test(baseUrl.trim());
  const valid = model.trim().length > 0 && !needsBaseUrl && (key.trim().length > 0 || hasSavedKey);

  const test = async () => {
    setTesting(true);
    setResult(null);
    const apiKey = key.trim() || (await getApiKey(id));
    if (!apiKey) {
      setTesting(false);
      setResult({ ok: false, message: 'Enter your API key first.' });
      return;
    }
    try {
      const res = await testConnection(createProvider(config(), apiKey));
      setResult(res.ok ? { ok: true, message: 'Connected. Your provider answered.' } : { ok: false, message: res.message });
    } catch {
      setResult({ ok: false, message: 'Check the base URL and model.' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (key.trim()) await setApiKey(id, key);
      const { isActive: _ignored, ...rest } = config();
      await saveProvider(await getDb(), rest);
      setKey('');
      setHasSavedKey(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {!providerId ? (
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Chip key={p.id} label={p.label} selected={p.id === preset.id} onPress={() => pickPreset(p)} />
          ))}
        </View>
      ) : null}

      <Field label="Name" value={label} onChangeText={setLabel} />
      {preset.kind === 'openai_compatible' ? (
        <Field
          label="Base URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          editable={preset.baseUrlEditable}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://your-provider.example/v1"
          hint={needsBaseUrl ? 'Enter an https:// URL that ends at the API root (before /chat/completions).' : undefined}
        />
      ) : null}
      <Field
        label="Model"
        value={model}
        onChangeText={setModel}
        autoCapitalize="none"
        autoCorrect={false}
        hint={preset.defaultModel ? `Suggested: ${preset.defaultModel}` : 'Enter the model ID from your provider.'}
      />
      <Field
        label="API key"
        value={key}
        onChangeText={setKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={hasSavedKey ? '•••••••• saved (type to replace)' : 'Paste your key'}
        hint={`Stored only on this device, in the secure keystore. Get one at ${preset.keyHint}.`}
      />

      {result ? <Text style={[ui.muted, { color: result.ok ? colors.success : colors.danger, marginBottom: space.md }]}>{result.message}</Text> : null}

      <View style={{ gap: space.sm }}>
        <Button title="Test connection" variant="secondary" onPress={() => void test()} loading={testing} disabled={!valid} />
        <Button title="Save provider" onPress={() => void save()} loading={saving} disabled={!valid} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
});
