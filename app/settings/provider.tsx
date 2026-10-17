import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ProviderForm } from '../../src/components/ProviderForm';
import { useUi } from '../../src/components/ui';

export default function ProviderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ui = useUi();
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <ProviderForm providerId={id} onSaved={() => router.back()} />
    </ScrollView>
  );
}
