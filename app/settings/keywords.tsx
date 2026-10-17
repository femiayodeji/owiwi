import { ScrollView, Text } from 'react-native';
import { KeywordEditor } from '../../src/components/KeywordEditor';
import { ui } from '../../src/components/ui';
import { space } from '../../src/lib/theme';

export default function KeywordsScreen() {
  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <KeywordEditor />
      <Text style={[ui.muted, { marginTop: space.lg }]}>
        Changes apply to your next digest. Today's digest stays as it is. Use "Regenerate" in the feed menu to rebuild it now.
      </Text>
    </ScrollView>
  );
}
