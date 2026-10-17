// Add / edit an LLM provider. The key goes straight to SecureStore and is never shown again.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getDb } from '../db/client';
import { getProvider, saveProvider } from '../db/queries';
import { newId } from '../lib/ids';
import { getApiKey, hasApiKey, setApiKey } from '../lib/secureStore';
import { colors, space } from '../lib/theme';
import {
  createProvider,
  DEFAULT_MODELS,
  DEFAULT_PRESET_ID,
  getPreset,
  PRESETS,
  SUGGESTED_MODELS,
  testConnection,
  type PresetId,
  type ProviderPreset,
} from '../llm';
import type { ProviderConfig } from '../llm/types';
import { Dropdown, type DropdownOption } from './Dropdown';
import { Button, Field, ui } from './ui';

const PRESET_OPTIONS: readonly DropdownOption<PresetId>[] = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  description: p.description,
}));

function modelOptions(preset: PresetId): DropdownOption<string>[] {
  return SUGGESTED_MODELS[preset].map((m) => ({
    value: m.id,
    label: m.label,
    description: m.note ? `${m.id} · ${m.note}` : m.id,
    badge: m.id === DEFAULT_MODELS[preset] ? 'Recommended' : undefined,
  }));
}

const isListed = (preset: PresetId, model: string) => SUGGESTED_MODELS[preset].some((m) => m.id === model);

function presetFor(p: ProviderConfig): ProviderPreset {
  return (
    PRESETS.find((x) => x.kind === p.kind && (x.kind !== 'openai_compatible' || x.baseUrl === p.baseUrl)) ??
    PRESETS.find((x) => x.id === 'custom')!
  );
}

export function ProviderForm({ providerId, onSaved }: { providerId?: string; onSaved: () => void }) {
  const [id] = useState(() => providerId ?? newId());
  const initial = getPreset(DEFAULT_PRESET_ID);
  const [preset, setPreset] = useState<ProviderPreset>(initial);
  const [label, setLabel] = useState(initial.label);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.defaultModel);
  /** Saved model isn't in the suggested list: open the model field as free text. */
  const [customModel, setCustomModel] = useState(false);
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
      const found = presetFor(p);
      setPreset(found);
      setLabel(p.label);
      setBaseUrl(p.baseUrl ?? '');
      setModel(p.model);
      setCustomModel(!isListed(found.id, p.model));
      setHasSavedKey(await hasApiKey(providerId));
    })();
  }, [providerId]);

  const pickPreset = (id: PresetId) => {
    const p = getPreset(id);
    // Keep a name the user typed; otherwise follow the preset.
    if (!label.trim() || label === preset.label) setLabel(p.label);
    setPreset(p);
    setBaseUrl(p.baseUrl);
    setModel(p.defaultModel);
    setCustomModel(false);
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

  const options = modelOptions(preset.id);

  return (
    <View>
      {!providerId ? (
        <Dropdown label="Provider" title="Choose a provider" value={preset.id} options={PRESET_OPTIONS} onChange={pickPreset} />
      ) : (
        <Field label="Provider" value={preset.label} editable={false} style={styles.readOnly} />
      )}

      <Field label="Name" value={label} onChangeText={setLabel} placeholder={preset.label} />
      {preset.baseUrlEditable ? (
        <Field
          label="Base URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://your-provider.example/v1"
          hint={needsBaseUrl ? 'Enter an https:// URL that ends at the API root (before /chat/completions).' : undefined}
        />
      ) : preset.baseUrl ? (
        <Text style={styles.fixedUrl}>Endpoint: {preset.baseUrl}</Text>
      ) : null}
      {options.length > 0 ? (
        <Dropdown
          key={preset.id}
          label="Model"
          title={`${preset.label} models`}
          value={model}
          options={options}
          onChange={setModel}
          allowCustom
          onChangeCustom={setModel}
          initialCustom={customModel}
          customPlaceholder="Model ID from your provider"
          hint={model.trim() ? undefined : 'Enter the model ID from your provider.'}
        />
      ) : (
        <Field
          label="Model"
          value={model}
          onChangeText={setModel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Model ID from your provider"
          hint="Enter the model ID from your provider."
        />
      )}
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
  readOnly: { backgroundColor: colors.bg, color: colors.textMuted },
  fixedUrl: { fontSize: 12, color: colors.textFaint, marginTop: -8, marginBottom: space.md },
});
