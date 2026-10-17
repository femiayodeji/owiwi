// On-brand select: a field-style trigger that opens a bottom sheet of options.
// Self-contained (own Modal + Reanimated spring). Optional "Custom…" row switches to free text.
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../lib/haptics';
import { colors, radius, space } from '../lib/theme';
import { PressScale } from './PressScale';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
}

interface Props<T extends string> {
  label: string;
  /** Selected value. With `allowCustom`, a value not in `options` shows as custom text. */
  value: T | string;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Sheet title; defaults to `label`. */
  title?: string;
  hint?: string;
  disabled?: boolean;
  /** Adds a final "Custom…" row that switches the field to a text input. */
  allowCustom?: boolean;
  /** Receives free text typed in custom mode. Required for custom mode to be useful. */
  onChangeCustom?: (text: string) => void;
  customPlaceholder?: string;
  /** Start in custom mode (e.g. a saved value that isn't in the list). */
  initialCustom?: boolean;
}

const SPRING = { damping: 22, stiffness: 260, mass: 0.9 } as const;
const CLOSE_MS = 180;

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  title,
  hint,
  disabled,
  allowCustom,
  onChangeCustom,
  customPlaceholder,
  initialCustom,
}: Props<T>) {
  const selected = options.find((o) => o.value === value);
  const [custom, setCustom] = useState(!!allowCustom && (!!initialCustom || (!selected && value !== '')));
  const [open, setOpen] = useState(false);

  // A parent can push a listed value (e.g. preset change resets the model) — leave custom mode then.
  // Ignore values the user typed here, so typing a listed ID doesn't yank them out of the input.
  const typed = useRef<string | null>(null);
  const selectedValue = selected?.value;
  useEffect(() => {
    if (selectedValue !== undefined && selectedValue !== typed.current) setCustom(false);
    else if (allowCustom && initialCustom) setCustom(true);
  }, [selectedValue, allowCustom, initialCustom]);

  const pick = (v: T) => {
    haptic.select();
    typed.current = null;
    setCustom(false);
    onChange(v);
    setOpen(false);
  };

  const goCustom = () => {
    haptic.select();
    setCustom(true);
    setOpen(false);
  };

  if (custom) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={(t) => {
            typed.current = t;
            onChangeCustom?.(t);
          }}
          placeholder={customPlaceholder ?? 'Type a value'}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          accessibilityLabel={`${label}, custom value`}
          style={styles.input}
        />
        {options.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic.select();
              setOpen(true);
            }}
            hitSlop={8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>Choose from list</Text>
          </Pressable>
        ) : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <OptionSheet
          open={open}
          title={title ?? label}
          options={options}
          value={value}
          customActive
          allowCustom={allowCustom}
          onPick={pick}
          onCustom={goCustom}
          onClose={() => setOpen(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? (value || 'Not set') }}
        accessibilityHint="Opens a list of choices"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        scaleTo={0.985}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.triggerTop}>
            <Text style={styles.value} numberOfLines={1}>
              {selected?.label ?? (value || 'Choose…')}
            </Text>
            {selected?.badge ? <Badge text={selected.badge} /> : null}
          </View>
          {selected?.description ? (
            <Text style={styles.secondary} numberOfLines={1}>
              {selected.description}
            </Text>
          ) : null}
        </View>
        {!disabled ? <Text style={styles.chevron}>⌄</Text> : null}
      </PressScale>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <OptionSheet
        open={open}
        title={title ?? label}
        options={options}
        value={value}
        allowCustom={allowCustom}
        onPick={pick}
        onCustom={goCustom}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function OptionSheet<T extends string>({
  open,
  title,
  options,
  value,
  allowCustom,
  customActive,
  onPick,
  onCustom,
  onClose,
}: {
  open: boolean;
  title: string;
  options: readonly DropdownOption<T>[];
  value: string;
  allowCustom?: boolean;
  customActive?: boolean;
  onPick: (v: T) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = reduceMotion ? withTiming(1, { duration: 120 }) : withSpring(1, SPRING);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: reduceMotion ? 100 : CLOSE_MS }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
  }, [open, mounted, reduceMotion, progress]);

  // Android back closes the sheet (Modal's onRequestClose covers it too; this keeps it explicit).
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * 400 }],
    opacity: reduceMotion ? progress.value : 1,
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.75, paddingBottom: insets.bottom + space.md }, sheet]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView accessibilityRole="menu" bounces={false} keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const isOn = !customActive && o.value === value;
              return (
                <PressScale
                  key={o.value}
                  accessibilityRole="menuitem"
                  accessibilityLabel={o.badge ? `${o.label}, ${o.badge}` : o.label}
                  accessibilityHint={o.description}
                  accessibilityState={{ selected: isOn, checked: isOn }}
                  onPress={() => onPick(o.value)}
                  scaleTo={0.985}
                  dimTo={0.7}
                  style={[styles.option, isOn && styles.optionOn]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.triggerTop}>
                      <Text style={[styles.optionLabel, isOn && styles.optionLabelOn]}>{o.label}</Text>
                      {o.badge ? <Badge text={o.badge} /> : null}
                    </View>
                    {o.description ? <Text style={styles.secondary}>{o.description}</Text> : null}
                  </View>
                  <Text style={styles.check}>{isOn ? '✓' : ''}</Text>
                </PressScale>
              );
            })}
            {allowCustom ? (
              <PressScale
                accessibilityRole="menuitem"
                accessibilityLabel="Custom value"
                accessibilityState={{ selected: !!customActive, checked: !!customActive }}
                onPress={onCustom}
                scaleTo={0.985}
                dimTo={0.7}
                style={[styles.option, customActive && styles.optionOn]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, customActive && styles.optionLabelOn]}>Custom…</Text>
                  <Text style={styles.secondary}>Type your own value</Text>
                </View>
                <Text style={styles.check}>{customActive ? '✓' : ''}</Text>
              </PressScale>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 4 },
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
  backLink: { alignSelf: 'flex-start', marginTop: 6 },
  backLinkText: { fontSize: 13, fontWeight: '700', color: colors.indigo },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 50,
  },
  triggerDisabled: { backgroundColor: colors.bg },
  triggerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  value: { fontSize: 16, color: colors.text, fontWeight: '600', flexShrink: 1 },
  secondary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.indigo, fontWeight: '800', marginLeft: space.sm, marginTop: -8 },
  badge: { backgroundColor: colors.indigo, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  backdrop: { backgroundColor: 'rgba(30, 35, 66, 0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.navy, marginBottom: space.sm, paddingHorizontal: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    minHeight: 52,
    marginBottom: 2,
  },
  optionOn: { backgroundColor: colors.bg },
  optionLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  optionLabelOn: { color: colors.indigo, fontWeight: '700' },
  check: { width: 24, textAlign: 'right', color: colors.indigo, fontSize: 18, fontWeight: '800' },
});
