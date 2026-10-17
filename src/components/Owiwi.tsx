// The mascot. Keep this API stable: the Rive upgrade should only replace this file.
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
}

let warnedMissing = false;

export function Owiwi({ emotion, size = 160, showCopy = false, caption }: Props) {
  const lift = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(lift);
    lift.value = 0;
    if (emotion === 'thinking' || emotion === 'sleepy') {
      lift.value = withRepeat(withTiming(-6, { duration: 900 }), -1, true);
    } else if (emotion === 'celebrate' || emotion === 'happy') {
      lift.value = withSequence(withTiming(-18, { duration: 180 }), withTiming(0, { duration: 260 }));
    }
  }, [emotion, lift]);

  const bounce = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const art = OWIWI_ART[emotion];

  if (!art && __DEV__ && !warnedMissing) {
    warnedMissing = true;
    console.warn('[Owiwi] state artwork missing in assets/owiwi/: showing placeholders.');
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[{ width: size, height: size }, bounce]}>
        {/* Keyed so a state change crossfades. */}
        <Animated.View key={emotion} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
          {art ? (
            <Image source={art} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={`Owiwi ${emotion}`} />
          ) : (
            <View
              style={[styles.placeholder, { backgroundColor: emotionBg[emotion], borderRadius: size / 4 }]}
              accessibilityLabel={`Owiwi ${emotion} (placeholder)`}
            >
              <Text style={styles.phTitle}>Owiwi</Text>
              <Text style={styles.phState}>{emotion}</Text>
              <Text style={styles.phNote}>PLACEHOLDER{'\n'}art missing</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
      {showCopy ? <Text style={styles.copy}>{caption ?? OWIWI_COPY[emotion]}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
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
