// Animated streak counter: flickering flame + a number that rolls up and pops when it increases.
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { makeStyles } from '../lib/useTheme';

const SIZES = {
  sm: { font: 15, flame: 15, gap: 4 },
  lg: { font: 56, flame: 48, gap: 10 },
} as const;

const ROLL_UP = {
  sm: rollUp(10),
  lg: rollUp(36),
} as const;

function rollUp(distance: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: distance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.back(1.6)) },
  }).duration(320);
}

/** value: streak days. highlight: today is done (lit, flickering flame; dimmed otherwise). size: 'sm' top bar | 'lg' hero. */
export function StreakFlame({ value, highlight = false, size = 'sm' }: { value: number; highlight?: boolean; size?: 'sm' | 'lg' }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const dims = SIZES[size];
  const prev = useRef(value);
  const increased = value > prev.current;
  const pop = useSharedValue(1);
  const flick = useSharedValue(1);
  const sway = useSharedValue(0);

  useEffect(() => {
    if (value > prev.current && !reduced) {
      pop.value = withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 }));
    }
    prev.current = value;
  }, [value, reduced, pop]);

  useEffect(() => {
    cancelAnimation(flick);
    cancelAnimation(sway);
    flick.value = 1;
    sway.value = 0;
    if (highlight && !reduced) {
      flick.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 180 }), withTiming(0.96, { duration: 220 }), withTiming(1.04, { duration: 160 }), withTiming(1, { duration: 200 })),
        -1,
      );
      sway.value = withRepeat(withSequence(withTiming(4, { duration: 300 }), withTiming(-4, { duration: 300 })), -1, true);
    }
    return () => {
      cancelAnimation(flick);
      cancelAnimation(sway);
    };
  }, [highlight, reduced, flick, sway]);

  useEffect(() => () => cancelAnimation(pop), [pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }, { scale: flick.value }] }));

  return (
    <View style={[styles.row, { gap: dims.gap }]} accessibilityRole="text" accessibilityLabel={`${value} day streak`}>
      <Animated.View style={[{ transformOrigin: 'bottom', opacity: highlight ? 1 : 0.45 }, flameStyle]}>
        <Text style={{ fontSize: dims.flame, lineHeight: dims.flame * 1.25 }}>🔥</Text>
      </Animated.View>
      <Animated.View style={[styles.numWrap, popStyle]}>
        <Animated.Text
          key={value}
          entering={increased && !reduced ? ROLL_UP[size] : undefined}
          style={[styles.num, { fontSize: dims.font, lineHeight: dims.font * 1.2 }]}
        >
          {value}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  numWrap: { overflow: 'hidden' },
  num: { fontWeight: '800', color: t.colors.navy, fontVariant: ['tabular-nums'] },
}));
