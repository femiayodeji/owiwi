// Duolingo-style rounded progress bar: springs to its new width, turns green with a pop when full.
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { makeStyles, useTheme } from '../lib/useTheme';

interface Props {
  /** 0..1 */
  progress: number;
  /** Green and popped when true. Defaults to progress >= 1. */
  complete?: boolean;
  /** Small caption to the right, e.g. "3 / 10". */
  label?: string;
  height?: number;
}

export function ProgressBar({ progress, complete, label, height = 14 }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const done = complete ?? p >= 1;
  const t = useTheme();
  const styles = useStyles();
  // Plain strings captured by the worklet below.
  const { indigo, success } = t.colors;

  const trackW = useSharedValue(0);
  const fill = useSharedValue(p);
  const green = useSharedValue(done ? 1 : 0);
  const pop = useSharedValue(1);
  const wasDone = useRef(done);

  useEffect(() => {
    fill.value = withSpring(p, { damping: 16, stiffness: 160 });
  }, [p, fill]);

  useEffect(() => {
    green.value = withTiming(done ? 1 : 0, { duration: 220 });
    if (done && !wasDone.current) {
      pop.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 220 }));
    }
    wasDone.current = done;
  }, [done, green, pop]);

  const fillStyle = useAnimatedStyle(() => {
    const w = trackW.value * fill.value;
    return {
      // Never narrower than a circle once started, so the rounded ends stay round.
      width: fill.value > 0.001 ? Math.max(w, height) : 0,
      backgroundColor: interpolateColor(green.value, [0, 1], [indigo, success]),
    };
  });
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: pop.value }, { scaleX: 1 + (pop.value - 1) * 0.15 }] }));

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[styles.track, { height, borderRadius: height / 2 }, barStyle]}
        onLayout={(e) => {
          trackW.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
          <View style={[styles.shine, { height: Math.max(3, height * 0.28), borderRadius: height / 2, top: height * 0.2 }]} />
        </Animated.View>
      </Animated.View>
      {label ? <Text style={[styles.label, done && styles.labelDone]}>{label}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, backgroundColor: t.colors.border, overflow: 'hidden' },
  fill: { height: '100%' },
  shine: { position: 'absolute', left: 6, right: 6, backgroundColor: t.colors.onPrimary, opacity: 0.35 },
  labelDone: { color: t.colors.success },
  label: { minWidth: 44, textAlign: 'right', color: t.colors.textMuted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
}));
