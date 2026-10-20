// Shown when a slot has no digest because the reader has already seen every
// story the news sources returned. Checking again costs no tokens unless
// something new turns up.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { isLateNight, nextDigestLine } from '../digest/slot';
import type { Slot } from '../llm/types';
import { space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';
import { Owiwi } from './Owiwi';
import { StreakFlame } from './StreakFlame';
import { Button } from './ui';

interface Props {
  streak: number;
  doneToday: boolean;
  morningTime: string;
  eveningTime: string;
  /** The other slot, when it has a ready digest to read again. */
  readAgainSlot: Slot | null;
  onReadAgain: () => void;
  onCheckAgain: () => void;
}

export function NothingNew({ streak, doneToday, morningTime, eveningTime, readAgainSlot, onReadAgain, onCheckAgain }: Props) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const now = new Date();
  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(i * 90).springify().damping(16));

  return (
    <View style={styles.page}>
      <Animated.View entering={enter(0)} style={styles.row}>
        <Owiwi emotion={isLateNight(now) ? 'sleepy' : 'idle'} />
      </Animated.View>
      <Animated.View entering={enter(1)} style={[styles.row, styles.flame]}>
        <StreakFlame value={streak} size="lg" highlight={doneToday} />
      </Animated.View>
      <Animated.Text entering={enter(2)} style={styles.title}>
        Nothing new since your last read
      </Animated.Text>
      <Animated.Text entering={enter(3)} style={styles.next}>
        {nextDigestLine(now, morningTime, eveningTime)}
      </Animated.Text>
      <Animated.View entering={enter(4)} style={styles.actions}>
        {readAgainSlot ? (
          <Button title={`Read your ${readAgainSlot} digest again`} variant="secondary" onPress={onReadAgain} />
        ) : null}
        <Button title="Check again" variant="secondary" onPress={onCheckAgain} />
        <Text style={styles.hint}>Free unless something new turns up.</Text>
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
