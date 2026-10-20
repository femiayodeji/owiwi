// Minimal toast: a small inverted pill near the bottom of the screen. Call showToast() from anywhere; <ToastHost /> is mounted once in app/_layout.tsx.
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { haptic } from '../lib/haptics';
import { space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';

export type ToastKind = 'info' | 'warning';

/** Optional inline action, e.g. Undo. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  toast: { id: number; message: string; kind: ToastKind; action?: ToastAction } | null;
  hide: () => void;
}

const HIDE_AFTER_MS = 2000;
// Give people time to reach an action like Undo.
const HIDE_WITH_ACTION_MS = 4000;
let nextId = 1;
/**
 * Distance above the bottom safe-area inset. Anchored low so the feed's top bar stays usable,
 * and high enough to clear a full-height story card's Save / Share / Read more row
 * (card padding + page padding + the row itself).
 */
const BOTTOM_OFFSET = 72;

const useToast = create<ToastState>((set) => ({
  toast: null,
  hide: () => set({ toast: null }),
}));

export function showToast(message: string, kind: ToastKind = 'info', action?: ToastAction) {
  if (kind === 'warning') haptic.warning();
  AccessibilityInfo.announceForAccessibility(message);
  useToast.setState({ toast: { id: nextId++, message, kind, action } });
}

export function ToastHost() {
  const styles = useStyles();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, toast.action ? HIDE_WITH_ACTION_MS : HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [toast, hide]);

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + BOTTOM_OFFSET }]}>
      {toast ? (
        <Animated.View key={toast.id} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.pill}>
          <Pressable onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.row}>
            <Text style={styles.text}>{toast.message}</Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.action.label}
                hitSlop={12}
                onPress={() => {
                  const run = toast.action?.onPress;
                  hide();
                  haptic.tap();
                  run?.();
                }}
              >
                <Text style={styles.action}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// Inverted colours (navy is the theme's text colour, bg its background) so the pill reads in every theme.
const useStyles = makeStyles((t) => ({
  host: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  pill: { maxWidth: 420, backgroundColor: t.colors.navy, borderRadius: 999, elevation: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: 18 },
  text: { flexShrink: 1, fontSize: 14, color: t.colors.bg, fontWeight: '500' },
  action: { fontSize: 14, color: t.colors.bg, fontWeight: '800' },
}));
