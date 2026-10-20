// Shown for a slot whose digest the reader already finished (its cards were cleared).
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { isLateNight } from '../digest/slot';
import type { Slot } from '../llm/types';
import { space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';
import { Owiwi } from './Owiwi';
import { StreakFlame } from './StreakFlame';
import { Button } from './ui';

interface Props {
  slot: Slot;
  streak: number;
  doneToday: boolean;
  /** Opens the existing regenerate confirmation (costs tokens). */
  onRegenerate: () => void;
}

export function CaughtUp({ slot, streak, doneToday, onRegenerate }: Props) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const late = isLateNight(new Date());
  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(i * 90).springify().damping(16));

  return (
    <View style={styles.page}>
      <Animated.View entering={enter(0)} style={styles.row}>
        {/* The day was counted when the reader finished, so no "Streak +1" copy here; sleepy keeps its line. */}
        <Owiwi emotion={late ? 'sleepy' : 'celebrate'} showCopy={late} />
      </Animated.View>
      <Animated.View entering={enter(1)} style={[styles.row, styles.flame]}>
        <StreakFlame value={streak} size="lg" highlight={doneToday} />
      </Animated.View>
      <Animated.Text entering={enter(2)} style={styles.title}>
        You're all caught up
      </Animated.Text>
      <Animated.Text entering={enter(3)} style={styles.next}>
        {slot === 'morning' ? 'See you this evening.' : 'See you tomorrow.'}
      </Animated.Text>
      <Animated.View entering={enter(4)} style={styles.actions}>
        <Button title="Regenerate for fresh stories" variant="secondary" onPress={onRegenerate} />
        <Text style={styles.hint}>Uses your API tokens.</Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={{ left: 12, right: 12 }}
          onPress={() => router.push('/bookmarks')}
          style={styles.linkRow}
        >
          {({ pressed }) => <Text style={[styles.link, pressed && styles.linkPressed]}>View bookmarks</Text>}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  row: { alignItems: 'center', alignSelf: 'stretch' },
  flame: { marginTop: space.lg },
  title: { marginTop: space.md, fontSize: 22, fontWeight: '800', color: t.colors.navy, textAlign: 'center' },
  next: { marginTop: space.sm, fontSize: 16, color: t.colors.textMuted, textAlign: 'center' },
  actions: { marginTop: space.lg, alignSelf: 'stretch', alignItems: 'stretch', gap: space.sm },
  hint: { fontSize: 13, color: t.colors.textFaint, textAlign: 'center' },
  linkRow: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  link: { fontSize: 14, fontWeight: '600', color: t.colors.indigo },
  linkPressed: { opacity: 0.6 },
}));
