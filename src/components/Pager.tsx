// Full-screen vertical pager: one card per page, swipe up for the next.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, View, type ListViewToken } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Card } from '../db/queries';
import type { Slot } from '../llm/types';
import { haptic } from '../lib/haptics';
import { space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/useTheme';
import { CompletionCard } from './CompletionCard';
import { StoryCard } from './StoryCard';

type Item = { kind: 'card'; card: Card } | { kind: 'done' };

interface Props {
  cards: Card[];
  slot: Slot;
  streak: number;
  /** Fires once when the last story card is reached (counts the streak). */
  onReachedEnd: () => void;
  /** Page to open on; cards.length is the completion card. Read once, on mount. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  onPullToRegenerate: () => void;
}

export function Pager({ cards, slot, streak, onReachedEnd, initialIndex = 0, onIndexChange, onPullToRegenerate }: Props) {
  const theme = useTheme();
  const [height, setHeight] = useState(0);
  const [startIndex] = useState(initialIndex);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [swiped, setSwiped] = useState(startIndex > 0);
  const items: Item[] = [...cards.map((card) => ({ kind: 'card' as const, card })), { kind: 'done' as const }];
  const firedEnd = useRef(false);
  const lastIndex = useRef(startIndex);

  // Must be stable for FlatList; read latest props via refs.
  const latest = useRef({ onReachedEnd, onIndexChange, total: cards.length });
  latest.current = { onReachedEnd, onIndexChange, total: cards.length };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null) return;
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      haptic.tap();
      setActiveIndex(index);
      setSwiped(true);
    }
    latest.current.onIndexChange?.(index);
    if (index >= latest.current.total - 1 && !firedEnd.current) {
      firedEnd.current = true;
      latest.current.onReachedEnd();
    }
  }).current;

  const getItemLayout = useCallback(
    (_: ArrayLike<Item> | null | undefined, index: number) => ({ length: height, offset: height * index, index }),
    [height],
  );

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <FlatList
          data={items}
          extraData={activeIndex}
          keyExtractor={(item) => (item.kind === 'card' ? item.card.id : 'done')}
          renderItem={({ item, index }) =>
            item.kind === 'card' ? (
              <StoryCard card={item.card} height={height} index={index} total={cards.length} active={index === activeIndex} />
            ) : (
              <CompletionCard height={height} slot={slot} streak={streak} active={index === activeIndex} />
            )
          }
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialScrollIndex={startIndex}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onPullToRegenerate} tintColor={theme.colors.indigo} colors={[theme.colors.indigo]} progressBackgroundColor={theme.colors.surface} />}
        />
      ) : null}
      {height > 0 && !swiped && cards.length > 1 ? <SwipeHint /> : null}
    </View>
  );
}

/** Bouncing "Swipe up" nudge on the first card; gone after the first swipe. */
function SwipeHint() {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withSequence(withTiming(-7, { duration: 420 }), withTiming(0, { duration: 420 })), -1);
  }, [reduced, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View entering={FadeIn.delay(1200).duration(400)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.hint}>
      <Animated.View style={[styles.hintInner, anim]}>
        <View style={styles.chevron} />
        <Text style={styles.hintText}>Swipe up</Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  hint: { position: 'absolute', left: 0, right: 0, bottom: space.sm, alignItems: 'center' },
  hintInner: { alignItems: 'center' },
  chevron: {
    width: 12,
    height: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: t.colors.indigo,
    borderTopLeftRadius: 2,
    transform: [{ rotate: '45deg' }],
    marginBottom: 2,
  },
  hintText: { color: t.colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
}));
