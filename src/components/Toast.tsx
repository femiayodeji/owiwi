// Lightweight info toast. Call showToast() from anywhere; <ToastHost /> is mounted once in app/_layout.tsx.
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { haptic } from '../lib/haptics';
import { radius, space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';

export type ToastKind = 'info' | 'warning';

interface ToastState {
  toast: { id: number; message: string; kind: ToastKind } | null;
  hide: () => void;
}

const HIDE_AFTER_MS = 2500;
let nextId = 1;

const useToast = create<ToastState>((set) => ({
  toast: null,
  hide: () => set({ toast: null }),
}));

export function showToast(message: string, kind: ToastKind = 'info') {
  if (kind === 'warning') haptic.warning();
  AccessibilityInfo.announceForAccessibility(message);
  useToast.setState({ toast: { id: nextId++, message, kind } });
}

export function ToastHost() {
  const styles = useStyles();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [toast, hide]);

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space.sm }]}>
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={SlideInUp.springify().damping(16)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.toast, toast.kind === 'warning' && styles.warning]}
        >
          <Pressable onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.row}>
            <View style={[styles.dot, toast.kind === 'warning' && styles.dotWarning]}>
              <Text style={styles.dotText}>{toast.kind === 'warning' ? '!' : 'i'}</Text>
            </View>
            <Text style={styles.text}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  host: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    alignSelf: 'stretch',
    maxWidth: 480,
    backgroundColor: t.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderBottomWidth: 3,
    borderBottomColor: t.colors.borderStrong,
    shadowColor: t.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  warning: { borderColor: t.colors.warning, borderBottomColor: t.colors.warning },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: space.md },
  dot: { width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.indigo, alignItems: 'center', justifyContent: 'center' },
  dotWarning: { backgroundColor: t.colors.warning },
  dotText: { color: t.colors.onPrimary, fontWeight: '900', fontSize: 14 },
  text: { flex: 1, fontSize: 15, color: t.colors.navy, fontWeight: '600', lineHeight: 20 },
}));
