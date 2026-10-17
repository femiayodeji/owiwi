import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, ui } from '../../src/components/ui';
import { getDb } from '../../src/db/client';
import { deleteProvider, listProviders, setActiveProvider } from '../../src/db/queries';
import { deleteApiKey } from '../../src/lib/secureStore';
import { colors, radius, space } from '../../src/lib/theme';
import type { ProviderConfig } from '../../src/llm/types';

export default function ProvidersScreen() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  const reload = useCallback(async () => setProviders(await listProviders(await getDb())), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const remove = (p: ProviderConfig) =>
    Alert.alert('Delete provider?', `"${p.label}" and its saved key will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProvider(await getDb(), p.id);
          await deleteApiKey(p.id);
          await reload();
        },
      },
    ]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {providers.map((p) => (
        <View key={p.id} style={[styles.item, p.isActive && styles.active]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={async () => {
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
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={() => router.push({ pathname: '/settings/provider', params: { id: p.id } })} hitSlop={8}>
              <Text style={styles.link}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => remove(p)} hitSlop={8}>
              <Text style={[styles.link, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {providers.length === 0 ? <Text style={[ui.muted, { marginBottom: space.md }]}>No provider yet. Add one to build digests.</Text> : null}
      {providers.length > 1 ? <Text style={[ui.muted, { marginBottom: space.md }]}>Tap a provider to make it active.</Text> : null}
      <Button title="Add provider" onPress={() => router.push('/settings/provider')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
