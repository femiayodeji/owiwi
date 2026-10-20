// Last page of the feed: the celebration.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import type { Slot } from '../llm/types';
import { haptic } from '../lib/haptics';
import { space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';
import { Confetti } from './Confetti';
import { Owiwi } from './Owiwi';
import { PressScale } from './PressScale';
import { StreakFlame } from './StreakFlame';

interface Props {
  height: number;
  slot: Slot;
  streak: number;
  /**
   * Whether this page is on screen. The pager renders it ahead of time, so pass
   * `active={index === currentIndex}` to celebrate when it is actually seen.
   * Omitted means "celebrate on mount".
   */
  active?: boolean;
  /** Quiet "Check for fresh stories" link (regenerate, confirmed by the caller). */
  onRegenerate?: () => void;
}

const COUNT_UP_DELAY_MS = 650;

export function CompletionCard({ height, slot, streak, active = true, onRegenerate }: Props) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const [shown, setShown] = useState(false);
  const [counted, setCounted] = useState(Math.max(0, streak - 1));

  // Celebrate the first time the page becomes active.
  useEffect(() => {
    if (!active || shown) return;
    setShown(true);
    haptic.success();
    setBurst((b) => b + 1);
  }, [active, shown]);

  // Count up from streak-1 to streak once shown; follow later changes (completeDay may land after mount).
  useEffect(() => {
    if (!shown) {
      setCounted(Math.max(0, streak - 1));
      return;
    }
    if (reduced) {
      setCounted(streak);
      return;
    }
    const id = setTimeout(() => setCounted(streak), COUNT_UP_DELAY_MS);
    return () => clearTimeout(id);
  }, [shown, streak, reduced]);

  const enter = (delay: number) => (reduced ? undefined : FadeInDown.delay(delay).duration(420));

  return (
    <View style={[styles.page, { height }]}>
      {shown ? (
        <>
          <Owiwi emotion="celebrate" size={180} showCopy onTap={() => setBurst((b) => b + 1)} />
          <Animated.View entering={enter(350)} style={styles.flame}>
            <StreakFlame value={counted} size="lg" highlight />
          </Animated.View>
          <Animated.Text entering={enter(550)} style={styles.streak}>
            {streak} day{streak === 1 ? '' : 's'} in a row
          </Animated.Text>
          <Animated.Text entering={enter(750)} style={styles.next}>
            {slot === 'morning' ? 'See you this evening.' : 'See you tomorrow.'}
          </Animated.Text>
          {onRegenerate ? (
            <Animated.View entering={enter(1100)}>
              <PressScale
                onPress={onRegenerate}
                accessibilityRole="button"
                accessibilityLabel="Check for fresh stories"
                hitSlop={{ left: 8, right: 8 }}
                scaleTo={0.95}
                style={styles.fresh}
              >
                <Animated.Text style={styles.freshText}>Check for fresh stories</Animated.Text>
              </PressScale>
            </Animated.View>
          ) : null}
          <Animated.Text entering={enter(1600)} style={styles.hint}>
            Tap Owiwi to celebrate again
          </Animated.Text>
        </>
      ) : null}
      <Confetti trigger={burst} originY={0.3} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  page: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  flame: { marginTop: space.lg },
  streak: { marginTop: space.sm, fontSize: 22, fontWeight: '800', color: t.colors.navy },
  next: { marginTop: space.sm, fontSize: 16, color: t.colors.textMuted },
  fresh: { marginTop: space.sm, minHeight: 44, justifyContent: 'center' },
  freshText: { fontSize: 14, fontWeight: '600', color: t.colors.indigo },
  hint: { marginTop: space.lg, fontSize: 13, color: t.colors.textFaint },
}));
