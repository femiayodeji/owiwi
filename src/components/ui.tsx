// Small shared UI primitives.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space } from '../lib/theme';
import { formatTime, parseTime } from '../lib/dates';

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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.btn, styles[variant], off && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.indigo} />
      ) : (
        <Text style={[styles.btnText, variant !== 'primary' && styles.btnTextAlt, variant === 'danger' && { color: colors.danger }]}>
          {title}
        </Text>
      )}
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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Row title={title} subtitle={subtitle} right={<Switch value={value} onValueChange={onChange} trackColor={{ true: colors.indigo }} />} />;
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
          <Text style={styles.stepValue}>{formatTime(value)}</Text>
          <Stepper label="+" onPress={() => step(15)} a11y={`Later ${label}`} />
        </View>
      }
    />
  );
}

export function NumberStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Row
      title={label}
      right={
        <View style={styles.stepper}>
          <Stepper label="−" onPress={() => onChange(Math.max(min, value - 1))} a11y={`Fewer ${label}`} />
          <Text style={styles.stepValue}>{value}</Text>
          <Stepper label="+" onPress={() => onChange(Math.min(max, value + 1))} a11y={`More ${label}`} />
        </View>
      }
    />
  );
}

function Stepper({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable accessibilityLabel={a11y} onPress={onPress} hitSlop={8} style={styles.stepBtn}>
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, muted }: { label: string; selected?: boolean; onPress?: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.chip, selected && styles.chipOn, muted && styles.chipMuted]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
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
  btn: { minHeight: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primary: { backgroundColor: colors.indigo },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnTextAlt: { color: colors.indigo },
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
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  sectionBody: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: colors.indigo, fontWeight: '700' },
  stepValue: { fontSize: 17, fontWeight: '700', color: colors.navy, minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  chipMuted: { opacity: 0.5 },
  chipText: { color: colors.navy, fontWeight: '600', fontSize: 14 },
  chipTextOn: { color: '#fff' },
});
