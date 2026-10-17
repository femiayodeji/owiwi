import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PressScale } from '../../src/components/PressScale';
import { ConfirmDialog } from '../../src/components/Sheet';
import { Button, useUi } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { deleteProvider, listProviders, setActiveProvider } from '../../src/db/queries';
import { haptic } from '../../src/lib/haptics';
import { deleteApiKey } from '../../src/lib/secureStore';
import { radius, space } from '../../src/lib/theme';
import { makeStyles } from '../../src/lib/useTheme';
import type { ProviderConfig } from '../../src/llm/types';

export default function ProvidersScreen() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [toDelete, setToDelete] = useState<ProviderConfig | null>(null);
  const ui = useUi();
  const styles = useStyles();

  const reload = useCallback(async () => setProviders(await listProviders(await getDb())), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const confirmDelete = async () => {
    const p = toDelete;
    setToDelete(null);
    if (!p) return;
    await deleteProvider(await getDb(), p.id);
    await deleteApiKey(p.id);
    await reload();
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {providers.map((p) => (
        <View key={p.id} style={[styles.item, p.isActive && styles.active]}>
          <PressScale
            style={{ flex: 1 }}
            scaleTo={0.98}
            dimTo={0.7}
            onPress={async () => {
              haptic.select();
              await setActiveProvider(await getDb(), p.id);
              await reload();
            }}
            accessibilityLabel={`Use ${p.label}`}
          >
            <Text style={styles.label}>
              {p.label} {p.isActive ? <Text style={styles.badge}> ACTIVE</Text> : null}
            </Text>
            <Text style={ui.muted}>{p.model}</Text>
            <Text style={[ui.muted, { fontSize: 12 }]}>Key: ••••••••</Text>
          </PressScale>
          <View style={styles.actions}>
            <PressScale
              onPress={() => router.push({ pathname: '/settings/provider', params: { id: p.id } })}
              hitSlop={8}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${p.label}`}
            >
              <Text style={styles.link}>Edit</Text>
            </PressScale>
            <PressScale onPress={() => setToDelete(p)} hitSlop={8} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={`Delete ${p.label}`}>
              <Text style={[styles.link, styles.danger]}>Delete</Text>
            </PressScale>
          </View>
        </View>
      ))}
      {providers.length === 0 ? <Text style={[ui.muted, { marginBottom: space.md }]}>No provider yet. Add one to build digests.</Text> : null}
      {providers.length > 1 ? <Text style={[ui.muted, { marginBottom: space.md }]}>Tap a provider to make it active.</Text> : null}
      <Button title="Add provider" onPress={() => router.push('/settings/provider')} />
      <ConfirmDialog
        visible={toDelete !== null}
        title="Delete provider?"
        message={toDelete ? `"${toDelete.label}" and its saved key will be removed from this device.` : undefined}
        confirmLabel="Delete"
        destructive
        emotion="sad"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  item: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
    gap: space.md,
  },
  active: { borderColor: colors.indigo, borderWidth: 2 },
  label: { fontSize: 16, fontWeight: '700', color: colors.navy },
  badge: { fontSize: 11, color: colors.indigo, fontWeight: '800' },
  actions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  link: { color: colors.indigo, fontWeight: '600' },
  danger: { color: colors.danger },
}));
