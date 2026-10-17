// In-app replacements for native alerts: bottom sheet, action menu and confirm dialog.
// Built on a transparent Modal so they sit above navigation; Reanimated drives the motion.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '../lib/haptics';
import { colors, emotionBg, radius, space } from '../lib/theme';
import { Owiwi, type OwiwiEmotion } from './Owiwi';
import { PressScale } from './PressScale';
import { Button } from './ui';

const OPEN_SPRING = { damping: 22, stiffness: 260, mass: 0.9 } as const;
const POP_SPRING = { damping: 14, stiffness: 320, mass: 0.7 } as const;
const CLOSE_MS = 180;
const BACKDROP = 'rgba(30, 35, 66, 0.45)'; // navy, dimmed

/**
 * Keeps the Modal mounted while the close animation plays, then unmounts.
 * `onDismissed` fires once the overlay is fully gone (safe point to open another modal or navigate).
 */
function usePresence(visible: boolean, spring: typeof OPEN_SPRING | typeof POP_SPRING, onDismissed?: () => void) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const dismissedRef = useRef(onDismissed);
  dismissedRef.current = onDismissed;
  const shown = useRef(false);

  useEffect(() => {
    if (visible) {
      shown.current = true;
      setMounted(true);
      progress.value = reduced ? withTiming(1, { duration: 120 }) : withSpring(1, spring);
      return;
    }
    if (!shown.current) return; // never opened: nothing to dismiss
    shown.current = false;
    const finish = () => {
      setMounted(false);
      dismissedRef.current?.();
    };
    progress.value = withTiming(0, { duration: reduced ? 100 : CLOSE_MS, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(finish);
    });
  }, [visible, reduced, spring, progress]);

  return { mounted, progress };
}

function Backdrop({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, style]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityRole="button" accessibilityLabel="Close" />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------------------------

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  /** Internal: called after the close animation finishes. */
  onDismissed?: () => void;
}

/** Slides up from the bottom over a dimmed backdrop. Tap outside or press back to close. */
export function BottomSheet({ visible, onClose, title, children, onDismissed }: BottomSheetProps) {
  const { mounted, progress } = usePresence(visible, OPEN_SPRING, onDismissed);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const sheetStyle = useAnimatedStyle(() => ({
    // Clamp so the spring's overshoot never lifts the sheet off the bottom edge.
    transform: [{ translateY: Math.max(0, interpolate(progress.value, [0, 1], [height * 0.6, 0])) }],
  }));

  if (!mounted) return null;
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="none" visible onRequestClose={onClose}>
      <View style={styles.fill}>
        <Backdrop progress={progress} onPress={onClose} />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm }, sheetStyle]}
        >
          <View style={styles.handle} />
          {title ? (
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------

export interface SheetAction {
  key: string;
  label: string;
  description?: string;
  /** A short glyph for the menu row (not the mascot). */
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Menu of actions in a bottom sheet. The chosen action runs after the sheet has fully closed,
 * so it can safely open another modal or navigate.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  const pending = useRef<SheetAction | null>(null);

  const choose = (a: SheetAction) => {
    haptic.select();
    pending.current = a;
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      onDismissed={() => {
        const a = pending.current;
        pending.current = null;
        a?.onPress();
      }}
    >
      <View style={styles.menu}>
        {actions.map((a, i) => (
          <PressScale
            key={a.key}
            onPress={() => choose(a)}
            scaleTo={0.98}
            dimTo={0.6}
            accessibilityRole="menuitem"
            accessibilityLabel={a.label}
            accessibilityHint={a.description}
            style={[styles.item, i > 0 && styles.itemDivider]}
          >
            {a.icon ? (
              <View style={[styles.icon, a.destructive && styles.iconDanger]}>
                <Text style={[styles.iconText, a.destructive && { color: colors.danger }]}>{a.icon}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemLabel, a.destructive && { color: colors.danger }]}>{a.label}</Text>
              {a.description ? <Text style={styles.itemDesc}>{a.description}</Text> : null}
            </View>
          </PressScale>
        ))}
      </View>
      <View style={{ marginTop: space.md }}>
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------------------------

/** Centered confirm card that pops in. Backdrop tap and Android back count as cancel. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  emotion,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  emotion?: OwiwiEmotion;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { mounted, progress } = usePresence(visible, POP_SPRING);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));

  if (!mounted) return null;
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="none" visible onRequestClose={onCancel}>
      <View style={[styles.fill, styles.center]}>
        <Backdrop progress={progress} onPress={onCancel} />
        <Animated.View accessibilityViewIsModal style={[styles.dialog, cardStyle]}>
          {emotion ? (
            <View style={styles.owl}>
              <Owiwi emotion={emotion} size={96} />
            </View>
          ) : null}
          <Text style={styles.dialogTitle} accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <View style={styles.dialogActions}>
            <Button title={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} />
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  center: { justifyContent: 'center', alignItems: 'center', padding: space.lg },
  backdrop: { backgroundColor: BACKDROP },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.md },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm, marginLeft: 4 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: space.md, minHeight: 56 },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: emotionBg.thinking, alignItems: 'center', justifyContent: 'center' },
  iconDanger: { backgroundColor: emotionBg.sad },
  iconText: { fontSize: 17, color: colors.indigo, fontWeight: '700' },
  itemLabel: { fontSize: 16, fontWeight: '700', color: colors.navy },
  itemDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  dialog: {
    alignSelf: 'stretch',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 4,
    padding: space.lg,
    alignItems: 'stretch',
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  owl: { alignItems: 'center', marginBottom: space.sm },
  dialogTitle: { fontSize: 20, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  dialogMessage: { fontSize: 15, color: colors.textMuted, lineHeight: 21, textAlign: 'center', marginTop: space.sm },
  dialogActions: { marginTop: space.lg, gap: space.xs },
});
