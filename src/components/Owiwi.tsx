// The mascot. Keep this API stable: the Rive upgrade should only replace this file.
// The art is one static image per emotion; we only animate the whole image (never redraw it).
import { useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  Keyframe,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { haptic } from '../lib/haptics';
import { colors, emotionBg, radius } from '../lib/theme';
import { OWIWI_ART, OWIWI_COPY, type OwiwiEmotion } from './owiwiAssets';

export type { OwiwiEmotion } from './owiwiAssets';
export { OWIWI_COPY } from './owiwiAssets';

interface Props {
  emotion: OwiwiEmotion;
  size?: number;
  /** Show the brand copy line under the owl. */
  showCopy?: boolean;
  /** Override the brand copy. */
  caption?: string;
  /** Optional: called on every tap of the owl (after its own reaction). */
  onTap?: () => void;
}

let warnedMissing = false;

const ease = Easing.inOut(Easing.sin);
const up = Easing.out(Easing.quad);
const down = Easing.in(Easing.quad);
const t = (toValue: number, duration: number, easing = ease) => withTiming(toValue, { duration, easing });
const rebound = { damping: 7, stiffness: 260, mass: 0.6 };

// Emotion change: new art springs in from 0.6 with overshoot, old one shrinks out.
const POP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  50: { opacity: 1, transform: [{ scale: 1.12 }], easing: Easing.out(Easing.quad) },
  78: { opacity: 1, transform: [{ scale: 0.95 }], easing: Easing.inOut(Easing.quad) },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.quad) },
}).duration(440);
const POP_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.7 }], easing: Easing.in(Easing.quad) },
}).duration(160);

const TAP_WINDOW_MS = 2000;
const TAP_BURST = 5;

export function Owiwi({ emotion, size = 160, showCopy = false, caption, onTap }: Props) {
  const reduced = useReducedMotion();

  // Idle loop (per emotion) and tap reactions are separate layers, combined in the style.
  const loopY = useSharedValue(0);
  const loopRot = useSharedValue(0);
  const loopSX = useSharedValue(1);
  const loopSY = useSharedValue(1);
  const tapY = useSharedValue(0);
  const tapRot = useSharedValue(0);
  const tapSX = useSharedValue(1);
  const tapSY = useSharedValue(1);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    const loop = [loopY, loopRot, loopSX, loopSY];
    const stop = () => loop.forEach((v) => cancelAnimation(v));
    stop();
    loopY.value = 0;
    loopRot.value = 0;
    loopSX.value = 1;
    loopSY.value = 1;
    if (!reduced) startLoop(emotion, loopY, loopRot, loopSX, loopSY);
    return stop;
  }, [emotion, reduced, loopY, loopRot, loopSX, loopSY]);

  useEffect(() => {
    const tap = [tapY, tapRot, tapSX, tapSY];
    return () => tap.forEach((v) => cancelAnimation(v));
  }, [tapY, tapRot, tapSX, tapSY]);

  const onPress = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter((ts) => now - ts < TAP_WINDOW_MS), now];
    const burst = taps.current.length >= TAP_BURST;
    if (burst) {
      taps.current = [];
      haptic.success();
    } else {
      haptic.tap();
    }
    onTap?.();
    if (reduced) return;

    // Squish, then springy rebound.
    tapSY.value = withSequence(t(0.85, 90, up), withSpring(1, rebound));
    tapSX.value = withSequence(t(1.12, 90, up), withSpring(1, rebound));

    if (burst) {
      // Easter egg: extra-happy jump with a full spin and wiggle.
      tapY.value = withSequence(withDelay(90, t(-size * 0.45, 320, up)), t(0, 300, down), withSpring(0, rebound));
      tapRot.value = withSequence(withDelay(90, t(360, 560, Easing.out(Easing.cubic))), t(360 - 10, 80), t(360 + 8, 80), t(360, 80), t(0, 0));
      return;
    }
    const pick = Math.random();
    if (pick < 0.45) {
      // Little hop.
      tapY.value = withSequence(withDelay(90, t(-size * 0.16, 200, up)), t(0, 220, down));
    } else if (pick < 0.8) {
      // Wiggle.
      tapRot.value = withSequence(withDelay(90, t(12, 90)), t(-10, 110), t(7, 100), t(-4, 90), t(0, 80));
    } else {
      // Spin with a small hop.
      tapY.value = withSequence(withDelay(90, t(-size * 0.12, 240, up)), t(0, 240, down));
      tapRot.value = withSequence(withDelay(90, t(360, 480, Easing.out(Easing.cubic))), t(0, 0));
    }
  }, [onTap, reduced, size, tapY, tapRot, tapSX, tapSY]);

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: loopY.value + tapY.value },
      { rotate: `${loopRot.value + tapRot.value}deg` },
      { scaleX: loopSX.value * tapSX.value },
      { scaleY: loopSY.value * tapSY.value },
    ],
  }));

  // Ground shadow shrinks and fades as the owl leaves the ground.
  const shadow = useAnimatedStyle(() => {
    const lift = Math.max(0, -(loopY.value + tapY.value)) / size;
    return {
      opacity: interpolate(lift, [0, 0.4], [1, 0.35], 'clamp'),
      transform: [{ scaleX: interpolate(lift, [0, 0.4], [1, 0.55], 'clamp') }, { scaleY: interpolate(lift, [0, 0.4], [1, 0.7], 'clamp') }],
    };
  });

  const art = OWIWI_ART[emotion];
  if (!art && __DEV__ && !warnedMissing) {
    warnedMissing = true;
    console.warn('[Owiwi] state artwork missing in assets/owiwi/: showing placeholders.');
  }

  const shadowW = size * 0.42;
  const shadowH = size * 0.07;
  const label = art ? `Owiwi ${emotion}` : `Owiwi ${emotion} (placeholder)`;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={label} hitSlop={8}>
        <View style={{ width: size, height: size + shadowH * 0.5 }}>
          <Animated.View
            style={[
              styles.shadow,
              { width: shadowW, height: shadowH, borderRadius: shadowH, left: (size - shadowW) / 2, top: size * 0.97 - shadowH / 2 },
              shadow,
            ]}
          />
          <Animated.View style={[{ width: size, height: size, transformOrigin: 'bottom' }, body]}>
            {/* Keyed so a state change pops the new art in. */}
            <Animated.View
              key={emotion}
              entering={reduced ? undefined : POP_IN}
              exiting={reduced ? undefined : POP_OUT}
              style={StyleSheet.absoluteFill}
            >
              {art ? (
                <Image source={art} style={{ width: size, height: size }} resizeMode="contain" />
              ) : (
                <View style={[styles.placeholder, { backgroundColor: emotionBg[emotion], borderRadius: size / 4 }]}>
                  <Text style={styles.phTitle}>Owiwi</Text>
                  <Text style={styles.phState}>{emotion}</Text>
                  <Text style={styles.phNote}>PLACEHOLDER{'\n'}art missing</Text>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </View>
      </Pressable>
      {showCopy ? (
        <Animated.Text
          key={`${emotion}:${caption ?? ''}`}
          entering={reduced ? undefined : FadeInDown.delay(260).duration(360)}
          style={styles.copy}
        >
          {caption ?? OWIWI_COPY[emotion]}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/** Starts the looping "alive" motion for an emotion. Values are already reset to rest. */
function startLoop(
  emotion: OwiwiEmotion,
  y: SharedValue<number>,
  rot: SharedValue<number>,
  sx: SharedValue<number>,
  sy: SharedValue<number>,
) {
  switch (emotion) {
    case 'idle':
      // Gentle breathing.
      sy.value = withRepeat(withSequence(t(1.025, 1500), t(1, 1500)), -1);
      sx.value = withRepeat(withSequence(t(0.985, 1500), t(1, 1500)), -1);
      return;
    case 'happy':
      // Little hops, stretch in the air, squash on landing. All four tracks are 1530ms so they stay in sync.
      y.value = withRepeat(withSequence(withDelay(900, t(-16, 180, up)), t(0, 200, down), t(0, 90), t(0, 160)), -1);
      sy.value = withRepeat(withSequence(withDelay(900, t(1.06, 180, up)), t(1, 200, down), t(0.9, 90, up), t(1, 160)), -1);
      sx.value = withRepeat(withSequence(withDelay(900, t(0.96, 180, up)), t(1, 200, down), t(1.1, 90, up), t(1, 160)), -1);
      return;
    case 'thinking':
      // Slow head-tilt rock plus a float.
      rot.value = withRepeat(withSequence(t(4, 1600), t(-4, 1600)), -1);
      y.value = withRepeat(t(-6, 1800), -1, true);
      return;
    case 'celebrate': {
      // Three big jumps with a wiggle (900ms per jump), then a bouncy idle (1100ms).
      const jumps = 3;
      y.value = withSequence(
        withRepeat(withSequence(t(-42, 260, up), t(0, 240, down), t(0, 100), t(0, 300)), jumps),
        withRepeat(withSequence(t(-8, 300, up), t(0, 300, down), t(0, 500)), -1),
      );
      sy.value = withSequence(
        withRepeat(withSequence(t(1.08, 260, up), t(1, 240, down), t(0.86, 100, up), t(1, 300, Easing.out(Easing.back(2)))), jumps),
        withRepeat(withSequence(t(1.03, 300, up), t(1, 300, down), t(0.95, 120, up), t(1, 380)), -1),
      );
      sx.value = withSequence(
        withRepeat(withSequence(t(0.94, 260, up), t(1, 240, down), t(1.12, 100, up), t(1, 300, Easing.out(Easing.back(2)))), jumps),
        withRepeat(withSequence(t(0.98, 300, up), t(1, 300, down), t(1.05, 120, up), t(1, 380)), -1),
      );
      rot.value = withRepeat(withSequence(t(8, 130), t(-8, 130), t(6, 120), t(-4, 120), t(0, 100), t(0, 300)), jumps);
      return;
    }
    case 'sad':
      // Droop and lean once, then barely breathe.
      y.value = t(6, 900);
      rot.value = t(-3, 900);
      sy.value = withDelay(900, withRepeat(withSequence(t(0.985, 2200), t(1, 2200)), -1));
      return;
    case 'sleepy':
      // Very slow, deep breathing with a slight sway.
      sy.value = withRepeat(withSequence(t(1.04, 2600), t(1, 2600)), -1);
      sx.value = withRepeat(withSequence(t(0.98, 2600), t(1, 2600)), -1);
      rot.value = withRepeat(withSequence(t(2, 2600), t(-1, 2600)), -1);
      return;
  }
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  shadow: { position: 'absolute', backgroundColor: 'rgba(30, 35, 66, 0.14)' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.indigo,
  },
  phTitle: { color: colors.indigo, fontWeight: '800', fontSize: 18 },
  phState: { color: colors.navy, fontWeight: '600', marginTop: 2 },
  phNote: { color: colors.danger, fontSize: 10, fontWeight: '700', marginTop: 6, textAlign: 'center', letterSpacing: 0.5 },
  copy: { marginTop: 14, color: colors.textMuted, fontSize: 15, textAlign: 'center', maxWidth: 280, borderRadius: radius.sm },
});
