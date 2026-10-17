// Morning / Evening segmented control with a sliding pill. The non-active slot stays muted.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SLOT_LABEL } from '../digest/slot';
import { haptic } from '../lib/haptics';
import { colors, radius } from '../lib/theme';
import type { Slot } from '../llm/types';

const SLOTS: Slot[] = ['morning', 'evening'];
const PAD = 3;

interface Props {
  /** Slot being viewed. */
  value: Slot;
  /** Slot that is "now" (auto-generates); the other one is shown muted. */
  activeSlot: Slot;
  onChange: (slot: Slot) => void;
}

export function SlotSwitcher({ value, activeSlot, onChange }: Props) {
  const [segW, setSegW] = useState(0);
  const pos = useSharedValue(SLOTS.indexOf(value));
  // 1 when viewing the active slot; the pill dims when viewing the deprioritized one.
  const prominent = useSharedValue(value === activeSlot ? 1 : 0);

  useEffect(() => {
    pos.value = withSpring(SLOTS.indexOf(value), { damping: 16, stiffness: 220, mass: 0.7 });
    prominent.value = withTiming(value === activeSlot ? 1 : 0, { duration: 200 });
  }, [value, activeSlot, pos, prominent]);

  const pill = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: pos.value * segW }],
    backgroundColor: interpolateColor(prominent.value, [0, 1], ['#A5A5E6', colors.indigo]),
  }));

  return (
    <View style={styles.track} accessibilityRole="tablist" onLayout={(e) => setSegW((e.nativeEvent.layout.width - PAD * 2) / SLOTS.length)}>
      {segW > 0 ? <Animated.View style={[styles.pill, pill]} /> : null}
      {SLOTS.map((slot) => (
        <Segment
          key={slot}
          slot={slot}
          selected={slot === value}
          muted={slot !== activeSlot}
          onPress={() => {
            if (slot === value) return;
            haptic.select();
            onChange(slot);
          }}
        />
      ))}
    </View>
  );
}

function Segment({ slot, selected, muted, onPress }: { slot: Slot; selected: boolean; muted: boolean; onPress: () => void }) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 180 });
  }, [selected, on]);
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.navy, '#ffffff']),
    opacity: muted ? 0.45 + 0.4 * on.value : 1,
  }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${SLOT_LABEL[slot]}${muted ? '' : ', now'}`}
      style={styles.seg}
    >
      <Animated.Text style={[styles.segText, text]}>{SLOT_LABEL[slot]}</Animated.Text>
      {!muted ? <View style={[styles.nowDot, selected && styles.nowDotOn]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: PAD,
    alignSelf: 'center',
    width: 220,
  },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.pill },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, gap: 5 },
  segText: { fontWeight: '800', fontSize: 14 },
  nowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.beak },
  nowDotOn: { backgroundColor: '#fff' },
});
