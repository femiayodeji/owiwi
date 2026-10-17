import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import type { Card } from '../db/queries';
import { relativeTime } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { colors, radius, space } from '../lib/theme';
import { PressScale } from './PressScale';

interface Props {
  card: Card;
  height: number;
  index: number;
  total: number;
  /** True while this is the visible page; the card springs in each time it becomes active. */
  active: boolean;
}

const ENTER = { damping: 15, stiffness: 170, mass: 0.8 } as const;
// Reset after the outgoing swipe has settled, so the card never visibly shrinks while still on screen.
const RESET_DELAY = 400;

export function StoryCard({ card, height, active }: Props) {
  const reduced = useReducedMotion();
  const when = relativeTime(card.publishedAt);
  const meta = [card.source, when].filter(Boolean).join(' · ');

  const shown = useSharedValue(reduced ? 1 : 0);
  const chip = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    if (active) {
      shown.value = withSpring(1, ENTER);
      chip.value = withDelay(160, withSpring(1, { damping: 9, stiffness: 240 }));
    } else {
      shown.value = withDelay(RESET_DELAY, withTiming(0, { duration: 0 }));
      chip.value = withDelay(RESET_DELAY, withTiming(0, { duration: 0 }));
    }
  }, [active, reduced, shown, chip]);

  const cardStyle = useAnimatedStyle(() => ({
    // Partly visible even when inactive, so a dragged-in card is never blank.
    opacity: 0.45 + 0.55 * shown.value,
    transform: [{ translateY: 18 * (1 - shown.value) }, { scale: 0.92 + 0.08 * shown.value }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chip.value,
    transform: [{ scale: 0.6 + 0.4 * chip.value }],
  }));

  return (
    <View style={[styles.page, { height }]}>
      <Animated.View style={[styles.card, cardStyle]}>
        {card.topic ? (
          <Animated.View style={[styles.chip, chipStyle]}>
            <Text style={styles.chipText} numberOfLines={1}>
              {card.topic}
            </Text>
          </Animated.View>
        ) : null}
        {/* RSS/LLM text is untrusted: rendered strictly as plain Text. */}
        <Text style={styles.title} accessibilityRole="header">
          {card.title}
        </Text>
        <Text style={styles.summary}>{card.summary}</Text>
        <View style={styles.footer}>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          <PressScale
            accessibilityRole="link"
            accessibilityLabel={`Read more: ${card.title}`}
            hitSlop={10}
            scaleTo={0.9}
            dimTo={0.7}
            onPress={() => {
              haptic.tap();
              void WebBrowser.openBrowserAsync(card.url);
            }}
          >
            <Text style={styles.readMore}>Read more ↗</Text>
          </PressScale>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingVertical: space.md, justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEEAFD',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: space.md,
    maxWidth: '100%',
  },
  chipText: { color: colors.indigoDark, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.navy },
  summary: { fontSize: 17, lineHeight: 26, color: colors.text, marginTop: space.md },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.md },
  meta: { flex: 1, color: colors.textMuted, fontSize: 13 },
  readMore: { color: colors.indigo, fontSize: 14, fontWeight: '600' },
});
