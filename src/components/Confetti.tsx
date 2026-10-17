// Lightweight confetti burst. Physics runs in UI-thread worklets off a single progress value per piece.
// <Confetti trigger={n} /> bursts on mount when n > 0 and again every time n changes.
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../lib/useTheme';

// Sparkle colors from the brand sheet; the theme's indigo and beak orange are added per theme.
// All are mid/high-luminance so they read on light, paper and dark backgrounds alike.
const SPARKLES = ['#FFC93C', '#5FD068', '#3EC6D8', '#FF7AB6'] as const;
const GRAVITY = 1400; // px/s^2

interface Piece {
  color: string;
  w: number;
  h: number;
  vx: number; // px/s
  vy: number; // px/s, negative = up
  spin: number; // deg/s
  rot0: number;
  delay: number;
  duration: number;
}

interface Props {
  /** Change to replay the burst. 0 means "don't fire yet". */
  trigger: number;
  /** Burst origin as fractions of the overlay (default: center, 35% from top). */
  originX?: number;
  originY?: number;
  /** Number of pieces (default 40). */
  count?: number;
}

function makePieces(count: number, palette: readonly string[]): Piece[] {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    const angle = r(-Math.PI * 0.85, -Math.PI * 0.15); // upward fan
    const speed = r(420, 900);
    return {
      color: palette[i % palette.length] ?? SPARKLES[0],
      w: r(6, 10),
      h: r(10, 16),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: r(-720, 720),
      rot0: r(0, 360),
      delay: r(0, 90),
      duration: r(1400, 2000),
    };
  });
}

export function Confetti({ trigger, originX = 0.5, originY = 0.35, count = 40 }: Props) {
  const reduced = useReducedMotion();
  const { indigo, beak } = useTheme().colors;
  // New pieces (and fresh trajectories) for every trigger.
  const pieces = useMemo(
    () => (trigger > 0 ? makePieces(count, [indigo, beak, ...SPARKLES]) : []),
    // Theme changes don't replay a burst; colors are picked when it fires.
    [trigger, count],
  );
  if (reduced || pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: `${originX * 100}%`, top: `${originY * 100}%` }}>
        {pieces.map((p, i) => (
          <ConfettiPiece key={`${trigger}:${i}`} piece={p} />
        ))}
      </View>
    </View>
  );
}

const ConfettiPiece = memo(function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.linear }));
    return () => cancelAnimation(progress);
  }, [piece, progress]);

  const style = useAnimatedStyle(() => {
    const secs = (progress.value * piece.duration) / 1000;
    // Light air drag on x so pieces drift instead of flying off-screen.
    const x = piece.vx * secs * (1 - progress.value * 0.45);
    const y = piece.vy * secs + 0.5 * GRAVITY * secs * secs;
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${piece.rot0 + piece.spin * secs}deg` },
        // Fake 3D flutter: squash width as the piece tumbles.
        { scaleX: Math.cos(secs * 9 + piece.rot0) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.w, height: piece.h, marginLeft: -piece.w / 2, marginTop: -piece.h / 2, backgroundColor: piece.color },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  piece: { position: 'absolute', borderRadius: 2 },
});
