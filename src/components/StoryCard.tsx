import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import type { Card } from '../db/queries';
import { relativeTime } from '../lib/dates';
import { radius, space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';
import { useBookmarks } from '../store/bookmarks';
import { StoryActionBar } from './StoryActions';

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
  const styles = useStyles();
  const reduced = useReducedMotion();
  const when = relativeTime(card.publishedAt);
  const meta = [card.source, when].filter(Boolean).join(' · ');

  const shown = useSharedValue(reduced ? 1 : 0);
  const chip = useSharedValue(reduced ? 1 : 0);

  // Bookmarked urls load once per process so the Save state is right on first paint.
  useEffect(() => {
    void useBookmarks.getState().ensureLoaded();
  }, []);

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
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <StoryActionBar story={card} />
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => {
  const font = t.type.readingFont ? { fontFamily: t.type.readingFont } : {};
  const scale = t.type.readingScale;
  return {
    page: { paddingHorizontal: space.md, paddingVertical: space.md, justifyContent: 'center' },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      borderWidth: 2,
      borderColor: t.colors.border,
      borderBottomWidth: 5,
      borderBottomColor: t.colors.borderStrong,
      shadowColor: t.colors.shadow,
      shadowOpacity: t.dark ? 0.35 : 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: t.colors.chipBg,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radius.pill,
      marginBottom: space.md,
      maxWidth: '100%',
    },
    chipText: { color: t.colors.chipText, fontWeight: '700', fontSize: 13 },
    title: { ...font, fontSize: 26 * scale, lineHeight: Math.round(32 * scale), fontWeight: '800', color: t.colors.navy },
    summary: {
      ...font,
      fontSize: 17 * scale,
      lineHeight: Math.round(26 * scale * t.type.readingLeading),
      color: t.colors.text,
      marginTop: space.md,
    },
    footer: { marginTop: space.lg, gap: space.sm },
    meta: { color: t.colors.textMuted, fontSize: 13 },
  } as const;
});
