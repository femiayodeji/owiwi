import { StyleSheet, Text, View } from 'react-native';
import type { Slot } from '../llm/types';
import { colors, space } from '../lib/theme';
import { Owiwi } from './Owiwi';

export function CompletionCard({ height, slot, streak }: { height: number; slot: Slot; streak: number }) {
  return (
    <View style={[styles.page, { height }]}>
      <Owiwi emotion="celebrate" size={180} showCopy />
      <Text style={styles.streak}>
        {streak} day{streak === 1 ? '' : 's'} in a row
      </Text>
      <Text style={styles.next}>{slot === 'morning' ? 'See you this evening.' : 'See you tomorrow.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  streak: { marginTop: space.lg, fontSize: 22, fontWeight: '800', color: colors.navy },
  next: { marginTop: space.sm, fontSize: 16, color: colors.textMuted },
});
