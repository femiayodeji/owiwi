// Small shared UI primitives.
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '../lib/haptics';
import { colors, radius, space } from '../lib/theme';
import { formatTime, parseTime } from '../lib/dates';
import { PRESS_SPRING, PressScale } from './PressScale';

const LIP = 4;

const FACE = {
  primary: { face: colors.indigo, lip: colors.indigoDark, border: colors.indigo, text: '#fff' },
  secondary: { face: colors.surface, lip: colors.border, border: colors.border, text: colors.indigo },
  danger: { face: colors.surface, lip: colors.danger, border: colors.danger, text: colors.danger },
  ghost: { face: 'transparent', lip: 'transparent', border: 'transparent', text: colors.indigo },
} as const;

/** Chunky 3D button: the face sits on a darker lip and presses down onto it. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  const flat = variant === 'ghost';
  const c = FACE[variant];
  // Disabled buttons rest flat where a pressed face sits, so the layout height never changes.
  const muted = !!disabled && !flat;
  const pressed = useSharedValue(0);
  const faceAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: flat ? 0 : muted ? LIP : LIP * pressed.value }, { scale: 1 - 0.02 * pressed.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      disabled={off}
      style={!flat ? { paddingBottom: LIP } : undefined}
    >
      {!flat && !muted ? <View style={[styles.btnLip, { backgroundColor: c.lip }]} /> : null}
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: c.face, borderColor: c.border },
          muted && styles.btnDisabled,
          flat && disabled && { opacity: 0.45 },
          faceAnim,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.indigo} />
        ) : (
          <Text style={[styles.btnText, { color: muted ? colors.textFaint : c.text }]}>{title}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textFaint} {...input} style={[styles.input, input.style]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ title, subtitle, right, onPress }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void }) {
  return (
    <PressScale onPress={onPress} disabled={!onPress} scaleTo={onPress ? 0.985 : 1} dimTo={onPress ? 0.7 : 1} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </PressScale>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.select();
            onChange(v);
          }}
          trackColor={{ true: colors.indigo }}
        />
      }
    />
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** HH:MM stepper in 15-minute increments (no native picker dependency). */
export function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const step = (delta: number) => {
    const t = parseTime(value) ?? { hours: 7, minutes: 0 };
    const total = (((t.hours * 60 + t.minutes + delta) % 1440) + 1440) % 1440;
    onChange(formatTime(`${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`));
  };
  return (
    <Row
      title={label}
      right={
        <View style={styles.stepper}>
          <Stepper label="−" onPress={() => step(-15)} a11y={`Earlier ${label}`} />
          <StepValue text={formatTime(value)} />
          <Stepper label="+" onPress={() => step(15)} a11y={`Later ${label}`} />
        </View>
      }
    />
  );
}

export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <Row
      title={label}
      right={
        <View style={styles.stepper}>
          <Stepper label="−" onPress={() => onChange(Math.max(min, value - 1))} a11y={`Fewer ${label}`} />
          <StepValue text={String(value)} />
          <Stepper label="+" onPress={() => onChange(Math.min(max, value + 1))} a11y={`More ${label}`} />
        </View>
      }
    />
  );
}

function Stepper({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      hitSlop={8}
      scaleTo={0.82}
      style={styles.stepBtn}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </PressScale>
  );
}

/** Stepper value that pops whenever it changes. */
function StepValue({ text }: { text: string }) {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.value = withSequence(withTiming(1.18, { duration: 70 }), withSpring(1, { damping: 10, stiffness: 300 }));
  }, [text, pop]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return <Animated.Text style={[styles.stepValue, anim]}>{text}</Animated.Text>;
}

/** Pill chip: pops on press, springs between off and selected colors. */
export function Chip({ label, selected, onPress, muted }: { label: string; selected?: boolean; onPress?: () => void; muted?: boolean }) {
  const on = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);
  const pressed = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 180 });
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected) pop.value = withSequence(withTiming(1.1, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 }));
  }, [selected, on, pop]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.surface, colors.indigo]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.indigo]),
    transform: [{ scale: pop.value * (1 - 0.1 * pressed.value) }],
  }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [colors.navy, '#ffffff']) }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      disabled={!onPress}
    >
      <Animated.View style={[styles.chip, muted && styles.chipMuted, box]}>
        <Animated.Text style={[styles.chipText, text]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xl * 2 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.navy },
  h2: { fontSize: 20, fontWeight: '700', color: colors.navy },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
});

const styles = StyleSheet.create({
  btnLip: { position: 'absolute', left: 0, right: 0, top: LIP, bottom: 0, borderRadius: radius.pill },
  btn: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnDisabled: { backgroundColor: colors.border, borderColor: colors.border },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  field: { marginBottom: space.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.md, minHeight: 56 },
  rowTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textFaint },
  section: { marginBottom: space.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  sectionBody: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: colors.indigo, fontWeight: '700' },
  stepValue: { fontSize: 17, fontWeight: '700', color: colors.navy, minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipMuted: { opacity: 0.5 },
  chipText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
});
